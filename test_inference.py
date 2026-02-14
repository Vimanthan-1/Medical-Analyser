# test_inference.py
import pandas as pd
import joblib
import random

# ---------------------------
# CONFIG
# ---------------------------
DATA_PATH = "synthetic_patients_large.csv"
MODEL_PATH = "models/logistic_model.pkl"
COLUMNS_PATH = "models/model_columns.pkl"

# ---------------------------
# LOAD MODEL & COLUMNS
# ---------------------------
try:
    model = joblib.load(MODEL_PATH)
except FileNotFoundError:
    print("Warning: Model not found. Using fallback rules.")
    model = None

try:
    columns = joblib.load(COLUMNS_PATH)
except FileNotFoundError:
    print("Warning: Model columns not found. Using fallback rules.")
    columns = None

# ---------------------------
# RISK PREDICTION FUNCTION
# ---------------------------
def predict_risk(patient_dict):
    """
    Forced High risk if Temperature >103°F or Heart_Rate >140,
    else uses trained model or fallback rules.
    """
    if patient_dict["Temperature"] > 103 or patient_dict["Heart_Rate"] > 140:
        return "High"

    # Use fallback if model missing
    if model is None or columns is None:
        return assign_risk_rule(patient_dict)

    # Convert patient dict to DataFrame
    df = pd.DataFrame([patient_dict])
    
    # One-hot encode categorical features
    df = pd.get_dummies(df)
    
    # Add missing columns from training
    for col in columns:
        if col not in df.columns:
            df[col] = 0
    
    # Ensure correct column order
    df = df[columns]
    
    # Make prediction
    return model.predict(df)[0]

# ---------------------------
# FALLBACK RULES
# ---------------------------
def assign_risk_rule(patient):
    if patient["Systolic_BP"] > 140 or patient["Diastolic_BP"] > 90 or patient["Temperature"] > 38.0 or patient["Heart_Rate"] > 140:
        return "High"
    elif patient["Systolic_BP"] > 130 or patient["Diastolic_BP"] > 85 or patient["Temperature"] > 37.5:
        return "Medium"
    else:
        return "Low"

# ---------------------------
# DEPARTMENT ASSIGNMENT
# ---------------------------
def assign_department(symptoms):
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
# EXAMPLE PATIENT
# ---------------------------
sample_patient = {
    "Patient_ID": 1,
    "Age": 75,
    "Gender": "Male",
    "Systolic_BP": 120,
    "Diastolic_BP": 80,
    "Heart_Rate": 145,
    "Temperature": 37.0,
    "Symptoms": "Chest pain",
    "Pre_Existing_Conditions": "Hypertension"
}

risk = predict_risk(sample_patient)
department = assign_department(sample_patient["Symptoms"])

# High Risk Override Message
if risk == "High":
    print(f"⚠️ Patient_ID {sample_patient['Patient_ID']}: High Risk detected! Override suggested.")

print(f"Patient_ID: {sample_patient['Patient_ID']}")
print("Predicted Risk Level:", risk)
print("Predicted Department:", department)

# ---------------------------
# BATCH PREDICTION FROM CSV
# ---------------------------
df = pd.read_csv(DATA_PATH)

df['Predicted_Risk_Level'] = df.apply(lambda row: predict_risk({
    "Age": row["Age"],
    "Gender": row["Gender"],
    "Systolic_BP": row["Systolic_BP"],
    "Diastolic_BP": row["Diastolic_BP"],
    "Heart_Rate": row["Heart_Rate"],
    "Temperature": row["Temperature"],
    "Symptoms": row["Symptoms"],
    "Pre_Existing_Conditions": row["Pre_Existing_Conditions"]
}), axis=1)

df['Predicted_Department'] = df['Symptoms'].apply(assign_department)

# Print High Risk Override for batch
for idx, row in df.iterrows():
    if row['Predicted_Risk_Level'] == "High":
        print(f"⚠️ Patient_ID {row['Patient_ID']}: High Risk detected! Override suggested.")

df.to_csv("test_inference_results.csv", index=False)
print("Batch inference complete! Results saved to 'test_inference_results.csv'")
