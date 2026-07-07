from dotenv import load_dotenv
load_dotenv()

import requests
from src.config import OPENROUTER_API_KEY, OPENROUTER_MODEL


def call_llm(prompt, max_tokens=500, temperature=0.3):
    """Call OpenRouter API, fallback to Ollama if fails."""

    # OpenRouter (cloud)
    if OPENROUTER_API_KEY:
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": temperature
                }
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
        except:
            pass

    # Fallback: Ollama (local)
    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "qwen2.5-coder:7b",
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens}
        })
        if response.status_code == 200:
            return response.json().get("response", "")
    except:
        pass

    return ""
