import { useState } from "react";
import { Link } from "react-router-dom";
import { explain as apiExplain } from "@/lib/api";

export default function ExplainPage() {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");

  async function generateExplanation() {
    setExplanation("");
    setError("");
    setLoading(true);
    const symptoms = "Chest pain, Shortness of breath";
    const predictedDepartment = "Cardiology";
    try {
      const data = await apiExplain(symptoms, predictedDepartment);
      setExplanation(data.explanation ?? "");
    } catch (err) {
      let errorMessage = "Failed to generate explanation.";
      if (err instanceof Error) {
        // Try to parse JSON error if possible, or just use the message
        try {
          const errorObj = JSON.parse(err.message);
          errorMessage = errorObj.detail || err.message;
        } catch {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 md:px-10 pb-8 md:pb-12">
      <div className="max-w-2xl mx-auto rounded-2xl border border-white/40 bg-white/20 backdrop-blur-xl shadow-xl p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 drop-shadow-sm mb-4">🧠 AI Explainability</h2>
        <div className="rounded-xl bg-white/40 p-4 mb-4 text-gray-800 text-sm space-y-1">
          <p><strong>Age:</strong> 40</p>
          <p><strong>Gender:</strong> Male</p>
          <p><strong>Symptoms:</strong> Chest pain, Shortness of breath</p>
          <p><strong>Heart Rate:</strong> 115 bpm</p>
          <p><strong>Temperature:</strong> 38.2 °C</p>
          <p><strong>Pre-existing Conditions:</strong> Hypertension</p>
        </div>
        <div className="rounded-xl bg-white/40 p-4 mb-4 text-gray-800 text-sm">
          <p><strong>Predicted Risk:</strong> <span className="text-violet-700 font-semibold">High</span></p>
          <p><strong>Recommended Department:</strong> <span className="text-violet-700 font-semibold">Cardiology</span></p>
        </div>
        <button
          onClick={generateExplanation}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 transition-all"
        >
          {loading ? "Generating..." : "Explain"}
        </button>
        {loading && <p className="mt-3 text-gray-600 text-sm">Generating explanation...</p>}
        {explanation && (
          <div className="mt-4 p-4 rounded-xl bg-white/50 border-l-4 border-violet-500 text-gray-800 text-sm whitespace-pre-line">
            {explanation.split("\n").map((line, i) => <p key={i} className="mb-1">{line}</p>)}
          </div>
        )}
        {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
        <Link to="/" className="inline-block mt-4 text-violet-700 hover:text-gray-900 font-medium text-sm">← Back to Home</Link>
      </div>
    </div>
  );
}
