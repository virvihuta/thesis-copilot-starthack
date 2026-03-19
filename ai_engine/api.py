from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import search_projects, generate_pitch, extract_text_from_pdf

app = FastAPI(title="Studyond AI Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class DraftRequest(BaseModel):
    profile: dict
    selected_project: dict

@app.post("/api/search")
async def handle_search(request: ChatRequest):
    return search_projects(request.message)

@app.post("/api/upload-cv")
async def handle_cv_upload(file: UploadFile = File(...)):
    # Read PDF, extract text, and run the search pipeline
    content = await file.read()
    text = extract_text_from_pdf(content)
    return search_projects(text)

@app.post("/api/draft")
async def handle_draft(request: DraftRequest):
    return generate_pitch(request.profile, request.selected_project)