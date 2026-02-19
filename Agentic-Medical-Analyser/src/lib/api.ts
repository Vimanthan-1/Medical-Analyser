/**
 * Backend API client for Agentic Medical Analyser
 * Backend runs at http://localhost:8010 (main_combined.py)
 */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8010";

export async function healthCheck(): Promise<{ status: string; models_loaded: boolean }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend unreachable");
  return res.json();
}

export async function triage(params: {
  Name?: string;
  Age?: number;
  Gender?: string;
  Systolic_BP?: number;
  Diastolic_BP?: number;
  Heart_Rate?: number;
  Temperature?: number;
  Symptoms: string;
}): Promise<{ risk_level: string }> {
  const res = await fetch(`${API_BASE}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function predict(symptoms: string): Promise<{
  Emergency?: boolean;
  Message?: string;
  System: string;
  "Top 3 Recommendations": Array<{ Department: string; "Final Confidence (%)": number }>;
  "Similar Past Cases"?: Array<{ Symptom: string; Department: string; Distance: number }>;
}> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptoms }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function chat(message: string): Promise<{ response: string }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function explain(symptoms: string, predicted_department: string): Promise<{ explanation: string }> {
  const res = await fetch(`${API_BASE}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptoms, predicted_department }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function nearestHospital(lat: number, lon: number) {
  const res = await fetch(`${API_BASE}/nearest-hospital`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      latitude: lat,
      longitude: lon,
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}


