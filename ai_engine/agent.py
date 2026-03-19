import json
import io
from pydantic import BaseModel, Field
from typing import List
from PyPDF2 import PdfReader
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()
CHROMA_PATH = "./chroma_db"

# --- UPDATED SCHEMA: Now includes Achievements for the "Wow" factor ---
class StudentProfile(BaseModel):
    extracted_skills: List[str] = Field(description="Hard skills like Python, React, or SQL.")
    core_interests: List[str] = Field(description="Industries like Biotech, FinTech, or Sustainability.")
    notable_achievements: List[str] = Field(description="Awards, high GPA, specific internships, or leadership.")
    excluded_topics: List[str] = Field(description="Topics the student wants to avoid.")

# --- NEW: PDF TEXT EXTRACTION ---
def extract_text_from_pdf(file_bytes: bytes) -> str:
    pdf_reader = PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text

# --- CORE SEARCH LOGIC ---
def search_projects(user_text: str):
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    extractor = llm.with_structured_output(StudentProfile)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert academic headhunter. Extract the student's profile from their message or CV text."),
        ("human", "{message}")
    ])
    
    profile: StudentProfile = (prompt | extractor).invoke({"message": user_text})
    
    vectorstore = Chroma(
        persist_directory=CHROMA_PATH, 
        embedding_function=OpenAIEmbeddings(model="text-embedding-3-small")
    )
    
    search_query = f"Skills: {', '.join(profile.extracted_skills)}. Interests: {', '.join(profile.core_interests)}"
    docs = vectorstore.as_retriever(search_kwargs={"k": 3}).invoke(search_query)
    
    return {
        "extracted_profile": profile.model_dump(),
        "top_matches": [doc.metadata for doc in docs]
    }

# --- PITCH GENERATION ---
def generate_pitch(profile_dict: dict, selected_project: dict):
    writer_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    
    pitch_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a high-end career coach. Write a concise, professional cold email.
        Highlight the student's 'notable_achievements' and connect them to the thesis project.
        Max 150 words."""),
        ("human", "Student Profile: {profile}\n\nThesis Project: {project}")
    ])
    
    response = (pitch_prompt | writer_llm).invoke({
        "profile": json.dumps(profile_dict),
        "project": json.dumps(selected_project)
    })
    
    return {"generated_pitch": response.content}