import requests
import json


OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5-coder:7b"


def generate_questions(resume_entities, jd_text, jd_skills, matched_skills, missing_skills):
    """Generate HR interview questions based on resume vs JD analysis."""

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
- Questions to check if the candidate truly understands the skills they claimed on their resume
- Not coding questions — ask them to explain concepts, compare approaches, describe how things work

EXPERIENCE VALIDATION (3 questions):
- Questions about their past work — what they did, what challenges they faced, what they learned
- Behavioral questions to verify their resume claims are real

GAP ASSESSMENT (2 questions):
- Questions about skills required in the JD but missing from their resume
- Check if they have any awareness or willingness to learn

CONFIDENCE CHECK (2 questions):
- Ask them to rate themselves on a skill, then follow up with a deeper question
- Tests honesty and self-awareness

Format each question with its category label. Keep questions conversational, not academic."""

    try:
        response = requests.post(OLLAMA_URL, json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.4,
                "num_predict": 1000
            }
        })

        if response.status_code == 200:
            return response.json().get('response', 'No questions generated.')
        else:
            return f"Error: {response.status_code} — {response.text}"

    except requests.ConnectionError:
        return "Error: Ollama not running. Start it with 'ollama serve' in another terminal."


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
