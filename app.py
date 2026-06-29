from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from src.parser import parse_resume
from src.extractor import extract_entities
from src.scorer import score_resume
from src.question_gen import generate_questions
from src.config import MIN_SCORE_THRESHOLD
import requests
import os
import shutil
import tempfile

app = FastAPI(
    title="Resume Analyser API",
    description="Upload resumes, match against JD, get ranked candidates with HR questions"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
parsed_resumes = {}
current_jd = {"text": "", "skills": []}
ranked_results = []

UPLOAD_DIR = "data/uploaded_resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============ ENDPOINTS ============

@app.get("/")
def home():
    return {"message": "Resume Analyser API is running", "docs": "/docs"}

@app.post("/upload-resumes")
async def upload_resumes(files: list[UploadFile] = File(description="Upload resume files")):
    """Upload one or more resume files (PDF, DOCX, TXT, PNG, JPG)."""
    global parsed_resumes
    results = []
    errors = []

    for file in files:
        filepath = os.path.join(UPLOAD_DIR, file.filename)
        try:
            with open(filepath, "wb") as f:
                content = await file.read()
                f.write(content)

            text = parse_resume(filepath)
            entities = extract_entities(text)
            parsed_resumes[file.filename] = {
                "text": text,
                "entities": entities
            }
            results.append({
                "file": file.filename,
                "name": entities.get("name"),
                "email": entities.get("email"),
                "skills_count": len(entities.get("skills", []))
            })
        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})

    return {
        "parsed": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }

@app.post("/set-jd")
def set_jd(jd_text: str = Form(...)):
    """Submit a Job Description — skills will be auto-extracted."""
    global current_jd

    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "qwen2.5-coder:7b",
            "prompt": f"""Extract the key required skills from this job description. Return ONLY a comma-separated list of skills, nothing else.

Job Description:
{jd_text}

Skills (comma-separated):""",
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 200}
        })

        if response.status_code == 200:
            raw = response.json().get("response", "")
            skills = [s.strip().strip("-").strip("•") for s in raw.split(",")]
            skills = [s for s in skills if s and len(s) < 50]
        else:
            skills = []
    except:
        skills = []

    current_jd = {"text": jd_text, "skills": skills}
    return {
        "message": "JD set successfully",
        "extracted_skills": skills,
        "skill_count": len(skills)
    }


@app.post("/rank")
def rank_resumes():
    """Rank all uploaded resumes against the current JD."""
    global ranked_results

    if not parsed_resumes:
        return JSONResponse(status_code=400, content={"error": "No resumes uploaded. Use /upload-resumes first."})
    if not current_jd["text"]:
        return JSONResponse(status_code=400, content={"error": "No JD set. Use /set-jd first."})

    ranked_results = []
    for filename, data in parsed_resumes.items():
        result = score_resume(data["text"], current_jd["text"], current_jd["skills"])
        result["file"] = filename
        result["name"] = data["entities"].get("name")
        result["email"] = data["entities"].get("email")
        result["entities"] = data["entities"]
        ranked_results.append(result)

    ranked_results.sort(key=lambda x: x["final_score"], reverse=True)

    shortlisted = [r for r in ranked_results if r["final_score"] >= MIN_SCORE_THRESHOLD]
    not_shortlisted = [r for r in ranked_results if r["final_score"] < MIN_SCORE_THRESHOLD]

    return {
        "total": len(ranked_results),
        "shortlisted_count": len(shortlisted),
        "shortlisted": [{
            "rank": i + 1,
            "name": r["name"],
            "file": r["file"],
            "final_score": r["final_score"],
            "embedding_score": r["embedding_score"],
            "skill_score": r["skill_score"],
            "llm_score": r.get("llm_score", "N/A"),
            "matched_skills": r["matched_skills"],
            "missing_skills": r["missing_skills"]
        } for i, r in enumerate(shortlisted)],
        "not_shortlisted": [{
            "name": r["name"],
            "file": r["file"],
            "final_score": r["final_score"]
        } for r in not_shortlisted]
    }


@app.post("/generate-questions/{filename}")
def generate_questions_for_resume(filename: str):
    """Generate HR interview questions for a specific resume."""
    if filename not in parsed_resumes:
        return JSONResponse(status_code=404, content={"error": f"Resume '{filename}' not found. Upload it first."})
    if not current_jd["text"]:
        return JSONResponse(status_code=400, content={"error": "No JD set. Use /set-jd first."})

    # Find the scored result for this resume
    resume_result = None
    for r in ranked_results:
        if r["file"] == filename:
            resume_result = r
            break

    matched = resume_result["matched_skills"] if resume_result else []
    missing = resume_result["missing_skills"] if resume_result else current_jd["skills"]

    questions = generate_questions(
        resume_entities=parsed_resumes[filename]["entities"],
        jd_text=current_jd["text"],
        jd_skills=current_jd["skills"],
        matched_skills=matched,
        missing_skills=missing
    )

    return {
        "candidate": parsed_resumes[filename]["entities"].get("name"),
        "file": filename,
        "questions": questions
    }


@app.get("/status")
def status():
    """Check current state — how many resumes uploaded, JD set or not."""
    return {
        "resumes_uploaded": len(parsed_resumes),
        "resume_files": list(parsed_resumes.keys()),
        "jd_set": bool(current_jd["text"]),
        "jd_skills": current_jd["skills"],
        "results_available": len(ranked_results) > 0
    }
