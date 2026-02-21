/**
 * Backend API client for Agentic Medical Analyser
 * Backend runs at http://localhost:8010 (main_combined.py)
 */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8010";

/** Creates a fetch with an AbortController timeout. Throws if time exceeded. */
function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export async function healthCheck(): Promise<{ status: string }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/health`, {}, 5000);
    if (!res.ok) throw new Error("Backend unreachable");
    return res.json();
  } catch {
    throw new Error("Backend unreachable");
  }
}

export async function triage(params: {
  symptoms: string;
  age?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  temperature?: number;
  oxygen_saturation?: number;
}): Promise<{
  department: string;
  confidence: number;
  risk_level: string;
  top3: Array<{ department: string; confidence: number }>;
}> {
  // 12 second timeout — falls back to local classifier in IntakePage catch block
  const res = await fetchWithTimeout(
    `${API_BASE}/triage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    12000
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function predict(symptoms: string): Promise<{
  System: string;
  "Top 3 Recommendations": Array<{ Department: string; "Final Confidence (%)": number }>;
}> {
  const res = await fetchWithTimeout(
    `${API_BASE}/predict`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms }),
    },
    12000
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function chat(message: string): Promise<{ response: string }> {
  const res = await fetchWithTimeout(
    `${API_BASE}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
    20000
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function explain(
  symptoms: string,
  predicted_department: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  // 25s timeout for streaming — Groq 8b is fast but allow buffer
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);

  try {
    const res = await fetch(`${API_BASE}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms, predicted_department }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(await res.text());
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function translateSymptoms(
  text: string,
  source_lang: string,
  available_symptoms: string[]
): Promise<{ translation: string; matched_symptoms: string[] }> {
  const res = await fetchWithTimeout(
    `${API_BASE}/translate-symptoms`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source_lang, available_symptoms }),
    },
    20000
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function nearestHospital(lat: number, lon: number) {
  const res = await fetchWithTimeout(
    `${API_BASE}/nearest-hospital`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lon }),
    },
    22000
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
