import joblib
import os
import numpy as np
from sklearn.linear_model import LogisticRegression
from sentence_transformers import SentenceTransformer

# 1. Setup Data (Matches main_combined.py)
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

# 2. Embed Data
print("Loading Embedder...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
X_train = embedder.encode(train_texts)
y_train = train_labels

# 3. Train Model
print("Training Classifier...")
clf = LogisticRegression()
clf.fit(X_train, y_train)

# 4. Save Model
output_dir = "models/trained_model"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "classifier.pkl")

joblib.dump(clf, output_path)
print(f"✅ Model saved to {output_path}")

# 5. Verify
loaded_clf = joblib.load(output_path)
print("Verification: Model loaded successfully.")
