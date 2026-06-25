from sentence_transformers import SentenceTransformer
import numpy as np


model = SentenceTransformer('all-MiniLM-L6-v2')


def generate_embedding(text):
    """Convert text to a vector embedding."""
    return model.encode(text, normalize_embeddings=True)


def calculate_similarity(embedding1, embedding2):
    """Cosine similarity between two embeddings."""
    return np.dot(embedding1, embedding2)


def rank_resumes(jd_text, resume_texts):
    """
    Rank resumes against a job description.

    Args:
        jd_text: Job description string
        resume_texts: Dict of {filename: extracted_text}

    Returns:
        Sorted list of (filename, score) tuples
    """
    jd_embedding = generate_embedding(jd_text)

    scores = {}
    for filename, text in resume_texts.items():
        resume_embedding = generate_embedding(text)
        score = calculate_similarity(jd_embedding, resume_embedding)
        scores[filename] = float(score)

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return ranked


# Quick test
if __name__ == "__main__":
    jd = "Looking for a Python developer with experience in machine learning, FastAPI, and SQL databases."

    resumes = {
        "resume1.pdf": "John Doe. Python developer with 3 years experience in machine learning, deep learning, FastAPI, PostgreSQL.",
        "resume2.pdf": "Jane Smith. Frontend developer skilled in React, JavaScript, HTML, CSS, Figma.",
        "resume3.pdf": "Bob Wilson. Data scientist with Python, scikit-learn, pandas, SQL, machine learning models.",
    }

    results = rank_resumes(jd, resumes)

    print("Ranking Results:")
    print("-" * 40)
    for filename, score in results:
        print(f"  {filename}: {score:.4f}")
