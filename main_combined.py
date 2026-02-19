
import os
import math
import requests
import numpy as np
import faiss
import joblib
import joblib
from groq import Groq
from typing import List, Dict, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, APIRouter, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
import pdfplumber
import json
from sentence_transformers import SentenceTransformer
import pickle
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load Google Maps API Key
GOOGLE_API_KEY = None
try:
    with open("API_KEY", "r") as f:
        content = f.read().strip()
        if "API_KEY=" in content:
            GOOGLE_API_KEY = content.split("=")[1]
        else:
            GOOGLE_API_KEY = content
except FileNotFoundError:
    # Try looking in parent directory as fallback (d:/Final/Agentic-Medical-Analyser/API_KEY)
    try:
        with open("../API_KEY", "r") as f:
             content = f.read().strip()
             if "API_KEY=" in content:
                GOOGLE_API_KEY = content.split("=")[1]
             else:
                GOOGLE_API_KEY = content
    except FileNotFoundError:
        print("Warning: API_KEY file not found. Google Maps features will be disabled.")



# =====================================================
# 1️⃣ CONFIGURATION & SETUP
# =====================================================

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY not found in .env")
else:
    print(f"Found GROQ_API_KEY: {GROQ_API_KEY[:5]}...{GROQ_API_KEY[-4:]}")

try:
    client = Groq(api_key=GROQ_API_KEY)
    print("Groq Client Initialized")
except Exception as e:
    print(f"Failed to initialize Groq client: {e}")
    client = None


