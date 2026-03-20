# Thesis Copilot ✦
### AI-powered thesis journey — built at StartHack 2026 for the Studyond / OST challenge.

> *From CV upload to matched topic, recommended supervisor & personalized outreach — in 60 seconds.*

---

## What It Does

Every year, thousands of students start their thesis facing the same fragmented experience — searching university websites for supervisors, browsing company career pages for topics, cold-messaging professionals with zero context.

**Thesis Copilot** solves this in one flow:

| Step | What happens |
|------|-------------|
| 📄 **Upload CV** | GPT-4o-mini extracts your real skills and interests |
| 🎯 **Smart Match** | Semantic vector search finds your top 3 thesis topics from real company data |
| 👨‍🏫 **Find Supervisor** | AI recommends the best matching professor for your specific topic |
| ✉️ **Draft Outreach** | GPT writes personalized cold emails to both the company and the supervisor |

---

## Stack

```
Frontend   React + TypeScript + Vite + Tailwind
Backend    FastAPI (Python)
AI Layer   OpenAI GPT-4o-mini + text-embedding-3-small
Vector DB  ChromaDB (semantic search)
Data       Studyond — 50 thesis topics · 25 supervisors
Pattern    RAG (Retrieval-Augmented Generation)
```

---

## Project Structure

```
thesis-copilot/
├── ai_engine/
│   ├── ingest.py          # Embeds topics + supervisors into ChromaDB
│   ├── inspect_db.py      # Debug tool to inspect the vector database
│   └── data/
│       ├── topics.json
│       ├── companies.json
│       └── supervisors.json
├── backend/
│   └── main.py            # FastAPI — all endpoints
└── frontend/
    └── thesis-copilot/
        └── src/
            ├── pages/ThesisCopilot.tsx
            ├── components/
            │   ├── ActionDrawer.tsx
            │   ├── MatchCard.tsx
            │   ├── CVUploadCard.tsx
            │   └── MemoryDumpCard.tsx
            └── api/apiService.ts
```

---

## Getting Started

### 1. Clone & set up environment

```bash
git clone https://github.com/your-repo/thesis-copilot
cd thesis-copilot
```

Create a `.env` file in `backend/`:

```env
OPENAI_API_KEY=sk-...
```

### 2. Build the AI brain

```bash
cd ai_engine
pip install -r requirements.txt
python ingest.py
# → Embedded 50 topics + 25 supervisors into ChromaDB
```

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Verify it's running:
```bash
curl http://localhost:8000/health
# → {"status":"online","db_count":75}
```

### 4. Start the frontend

```bash
cd frontend/thesis-copilot
npm install
npm run dev
# → http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status + DB document count |
| `POST` | `/find-matches` | Semantic search from free text |
| `POST` | `/upload-cv` | Upload PDF → extract skills → find matches |
| `POST` | `/find-supervisor` | Find best supervisor for a topic |
| `POST` | `/generate-pitch` | GPT cold email to company |
| `POST` | `/generate-supervisor-pitch` | GPT cold email to supervisor |
| `POST` | `/save-profile` | Save student profile to session |

---

## How the Matching Works

```
Student text / CV
        ↓
  OpenAI Embeddings
  (text-embedding-3-small)
        ↓
  ChromaDB similarity search
  (L2 distance → similarity %)
        ↓
  Top 3 thesis topics (filtered by doc_type: "topic")
        ↓
  Parallel: find best supervisor (filtered by doc_type: "supervisor")
        ↓
  GPT-4o-mini generates personalized outreach emails
```

Scores are remapped from raw L2 distance to a human-readable 60–99% range so results feel intuitive.

---

## Team

Built in 36 hours at **StartHack 2026**, St. Gallen 🇨🇭

| Role | Responsibility |
|------|---------------|
| AI / Data Science | ChromaDB pipeline, embeddings, LangChain, RAG |
| Backend | FastAPI architecture, session management, API design |
| Frontend | React/TypeScript UI, Studyond design system |

---

## Built For

**[Studyond](https://studyond.com)** — the three-sided marketplace connecting students, universities, and companies for academic collaboration. Backed by Innosuisse, HSG spin-off, ETH startup.

**OST** — Eastern Switzerland University of Applied Sciences.

---

*"Complexity is easy. Precision is hard. We chose precision."*
