from src.parser import parse_resume
from src.extractor import extract_entities
from src.scorer import score_resume
from src.config import SUPPORTED_FORMATS, MIN_SCORE_THRESHOLD
from src.question_gen import generate_questions
import os
import json, requests


def extract_jd_skills(jd_text):
    """Extract required skills from JD using Ollama."""
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
            raw = response.json().get('response', '')
            skills = [s.strip().strip('-').strip('•').strip() for s in raw.split(',')]
            return [s for s in skills if s and len(s) < 50]
        else:
            return []
    except:
        print("Warning: Ollama not running. Enter skills manually.")
        manual = input("Enter required skills (comma-separated): ")
        return [s.strip() for s in manual.split(',')]

def process_folder(folder_path):
    """Parse all resumes in a folder, return extracted data."""
    if not os.path.isdir(folder_path):
        raise FileNotFoundError(f"Folder not found: {folder_path}")

    results = {}
    errors = []

    for filename in os.listdir(folder_path):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED_FORMATS:
            continue

        filepath = os.path.join(folder_path, filename)
        try:
            text = parse_resume(filepath)
            entities = extract_entities(text)
            results[filename] = {
                'text': text,
                'entities': entities
            }
            print(f"  Parsed: {filename} ({entities.get('name', 'Unknown')})")
        except Exception as e:
            errors.append({'file': filename, 'error': str(e)})
            print(f"  Failed: {filename} — {e}")

    return results, errors


def rank_against_jd(parsed_resumes, jd_text, jd_skills):
    """Score and rank all parsed resumes against a JD."""
    ranked = []

    for filename, data in parsed_resumes.items():
        result = score_resume(data['text'], jd_text, jd_skills)
        result['file'] = filename
        result['entities'] = data['entities']
        ranked.append(result)

    ranked.sort(key=lambda x: x['final_score'], reverse=True)
    return ranked


def display_results(ranked, threshold=MIN_SCORE_THRESHOLD):
    """Pretty print ranked results."""
    print("\n" + "=" * 60)
    print("RESUME RANKING RESULTS")
    print("=" * 60)

    above = [r for r in ranked if r['final_score'] >= threshold]
    below = [r for r in ranked if r['final_score'] < threshold]

    if above:
        print(f"\n SHORTLISTED ({len(above)} candidates above {threshold} threshold):\n")
        for i, r in enumerate(above, 1):
            print(f"  {i}. {r['entities'].get('name', 'Unknown')} ({r['file']})")
            print(f"     Score: {r['final_score']} | Embedding: {r['embedding_score']} | Skills: {r['skill_score']}")
            print(f"     Matched: {r['matched_skills']}")
            print(f"     Missing: {r['missing_skills']}")
            print()

    if below:
        print(f"\n NOT SHORTLISTED ({len(below)} candidates below threshold):\n")
        for r in below:
            print(f"  - {r['entities'].get('name', 'Unknown')} ({r['file']}) — Score: {r['final_score']}")
        print()


def generate_candidate_questions(ranked, jd_text, jd_skills):
    """Let user select a candidate and generate HR questions."""
    shortlisted = [r for r in ranked if r['final_score'] >= MIN_SCORE_THRESHOLD]

    if not shortlisted:
        print("No shortlisted candidates to generate questions for.")
        return

    print("\nSelect a candidate for interview questions:")
    for i, r in enumerate(shortlisted, 1):
        print(f"  {i}. {r['entities'].get('name', 'Unknown')} — Score: {r['final_score']}")

    try:
        choice = int(input("\nEnter number (0 to skip): "))
        if choice == 0:
            return
        if 1 <= choice <= len(shortlisted):
            selected = shortlisted[choice - 1]
            name = selected['entities'].get('name', 'Unknown')
            print(f"\nGenerating HR questions for {name}...\n")

            questions = generate_questions(
                resume_entities=selected['entities'],
                jd_text=jd_text,
                jd_skills=jd_skills,
                matched_skills=selected['matched_skills'],
                missing_skills=selected['missing_skills']
            )
            print(questions)
        else:
            print("Invalid choice.")
    except ValueError:
        print("Invalid input.")


if __name__ == "__main__":
    RESUME_FOLDER = "data/sample_resumes"

    # Step 0: Take JD input from user
    print("=" * 60)
    print("RESUME ANALYSER")
    print("=" * 60)
    print("\nPaste the Job Description (press Enter twice when done):\n")

    lines = []
    while True:
        line = input()
        if line == "":
            if lines and lines[-1] == "":
                break
            lines.append(line)
        else:
            lines.append(line)
    JD_TEXT = "\n".join(lines).strip()

    # Extract skills from JD using Ollama
    print("\nExtracting skills from JD...")
    JD_SKILLS = extract_jd_skills(JD_TEXT)
    print(f"Extracted Skills: {JD_SKILLS}")

    print("\nStep 1: Parsing all resumes...")
    parsed, errors = process_folder(RESUME_FOLDER)
    print(f"\nParsed: {len(parsed)} | Failed: {len(errors)}")

    print("\nStep 2: Scoring against JD...")
    ranked = rank_against_jd(parsed, JD_TEXT, JD_SKILLS)

    display_results(ranked)

    if errors:
        print("ERRORS:")
        for e in errors:
            print(f"  {e['file']}: {e['error']}")

    print("\nStep 3: Interview Question Generation")
    generate_candidate_questions(ranked, JD_TEXT, JD_SKILLS)


