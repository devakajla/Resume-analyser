from src.embedder import generate_embedding, calculate_similarity
from src.extractor import extract_entities
from src.llm import call_llm


import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.embedder import generate_embedding, calculate_similarity
from src.extractor import extract_entities

import requests

def llm_match_score(resume_text, jd_text):
    clean_resume = ' '.join(resume_text.split())[:1500]

    raw = call_llm(
        prompt=f"""Rate resume-job match from 0.0 to 1.0. Reply with ONLY a number.

0.8-1.0 = Strong match (most skills and experience align)
0.5-0.7 = Partial match (some relevant skills)
0.2-0.4 = Weak match (few relevant skills)
0.0-0.1 = No match

RESUME SUMMARY:
{clean_resume}

JOB REQUIREMENTS:
{jd_text[:800]}

Score:""",
        max_tokens=10,
        temperature=0.1
    )

    import re as _re
    match = _re.search(r'(\d+\.?\d*)', raw)
    if match:
        return min(float(match.group(1)), 1.0)
    return 0.0



def calculate_skill_match(resume_text, resume_skills, jd_skills):
    """Match JD skills using both keyword search AND embedding similarity."""
    if not jd_skills:
        return 0.0, [], []

    matched = []
    missing = []
    resume_lower = resume_text.lower()
    resume_skills_lower = [s.lower() for s in resume_skills]

    # Get resume text embedding once
    resume_embedding = generate_embedding(resume_text)

    for skill in jd_skills:
        skill_lower = skill.lower()

        # Method 1: Exact keyword match in text
        found_keyword = skill_lower in resume_lower

        # Method 2: Exact match in extracted skills
        found_in_skills = any(skill_lower in rs or rs in skill_lower for rs in resume_skills_lower)

        # Method 3: Embedding similarity (semantic match)
        skill_embedding = generate_embedding(skill)
        similarity = float(calculate_similarity(skill_embedding, resume_embedding))
        found_semantic = similarity > 0.45  # threshold for "related enough"

        if found_keyword or found_in_skills or found_semantic:
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

    llm_score = llm_match_score(resume_text, jd_text)
    print(f"    LLM scored {entities.get('name', '?')}: {llm_score}")

    if len(jd_skills) > 20:
        final_score = (0.30 * embedding_score) + (0.20 * skill_score) + (0.50 * llm_score)
    else:
        final_score = (0.35 * embedding_score) + (0.35 * skill_score) + (0.30 * llm_score)

    return {
        'final_score': round(final_score, 4),
        'embedding_score': round(embedding_score, 4),
        'skill_score': round(skill_score, 4),
        'llm_score': round(llm_score, 4),
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
