# Agentic Medical Analyser

Agentic Medical Analyser is an AI-powered medical triage and diagnostic assistant designed to simulate intelligent patient intake, risk assessment, department routing, and explainable predictions.

The system combines rule-based logic, optional machine learning models, and LLM-powered assistance to provide fast preliminary medical guidance.

---

## Features

### Patient Intake

Interactive multi-step form for capturing symptoms and patient details.

- Calls **/triage** for risk assessment
- Calls **/predict** for department routing

### Triage Results

- Risk level classification
- Suggested medical department
- Confidence score
- Actionable recommendations

### AI Assistant

- LLM-powered chat via **/chat** (Groq API)
- Graceful fallback to local responses if unavailable

### AI Explainability

- **/explain** endpoint provides prediction rationale
- Helps users understand system decisions

### Nearby Hospitals

- Location-aware hospital lookup
- Uses **/nearest-hospital** (Overpass API)

---

## Running the Application

The project consists of two components:

- **Backend** (FastAPI)
- **Frontend** (Vite / npm)

---

### Backend Setup

Run from the Pragyan project root:

```bash
cd /Users/apple/Pragyan
python main_combined.py
```

**Default Backend URL:** `http://localhost:8010`

If port 8010 is occupied, the server may automatically use ports **8011–8015**.

#### Backend Requirements

- Python 3.x
- FastAPI
- Uvicorn

Install dependencies if needed:

```bash
pip install fastapi uvicorn python-dotenv
```

#### Environment Variables

Create a **.env** file:

```
GROQ_API_KEY=your_api_key_here
```

Required for:

- **/chat**
- **/explain**

#### Optional Machine Learning Models

If present, ML-based triage logic will be used:

- `models/triage_model.pkl`
- `models/encoders.pkl`

If missing, the system falls back to **rule-based logic**.

---

### Frontend Setup

```bash
cd Agentic-Medical-Analyser
npm install
npm run dev
```

**Default Frontend URL:** `http://localhost:5173`

#### API Configuration

The frontend defaults to **http://localhost:8010**.

To override:

```bash
cp .env.example .env
```

Edit **.env**:

```
VITE_API_URL=http://localhost:8010
```

---

## Conceptual Architecture

**User Input** → **Backend Intelligence Layer** →

| Component | Endpoint |
|-----------|----------|
| **Risk Engine** | /triage |
| **Prediction Engine** | /predict |
| **Explainability Engine** | /explain |
| **AI Assistant** | /chat |
| **Location Services** | /nearest-hospital |

---

## Disclaimer

This project is a research and educational prototype. It is **not** a replacement for professional medical advice and is **not** approved for clinical use. Always consult qualified medical professionals for real health concerns.
