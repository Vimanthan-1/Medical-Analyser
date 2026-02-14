import pandas as pd
import random

num_patients = 50000  # number of records

symptoms_list = ["Fever", "Cough", "Chest Pain", "Headache", "Dizziness", "Shortness of Breath", "Nausea"]
pre_existing_conditions = ["None", "Hypertension", "Diabetes", "Asthma", "Heart Disease"]
departments = ["General Medicine", "Cardiology", "Neurology", "Emergency"]

data = []

for i in range(1, num_patients + 1):
    age = random.randint(1, 100)
    gender = random.choice(["M", "F"])
    symptoms = ",".join(random.sample(symptoms_list, random.randint(1,3)))
    systolic = random.randint(90, 180)
    diastolic = random.randint(60, 120)
    heart_rate = random.randint(60, 110)
    temperature = round(random.uniform(36.0, 40.0), 1)
    pre_condition = random.choice(pre_existing_conditions)

    if systolic > 140 or diastolic > 90 or temperature > 38.0:
        risk = "High"
    elif systolic > 130 or diastolic > 85 or temperature > 37.5:
        risk = "Medium"
    else:
        risk = "Low"

    s_lower = symptoms.lower()
    if "chest" in s_lower or "heart" in s_lower:
        dept = "Cardiology"
    elif "headache" in s_lower or "dizziness" in s_lower:
        dept = "Neurology"
    elif "fever" in s_lower or "cough" in s_lower:
        dept = "General Medicine"
    else:
        dept = random.choice(departments)

    data.append([i, age, gender, symptoms, systolic, diastolic, heart_rate, temperature,
                 pre_condition, risk, dept])

columns = ["Patient_ID", "Age", "Gender", "Symptoms", "Systolic_BP", "Diastolic_BP",
           "Heart_Rate", "Temperature", "Pre_Existing_Conditions", "Risk_Level", "Department"]

df = pd.DataFrame(data, columns=columns)
df.to_csv("synthetic_patients_large.csv", index=False)
print(f"Synthetic dataset with {num_patients} records saved as 'synthetic_patients_large.csv'")
