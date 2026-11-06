const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify([], null, 2));
  }
}

function readNotes() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(NOTES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeNotes(notes) {
  ensureStorage();
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

function createId() {
  return `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeNote(raw) {
  return {
    id: raw.id || createId(),
    title: raw.title || 'Untitled note',
    content: raw.content || '',
    attachmentName: raw.attachmentName || '',
    attachmentData: raw.attachmentData || '',
    profile: raw.profile || {
      audience: 'a curious beginner',
      style: 'clear, encouraging, and practical'
    },
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function fallbackExpansion({ title, content, profile, imageName }) {
  const audience = profile?.audience || 'a curious beginner';
  const style = profile?.style || 'clear, encouraging, and practical';
  const trimmed = (content || '').trim();

  const summary = trimmed
    ? `Here is a clearer version of your notes for ${audience}, written in a ${style} way:\n\n${trimmed}\n\nKey idea:\n- Break the main concept into a simple takeaway.\n- Add one concrete example.\n- Connect it to a real-world application.\n\nQuick recap:\n1. What is the central idea?\n2. What example makes it easier to remember?\n3. What should you review again before your next lesson?`
    : `Your note is still empty. Start writing a key idea, fact, or question, then use this feature again. A good note often includes a summary, one example, and a question you still have.`;

  const imageNote = imageName
    ? `\n\nI also noticed an attached image: ${imageName}. Use that visual as a reference when explaining the concept, and connect it back to the text you wrote.`
    : '';

  return `${summary}${imageNote}`;
}

function getMediaType(fileName = '') {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function callClaude({ title, content, profile, imageData, imageName }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return fallbackExpansion({ title, content, profile, imageName });
  }

  const anthropic = new Anthropic({ apiKey });

  const contentParts = [
    {
      type: 'text',
      text: `You are a helpful teaching assistant. Expand and clarify the learner's notes for ${profile.audience || 'a curious beginner'} using a ${profile.style || 'clear, encouraging, and practical'} teaching style.\n\nInstructions:\n- Preserve the original meaning.\n- Simplify dense ideas without losing accuracy.\n- Add one helpful example or analogy.\n- End with a short recap and 2-3 questions to check understanding.\n- If the learner included a visual, connect the visual to the written content.\n\nNote title: ${title || 'Untitled note'}\n\nNote content:\n${content || 'No content written yet.'}`
    }
  ];

  if (imageData) {
    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: getMediaType(imageName),
        data: imageData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
      }
    });
  }

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1200,
    system: 'You are a patient teaching coach who helps learners understand ideas and connect them to real-world examples.',
    messages: [{ role: 'user', content: contentParts }]
  });

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return text || fallbackExpansion({ title, content, profile, imageName });
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', hasClaude: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.get('/api/notes', (_req, res) => {
  const notes = readNotes();
  res.json(notes);
});

app.post('/api/notes', (req, res) => {
  const notes = readNotes();
  const note = normalizeNote({ ...req.body, id: createId() });
  notes.unshift(note);
  writeNotes(notes);
  res.status(201).json(note);
});

app.put('/api/notes/:id', (req, res) => {
  const notes = readNotes();
  const index = notes.findIndex((note) => note.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }

  notes[index] = normalizeNote({ ...notes[index], ...req.body, updatedAt: new Date().toISOString() });
  writeNotes(notes);
  res.json(notes[index]);
});

app.delete('/api/notes/:id', (req, res) => {
  const notes = readNotes().filter((note) => note.id !== req.params.id);
  writeNotes(notes);
  res.status(200).json({ ok: true });
});

app.post('/api/ai/expand', async (req, res) => {
  const { title, content, profile, imageData, imageName } = req.body || {};

  try {
    const text = await callClaude({ title, content, profile, imageData, imageName });
    res.json({ text });
  } catch (error) {
    const fallback = fallbackExpansion({ title, content, profile, imageName });
    res.json({ text: `${fallback}\n\nSystem note: ${error.message}` });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Fieldnotes AI is running on http://localhost:${PORT}`);
});
