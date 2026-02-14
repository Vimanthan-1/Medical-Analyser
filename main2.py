import os
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

# ==============================
# App Initialization
# ==============================

app = FastAPI(title="Explainability Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# Load Gemini
# ==============================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY not found in .env")

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.5-flash")

# ==============================
# Request Schema
# ==============================

class ExplainRequest(BaseModel):
    age: int
    gender: str
    symptoms: List[str]
    vitals: Dict[str, float]
    pre_existing_conditions: List[str]
    predicted_risk: str
    recommended_department: str

# ==============================
# Health Check
# ==============================

@app.get("/health")
def health():
    return {"status": "Explainability backend running"}

# ==============================
# Explain Endpoint
# ==============================

@app.post("/explain")
async def explain(request: ExplainRequest):

    prompt = f"""
You are a medical AI explainability assistant.

STRICT RULES:
- Do NOT change the prediction.
- Do NOT diagnose.
- Do NOT suggest treatments.
- Only explain why the given prediction makes sense.
- Output only bullet points.
- Each bullet must start with "- ".
- Maximum 6 bullet points.
- No paragraphs.

Patient Data:
Age: {request.age}
Gender: {request.gender}
Symptoms: {", ".join(request.symptoms)}
Vitals: {request.vitals}
Pre-existing conditions: {", ".join(request.pre_existing_conditions)}

Model Output:
Risk Level: {request.predicted_risk}
Recommended Department: {request.recommended_department}
"""

    try:
        response = model.generate_content(prompt)

        if not response.text:
            raise HTTPException(status_code=500, detail="Empty response from AI")

        return {"explanation": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail="AI explanation failed")