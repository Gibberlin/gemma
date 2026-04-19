# Gemma — Local AI Study Chat (Next.js + LM Studio)

<p align="center">
  <img src="./public/images/image2.png" width="900" alt="Gemma Main Interface"/>
</p>

## Introduction

Gemma is a Next.js-based study assistant that integrates with a locally hosted LM Studio server (OpenAI-compatible API). It provides a structured academic interface where users can navigate subjects and interact with a local language model for explanations, problem-solving, and technical assistance.

The application is designed to transform static academic content into an interactive learning experience while maintaining privacy through local model execution.

> **Important**
> Chat functionality requires LM Studio to be installed and running locally. Refer to the setup instructions below.

---

## Overview

Gemma serves as an academic companion that combines subject navigation with AI-assisted learning. It enables students to explore course structures, access study materials, and receive contextual responses without relying on external APIs.

It supports multiple academic formats, including:

* Project-based coursework
* Laboratory subjects
* Specialized system tracks
* Elective modules

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

### Study Materials and Online Resources

<p align="center">
  <img src="./public/images/image3.png" width="800"/>
</p>

Provides access to curated learning resources, including PDFs, references, and module-based materials.

---

## Features

* **Comprehensive Curriculum Mapping:** Supports subjects, labs, electives, and project-based coursework.
* **Contextual Study Materials:** Organizes academic resources within each subject.
* **Local-First AI Integration:** Operates entirely through LM Studio for offline usage.
* **Advanced Content Rendering:** Supports markdown, code blocks, and mathematical expressions.
* **Next.js App Router Architecture:** Enables fast and responsive navigation.

---

## Tech Stack

* **Frontend:** Next.js, TypeScript, Tailwind CSS
* **Backend:** Next.js API routes
* **AI Runtime:** LM Studio (local models)
* **Rendering:** Markdown with syntax highlighting and math support

---

## Setup

> **Warning**
> The chat feature will not function without LM Studio running.

### 1. Install and Start LM Studio

1. Download and install from https://lmstudio.ai/
2. Load a language model (e.g., `gemma-2b-it`)
3. Start the local server from the LM Studio interface

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
LMSTUDIO_API_KEY=not-needed
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

Access the application at:

```
http://localhost:3000
```

---

## Project Structure

```
app/
  api/chat/        # Chat API route connecting to LM Studio
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

* Proxies requests to the local LM Studio instance
* Returns structured responses for frontend rendering

---

## Notes

* Performance depends on local hardware and model size
* Recommended models: 2B–7B for general systems
* Markdown rendering is required for full UI experience

---

## Future Improvements

* Streaming responses
* Enhanced math rendering
* Improved code block interaction
* Persistent chat sessions
* Academic system integration

---

## License

MIT License
