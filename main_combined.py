from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import math
import requests

# =====================================================
# APP
# =====================================================

app = FastAPI(title="Agentic Medical Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# ENV
# =====================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# =====================================================
# LAZY SINGLETONS
# =====================================================

_embedder = None
_faiss_index = None
_departments = None
_groq_client = None


def get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
    return _embedder


def load_department_index():
    global _faiss_index, _departments

    if _faiss_index is not None:
        return

    import numpy as np
    import faiss

    knowledge = {
        "Emergency Medicine": "Life threatening conditions including cardiac arrest, stroke, trauma, breathing failure.",
        "General Medicine": "Fever, weakness, infections, common illnesses.",
        "Cardiology": "Chest pain, heart attack, arrhythmia, hypertension.",
        "Neurology": "Stroke, seizures, migraine, paralysis.",
        "Dermatology": "Skin rash, acne, fungal infection.",
        "Orthopedics": "Joint pain, fractures, arthritis.",
        "Pediatrics": "Child health and infections.",
        "Psychiatry": "Mental health issues like anxiety and depression.",
        "Gastroenterology": "Abdominal pain, vomiting, digestion issues.",
        "Pulmonology": "Asthma, pneumonia, breathing problems."
    }

    _departments = list(knowledge.keys())
    texts = list(knowledge.values())

    embedder = get_embedder()
    embeddings = embedder.encode(texts, convert_to_numpy=True)

    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    _faiss_index = index


def get_groq_client():
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            return None
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


# =====================================================
# UTILS
# =====================================================

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2 +
        math.cos(math.radians(lat1)) *
        math.cos(math.radians(lat2)) *
        math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# =====================================================
# SCHEMAS
# =====================================================

class SymptomRequest(BaseModel):
    symptoms: str


class LocationRequest(BaseModel):
    latitude: float
    longitude: float


class ChatRequest(BaseModel):
    message: Optional[str] = None


class ExplainRequest(BaseModel):
    symptoms: str
    predicted_department: str


# =====================================================
# ENDPOINTS
# =====================================================

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(data: SymptomRequest):
    import numpy as np

    load_department_index()
    embedder = get_embedder()

    user_embedding = embedder.encode([data.symptoms], convert_to_numpy=True)
    distances, indices = _faiss_index.search(user_embedding, k=3)

    scores = 1 / (1 + distances[0])
    scores /= scores.sum()

    results = []
    for i, idx in enumerate(indices[0]):
        results.append({
            "Department": _departments[idx],
            "Final Confidence (%)": round(float(scores[i] * 100), 2)
        })

    return {
        "System": "Semantic Knowledge Engine",
        "Top 3 Recommendations": results
    }


@app.post("/nearest-hospital")
def nearest_hospital(location: LocationRequest):
    overpass_url = "https://overpass-api.de/api/interpreter"

    query = f"""
    [out:json];
    node["amenity"="hospital"](around:5000,{location.latitude},{location.longitude});
    out;
    """

    try:
        res = requests.post(overpass_url, data=query, timeout=10)
        data = res.json()

        if not data.get("elements"):
            return {"name": "No hospital found nearby", "distance_km": 0}

        nearest = None
        min_dist = float("inf")

        for h in data["elements"]:
            dist = haversine(
                location.latitude,
                location.longitude,
                h["lat"],
                h["lon"]
            )
            if dist < min_dist:
                min_dist = dist
                nearest = h

        return {
            "name": nearest.get("tags", {}).get("name", "Unnamed Hospital"),
            "distance_km": round(min_dist, 2),
            "maps_url": f"https://www.google.com/maps/dir/?api=1&destination={nearest['lat']},{nearest['lon']}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
def chat(req: ChatRequest):
    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    if not req.message:
        raise HTTPException(status_code=422, detail="Message required")

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a medical information assistant. No diagnosis."},
            {"role": "user", "content": req.message}
        ],
        temperature=0.3,
        max_tokens=200,
    )

    return {"response": completion.choices[0].message.content}


@app.post("/explain")
def explain(req: ExplainRequest):
    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    prompt = (
        f"Symptoms: {req.symptoms}\n"
        f"Predicted Department: {req.predicted_department}\n\n"
        "Explain why this department is suitable. No diagnosis."
    )

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "Medical explainability assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=150,
    )

    return {"explanation": completion.choices[0].message.content}


    print(f"✅ Starting server on port {PORT}...")
    uvicorn.run(app, host="0.0.0.0", port=8010)
