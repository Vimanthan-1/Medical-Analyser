# inference.py
import pandas as pd
import numpy as np
import pickle
import random

# ---------------------------
# CONFIG
# ---------------------------
DATA_PATH = "synthetic_patients_large.csv"  # CSV dataset
MODEL_PATH = "models/triage_model.pkl"      # trained risk model
ENCODER_PATH = "models/encoders.pkl"        # categorical encoder

# ---------------------------
# LOAD MODEL & ENCODER
# ---------------------------
try:
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
except FileNotFoundError:
    print("Warning: Risk model not found. Using fallback rules.")
    model = None

try:
    with open(ENCODER_PATH, "rb") as f:
        encoder = pickle.load(f)
except FileNotFoundError:
    print("Warning: Encoder not found. Using fallback rules.")
    encoder = None

# ---------------------------
# HELPER FUNCTIONS
# ---------------------------

def predict_risk(patient):
    """
    Predict Risk_Level for a single patient
    Keys: Age, Gender, Systolic_BP, Diastolic_BP, Heart_Rate, Temperature, Symptoms, Pre_Existing_Conditions
    """

    # ---------------------------
    # FORCE HIGH RISK FOR EXTREME VITALS
    # ---------------------------
    if patient["Temperature"] > 103 or patient["Heart_Rate"] > 140:
        return "High"

    # ---------------------------
    # Use fallback rules if model/encoder missing
    # ---------------------------
    if model is None or encoder is None:
        return assign_risk_rule(patient)

    # ---------------------------
    # Compute Mean Arterial Pressure
    # ---------------------------
    mean_bp = (patient["Systolic_BP"] + 2 * patient["Diastolic_BP"]) / 3

    # ---------------------------
    # Prepare numerical features
    # ---------------------------
    X_num = np.array([[ 
        patient["Age"],
        mean_bp,
        patient["Heart_Rate"],
        patient["Temperature"]
    ]])

    # ---------------------------
    # Prepare categorical features
    # ---------------------------
    X_cat = [[
        patient["Gender"],
        patient["Symptoms"],
        patient["Pre_Existing_Conditions"]
    ]]

    X_cat_encoded = encoder.transform(X_cat)
    X = np.hstack([X_num, X_cat_encoded])

    # ---------------------------
    # Predict risk
    # ---------------------------
    prediction = model.predict(X)[0]
    return prediction

def assign_risk_rule(patient):
    """
    Fallback rule-based risk assignment:
    - High temp (>38°C) or very high Heart Rate (>140) → High
    - BP > thresholds → High/Medium
    """
    if patient["Systolic_BP"] > 140 or patient["Diastolic_BP"] > 90 or patient["Temperature"] > 38.0 or patient["Heart_Rate"] > 140:
        return "High"
    elif patient["Systolic_BP"] > 130 or patient["Diastolic_BP"] > 85 or patient["Temperature"] > 37.5:
        return "Medium"
    else:
        return "Low"

def assign_department(symptoms):
    """Assign department based on Symptoms"""
    s = str(symptoms).lower()
    if "chest" in s or "heart" in s:
        return "Cardiology"
    elif "headache" in s or "dizziness" in s:
        return "Neurology"
    elif "fever" in s or "cough" in s:
        return "General Medicine"
    else:
        return random.choice(["General Medicine","Emergency","Neurology"])

# ---------------------------
# LOAD DATA
# ---------------------------
df = pd.read_csv(DATA_PATH)

# ---------------------------
# RUN INFERENCE WITH PROGRESS AND HIGH RISK ALERT
# ---------------------------
pred_risks = []
pred_departments = []

for idx, row in df.iterrows():
    patient = row.to_dict()
    risk = predict_risk(patient)
    
    # High Risk Override Message
    if risk == "High":
        print(f"⚠️ Patient_ID {patient.get('Patient_ID', '')}: High Risk detected! Override suggested.")
    
    department = assign_department(patient["Symptoms"])
    pred_risks.append(risk)
    pred_departments.append(department)

    # Print progress every 1000 rows
    if (idx+1) % 1000 == 0:
        print(f"Processed {idx+1}/{len(df)} rows")

df["Predicted_Risk_Level"] = pred_risks
df["Predicted_Department"] = pred_departments

# ---------------------------
# SAVE RESULTS
# ---------------------------
df.to_csv("inference_results.csv", index=False)
print("Inference complete! Results saved to 'inference_results.csv'")

# ---------------------------
# PRINT FIRST 10
# ---------------------------
print(df[["Patient_ID","Predicted_Risk_Level","Predicted_Department"]].head(10))