# Initialize FastAPI
app = FastAPI(title="Agentic Medical Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# 2️⃣ DATABASE SETUP (SQLite)
# =====================================================


import sys

# Use absolute path for DB to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'medical_ai.db')}"
sys.stderr.write(f"DB URL: {DATABASE_URL}\n")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class PredictionLog(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    symptoms = Column(String)
    department_1 = Column(String)
    confidence_1 = Column(Float)
    department_2 = Column(String)
    confidence_2 = Column(Float)
    department_3 = Column(String)
    confidence_3 = Column(Float)
    emergency = Column(Boolean)

def init_db():
    Base.metadata.create_all(bind=engine)

# =====================================================
# SKIP TO PYDANTIC MODELS
# =====================================================

class TriageRequest(BaseModel):
    Name: Optional[str] = "Anonymous"
    Age: Optional[int] = 30
    Gender: Optional[str] = "Male"
    Systolic_BP: Optional[int] = 120
    Diastolic_BP: Optional[int] = 80
    Heart_Rate: Optional[int] = 72
    Temperature: Optional[float] = 37.0
    Symptoms: str

# ... (Previous code) ...

@app.post("/triage")
def triage_endpoint(data: TriageRequest):
    risk_level = predict_risk_logic(data)
    return {"risk_level": risk_level}

# Initialize DB on import
init_db()

# =====================================================
# 3️⃣ AI MODELS & KNOWLEDGE BASE
# =====================================================

# Load Sentence Transformer
try:
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
except Exception as e:
    print(f"Error loading SentenceTransformer: {e}")
    embedder = None

# --- Department Knowledge Base ---
department_knowledge = {
    "Emergency Medicine": "Life threatening conditions including cardiac arrest, stroke, severe trauma, heavy bleeding, respiratory failure.",
    "General Medicine": "Common illnesses including fever, fatigue, infections, general weakness, non-specific symptoms.",
    "Cardiology": "Heart related disorders including chest pain, heart attack, arrhythmia, hypertension, coronary artery disease.",
    "Neurology": "Brain and nervous system disorders including stroke, seizures, migraine, neuropathy, paralysis.",
    "Dermatology": "Skin diseases including rash, eczema, acne, fungal infection, psoriasis.",
    "Orthopedics": "Bone and joint disorders including fractures, arthritis, joint pain, spine injury.",
    "Pediatrics": "Medical care for infants and children including childhood infections and growth issues.",
    "Psychiatry": "Mental health conditions including depression, anxiety, bipolar disorder, hallucinations.",
    "Gastroenterology": "Digestive system disorders including abdominal pain, vomiting, diarrhea, liver disease.",
    "Pulmonology": "Respiratory diseases including asthma, pneumonia, breathing difficulty, chronic cough.",
    "Urology": "Urinary tract disorders including kidney stones, urinary infections, prostate issues.",
    "Nephrology": "Kidney related diseases including renal failure, dialysis conditions, electrolyte imbalance.",
    "Endocrinology": "Hormonal disorders including diabetes, thyroid disease, metabolic syndrome.",
    "Oncology": "Cancer related conditions including tumor growth, chemotherapy, radiation therapy.",
    "ENT": "Ear, nose and throat disorders including sinusitis, hearing loss, throat infections.",
    "Ophthalmology": "Eye related diseases including vision loss, cataract, glaucoma, eye infection.",
    "Gynecology": "Female reproductive health including menstrual disorders, ovarian cyst, pelvic pain."
}

department_names = list(department_knowledge.keys())
knowledge_texts = list(department_knowledge.values())

# Build Semantic Index (Department)
if embedder:
    knowledge_embeddings = embedder.encode(knowledge_texts)
    d_dimension = knowledge_embeddings.shape[1]
    dept_index = faiss.IndexFlatL2(d_dimension)
    dept_index.add(np.array(knowledge_embeddings))
else:
    dept_index = None

# --- Training Data (For Similar Past Cases) ---
training_data = [
    ("Chest pain radiating to left arm", "Cardiology"),
    ("Shortness of breath and chest tightness", "Pulmonology"),
    ("Frequent urination and burning sensation", "Urology"),
    ("Skin rash with itching and redness", "Dermatology"),
    ("Severe headache and dizziness", "Neurology"),
    ("Joint pain and swelling", "Orthopedics"),
    ("Fever and persistent cough", "General Medicine"),
    ("Abdominal pain and vomiting", "Gastroenterology"),
    ("Irregular heartbeat and palpitations", "Cardiology"),
    ("Seizure episode and confusion", "Neurology"),
]

train_texts = [x[0] for x in training_data]
train_labels = [x[1] for x in training_data]

# Build Case Index
if embedder:
    train_embeddings = embedder.encode(train_texts)
    c_dimension = train_embeddings.shape[1]
    case_index = faiss.IndexFlatL2(c_dimension)
    case_index.add(np.array(train_embeddings))
else:
    case_index = None

# --- Custom Classifier (Logistic Regression) ---
classifier = None
if os.path.exists("models/trained_model/classifier.pkl"):
    try:
        classifier = joblib.load("models/trained_model/classifier.pkl")
    except Exception:
        print("Could not load classifier.pkl")

# --- Triage Model (Risk Prediction) ---
triage_model = None
triage_encoder = None
try:
    if os.path.exists("models/triage_model.pkl") and os.path.exists("models/encoders.pkl"):
        with open("models/triage_model.pkl", "rb") as f:
            triage_model = pickle.load(f)
        with open("models/encoders.pkl", "rb") as f:
            triage_encoder = pickle.load(f)
        print("Triage Risk Model Loaded")
    else:
        print("Warning: Triage models not found in models/")
except Exception as e:
    print(f"Error loading triage models: {e}")

# --- Emergency Detection ---
emergency_sentences = [
    "heart attack",
    "stroke",
    "severe bleeding",
    "unconscious",
    "difficulty breathing"
]
if embedder:
    emergency_embeddings = embedder.encode(emergency_sentences)
else:
    emergency_embeddings = None

def check_emergency(text):
    if not embedder or emergency_embeddings is None:
        return False
    
    input_embedding = embedder.encode([text])
    similarities = np.dot(input_embedding, emergency_embeddings.T)
    max_score = np.max(similarities)

    if max_score > 0.6:
        return True
    return False

# =====================================================
# 4️⃣ PYDANTIC MODELS
# =====================================================

class LocationRequest(BaseModel):
    latitude: float
    longitude: float

class ChatRequest(BaseModel):
    message: Optional[str] = None
    prompt: Optional[str] = None
    text: Optional[str] = None
    question: Optional[str] = None

class ChatResponse(BaseModel):
    response: str

class ExplainRequest(BaseModel):
    symptoms: str
    predicted_department: str

class SymptomRequest(BaseModel):
    symptoms: str  # Assuming string input based on usage



# =====================================================
# 5️⃣ CORE LOGIC
# =====================================================

def predict_risk_logic(data: TriageRequest):
    # --- SAFETY OVERRIDE: Rule-Based check for Critical Vitals/Symptoms ---
    
    # 1. Critical Vitals Check
    is_critical_vitals = False
    if (data.Heart_Rate and (data.Heart_Rate > 120 or data.Heart_Rate < 40)): is_critical_vitals = True
    if (data.Systolic_BP and (data.Systolic_BP > 180 or data.Systolic_BP < 90)): is_critical_vitals = True
    if (data.Temperature and data.Temperature > 39.5): is_critical_vitals = True

    # 2. Critical Keyword Check (Simple String Matching)
    # These symptoms should nearly ALWAYS be High Risk
    critical_keywords = [
        "chest pain", "cardiac", "heart attack", "unconscious",
        "difficulty breathing", "shortness of breath", "severe bleeding",
        "stroke", "paralysis", "sudden vision loss", "severe headache", "high fever"
    ]
    is_critical_symptoms = any(k in data.Symptoms.lower() for k in critical_keywords)

    # 3. Embedding-based Emergency Check
    is_emergency_embedding = check_emergency(data.Symptoms)

    if is_critical_vitals or is_critical_symptoms or is_emergency_embedding:
        print(f"⚠️ Safety Override Triggered: Vitals={is_critical_vitals}, Keywords={is_critical_symptoms}, Embed={is_emergency_embedding}")
        return "High Risk"

    # --- END SAFETY OVERRIDE ---

    if not triage_model or not triage_encoder:
        return "Model not loaded"

    try:
        # 1. Compute MAP
        mean_bp = (data.Systolic_BP + 2 * data.Diastolic_BP) / 3

        # 2. Numerical Features
        X_num = np.array([[
            data.Age,
            mean_bp,
            data.Heart_Rate,
            data.Temperature
        ]])

        # 3. Categorical Features
        # Note: Input must be 2D array for encoder
        X_cat = [[
            data.Gender,
            data.Symptoms
        ]]

        X_cat_encoded = triage_encoder.transform(X_cat)

        # 4. Combine
        X = np.hstack([X_num, X_cat_encoded])

        # 5. Predict
        prediction = triage_model.predict(X)[0]
        return prediction
    except Exception as e:
        print(f"Prediction error: {e}")
        return "Error"

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def hybrid_predict_logic(symptoms: str):
    if not embedder or not dept_index:
        return {"System": "Error", "Top 3 Recommendations": [], "Similar Past Cases": []}

    # Encode user input
    user_embedding = embedder.encode([symptoms])

    # 1. Semantic Search (Department Knowledge)
    distances, indices = dept_index.search(np.array(user_embedding), k=3)
    semantic_scores = 1 / (1 + distances[0])
    semantic_scores = semantic_scores / np.sum(semantic_scores) # Normalize

    semantic_results = []
    for i, idx in enumerate(indices[0]):
        semantic_results.append({
            "Department": department_names[idx],
            "Semantic Confidence (%)": round(float(semantic_scores[i] * 100), 2)
        })

    # 2. Similar Past Cases
    similar_cases = []
    if case_index:
        c_distances, c_indices = case_index.search(np.array(user_embedding), k=3)
        for i, idx in enumerate(c_indices[0]):
            if idx < len(training_data):
                similar_cases.append({
                    "Symptom": training_data[idx][0],
                    "Department": training_data[idx][1],
                    "Distance": float(c_distances[0][i])
                })

    # 3. ML Classifier (if available)
    ml_results = []
    if classifier:
        try:
            ml_probs = classifier.predict_proba(user_embedding)[0]
            ml_indices = np.argsort(ml_probs)[::-1][:3]
            for idx in ml_indices:
                ml_results.append({
                    "Department": classifier.classes_[idx],
                    "ML Confidence (%)": round(float(ml_probs[idx] * 100), 2)
                })
        except Exception:
            pass

    # 4. Hybrid Merge
    combined = {}
    
    # Weight Semantic
    for item in semantic_results:
        combined[item["Department"]] = item["Semantic Confidence (%)"] * 0.6
    
    # Weight ML
    for item in ml_results:
        if item["Department"] in combined:
            combined[item["Department"]] += item["ML Confidence (%)"] * 0.4
        else:
            combined[item["Department"]] = item["ML Confidence (%)"] * 0.4

    # If no ML, purely Semantic (renormalize if needed, or just leave as is)
    if not ml_results:
        # If we didn't add ML scores, the existing semantic scores are already 'good enough' relative to each other,
        # but they were multiplied by 0.6. Let's scale them back up or just use them.
        # Simple fix: If combined is low, just take semantic_results directly
        pass 

    sorted_final = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:3]
    
    final_results = []
    for dept, score in sorted_final:
        final_results.append({
            "Department": dept,
            "Final Confidence (%)": round(score, 2)
        })

    return {
        "System": "Hybrid Semantic + ML Engine" if classifier else "Semantic Knowledge Engine",
        "Top 3 Recommendations": final_results,
        "Similar Past Cases": similar_cases
    }

# =====================================================
# 6️⃣ ENDPOINTS
# =====================================================

@app.get("/health")
def health():
    return {"status": "Backend running", "models_loaded": embedder is not None}

@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    
    try:
        # Read the file content
        content = await file.read()
        
        # Groq Whisper expects a file-like object with a name
        audio_file = io.BytesIO(content)
        audio_file.name = file.filename
        
        translation = client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3",
            response_format="json",
        )
        return {"text": translation.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT failed: {str(e)}")

@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    filename = file.filename.lower()
    
    try:
        if filename.endswith(".pdf"):
            # PDF Extraction
            content = await file.read()
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = ""
                for page in pdf.pages:
                    text += page.extract_text() or ""
            
            # Use Groq to structure the extracted text
            system_prompt = "You are a medical assistant. Extract symptoms and vitals (Age, Gender, BP, Heart Rate, Temperature) from the following text into a clean JSON format."
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"}
            )
            return json.loads(chat_completion.choices[0].message.content)

        elif filename.endswith((".png", ".jpg", ".jpeg")):
            # Image OCR with Groq Vision
            content = await file.read()
            base64_image = base64.b64encode(content).decode('utf-8')
            
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Extract all medical symptoms and vitals (Age, Gender, Systolic BP, Diastolic BP, Heart Rate, Temperature) from this image. Return ONLY a JSON object."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                },
                            },
                        ],
                    }
                ],
                model="llama-3.2-11b-vision-preview", # Vision model
                response_format={"type": "json_object"}
            )
            return json.loads(chat_completion.choices[0].message.content)
        
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF or Image.")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

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
        response = requests.post(overpass_url, data=query, timeout=10)

        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="Overpass API failed")

        data = response.json()

        if not data.get("elements"):
            return {"name": "No hospital found nearby", "distance": 0}

        nearest = None
        min_distance = float("inf")

        for hospital in data["elements"]:
            dist = haversine(
                location.latitude, location.longitude,
                hospital["lat"], hospital["lon"]
            )
            if dist < min_distance:
                min_distance = dist
                nearest = hospital

        return {
            "name": nearest.get("tags", {}).get("name", "Unnamed Hospital"),
            "distance": round(min_distance, 2),
            "latitude": nearest["lat"],
            "longitude": nearest["lon"],
            "maps_url": (
                f"https://www.google.com/maps/dir/?api=1"
                f"&destination={nearest['lat']},{nearest['lon']}"
                f"&travelmode=driving"
            )
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):

    # 1️⃣ Ensure AI is available
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable"
        )

    # Coalesce input
    user_message = request.message or request.prompt or request.text or request.question
    
    if not user_message:
         raise HTTPException(status_code=422, detail="Message/prompt/text/question is required")

    # 2️⃣ Strongly constrained prompt
    system_prompt = (
        "You are an informational assistant.\n"
        "Rules:\n"
        "- No diagnosis\n"
        "- No treatment advice\n"
        "- No emergency instructions\n"
        "- Use bullet points only\n"
        "-Set your boundaries to only medical advices and concepts\n"
        "-Do not Talk about non medical topics\n"
        "- Max 5 bullets\n"
        "- One sentence per bullet"
    )

    try:
        # 3️⃣ Run Groq safely
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=200,
        )

        response_text = chat_completion.choices[0].message.content

        # 4️⃣ Validate response
        if not response_text:
            raise HTTPException(
                status_code=502,
                detail="Empty response from AI service"
            )

        return {"response": response_text.strip()}

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat service failed: {str(e)}"
        )

