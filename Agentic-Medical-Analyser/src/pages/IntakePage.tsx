import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientForm } from '@/components/PatientForm';
import { PatientData, TriageResult, Department } from '@/lib/types';
import { classifyPatient } from '@/lib/triage-engine';
import { triage as apiTriage } from '@/lib/api';

// Map backend department names → frontend Department type
function mapDepartment(backendDept: string): Department {
  const map: Record<string, Department> = {
    "Emergency Medicine": "Emergency",
    "General Medicine": "General Medicine",
    "Cardiology": "Cardiology",
    "Neurology": "Neurology",
    "Pulmonology": "Pulmonology",
    "Orthopedics": "Orthopedics",
    "Gastroenterology": "Gastroenterology",
    "Endocrinology": "Endocrinology",
    "Psychiatry": "Psychiatry",
    "Dermatology": "Dermatology",
  };
  return (map[backendDept] || "General Medicine") as Department;
}

function saveAndNavigate(result: TriageResult, data: PatientData, navigate: ReturnType<typeof useNavigate>) {
  sessionStorage.setItem("triageResult", JSON.stringify(result));
  sessionStorage.setItem("patientData", JSON.stringify({
    ...data,
    uploadedReport: data.uploadedReport ? data.uploadedReport.name : null,
  }));
  navigate("/results");
}

export default function IntakePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: PatientData) => {
    setLoading(true);
    setError(null);
    const symptomsStr = data.symptoms.join(", ");

    try {
      // Single API call — backend returns department + risk level + confidence
      const triageRes = await apiTriage({
        symptoms: symptomsStr,
        age: data.age,
        systolic_bp: data.bloodPressureSystolic,
        diastolic_bp: data.bloodPressureDiastolic,
        heart_rate: data.heartRate,
        temperature: data.temperature,
        oxygen_saturation: data.oxygenSaturation,
      });

      // Build the full TriageResult using local engine for recommendations/factors,
      // but override department, riskLevel, and confidenceScore from backend.
      const localResult = classifyPatient(data);
      const riskLevel = (["Low", "Medium", "High"].includes(triageRes.risk_level)
        ? triageRes.risk_level
        : localResult.riskLevel) as TriageResult["riskLevel"];

      const result: TriageResult = {
        ...localResult,
        riskLevel,
        department: mapDepartment(triageRes.department),
        confidenceScore: Math.round(triageRes.confidence),
      };

      saveAndNavigate(result, data, navigate);
    } catch (err) {
      // Backend unreachable (cold start / network) — use local engine as fallback
      console.warn("Backend unavailable, using local triage:", err);
      setError("Backend unreachable. Using local AI assessment.");
      const result = classifyPatient(data);
      saveAndNavigate(result, data, navigate);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-4">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Patient Intake</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter patient details for AI-powered triage assessment
        </p>
        {error && (
          <p className="mt-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
      </div>
      <PatientForm onSubmit={handleSubmit} isSubmitting={loading} />
    </div>
  );
}
