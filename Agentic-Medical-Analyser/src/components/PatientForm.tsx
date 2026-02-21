import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { PatientData, EmergencyContact } from '@/lib/types';
import { ALL_SYMPTOMS, ALL_CONDITIONS } from '@/lib/triage-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRipple } from '@/hooks/useGsap';
import {
  User, Heart, Thermometer, Activity, FileUp,
  Users, X, Plus, ArrowRight, ArrowLeft, Upload
} from 'lucide-react';
import { MicButton } from './MicButton';

interface PatientFormProps {
  onSubmit: (data: PatientData) => void | Promise<void>;
  isSubmitting?: boolean;
}

const steps = [
  { title: 'Patient Info', icon: User, desc: 'Basic demographics' },
  { title: 'Symptoms', icon: Activity, desc: 'Current complaints' },
  { title: 'Vitals', icon: Heart, desc: 'Vital measurements' },
  { title: 'Medical History', icon: FileUp, desc: 'Conditions & reports' },
  { title: 'Emergency Contacts', icon: Users, desc: 'Close contacts' },
];

export function PatientForm({ onSubmit, isSubmitting = false }: PatientFormProps) {
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRipple<HTMLButtonElement>();
  const [formData, setFormData] = useState<Partial<PatientData>>({
    patientId: `PT-${Date.now().toString(36).toUpperCase()}`,
    name: '', age: 30, gender: 'Male', symptoms: [],
    bloodPressureSystolic: 120, bloodPressureDiastolic: 80,
    heartRate: 72, temperature: 36.6, oxygenSaturation: 98,
    preExistingConditions: [],
    emergencyContacts: [
      { name: '', phone: '', relation: '' },
      { name: '', phone: '', relation: '' },
      { name: '', phone: '', relation: '' },
    ],
    uploadedReport: null,
  });

  // Animate form content on step change
  useEffect(() => {
    if (!formRef.current) return;
    gsap.fromTo(formRef.current,
      { opacity: 0, x: 30, scale: 0.98 },
      { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: 'power3.out' }
    );
  }, [step]);

  // Animate step indicators
  useEffect(() => {
    if (!stepsRef.current) return;
    const icons = stepsRef.current.querySelectorAll('.step-icon');
    icons.forEach((icon, i) => {
      if (i === step) {
        gsap.to(icon, { scale: 1.15, duration: 0.3, ease: 'back.out(2)' });
      } else {
        gsap.to(icon, { scale: 1, duration: 0.2 });
      }
    });
  }, [step]);

  const toggleSymptom = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms?.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...(prev.symptoms || []), symptom],
    }));
  };

  const toggleCondition = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      preExistingConditions: prev.preExistingConditions?.includes(condition)
        ? prev.preExistingConditions.filter(c => c !== condition)
        : [...(prev.preExistingConditions || []), condition],
    }));
  };

  const updateContact = (index: number, field: keyof EmergencyContact, value: string) => {
    setFormData(prev => {
      const contacts = [...(prev.emergencyContacts || [])];
      contacts[index] = { ...contacts[index], [field]: value };
      return { ...prev, emergencyContacts: contacts };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, uploadedReport: file }));
  };

  const handleSubmit = () => void onSubmit(formData as PatientData);

  const canProceed = () => {
    switch (step) {
      case 0: return formData.name && formData.age && formData.gender;
      case 1: return (formData.symptoms?.length || 0) > 0;
      case 2: return true;
      case 3: return true;
      case 4: return formData.emergencyContacts?.some(c => c.name && c.phone);
      default: return true;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div ref={stepsRef} className="flex items-center justify-between mb-8 px-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex flex-col items-center gap-1.5 transition-all ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`step-icon flex h-10 w-10 items-center justify-center rounded-xl transition-all ${isActive ? 'gradient-primary shadow-glow' : isDone ? 'bg-primary' : 'bg-muted'
                  }`}>
                  <Icon className={`h-4.5 w-4.5 ${isActive || isDone ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{s.title}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`h-[2px] w-8 mx-2 mt-[-18px] ${i < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Form content */}
      <div ref={formRef} className="bg-card rounded-2xl border border-border p-8 shadow-card">
        <h2 className="font-display text-xl font-bold text-foreground mb-1">{steps[step].title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{steps[step].desc}</p>

        {step === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Patient ID</Label>
                <Input value={formData.patientId} disabled className="mt-1.5 bg-muted" />
              </div>
              <div>
                <Label>Full Name</Label>
                <Input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="John Doe" className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Age</Label>
                <Input type="number" value={formData.age} onChange={e => setFormData(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(v: 'Male' | 'Female' | 'Other') => setFormData(prev => ({ ...prev, gender: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {/* Voice input — any language */}
            <MicButton
              onSymptomsDetected={(detected) =>
                setFormData(prev => ({
                  ...prev,
                  symptoms: [...new Set([...(prev.symptoms ?? []), ...detected])],
                }))
              }
            />
            <p className="text-sm text-muted-foreground pt-1">Or select symptoms manually:</p>
            <div className="flex flex-wrap gap-2">
              {ALL_SYMPTOMS.map(symptom => (
                <SymptomBadge key={symptom} symptom={symptom} selected={formData.symptoms?.includes(symptom) || false} onToggle={toggleSymptom} />
              ))}
            </div>
            {(formData.symptoms?.length || 0) > 0 && (
              <p className="text-sm text-primary font-medium">{formData.symptoms?.length} symptom(s) selected</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-5">
            <div><Label className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-muted-foreground" />Blood Pressure (Systolic)</Label>
              <Input type="number" value={formData.bloodPressureSystolic} onChange={e => setFormData(prev => ({ ...prev, bloodPressureSystolic: parseInt(e.target.value) || 0 }))} className="mt-1.5" /></div>
            <div><Label className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-muted-foreground" />Blood Pressure (Diastolic)</Label>
              <Input type="number" value={formData.bloodPressureDiastolic} onChange={e => setFormData(prev => ({ ...prev, bloodPressureDiastolic: parseInt(e.target.value) || 0 }))} className="mt-1.5" /></div>
            <div><Label className="flex items-center gap-2"><Heart className="h-4 w-4 text-muted-foreground" />Heart Rate (bpm)</Label>
              <Input type="number" value={formData.heartRate} onChange={e => setFormData(prev => ({ ...prev, heartRate: parseInt(e.target.value) || 0 }))} className="mt-1.5" /></div>
            <div><Label className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-muted-foreground" />Temperature (°C)</Label>
              <Input type="number" step="0.1" value={formData.temperature} onChange={e => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0 }))} className="mt-1.5" /></div>
            <div className="col-span-2"><Label className="flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" />Oxygen Saturation (%)</Label>
              <Input type="number" value={formData.oxygenSaturation} onChange={e => setFormData(prev => ({ ...prev, oxygenSaturation: parseInt(e.target.value) || 0 }))} className="mt-1.5" /></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Select pre-existing conditions:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_CONDITIONS.map(condition => (
                  <SymptomBadge key={condition} symptom={condition} selected={formData.preExistingConditions?.includes(condition) || false} onToggle={toggleCondition} />
                ))}
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2"><Upload className="h-4 w-4 text-muted-foreground" />Upload Medical Report (EHR/EMR)</Label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleFileUpload} className="hidden" id="report-upload" />
                <label htmlFor="report-upload" className="cursor-pointer">
                  <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">{formData.uploadedReport ? formData.uploadedReport.name : 'Click to upload medical report'}</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, JPG, PNG (max 20MB)</p>
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (() => {
          // Phone validation helper
          const isValidPhone = (p: string) => p.replace(/\D/g, '').length >= 7;
          const contacts = formData.emergencyContacts ?? [];

          return (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">Add at least 1 emergency contact (up to 3):</p>
              {contacts.map((contact, i) => {
                const phoneDigits = contact.phone.replace(/\D/g, '');
                const phoneError = contact.phone && !isValidPhone(contact.phone);
                return (
                  <div key={i} className={`border rounded-xl p-4 space-y-3 transition-colors ${contact.name || contact.phone ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                    <p className="text-sm font-semibold text-foreground">Contact {i + 1}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={contact.name}
                          onChange={e => updateContact(i, 'name', e.target.value)}
                          placeholder="Full name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Phone</Label>
                        <Input
                          value={contact.phone}
                          inputMode="tel"
                          onChange={e => {
                            // Only allow digits, +, -, (, ), spaces
                            const cleaned = e.target.value.replace(/[^\d+\-() ]/g, '');
                            updateContact(i, 'phone', cleaned);
                          }}
                          placeholder="+1 555-000-0000"
                          className={`mt-1 ${phoneError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                        />
                        {phoneError && (
                          <p className="text-xs text-red-500 mt-1">Enter a valid phone number</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Relation</Label>
                        <Input
                          value={contact.relation}
                          onChange={e => updateContact(i, 'relation', e.target.value)}
                          placeholder="e.g. Spouse"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0 || isSubmitting} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button ref={nextBtnRef} onClick={() => setStep(s => s + 1)} disabled={!canProceed() || isSubmitting} className="gap-2 gradient-primary text-primary-foreground border-0">
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button ref={nextBtnRef} onClick={handleSubmit} disabled={!canProceed() || isSubmitting} className="gap-2 gradient-primary text-primary-foreground border-0">
            {isSubmitting ? "Analyzing..." : <><Activity className="h-4 w-4" /> Run AI Triage</>}
          </Button>
        )}
      </div>
    </div>
  );
}

// Interactive symptom/condition badge with GSAP
function SymptomBadge({ symptom, selected, onToggle }: { symptom: string; selected: boolean; onToggle: (s: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleEnter = () => gsap.to(el, { scale: 1.08, y: -2, duration: 0.2, ease: 'back.out(2)' });
    const handleLeave = () => gsap.to(el, { scale: 1, y: 0, duration: 0.2, ease: 'power2.out' });
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);
    return () => { el.removeEventListener('mouseenter', handleEnter); el.removeEventListener('mouseleave', handleLeave); };
  }, []);

  const handleClick = () => {
    if (ref.current) {
      gsap.fromTo(ref.current, { scale: 0.9 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.4)' });
    }
    onToggle(symptom);
  };

  return (
    <div ref={ref}>
      <Badge
        variant={selected ? 'default' : 'outline'}
        className={`cursor-pointer transition-colors py-1.5 px-3 text-sm ${selected ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-accent'
          }`}
        onClick={handleClick}
      >
        {symptom}
        {selected && <X className="h-3 w-3 ml-1" />}
      </Badge>
    </div>
  );
}
