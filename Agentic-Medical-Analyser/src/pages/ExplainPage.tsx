import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { explain as apiExplain } from "@/lib/api";
import { TriageResult, PatientData } from "@/lib/types";
import { Brain, Loader2, ArrowLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExplainPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);

  useEffect(() => {
    const r = sessionStorage.getItem("triageResult");
    const p = sessionStorage.getItem("patientData");
    if (r) setResult(JSON.parse(r));
    if (p) setPatient(JSON.parse(p));
  }, []);

  async function generateExplanation() {
    if (!result || !patient) return;
    setExplanation("");
    setError("");
    setLoading(true);
    try {
      const symptomsStr = patient.symptoms.join(", ");
      await apiExplain(symptomsStr, result.department, (chunk) => {
        setExplanation(prev => prev + chunk);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate explanation.");
    } finally {
      setLoading(false);
    }
  }


  // No session data — prompt user to complete triage first
  if (!result || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-xl font-bold text-foreground mb-2">No Assessment Found</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Complete the patient intake form first to get an AI explanation.
        </p>
        <Button onClick={() => navigate("/intake")} className="gradient-primary text-primary-foreground border-0 gap-2">
          <ArrowLeft className="h-4 w-4" /> Go to Patient Intake
        </Button>
      </div>
    );
  }

  return (
    <div className="py-4 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> AI Explanation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Understanding why <span className="font-semibold text-foreground">{result.department}</span> was recommended
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-2 text-sm">
        <p><span className="font-semibold text-foreground">Patient:</span> <span className="text-muted-foreground">{patient.name}, {patient.age} y/o {patient.gender}</span></p>
        <p><span className="font-semibold text-foreground">Symptoms:</span> <span className="text-muted-foreground">{patient.symptoms.join(", ")}</span></p>
        <p><span className="font-semibold text-foreground">Risk Level:</span> <span className="text-muted-foreground">{result.riskLevel}</span></p>
        <p><span className="font-semibold text-foreground">Recommended Department:</span> <span className="text-primary font-semibold">{result.department}</span></p>
      </div>

      <Button
        onClick={generateExplanation}
        disabled={loading}
        className="gap-2 gradient-primary text-primary-foreground border-0"
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          : <><Brain className="h-4 w-4" /> Generate AI Explanation</>
        }
      </Button>

      {explanation && (
        <div className="p-5 rounded-xl bg-accent/40 border-l-4 border-primary text-sm text-foreground leading-relaxed whitespace-pre-line">
          {explanation}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Link to="/results" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Results
      </Link>
    </div>
  );
}
