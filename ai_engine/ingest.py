import json
import os
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

load_dotenv()

CHROMA_PATH = "./chroma_db"

def load_json(filepath):
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found. Check your folder structure!")
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def build_vector_database():
    print("Loading Studyond relational data...")

    topics = load_json("data/topics.json")
    companies = load_json("data/companies.json")
    supervisors = load_json("data/supervisors.json")
    experts = load_json("data/experts.json")

    if not topics:
        print("Error: Still can't find topics.json. The brain is empty!")
        return

    company_dict = {c.get("id"): c for c in companies if "id" in c}

    documents = []
    print("Embedding topics...")

    for topic in topics:
        if topic.get("type") != "topic":
            continue

        title = topic.get("title", "Unknown Title")
        desc = topic.get("description", "No description provided.")

        company_id = topic.get("companyId")
        company_info = company_dict.get(company_id, {})
        company_name = company_info.get("name", "Industry Partner")

        page_content = f"Title: {title}\nCompany: {company_name}\nDescription: {desc}"

        metadata = {
            "doc_type": "topic",
            "topic_id": str(topic.get("id", "0")),
            "title": title,
            "company_name": company_name,
        }

        documents.append(Document(page_content=page_content, metadata=metadata))

    print(f"Embedded {len(documents)} topics.")

    # ── Embed supervisors ────────────────────────────────────────────────────
    supervisor_count = 0
    print("Embedding supervisors...")

    for sup in supervisors:
        first = sup.get("firstName", "")
        last = sup.get("lastName", "")
        full_name = f"{sup.get('title', '')} {first} {last}".strip()
        email = sup.get("email", "")
        interests = sup.get("researchInterests", [])
        about = sup.get("about") or "No description available."

        # Build rich text so semantic search can match supervisors to topics
        page_content = (
            f"Supervisor: {full_name}\n"
            f"Email: {email}\n"
            f"Research Interests: {', '.join(interests)}\n"
            f"About: {about}"
        )

        metadata = {
            "doc_type": "supervisor",
            "supervisor_id": str(sup.get("id", "0")),
            "full_name": full_name,
            "email": email,
            "interests": ", ".join(interests),
        }

        documents.append(Document(page_content=page_content, metadata=metadata))
        supervisor_count += 1

    print(f"Embedded {supervisor_count} supervisors.")

    # ── Write everything to ChromaDB ─────────────────────────────────────────
    vectorstore = Chroma.from_documents(
        documents=documents,
        embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
        persist_directory=CHROMA_PATH
    )

    print(f"Success! Total {len(documents)} documents in the AI Brain.")

if __name__ == "__main__":
    build_vector_database()
