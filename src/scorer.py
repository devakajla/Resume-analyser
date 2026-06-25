from src.embedder import generate_embedding, calculate_similarity
from src.extractor import extract_entities

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.embedder import generate_embedding, calculate_similarity
from src.extractor import extract_entities

def calculate_skill_match(resume_text, resume_skills, jd_skills):
    """Check JD skills in extracted skills + full resume text as fallback."""
    if not jd_skills:
        return 0.0, [], []

    matched = []
    missing = []
    resume_lower = resume_text.lower()
    resume_skills_lower = [s.lower() for s in resume_skills]

    for skill in jd_skills:
        skill_lower = skill.lower()
        # Check in extracted skills first
        found_in_skills = any(skill_lower in rs or rs in skill_lower for rs in resume_skills_lower)
        # Fallback: check in full resume text
        found_in_text = skill_lower in resume_lower

        if found_in_skills or found_in_text:
            matched.append(skill)
        else:
            missing.append(skill)

    score = len(matched) / len(jd_skills)
    return score, matched, missing

def score_resume(resume_text, jd_text, jd_skills):
    resume_emb = generate_embedding(resume_text)
    jd_emb = generate_embedding(jd_text)
    embedding_score = float(calculate_similarity(resume_emb, jd_emb))

    entities = extract_entities(resume_text)
    resume_skills = entities.get('skills', [])
    skill_score, matched, missing = calculate_skill_match(resume_text, resume_skills, jd_skills)

    final_score = (0.5 * embedding_score) + (0.5 * skill_score)

    return {
        'final_score': round(final_score, 4),
        'embedding_score': round(embedding_score, 4),
        'skill_score': round(skill_score, 4),
        'matched_skills': matched,
        'missing_skills': missing,
        'resume_skills': resume_skills,
        'name': entities.get('name'),
        'email': entities.get('email'),
    }



# Quick test
if __name__ == "__main__":
    jd_text = "Looking for a Python developer with experience in machine learning, FastAPI, and SQL databases."
    jd_skills = ["Python", "Machine Learning", "FastAPI", "SQL"]

    resumes = {
        "dev.pdf": "John Doe. Python developer with 3 years in machine learning, deep learning, FastAPI, PostgreSQL, SQL.",
        "frontend.pdf": "Jane Smith. Frontend developer skilled in React, JavaScript, HTML, CSS.",
        "data.pdf": "Bob Wilson. Data scientist with Python, scikit-learn, pandas, SQL, machine learning.",
    }

    print("Detailed Scoring:")
    print("=" * 50)
    for filename, text in resumes.items():
        result = score_resume(text, jd_text, jd_skills)
        print(f"\n{filename} ({result['name']})")
        print(f"  Final Score:     {result['final_score']}")
        print(f"  Embedding Score: {result['embedding_score']}")
        print(f"  Skill Score:     {result['skill_score']}")
        print(f"  Matched Skills:  {result['matched_skills']}")
        print(f"  Missing Skills:  {result['missing_skills']}")