@app.post("/explain")
async def explain(request: ExplainRequest):
    if client is None:
        raise HTTPException(
            status_code=503, 
            detail="AI Service Unavailable: GROQ_API_KEY not found in .env file. Please add your Groq API key."
        )

    system_prompt = (
        "You are a medical AI explainability assistant.\n"
        "STRICT RULES:\n"
        "- Do NOT change the prediction.\n"
        "- Do NOT diagnose.\n"
        "- Do NOT suggest treatments.\n"
        "- Only explain why the given prediction makes sense.\n"
        "- Output only bullet points.\n"
        "- Each bullet must start with '- '.\n"
        "- Maximum 3 bullet points.\n"
        "- No paragraphs."
    )
    
    user_content = (
        f"Patient Data:\n"
        f"Symptoms: {request.symptoms}\n\n"
        f"Model Output:\n"
        f"Recommended Department: {request.predicted_department}"
    )

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=300,
        )
        
        response_text = chat_completion.choices[0].message.content

        if not response_text:
             raise HTTPException(status_code=500, detail="Empty response from AI")
        return {"explanation": response_text}
    except Exception as e:
        print(f"Explanation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")

@app.post("/predict")
def predict(data: SymptomRequest):
    # 1. Emergency Check
    if check_emergency(data.symptoms):
        return {
            "Emergency": True,
            "Message": "Possible medical emergency. Please seek immediate care.",
            "System": "Emergency Guard",
            "Top 3 Recommendations": [],
            "Similar Past Cases": []
        }

    # 2. Hybrid Predict
    result = hybrid_predict_logic(data.symptoms)

    # 3. Save to DB
    try:
        db = SessionLocal()
        top3 = result["Top 3 Recommendations"]
        # Ensure we have at least 3 items to avoid IndexError, pad if necessary
        while len(top3) < 3:
            top3.append({"Department": "None", "Final Confidence (%)": 0.0})

        log = PredictionLog(
            symptoms=data.symptoms,
            department_1=top3[0]["Department"],
            confidence_1=top3[0]["Final Confidence (%)"],
            department_2=top3[1]["Department"],
            confidence_2=top3[1]["Final Confidence (%)"],
            department_3=top3[2]["Department"],
            confidence_3=top3[2]["Final Confidence (%)"],
            emergency=False
        )
        db.add(log)
        db.commit()
        db.close()
    except Exception as e:
        print(f"DB Logging failed: {e}")

    # 4. Return
    return {
        "Emergency": False,
        "System": result["System"],
        "Top 3 Recommendations": result["Top 3 Recommendations"],
        "Similar Past Cases": result.get("Similar Past Cases", [])
    }



