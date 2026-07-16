import os
import chromadb
from src.embedder import generate_embedding

# Path configuration (data/chroma_db me database local store hoga)
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_db")
os.makedirs(DB_PATH, exist_ok=True)

# Client Initialization
chroma_client = chromadb.PersistentClient(path=DB_PATH)
collection = chroma_client.get_or_create_collection(name="candidate_resumes")

def add_resume_vector(application_id: int, text: str, name: str, email: str):
    """Generate embedding and add resume details to ChromaDB."""
    # Cosine search embeddings list create
    embedding = generate_embedding(text).tolist() # Convert numpy array to list
    
    collection.add(
        embeddings=[embedding],
        documents=[text[:1000]], # Storing a preview snippet
        metadatas=[{"name": name or "", "email": email or ""}],
        ids=[str(application_id)]
    )

def query_semantic_candidates(jd_text: str, limit: int = 5):
    """Query ChromaDB for top matched candidate application IDs."""
    jd_embedding = generate_embedding(jd_text).tolist()
    results = collection.query(
        query_embeddings=[jd_embedding],
        n_results=limit
    )
    return results["ids"][0] if results["ids"] else []