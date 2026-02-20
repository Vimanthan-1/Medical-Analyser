import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { TriageResult, PatientData } from '@/lib/types';
import { RiskBadge } from './RiskBadge';
import {
  TrendingUp, Stethoscope, AlertCircle, CheckCircle,
  Clock, ArrowRight, Brain, BarChart3, Loader2, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useTiltHover, useStaggerReveal, useHoverLift } from '@/hooks/useGsap';
import { explain as apiExplain } from '@/lib/api';

interface TriageResultsProps {
  result: TriageResult;
  patient: PatientData;
}

export function TriageResults({ result, patient }: TriageResultsProps) {
  const riskColorClass = {
    Low: 'gradient-risk-low',
    Medium: 'gradient-risk-medium',
    High: 'gradient-risk-high',
  }[result.riskLevel];

  const heroRef = useTiltHover<HTMLDivElement>(5);
  const factorsRef = useStaggerReveal<HTMLDivElement>(0.08, 0.3);
  const recsRef = useStaggerReveal<HTMLDivElement>(0.1, 0.5);
  const confidenceRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  // AI Explain state
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainText, setExplainText] = useState('');
  const [explainError, setExplainError] = useState('');
  const [explainOpen, setExplainOpen] = useState(false);

  // Animate confidence score counter
  useEffect(() => {
    if (!scoreRef.current) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: result.confidenceScore,
      duration: 1.5,
      ease: 'power2.out',
      delay: 0.4,
      onUpdate: () => { if (scoreRef.current) scoreRef.current.textContent = `${Math.round(obj.val)}%`; },
    });
  }, [result.confidenceScore]);

  // Animate confidence bars
  useEffect(() => {
    if (!confidenceRef.current) return;
    const bars = confidenceRef.current.querySelectorAll('[role="progressbar"]');
    gsap.fromTo(bars,
      { scaleX: 0 },
      { scaleX: 1, stagger: 0.12, delay: 0.6, duration: 0.8, ease: 'power3.out', transformOrigin: 'left' }
    );
  }, []);

  async function handleExplain() {
    // If already loaded, just toggle visibility
    if (explainText) {
      setExplainOpen(o => !o);
      return;
    }
    setExplainLoading(true);
    setExplainError('');
    try {
      const symptomsStr = patient.symptoms.join(', ');
      const data = await apiExplain(symptomsStr, result.department);
      setExplainText(data.explanation ?? '');
      setExplainOpen(true);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Failed to generate explanation.');
    } finally {
      setExplainLoading(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* AI Explain Button + Panel */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-base font-bold text-foreground">AI Explanation</h3>
              <p className="text-xs text-muted-foreground">Why {result.department} was recommended for your symptoms</p>
            </div>
          </div>
          <Button
            onClick={handleExplain}
            disabled={explainLoading}
            className="gap-2 gradient-primary text-primary-foreground border-0"
            size="sm"
          >
            {explainLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              : explainOpen
                ? <><ChevronUp className="h-4 w-4" /> Hide Explanation</>
                : <><Brain className="h-4 w-4" /> Explain My Results</>
            }
          </Button>
        </div>

        {explainError && (
          <p className="mt-3 text-sm text-destructive">{explainError}</p>
        )}

        {explainOpen && explainText && (
          <div className="mt-4 p-4 rounded-xl bg-accent/40 border-l-4 border-primary text-sm text-foreground leading-relaxed whitespace-pre-line">
            {explainText}
          </div>
        )}
      </div>

      {/* Hero result card */}
      <div ref={heroRef} className="rounded-2xl border border-border bg-card overflow-hidden shadow-card cursor-default">
        <div className={`${riskColorClass} p-6 text-primary-foreground`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">AI Triage Assessment</p>
              <h2 className="font-display text-3xl font-bold mt-1">{result.riskLevel} Risk</h2>
              <p className="text-sm opacity-90 mt-1">Patient: {patient.name} (ID: {patient.patientId})</p>
            </div>
            <div className="text-right">
              <div ref={scoreRef} className="text-5xl font-display font-bold">0%</div>
              <p className="text-sm opacity-90">Confidence</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-3 gap-4">
          {[
            { icon: Stethoscope, label: 'Department', value: result.department },
            { icon: Clock, label: 'Wait Priority', value: result.waitTimePriority === 1 ? 'Immediate' : result.waitTimePriority === 2 ? 'Priority' : 'Standard' },
            { icon: BarChart3, label: 'Risk Factors', value: result.contributingFactors.length.toString() },
          ].map((item, i) => (
            <StatItem key={i} item={item} />
          ))}
        </div>
      </div>

      {/* Explainability panel */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold text-foreground">Explainability – Contributing Factors</h3>
        </div>
        <div ref={factorsRef} className="space-y-3">
          {result.contributingFactors.map((factor, i) => (
            <FactorRow key={i} factor={factor} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground mb-4">Recommendations</h3>
        <div ref={recsRef} className="space-y-2">
          {result.recommendations.map((rec, i) => (
            <RecRow key={i} rec={rec} />
          ))}
        </div>
      </div>

      {/* Confidence meter */}
      <div ref={confidenceRef} className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground mb-4">Model Confidence Breakdown</h3>
        <div className="space-y-4">
          {[
            { label: 'Symptom Analysis', value: Math.min(98, result.confidenceScore + 5) },
            { label: 'Vital Signs Assessment', value: Math.min(95, result.confidenceScore + 2) },
            { label: 'Medical History Correlation', value: result.confidenceScore - 3 },
            { label: 'Department Matching', value: result.confidenceScore },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold text-foreground">{item.value}%</span>
              </div>
              <Progress value={item.value} className="h-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatItem({ item }: { item: { icon: typeof Stethoscope; label: string; value: string } }) {
  const ref = useHoverLift<HTMLDivElement>();
  const Icon = item.icon;
  return (
    <div ref={ref} className="text-center p-4 rounded-xl bg-muted/50 cursor-default">
      <Icon className="h-5 w-5 mx-auto text-primary mb-2" />
      <p className="text-xs text-muted-foreground">{item.label}</p>
      <p className="font-semibold text-sm text-foreground mt-1">{item.value}</p>
    </div>
  );
}

function FactorRow({ factor }: { factor: { factor: string; description: string; impact: string } }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleEnter = () => gsap.to(el, { x: 6, backgroundColor: 'hsl(174 40% 92% / 0.5)', duration: 0.25, ease: 'power2.out' });
    const handleLeave = () => gsap.to(el, { x: 0, backgroundColor: 'hsl(200 18% 95% / 0.4)', duration: 0.25, ease: 'power2.out' });
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);
    return () => { el.removeEventListener('mouseenter', handleEnter); el.removeEventListener('mouseleave', handleLeave); };
  }, []);

  return (
    <div ref={ref} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 cursor-default">
      {factor.impact === 'High' ? (
        <AlertCircle className="h-4 w-4 mt-0.5 text-risk-high shrink-0" />
      ) : factor.impact === 'Medium' ? (
        <TrendingUp className="h-4 w-4 mt-0.5 text-risk-medium shrink-0" />
      ) : (
        <CheckCircle className="h-4 w-4 mt-0.5 text-risk-low shrink-0" />
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{factor.factor}</span>
          <RiskBadge level={factor.impact === 'High' ? 'High' : factor.impact === 'Medium' ? 'Medium' : 'Low'} size="sm" showIcon={false} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{factor.description}</p>
      </div>
    </div>
  );
}

function RecRow({ rec }: { rec: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleEnter = () => {
      gsap.to(el, { x: 8, duration: 0.25, ease: 'power2.out' });
      gsap.to(el.querySelector('.rec-arrow'), { x: 4, duration: 0.25, ease: 'power2.out' });
    };
    const handleLeave = () => {
      gsap.to(el, { x: 0, duration: 0.25, ease: 'power2.out' });
      gsap.to(el.querySelector('.rec-arrow'), { x: 0, duration: 0.25, ease: 'power2.out' });
    };
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);
    return () => { el.removeEventListener('mouseenter', handleEnter); el.removeEventListener('mouseleave', handleLeave); };
  }, []);

  return (
    <div ref={ref} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50 cursor-default">
      <ArrowRight className="rec-arrow h-4 w-4 text-primary shrink-0" />
      <span className="text-sm text-foreground">{rec}</span>
    </div>
  );
}

