from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Generator, List
from contextlib import asynccontextmanager
import os
import math
import json
import requests
from dotenv import load_dotenv

load_dotenv()

# =====================================================
# APP
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load heavy models at startup so first request is fast."""
    print("⏳ Pre-loading ML models...")
    load_department_index()   # loads SentenceTransformer + FAISS
    get_groq_client()         # initialises Groq client
    print("✅ Models ready.")
    yield

app = FastAPI(title="Agentic Medical Analyser", lifespan=lifespan)

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


class TriageInput(BaseModel):
    symptoms: str
    age: Optional[int] = None
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    heart_rate: Optional[float] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[float] = None


# =====================================================
# ENDPOINTS
# =====================================================

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/triage")
def triage(data: TriageInput):
    """
    Combined triage endpoint: FAISS department prediction + risk scoring.
    Returns everything the frontend needs in a single call.
    """
    import numpy as np

    # --- Department prediction via FAISS ---
    load_department_index()
    embedder = get_embedder()
    user_embedding = embedder.encode([data.symptoms], convert_to_numpy=True)
    distances, indices = _faiss_index.search(user_embedding, k=3)
    scores = 1 / (1 + distances[0])
    scores /= scores.sum()

    top_dept = _departments[indices[0][0]]
    top_confidence = round(float(scores[0] * 100), 2)

    # --- Lightweight risk scoring using vitals ---
    risk_score = 0.0

    # Age
    age = data.age or 0
    if age > 65:
        risk_score += 3
    elif age > 50:
        risk_score += 1.5
    if age < 5:
        risk_score += 2

    # Blood pressure
    sys_bp = data.systolic_bp or 0
    dia_bp = data.diastolic_bp or 0
    if sys_bp > 180 or dia_bp > 120:
        risk_score += 5
    elif sys_bp > 140 or dia_bp > 90:
        risk_score += 2.5

    # Heart rate
    hr = data.heart_rate or 0
    if hr > 120 or (0 < hr < 50):
        risk_score += 4
    elif hr > 100:
        risk_score += 2

    # Temperature
    temp = data.temperature or 0
    if temp > 39.5:
        risk_score += 4
    elif temp > 38:
        risk_score += 2

    # Oxygen saturation
    spo2 = data.oxygen_saturation or 100
    if spo2 < 90:
        risk_score += 6
    elif spo2 < 95:
        risk_score += 3

    # Symptom count contributes to risk
    symptom_count = len([s.strip() for s in data.symptoms.split(",") if s.strip()])
    risk_score += symptom_count * 1.5  # each symptom adds mild weight

    if risk_score >= 20:
        risk_level = "High"
    elif risk_score >= 10:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {
        "department": top_dept,
        "confidence": top_confidence,
        "risk_level": risk_level,
        "top3": [
            {"department": _departments[indices[0][i]], "confidence": round(float(scores[i] * 100), 2)}
            for i in range(len(indices[0]))
        ]
    }


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
    lat, lon = location.latitude, location.longitude

    def run_query(radius: int):
        # Union query: nodes + ways + relations (hospitals mapped as any OSM type)
        query = f"""
[out:json][timeout:25];
(
  node["amenity"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="hospital"](around:{radius},{lat},{lon});
  relation["amenity"="hospital"](around:{radius},{lat},{lon});
);
out center tags;
"""
        res = requests.post(overpass_url, data={"data": query}, timeout=20)
        res.raise_for_status()
        return res.json()

    try:
        # Try 10 km first, then fall back to 25 km
        for radius in [10000, 25000]:
            data = run_query(radius)
            elements = data.get("elements", [])
            if elements:
                break

        if not elements:
            return {"name": "No hospital found nearby", "distance_km": 0, "maps_url": None}

        nearest = None
        min_dist = float("inf")

        for h in elements:
            # nodes have lat/lon directly; ways/relations expose it via 'center'
            h_lat = h.get("lat") or (h.get("center") or {}).get("lat")
            h_lon = h.get("lon") or (h.get("center") or {}).get("lon")
            if h_lat is None or h_lon is None:
                continue
            dist = haversine(lat, lon, h_lat, h_lon)
            if dist < min_dist:
                min_dist = dist
                nearest = h
                nearest["_lat"] = h_lat
                nearest["_lon"] = h_lon

        if nearest is None:
            return {"name": "No hospital found nearby", "distance_km": 0, "maps_url": None}

        name = nearest.get("tags", {}).get("name", "Unnamed Hospital")
        maps_url = (
            f"https://www.google.com/maps/dir/?api=1"
            f"&destination={nearest['_lat']},{nearest['_lon']}"
            f"&destination_place_id={name.replace(' ', '+')}"
        )

        return {
            "name": name,
            "distance_km": round(min_dist, 2),
            "maps_url": maps_url,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hospital search failed: {str(e)}")


@app.post("/chat")
def chat(req: ChatRequest):
    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    if not req.message:
        raise HTTPException(status_code=422, detail="Message required")

    # llama3-8b is ~3-4x faster than 70b for simple Q&A
    completion = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "system", "content": "You are a medical information assistant. Be concise. No diagnosis."},
            {"role": "user", "content": req.message}
        ],
        temperature=0.3,
        max_tokens=200,
    )

    return {"response": completion.choices[0].message.content}


@app.post("/explain")
def explain(req: ExplainRequest):
    """Streams the explanation token-by-token so the user sees text immediately."""
    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    prompt = (
        f"Patient symptoms: {req.symptoms}.\n"
        f"Recommended department: {req.predicted_department}.\n"
        "In 3-4 concise sentences, explain why this department handles these symptoms. "
        "Do not diagnose. Be clear and direct."
    )

    def token_stream() -> Generator[str, None, None]:
        stream = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": "You are a concise medical explainability assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=180,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    return StreamingResponse(token_stream(), media_type="text/plain")


class TranslateSymptomsRequest(BaseModel):
    text: str                          # raw speech transcript (any language)
    source_lang: str = "English"       # human-readable language name
    available_symptoms: List[str] = [] # exact symptom strings from the frontend


@app.post("/translate-symptoms")
def translate_symptoms(req: TranslateSymptomsRequest):
    """
    Translates speech-to-text from any language → English, then matches
    the content against the provided list of known medical symptoms.
    Returns { translation, matched_symptoms }.
    """
    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    if not req.text.strip():
        return {"translation": "", "matched_symptoms": []}

    symptoms_str = ", ".join(req.available_symptoms)
    prompt = (
        f'The patient spoke in {req.source_lang} and said: "{req.text}"\n\n'
        f"Available symptom list: {symptoms_str}\n\n"
        "Tasks:\n"
        "1. Translate what the patient said into English.\n"
        "2. Identify every symptom from the available list that matches or closely corresponds to what they described.\n"
        "3. Return ONLY a valid JSON object with exactly these two fields:\n"
        '   { "translation": "<English translation>", "matched_symptoms": [<exact symptom strings from the list>] }\n'
        "No extra text. No markdown. Only the JSON object."
    )

    completion = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=400,
    )

    raw = completion.choices[0].message.content.strip()
    # Strip any accidental markdown code fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        result = json.loads(raw)
        # Ensure matched_symptoms are actually in the available list
        valid = set(req.available_symptoms)
        result["matched_symptoms"] = [s for s in result.get("matched_symptoms", []) if s in valid]
        return result
    except Exception:
        return {"translation": req.text, "matched_symptoms": []}


if __name__ == "__main__":
    import uvicorn
    print("✅ Starting backend server on http://localhost:8010 ...")
    uvicorn.run(app, host="0.0.0.0", port=8010)
