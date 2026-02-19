# app/model.py

import os
import numpy as np
import faiss
import joblib
from sentence_transformers import SentenceTransformer

# =====================================================
# GLOBAL SINGLETONS (LAZY)
# =====================================================

_embedder = None
_faiss_index = None
_department_names = None
_classifier = None


def load_resources():
    global _embedder, _faiss_index, _department_names, _classifier

    if _embedder is not None:
        return  # already loaded

    # ---- Department knowledge ----
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

    _department_names = list(department_knowledge.keys())
    knowledge_texts = list(department_knowledge.values())

    # ---- Load embedder (CPU only) ----
    _embedder = SentenceTransformer(
        "all-MiniLM-L6-v2",
        device="cpu"
    )

    embeddings = _embedder.encode(knowledge_texts, convert_to_numpy=True)
    dim = embeddings.shape[1]

    _faiss_index = faiss.IndexFlatL2(dim)
    _faiss_index.add(embeddings)

    # ---- Optional classifier ----
    if os.path.exists("models/trained_model/classifier.pkl"):
        _classifier = joblib.load("models/trained_model/classifier.pkl")
    else:
        _classifier = None


def hybrid_predict(symptoms: str):
    load_resources()

    user_embedding = _embedder.encode([symptoms], convert_to_numpy=True)

    distances, indices = _faiss_index.search(user_embedding, k=3)
    scores = 1 / (1 + distances[0])
    scores /= scores.sum()

    semantic_results = []
    for i, idx in enumerate(indices[0]):
        semantic_results.append({
            "Department": _department_names[idx],
            "Semantic Confidence (%)": round(float(scores[i] * 100), 2)
        })

    if _classifier:
        ml_probs = _classifier.predict_proba(user_embedding)[0]
        ml_indices = np.argsort(ml_probs)[::-1][:3]

        combined = {}
        for item in semantic_results:
            combined[item["Department"]] = item["Semantic Confidence (%)"] * 0.6

        for idx in ml_indices:
            dept = _classifier.classes_[idx]
            combined[dept] = combined.get(dept, 0) + ml_probs[idx] * 100 * 0.4

        final = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:3]

        return {
            "System": "Hybrid Semantic + ML Engine",
            "Top 3 Recommendations": [
                {"Department": d, "Final Confidence (%)": round(s, 2)}
                for d, s in final
            ]
        }

    return {
        "System": "Semantic Knowledge Engine",
        "Top 3 Recommendations": semantic_results
    }
