import requests
import json

from src.llm import call_llm

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5-coder:7b"


def generate_questions(resume_entities, jd_text, jd_skills, matched_skills, missing_skills):
    name = resume_entities.get('name', 'the candidate')
    skills = resume_entities.get('skills', [])
    experience = resume_entities.get('experience', 'Not available')
    education = resume_entities.get('education', 'Not available')

    prompt = f"""You are an experienced HR interviewer. Based on the candidate's resume and the job requirements below, generate practical interview questions.

CANDIDATE: {name}
CANDIDATE'S SKILLS: {', '.join(skills[:15])}
CANDIDATE'S EXPERIENCE: {str(experience)[:300]}
CANDIDATE'S EDUCATION: {str(education)}

JOB DESCRIPTION: {jd_text}
REQUIRED SKILLS: {', '.join(jd_skills)}
SKILLS MATCHED: {', '.join(matched_skills)}
SKILLS MISSING: {', '.join(missing_skills)}

Generate exactly 10 interview questions in these categories:

KNOWLEDGE VERIFICATION (3 questions):
- Questions to check if the candidate truly understands the skills they claimed
- Not coding questions — ask them to explain concepts, compare approaches

EXPERIENCE VALIDATION (3 questions):
- Questions about their past work — what they did, challenges faced, what they learned

GAP ASSESSMENT (2 questions):
- Questions about skills required in JD but missing from resume

CONFIDENCE CHECK (2 questions):
- Ask them to rate themselves on a skill, then follow up deeper

Keep questions conversational, not academic."""

    result = call_llm(prompt, max_tokens=1000, temperature=0.4)
    return result if result else "Could not generate questions."



# Quick test
if __name__ == "__main__":
    test_entities = {
        'name': 'RAHUL THAKUR',
        'skills': ['Playwright', 'JavaScript', 'TypeScript', 'API Testing', 'Manual Testing',
                   'Automation Testing', 'CI/CD Integration', 'Git / GitHub', 'Postman', 'JIRA'],
        'experience': 'Software QA Intern at ABYM Technology. 6 months. Executed manual and automation testing for healthcare applications.',
        'education': 'Bachelor of Computer Applications (BCA) — Currently Pursuing'
    }

    jd = "Looking for a QA Automation Engineer with experience in Playwright, JavaScript, API testing, and CI/CD."
    jd_skills = ["Playwright", "JavaScript", "API Testing", "CI/CD"]
    matched = ["Playwright", "JavaScript", "API Testing", "CI/CD"]
    missing = []

    print("Generating HR interview questions...\n")
    questions = generate_questions(test_entities, jd, jd_skills, matched, missing)
    print(questions)
