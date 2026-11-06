# Fieldnotes AI

A tablet-first note-taking app with a built-in teaching AI and photo attachment support for a Samsung Galaxy Tab S6 Lite workflow.

## Features

- Notebook-style note editor
- AI tutor panel that expands notes with Claude
- Camera/gallery image attachment support
- Teaching profile that adapts tone and audience
- Note export as Markdown
- Persistent local data storage
- Responsive design for tablets and desktops

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your Anthropic API key if you want live Claude support:
   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

3. Start the app:
   ```bash
   npm start
   ```

4. Open http://localhost:3000

## Optional: live AI

If `ANTHROPIC_API_KEY` is present, the app sends the current note and any attached photo to Claude. If it is not present, the app gracefully falls back to a built-in teaching expansion that still works in demo mode.

## Notes

This is built as an installable web app so it works well on a Galaxy Tab, and it can be added to the home screen like a native app.