@app.get("/analytics")
def analytics():
    db = SessionLocal()
    total = db.query(PredictionLog).count()
    emergencies = db.query(PredictionLog).filter_by(emergency=True).count()
    logs = db.query(PredictionLog).all()
    
    department_counter = {}
    for log in logs:
        # Only count valid departments
        for dept in [log.department_1, log.department_2, log.department_3]:
            if dept and dept != "None":
                department_counter[dept] = department_counter.get(dept, 0) + 1
    
    db.close()
    return {
        "Total Predictions": total,
        "Emergency Cases": emergencies,
        "Department Frequency": department_counter
    }

@app.get("/nearest-hospital")
def nearest_hospital(lat: float, lon: float):
    """
    Finds the nearest hospital using Google Places API (Text Search) if available,
    otherwise falls back to OpenStreetMap (Overpass API).
    """
    
    # --- 1. Try Google Places API ---
    if GOOGLE_API_KEY:
        try:
            # Using Text Search (New) or Nearby Search
            # Text Search is often more reliable for "hospital" query
            google_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            params = {
                "query": "hospital",
                "location": f"{lat},{lon}",
                "radius": 5000, # 5km
                "key": GOOGLE_API_KEY
            }
            
            response = requests.get(google_url, params=params, timeout=5)
            data = response.json()
            
            if data.get("status") == "OK" and data.get("results"):
                nearest = data["results"][0] # Results are usually ranked by prominence/distance
                
                # Calculate direct distance (as not always provided)
                h_lat = nearest["geometry"]["location"]["lat"]
                h_lon = nearest["geometry"]["location"]["lng"]
                dist = haversine(lat, lon, h_lat, h_lon)

                return {
                    "name": nearest.get("name", "Unnamed Hospital"),
                    "distance_km": round(dist, 2),
                    "location": {
                        "lat": h_lat,
                        "lon": h_lon,
                        "addr_street": nearest.get("formatted_address", ""),
                    },
                    "Google Maps Link": f"https://www.google.com/maps/place/?q=place_id:{nearest['place_id']}"
                }
            elif data.get("status") in ["REQUEST_DENIED", "OVER_QUERY_LIMIT"]:
                print(f"Google API Error: {data.get('status')} - {data.get('error_message')}")
                # Fallback to Overpass
        except Exception as e:
            print(f"Google Places API failed: {e}")
            # Fallback to Overpass

    # --- 2. Fallback: Overpass API ---
    print("Falling back to OpenStreetMap (Overpass API)...")
    overpass_url = "https://overpass-api.de/api/interpreter"

    try:
        # Search radius: 5000 meters (5km)
        query = f"""
        [out:json];
        node
          ["amenity"="hospital"]
          (around:5000,{lat},{lon});
        out;
        """

        response = requests.post(overpass_url, data=query, timeout=10)
        
        if response.status_code != 200:
             print(f"Overpass API Error: {response.text}")
             return {"name": "Error contacting map service", "distance": 0, "location": {}}

        data = response.json()

        if not data.get("elements"):
            return {"name": "No hospital found within 5km", "distance": 0, "location": {}}

        nearest = None
        min_distance = float("inf")

        for hospital in data["elements"]:
            h_lat = hospital.get("lat")
            h_lon = hospital.get("lon")
            
            if h_lat is None or h_lon is None:
                continue

            dist = haversine(lat, lon, h_lat, h_lon)

            if dist < min_distance:
                min_distance = dist
                nearest = hospital

        if not nearest:
             return {"name": "No valid hospital data found", "distance": 0, "location": {}}

        return {
            "name": nearest.get("tags", {}).get("name", "Unnamed Hospital"),
            "distance_km": round(min_distance, 2),
            "location": {
                "lat": nearest["lat"],
                "lon": nearest["lon"],
                "addr_street": nearest.get("tags", {}).get("addr:street", ""),
                "addr_city": nearest.get("tags", {}).get("addr:city", "")
            },
            "Google Maps Link": f"https://www.google.com/maps/dir/?api=1&destination={nearest['lat']},{nearest['lon']}&travelmode=driving"
        }

    except Exception as e:
        print(f"Hospital search error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    import socket

    def is_port_in_use(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0
            
    # Enforce strict port 8010 to ensure frontend connection works
    PORT = 8010
    
    if is_port_in_use(PORT):
        print(f"❌ Error: Port {PORT} is already in use.")
        print("Please stop any running instances of the backend or other services on port 8010.")
        print("You can try finding the process with: netstat -ano | findstr :8010")
        sys.exit(1)
        
    print(f"✅ Starting server on port {PORT}...")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
