# main_combined.py

import os
import math
import requests
import numpy as np
import faiss
import joblib
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# =====================================================
# APP INIT
# =====================================================

app = FastAPI(title="Agentic Medical Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# ENV VARS
# =====================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# =====================================================
# LAZY ML SINGLETONS
# =====================================================

_embedder = None
_dept_index = None
_department_names = None

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(
            "all-MiniLM-L6-v2",
            device="cpu"
        )
    return _embedder


def load_department_index():
    global _dept_index, _department_names

    if _dept_index is not None:
        return

    embedder = get_embedder()

    department_knowledge = {
        "Emergency Medicine": "Life threatening conditions including cardiac arrest, stroke, severe trauma, heavy bleeding, respiratory failure.",
        "General Medicine": "Common illnesses including fever, fatigue, infections, general weakness.",
        "Cardiology": "Heart related disorders including chest pain, heart attack, arrhythmia.",
        "Neurology": "Brain and nervous system disorders including stroke, seizures, migraine.",
        "Dermatology": "Skin diseases including rash, eczema, acne.",
        "Orthopedics": "Bone and joint disorders including fractures, arthritis.",
        "Pediatrics": "Medical care for infants and children.",
        "Psychiatry": "Mental health conditions including depression and anxiety.",
        "Gastroenterology": "Digestive disorders including abdominal pain and vomiting.",
        "Pulmonology": "Respiratory diseases including asthma and pneumonia.",
    }

    _department_names = list(department_knowledge.keys())
    texts = list(department_knowledge.values())

    embeddings = embedder.encode(texts, convert_to_numpy=True)
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    _dept_index = index


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


# =====================================================
# HEALTH
# =====================================================

@app.get("/health")
def health():
    return {"status": "ok"}


# =====================================================
# PREDICT
# =====================================================

@app.post("/predict")
def predict(data: SymptomRequest):
    load_department_index()
    embedder = get_embedder()

    user_embedding = embedder.encode([data.symptoms], convert_to_numpy=True)
    distances, indices = _dept_index.search(user_embedding, k=3)

    scores = 1 / (1 + distances[0])
    scores /= scores.sum()

    results = []
    for i, idx in enumerate(indices[0]):
        results.append({
            "Department": _department_names[idx],
            "Final Confidence (%)": round(float(scores[i] * 100), 2)
        })

    return {
        "System": "Semantic Knowledge Engine",
        "Top 3 Recommendations": results
    }


# =====================================================
# NEAREST HOSPITAL
# =====================================================

@app.post("/nearest-hospital")
def nearest_hospital(location: LocationRequest):
    overpass_url = "https://overpass-api.de/api/interpreter"

    query = f"""
    [out:json];
    node
      ["amenity"="hospital"]
      (around:5000,{location.latitude},{location.longitude});
    out;
    """

    try:
        res = requests.post(overpass_url, data=query, timeout=10)
        data = res.json()

        if not data.get("elements"):
            return {"name": "No hospital found nearby", "distance": 0}

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

    print(f"✅ Starting server on port {PORT}...")
    uvicorn.run(app, host="0.0.0.0", port=8010)
