import os
from pinecone import Pinecone
from src.embedder import generate_embedding

# Load credentials from .env
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "resume-analyser")

# Initialize Pinecone Cloud Client
if PINECONE_API_KEY:
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
else:
    index = None


def add_resume_vector(application_id: int, text: str, name: str, email: str):
    """Generate embedding and upload to Pinecone Cloud Index."""
    if index is None:
        print("Pinecone client is not initialized. Skip upload.")
        return

    # Generate 768-D embedding vector
    embedding = generate_embedding(text).tolist()

    # Pinecone expects list of dicts for upsert: (id, vector, metadata)
    index.upsert(
        vectors=[
            {
                "id": str(application_id),
                "values": embedding,
                "metadata": {
                    "name": name or "",
                    "email": email or "",
                    "text_preview": text[:500]  # Store preview snippet
                }
            }
        ]
    )
    print(f"Successfully uploaded vector {application_id} to Pinecone Cloud!")


def query_semantic_candidates(jd_text: str, limit: int = 5):
    """Query Pinecone Cloud using Job Description embedding."""
    if index is None:
        print("Pinecone client is not initialized. Skip query.")
        return []

    # Generate JD embedding vector in RAM
    jd_embedding = generate_embedding(jd_text).tolist()

    # Query Pinecone
    results = index.query(
        vector=jd_embedding,
        top_k=limit,
        include_metadata=True
    )

    # Return list of matched candidate application IDs
    return [match["id"] for match in results["matches"]] if "matches" in results else []