# Gemma — Local AI Study Chat (Next.js + LM Studio)

Gemma is a Next.js-based study assistant that connects to a locally hosted LM Studio server (OpenAI-compatible API). It provides a structured academic interface where users can navigate subjects and interact with a local language model for explanations, problem-solving, and code assistance.

---

## Overview

This project combines:

* Structured academic navigation (semester → subject → Q&A)
* Local LLM interaction (via LM Studio)
* Rich formatted responses (Markdown, code, math-ready)

It is designed as a lightweight, offline-capable learning tool.

---

## Interface

### Study Hub

<p align="center">
  <img src="./public/images/image1.png" width="800"/>
</p>

The main entry point where users browse semesters and select subjects.

---

### Subject Q&A (Conceptual / Theory)

<p align="center">
  <img src="./public/images/image2.png" width="800"/>
</p>

Supports structured explanations for theoretical topics such as probability, statistics, and system concepts.

---

### Subject Q&A (Code / Technical)

<p align="center">
  <img src="./public/images/image3.png" width="800"/>
</p>

Handles technical responses including SQL schemas, formatted code blocks, and structured outputs.

---

## Features

* Next.js App Router architecture
* Integration with LM Studio (local OpenAI-compatible API)
* Structured academic navigation
* Markdown rendering with:

  * Headings, lists, emphasis
  * Code blocks with syntax highlighting
  * Support for mathematical expressions (LaTeX-ready)
* Custom API proxy for secure model communication
* Local-first workflow (no external API dependency)

---

## Tech Stack

* **Frontend:** Next.js, TypeScript, Tailwind CSS
* **Backend:** Next.js API routes
* **AI Runtime:** LM Studio (local models)
* **Rendering:** Markdown + syntax highlighting + math support

---

## Setup

### 1. Start LM Studio

* Load a model
* Enable OpenAI-compatible server

Default endpoint:

```
http://localhost:1234/v1
```

---

### 2. Environment Configuration

Create a `.env` file:

```env
LMSTUDIO_API_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=google/gemma-4-e4b
LMSTUDIO_API_KEY=
```

---

### 3. Install Dependencies

```bash
npm install
```

---

### 4. Run the Application

```bash
npm run dev
```

Open in browser:

```
http://localhost:3000
```

---

## Project Structure

```
app/
  api/chat/        # Chat API route
  components/      # UI components
  sem/             # Semester-based routing
lib/
  lmstudio.ts      # LM Studio integration
  catalog.ts       # Academic utilities
public/
  images/          # Screenshots
  courses.json     # Course metadata
  materials.json   # Learning resources
```

---

## API

### POST /api/chat

* Proxies requests to LM Studio
* Returns structured responses for rendering

---

## Notes

* Performance depends on local hardware and model size
* Smaller models (2B–7B) are recommended for stability
* Proper Markdown rendering is required for full UI experience

---

## Future Improvements

* Streaming responses
* Enhanced math rendering
* Code block UX (copy, themes)
* Persistent chat sessions
* ERP-style academic system integration

---

## License

MIT License
