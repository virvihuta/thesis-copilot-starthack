# backend/main.py
# ─────────────────────────────────────────────────────────────────────────────
# UNIFIED BACKEND — Thesis Copilot
# This is the SINGLE FastAPI server the frontend talks to. Run it with:
#   uvicorn main:app --reload --port 8000
# ─────────────────────────────────────────────────────────────────────────────

import os
import re
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from openai import OpenAI
import io
from PyPDF2 import PdfReader

load_dotenv()

app = FastAPI(title="Thesis Copilot — Unified Backend")
openai_client = OpenAI()

# ─── CORS ────────────────────────────────────────────────────────────────────
# Allow requests from any origin (fine for hackathon/local dev).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── DATABASE ────────────────────────────────────────────────────────────────
# Point this at your chroma_db folder. Make sure ingest.py has already been run.
CHROMA_PATH = "/Users/user/Desktop/thesis-copilot-starthack/ai_engine/chroma_db"
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)

# ─── SESSION STATE ───────────────────────────────────────────────────────────
# Simple in-memory session for hackathon. Stores the current student's profile
# so the pitch generator can personalize the email without asking again.
# In production this would be a database or Redis.
user_session: dict = {}

# ─── REQUEST MODELS ──────────────────────────────────────────────────────────

class ProfileData(BaseModel):
    full_name: str
    skills: str
    interests: str

class SearchRequest(BaseModel):
    text: str

class PitchRequest(BaseModel):
    topic_id: str  # This is the topic_id stored in Chroma metadata, NOT the Chroma UUID


# ─── ENDPOINTS ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Quick sanity check — call this first to verify the server is running."""
    try:
        count = db._collection.count()
    except Exception:
        count = -1
    return {
        "status": "online",
        "db_count": count,
        "session_has_user": "current_user" in user_session,
    }


@app.post("/save-profile")
async def save_profile(profile: ProfileData):
    """
    Save the student profile to the session.
    The frontend calls this when the user fills in their name/skills/interests.
    The pitch generator reads this later to personalize the cold email.
    """
    user_session["current_user"] = profile.model_dump()
    return {"message": "Profile saved", "user": user_session["current_user"]}


@app.post("/find-matches")
async def find_matches(query: SearchRequest):
    """
    Core search endpoint.
    Takes free text from the student (typed or extracted from CV),
    runs a semantic similarity search against the ChromaDB vector store,
    and returns the top 3 matching thesis topics.
    """
    try:
        results = db.similarity_search_with_score(query.text, k=3)

        matches = []
        for doc, score in results:
            # Chroma returns L2 distance (lower = better, 0.0 = perfect, 2.0 = unrelated)
            # Convert to a human-friendly 0-100 similarity percentage
            similarity = max(0, round((1 - score / 2) * 100))
            matches.append({
                "id": doc.metadata.get("topic_id", "unknown"),
                "title": doc.metadata.get("title", "Untitled"),
                "company": doc.metadata.get("company_name", "Industry Partner"),
                "expert": doc.metadata.get("expert_names", "Hiring Manager"),
                "snippet": doc.page_content[:300],
                "score": similarity,
            })

        return matches

    except Exception as e:
        print(f"[Search Error] {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    """
    CV upload endpoint.
    Accepts a PDF, extracts the text, then runs the same search as /find-matches.
    The frontend calls this when the user drops a CV file.
    """
    try:
        content = await file.read()

        # Extract text from the PDF
        pdf_reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""

        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

        # Reuse the same search logic — treat the CV text as the search query
        results = db.similarity_search_with_score(text[:2000], k=3)

        matches = []
        for doc, score in results:
            similarity = max(60, min(99, round(100 - (score * 35))))
            matches.append({
                "id": doc.metadata.get("topic_id", "unknown"),
                "title": doc.metadata.get("title", "Untitled"),
                "company": doc.metadata.get("company_name", "Industry Partner"),
                "expert": doc.metadata.get("expert_names", "Hiring Manager"),
                "snippet": doc.page_content[:300],
                "score": similarity,
            })

        # Use GPT to extract real skills from the CV
        kw_response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"""Extract exactly 5 technical skills, tools, or domain areas from this CV.
Return ONLY a JSON array of short strings, nothing else. No explanation.
Example: ["Python", "Machine Learning", "Computer Vision", "React", "Data Science"]

CV text:
{text[:2000]}"""
            }],
            max_tokens=60,
            temperature=0,
        )

        import json as json_lib
        try:
            raw = kw_response.choices[0].message.content.strip()
            keywords = json_lib.loads(raw)
        except Exception:
            keywords = ["Research", "Data Analysis", "Innovation"]

        return {"matches": matches, "keywords": keywords}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[CV Upload Error] {e}")
        raise HTTPException(status_code=500, detail=f"CV processing failed: {str(e)}")


@app.post("/generate-pitch")
async def generate_pitch(request: PitchRequest):
    """
    AI pitch generator.
    Looks up the selected topic from ChromaDB by its topic_id metadata field,
    then uses GPT to write a personalized cold email using the student's profile.

    FIX: Previously this used db.get(ids=[...]) which looks up by Chroma's
    internal UUID — those are not the same as our topic_id strings.
    Now we use db.get(where={"topic_id": ...}) to filter by metadata correctly.
    """

    # ── Step 1: Fetch topic from ChromaDB using metadata filter ─────────────
    # IMPORTANT: This is the fix. We query by metadata field, not by Chroma's
    # internal UUID. Without this fix, this endpoint always returns 404.
    try:
        topic_data = db.get(where={"topic_id": request.topic_id})
    except Exception as e:
        print(f"[DB Query Error] {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

    if not topic_data or not topic_data.get("metadatas") or len(topic_data["metadatas"]) == 0:
        # Fallback: try a text search for the topic_id as a last resort
        print(f"[Pitch] topic_id '{request.topic_id}' not found via metadata filter, trying text search...")
        results = db.similarity_search(f"topic id {request.topic_id}", k=1)
        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"Topic '{request.topic_id}' not found in database."
            )
        meta = results[0].metadata
        topic_text = results[0].page_content
    else:
        meta = topic_data["metadatas"][0]
        topic_text = topic_data["documents"][0] if topic_data.get("documents") else ""

    # ── Step 2: Get student profile from session ─────────────────────────────
    # If the student never saved a profile, fall back to generic placeholder.
    user = user_session.get("current_user", {
        "full_name": "Student",
        "skills": "research and analytical thinking",
        "interests": "innovation and applied research",
    })

    # ── Step 3: Build the prompt ─────────────────────────────────────────────
    company = meta.get("company_name", "the company")
    expert = meta.get("expert_names", "Hiring Manager")
    title = meta.get("title", "the thesis project")

    prompt = f"""You are a professional academic career coach helping a student write a cold email.

Write a concise, confident, professional cold email (max 150 words) from {user['full_name']} 
to {expert} at {company} about the thesis project: "{title}".

The student's skills: {user['skills']}
The student's interests: {user['interests']}

Project context:
{topic_text[:400]}

Rules:
- Address {expert} by first name if possible, otherwise use "Dear {expert}"
- Mention 1–2 specific skills that directly match the project
- Express genuine enthusiasm for the specific project (not generic)
- End with a clear call to action (brief call or meeting)
- Do NOT use buzzwords like "synergy" or "leverage"
- Do NOT write a subject line, just the email body
"""

    # ── Step 4: Call GPT ──────────────────────────────────────────────────────
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7,
        )
        pitch_text = response.choices[0].message.content
        return {"pitch": pitch_text}

    except Exception as e:
        print(f"[GPT Error] {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
