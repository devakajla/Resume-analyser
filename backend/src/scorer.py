import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.embedder import generate_embedding, calculate_similarity
from src.extractor import extract_entities
from src.llm import call_llm

# Step 1: Supplementary (Nice-to-Have) list definition
SUPPLEMENTARY_SET = {
    "git", "github", "jira", "slack", "notion", "communication",
    "agile", "scrum", "excel", "sheets", "teamwork", "leadership",
    "trello", "confluence", "office", "word", "powerpoint", "interpersonal"
}


def llm_match_score(resume_text, jd_text):
    clean_resume = ' '.join(resume_text.split())[:2000]

    raw = call_llm(
        prompt=f"""You are a recruiter scoring how well a candidate fits a role. Consider not just exact skill matches, but also transferable skills, related experience, and overall capability.

Scoring guide:
- 0.8-1.0 = Excellent fit (directly relevant background and skills)
- 0.5-0.7 = Good fit (strong transferable skills, related domain)
- 0.3-0.4 = Moderate fit (some relevant skills, could adapt with training)
- 0.1-0.2 = Weak fit (mostly unrelated but some overlap)
- 0.0 = No relevant background at all

Be fair — a candidate from a related technical field usually deserves at least 0.3, not 0. Only give 0.0 if there is genuinely zero relevant skill or experience.

RESUME:
{clean_resume}

JOB DESCRIPTION:
{jd_text[:1000]}

Reply with ONLY a number between 0.0 and 1.0:""",
        max_tokens=10,
        temperature=0.1
    )

    import re as _re
    match = _re.search(r'(\d+\.?\d*)', raw)
    if match:
        return min(float(match.group(1)), 1.0)
    return 0.0


def calculate_skill_match(resume_text, resume_skills, jd_skills, experience_text=None):
    """Match JD skills using keyword search, embedding similarity, core/supplementary weights, and experience-recency."""
    if not jd_skills:
        return 0.0, [], []

    matched = []
    missing = []
    resume_lower = resume_text.lower()
    resume_skills_lower = [s.lower() for s in resume_skills]

    # Get resume text embedding once
    resume_embedding = generate_embedding(resume_text)

    # Step 1: Split Core vs Supplementary Skills
    core_skills = []
    supp_skills = []
    for skill in jd_skills:
        if skill.lower() in SUPPLEMENTARY_SET:
            supp_skills.append(skill)
        else:
            core_skills.append(skill)

    # Step 2: Experience details analysis for recency and duration
    exp_lower = experience_text.lower() if experience_text else ""
    # Assume top 40% of experience block contains the "Most Recent" job (due to reverse chronology)
    recent_boundary = int(len(exp_lower) * 0.40)
    recent_exp = exp_lower[:recent_boundary]

    total_weighted_points = 0.0
    max_possible_points = 0.0
    core_matched_count = 0

    for skill in jd_skills:
        skill_lower = skill.lower()
        is_core = skill not in supp_skills

        # Match check methods
        found_keyword = skill_lower in resume_lower
        found_in_skills = any(skill_lower in rs or rs in skill_lower for rs in resume_skills_lower)

        skill_embedding = generate_embedding(skill)
        similarity = float(calculate_similarity(skill_embedding, resume_embedding))
        found_semantic = similarity > 0.45

        # Core vs Supplementary base weights
        base_weight = 1.0 if is_core else 0.3
        max_possible_points += base_weight

        if found_keyword or found_in_skills or found_semantic:
            matched.append(skill)
            if is_core:
                core_matched_count += 1

            # Recency Weighting multiplier:
            # - Found in recent experience (top 40%): 1.2x weight
            # - Found in older experience (bottom 60%): 1.0x weight
            # - Only listed in skills list (academic/unused): 0.6x weight
            if exp_lower:
                if skill_lower in recent_exp:
                    multiplier = 1.2
                elif skill_lower in exp_lower:
                    multiplier = 1.0
                else:
                    multiplier = 0.6
            else:
                multiplier = 0.8  # Fallback for freshers (no experience text)

            total_weighted_points += base_weight * multiplier
        else:
            missing.append(skill)

    # Calculate final skill ratio
    if max_possible_points > 0:
        skill_score = total_weighted_points / max_possible_points
    else:
        skill_score = 0.0

    # Step 1 logic: Must-Have Core Penalty
    # If candidate misses > 50% of the Core skills, penalize final skill score by 50%
    if core_skills:
        core_match_ratio = core_matched_count / len(core_skills)
        if core_match_ratio < 0.5:
            skill_score *= 0.5

    return min(skill_score, 1.0), matched, missing


def score_resume(resume_text, jd_text, jd_skills):
    # Extract structural parts of the candidate profile
    entities = extract_entities(resume_text)
    resume_skills = entities.get('skills', [])
    exp_text = entities.get('experience', '')
    edu_text = entities.get('education', '')

    # Step 3: Section-Based Semantic Matching
    # Generate JD embedding once
    jd_emb = generate_embedding(jd_text)

    # 1. Overall Similarity (40% weight)
    resume_emb = generate_embedding(resume_text)
    overall_similarity = float(calculate_similarity(resume_emb, jd_emb))

    # 2. Experience Section Similarity (50% weight)
    if exp_text and len(exp_text.strip()) > 50:
        exp_emb = generate_embedding(exp_text)
        exp_similarity = float(calculate_similarity(exp_emb, jd_emb))
    else:
        exp_similarity = overall_similarity  # Fallback

    # 3. Education Section Similarity (10% weight)
    if edu_text and len(edu_text.strip()) > 20:
        edu_emb = generate_embedding(edu_text)
        edu_similarity = float(calculate_similarity(edu_emb, jd_emb))
    else:
        edu_similarity = overall_similarity  # Fallback

    # Blend semantic matching vectors
    embedding_score = (0.40 * overall_similarity) + (0.50 * exp_similarity) + (0.10 * edu_similarity)

    # Calculate skill score using MUST-HAVEs and Recency rules
    skill_score, matched, missing = calculate_skill_match(
        resume_text=resume_text,
        resume_skills=resume_skills,
        jd_skills=jd_skills,
        experience_text=exp_text
    )

    # Recruiter verification LLM score
    llm_score = llm_match_score(resume_text, jd_text)
    print(f"    LLM scored {entities.get('name', '?')}: {llm_score}")

    # Dynamic Weighting depending on JDs complexity scale
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
    jd_skills = ["Python", "Machine Learning", "FastAPI", "SQL", "Git", "Communication"]

    resumes = {
        "dev.pdf": "John Doe. Python developer with 3 years in machine learning, deep learning, FastAPI, PostgreSQL, SQL. Worked on these recently.",
        "frontend.pdf": "Jane Smith. Frontend developer skilled in React, JavaScript, HTML, CSS.",
        "data.pdf": "Bob Wilson. Data scientist with Python, scikit-learn, pandas, SQL, machine learning. Has Git listed but no recent experience in work history.",
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