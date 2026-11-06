const state = {
  notes: [],
  selectedId: null,
  audience: 'a curious beginner',
  style: 'clear, encouraging, and practical'
};

const els = {
  list: document.getElementById('notes-list'),
  title: document.getElementById('note-title'),
  content: document.getElementById('note-content'),
  audience: document.getElementById('audience-select'),
  style: document.getElementById('style-select'),
  meta: document.getElementById('note-meta'),
  status: document.getElementById('status-line'),
  aiOutput: document.getElementById('ai-output'),
  attachmentInput: document.getElementById('attachment-input'),
  attachmentPreview: document.getElementById('attachment-preview')
};

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function getSelectedNote() {
  return state.notes.find((note) => note.id === state.selectedId) || null;
}

async function loadNotes() {
  const response = await fetch('/api/notes');
  const notes = await response.json();
  state.notes = notes;

  if (!notes.length) {
    createNote();
    return;
  }

  state.selectedId = notes[0].id;
  render();
}

function setStatus(message) {
  els.status.textContent = message;
}

function renderList() {
  els.list.innerHTML = '';

  state.notes.forEach((note) => {
    const button = document.createElement('button');
    button.className = `note-item ${note.id === state.selectedId ? 'active' : ''}`;
    button.innerHTML = `
      <span class="note-item-title">${escapeHtml(note.title || 'Untitled note')}</span>
      <span class="note-item-meta">${formatDate(note.updatedAt)}</span>
    `;
    button.addEventListener('click', () => {
      state.selectedId = note.id;
      render();
    });
    els.list.appendChild(button);
  });
}

function renderEditor() {
  const note = getSelectedNote();
  if (!note) return;

  els.title.value = note.title || '';
  els.content.value = note.content || '';
  els.meta.textContent = `Updated ${formatDate(note.updatedAt)}`;
  els.audience.value = note.profile?.audience || state.audience;
  els.style.value = note.profile?.style || state.style;

  if (note.attachmentData) {
    els.attachmentPreview.innerHTML = `
      <img src="${note.attachmentData}" alt="Attached work" />
      <span>${note.attachmentName || 'Attached image'}</span>
    `;
  } else {
    els.attachmentPreview.innerHTML = 'No image attached yet';
  }
}

function render() {
  renderList();
  renderEditor();
}

function escapeHtml(raw) {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function saveCurrentNote() {
  const note = getSelectedNote();
  if (!note) return;

  const payload = {
    title: els.title.value.trim() || 'Untitled note',
    content: els.content.value,
    profile: {
      audience: els.audience.value,
      style: els.style.value
    },
    attachmentName: note.attachmentName || '',
    attachmentData: note.attachmentData || ''
  };

  const response = await fetch(`/api/notes/${note.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    setStatus('Unable to save');
    return;
  }

  const updated = await response.json();
  state.notes = state.notes.map((item) => (item.id === updated.id ? updated : item));
  state.selectedId = updated.id;
  render();
  setStatus('Saved locally');
}

async function createNote() {
  const payload = {
    title: 'Untitled note',
    content: '',
    profile: {
      audience: els.audience.value,
      style: els.style.value
    },
    attachmentName: '',
    attachmentData: ''
  };

  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const created = await response.json();
  state.notes.unshift(created);
  state.selectedId = created.id;
  render();
  setStatus('New note created');
}

async function handleAI(action) {
  const note = getSelectedNote();
  if (!note) return;

  const prompt = {
    title: els.title.value || 'Untitled note',
    content: els.content.value,
    imageData: note.attachmentData || '',
    imageName: note.attachmentName || '',
    profile: {
      audience: els.audience.value,
      style: els.style.value
    },
    action
  };

  const response = await fetch('/api/ai/expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prompt)
  });

  const data = await response.json();
  els.aiOutput.textContent = data.text || 'No response returned.';
}

function applyAIToNote() {
  const note = getSelectedNote();
  if (!note) return;

  const responseText = els.aiOutput.textContent.trim();
  if (!responseText || responseText === 'Ask the AI to explain your notes or attach a photo of your work.') {
    return;
  }

  const nextContent = `${els.content.value.trim()}\n\n---\n\n## AI Teaching Expansion\n\n${responseText}`;
  els.content.value = nextContent;
  saveCurrentNote();
}

function downloadMarkdown() {
  const note = getSelectedNote();
  if (!note) return;

  const markdown = `# ${els.title.value || 'Untitled note'}\n\n${els.content.value || ''}`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(els.title.value || 'untitled-note').replace(/\s+/g, '-').toLowerCase()}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleAttachment(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const dataUrl = await readFileAsDataUrl(file);
  const note = getSelectedNote();
  if (!note) return;

  note.attachmentName = file.name;
  note.attachmentData = dataUrl;

  const response = await fetch(`/api/notes/${note.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: els.title.value || 'Untitled note',
      content: els.content.value,
      profile: {
        audience: els.audience.value,
        style: els.style.value
      },
      attachmentName: file.name,
      attachmentData: dataUrl
    })
  });

  if (response.ok) {
    const updated = await response.json();
    state.notes = state.notes.map((item) => (item.id === updated.id ? updated : item));
    render();
    setStatus('Image attached');
  }
}

const quickActionMap = {
  expand: 'Explain this section in simpler language, connect it to a real example, and end with a brief recap.',
  quiz: 'Create 5 quick quiz questions from these notes, with answers at the end.',
  lesson: 'Turn these notes into a short teaching lesson for the selected audience, including examples and a check for understanding.',
  summarize: 'Summarize the key idea in plain language and identify the most important takeaways.'
};

function attachInputListeners() {
  document.getElementById('new-note-btn').addEventListener('click', createNote);
  document.getElementById('save-btn').addEventListener('click', saveCurrentNote);
  document.getElementById('download-btn').addEventListener('click', downloadMarkdown);
  document.getElementById('expand-btn').addEventListener('click', () => handleAI('expand'));
  document.getElementById('apply-output-btn').addEventListener('click', applyAIToNote);
  els.title.addEventListener('input', saveCurrentNote);
  els.content.addEventListener('input', saveCurrentNote);
  els.audience.addEventListener('change', saveCurrentNote);
  els.style.addEventListener('change', saveCurrentNote);
  els.attachmentInput.addEventListener('change', handleAttachment);

  document.querySelectorAll('.quick-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      const note = getSelectedNote();
      if (!note) return;

      const customInstruction = quickActionMap[action];
      const response = await fetch('/api/ai/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: els.title.value || 'Untitled note',
          content: els.content.value,
          profile: {
            audience: els.audience.value,
            style: els.style.value
          },
          imageData: note.attachmentData || '',
          imageName: note.attachmentName || '',
          customInstruction
        })
      });

      const data = await response.json();
      els.aiOutput.textContent = data.text || 'No response returned.';
    });
  });
}

attachInputListeners();
loadNotes();
