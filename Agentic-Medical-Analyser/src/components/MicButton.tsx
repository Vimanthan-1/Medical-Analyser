import { useState, useRef } from 'react';
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { translateSymptoms } from '@/lib/api';
import { ALL_SYMPTOMS } from '@/lib/triage-engine';

// ---------------------------------------------------------------------------
// Local keyword → symptom map (browser-side fallback when backend unavailable)
// Covers Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali + common synonyms
// ---------------------------------------------------------------------------
const KEYWORD_MAP: Record<string, string> = {
    // Tamil
    "காய்ச்சல்": "Fever", "தலைவலி": "Headache", "இருமல்": "Cough",
    "மூச்சுத்திணறல்": "Shortness of Breath", "வாந்தி": "Vomiting",
    "குமட்டல்": "Nausea", "வயிற்றுவலி": "Abdominal Pain",
    "மார்பு வலி": "Chest Pain", "தலைச்சுற்றல்": "Dizziness",
    "சோர்வு": "Fatigue", "வயிற்றுப்போக்கு": "Diarrhea",
    "மூட்டு வலி": "Joint Pain", "தசைவலி": "Muscle Pain",
    "உடல்வலி": "Body Aches", "மயக்கம்": "Loss of Consciousness",
    "நடுக்கம்": "Chills", "வீக்கம்": "Swelling",
    "சருமத்தில் அரிப்பு": "Rash", "தோல் வெடிப்பு": "Rash",
    "இரத்தம்": "Bleeding", "தூக்கமின்மை": "Insomnia",
    // Hindi
    "बुखार": "Fever", "सिरदर्द": "Headache", "खांसी": "Cough",
    "सांस लेने में दिक्कत": "Shortness of Breath", "उल्टी": "Vomiting",
    "मतली": "Nausea", "पेट दर्द": "Abdominal Pain",
    "सीने में दर्द": "Chest Pain", "चक्कर": "Dizziness",
    "थकान": "Fatigue", "दस्त": "Diarrhea", "जोड़ों में दर्द": "Joint Pain",
    "मांसपेशियों में दर्द": "Muscle Pain", "शरीर में दर्द": "Body Aches",
    "कमज़ोरी": "Weakness", "ठंड लगना": "Chills", "सूजन": "Swelling",
    "खुजली": "Rash", "रक्तस्राव": "Bleeding",
    // Telugu
    "జ్వరం": "Fever", "తలనొప్పి": "Headache", "దగ్గు": "Cough",
    "వాంతి": "Vomiting", "వికారం": "Nausea",
    "కడుపు నొప్పి": "Abdominal Pain", "అలసట": "Fatigue",
    // Kannada
    "ಜ್ವರ": "Fever", "ತಲೆನೋವು": "Headache", "ಕೆಮ್ಮು": "Cough",
    "ವಾಂತಿ": "Vomiting", "ಹೊಟ್ಟೆ ನೋವು": "Abdominal Pain", "ಆಯಾಸ": "Fatigue",
    // Malayalam
    "പനി": "Fever", "തലവേദന": "Headache", "ചുമ": "Cough",
    "ഛർദ്ദി": "Vomiting", "ഓക്കാനം": "Nausea",
    "വയറുവേദന": "Abdominal Pain", "ക്ഷീണം": "Fatigue",
    // Bengali
    "জ্বর": "Fever", "মাথাব্যথা": "Headache", "কাশি": "Cough",
    "বমি": "Vomiting", "পেটে ব্যথা": "Abdominal Pain", "ক্লান্তি": "Fatigue",
    // English synonyms
    "high temperature": "Fever", "head pain": "Headache", "migraine": "Headache",
    "throwing up": "Vomiting", "sick to stomach": "Nausea",
    "stomach pain": "Abdominal Pain", "belly pain": "Abdominal Pain",
    "chest tightness": "Chest Pain", "breathless": "Shortness of Breath",
    "tired": "Fatigue", "exhausted": "Fatigue",
    "running nose": "Runny Nose", "runny nose": "Runny Nose",
};

function localMatch(text: string): string[] {
    const lower = text.toLowerCase();
    const matched = new Set<string>();
    for (const [kw, symptom] of Object.entries(KEYWORD_MAP)) {
        if (text.includes(kw) || lower.includes(kw.toLowerCase())) {
            if (ALL_SYMPTOMS.includes(symptom)) matched.add(symptom);
        }
    }
    for (const s of ALL_SYMPTOMS) {
        if (lower.includes(s.toLowerCase())) matched.add(s);
    }
    return [...matched];
}

const LANGUAGES = [
    { label: "English", code: "en-US", name: "English" },
    { label: "தமிழ்", code: "ta-IN", name: "Tamil" },
    { label: "हिंदी", code: "hi-IN", name: "Hindi" },
    { label: "తెలుగు", code: "te-IN", name: "Telugu" },
    { label: "ಕನ್ನಡ", code: "kn-IN", name: "Kannada" },
    { label: "മലയാളം", code: "ml-IN", name: "Malayalam" },
    { label: "বাংলা", code: "bn-IN", name: "Bengali" },
    { label: "मराठी", code: "mr-IN", name: "Marathi" },
    { label: "Español", code: "es-ES", name: "Spanish" },
    { label: "Français", code: "fr-FR", name: "French" },
    { label: "العربية", code: "ar-SA", name: "Arabic" },
    { label: "中文", code: "zh-CN", name: "Chinese" },
];

type State = 'idle' | 'recording' | 'processing' | 'done' | 'error' | 'unsupported';

interface MicButtonProps {
    onSymptomsDetected: (symptoms: string[]) => void;
}

export function MicButton({ onSymptomsDetected }: MicButtonProps) {
    const [lang, setLang] = useState(LANGUAGES[0]);
    const [state, setState] = useState<State>('idle');
    const [transcript, setTranscript] = useState('');
    const [translation, setTranslation] = useState('');
    const [matchCount, setMatchCount] = useState(0);
    const [error, setError] = useState('');
    const [usedFallback, setUsedFallback] = useState(false);
    const recognitionRef = useRef<any>(null);
    const runningRef = useRef(false);

    function reset() {
        setTranscript('');
        setTranslation('');
        setMatchCount(0);
        setError('');
        setUsedFallback(false);
        setState('idle');
        runningRef.current = false;
    }

    function stopRecording() {
        recognitionRef.current?.stop();
        setState('idle');
        runningRef.current = false;
    }

    async function startRecording() {
        if (runningRef.current) return;

        // Check Web Speech API availability
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setState('unsupported');
            setError('Speech recognition is not supported in this browser. Please use Chrome on Android or desktop.');
            return;
        }

        runningRef.current = true;
        setError('');
        setTranscript('');
        setTranslation('');
        setMatchCount(0);

        const recognition = new SR();
        recognition.lang = lang.code;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;
        recognitionRef.current = recognition;

        recognition.onstart = () => setState('recording');

        recognition.onresult = async (event: any) => {
            const text: string = event.results[0][0].transcript;
            setTranscript(text);
            setState('processing');
            try {
                const res = await translateSymptoms(text, lang.name, ALL_SYMPTOMS);
                setTranslation(res.translation);
                setMatchCount(res.matched_symptoms.length);
                onSymptomsDetected(res.matched_symptoms);
                setState('done');
            } catch {
                // Backend unavailable (cold start / network) — use local keyword map silently
                const local = localMatch(text);
                setUsedFallback(true);
                setMatchCount(local.length);
                onSymptomsDetected(local);
                setState('done');
            } finally {
                runningRef.current = false;
            }
        };

        recognition.onerror = (e: any) => {
            const msg: Record<string, string> = {
                'not-allowed': 'Microphone access denied. Please allow mic permission.',
                'no-speech': 'No speech detected. Please try again.',
                'network': 'Network error during speech recognition.',
            };
            setError(msg[e.error] ?? `Speech error: ${e.error}`);
            setState('error');
            runningRef.current = false;
        };

        recognition.start();
    }

    return (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-violet-500/5 p-4 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-foreground">🎤 Speak your symptoms</span>
                <span className="text-xs text-muted-foreground">— speak in your language, we'll match the symptoms</span>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Language picker */}
                <select
                    value={lang.code}
                    onChange={e => {
                        const found = LANGUAGES.find(l => l.code === e.target.value);
                        if (found) { setLang(found); reset(); }
                    }}
                    disabled={state === 'recording' || state === 'processing'}
                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                    {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.label} – {l.name}</option>
                    ))}
                </select>

                {/* Mic / Stop button */}
                {state !== 'recording' ? (
                    <button
                        onClick={state === 'done' || state === 'error' ? reset : startRecording}
                        disabled={state === 'processing'}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
              ${state === 'processing'
                                ? 'bg-muted text-muted-foreground cursor-wait'
                                : state === 'done'
                                    ? 'bg-primary/15 text-primary hover:bg-primary/25'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                            }`}
                    >
                        {state === 'processing'
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
                            : state === 'done'
                                ? <><Mic className="h-4 w-4" /> Record again</>
                                : <><Mic className="h-4 w-4" /> Start recording</>
                        }
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-red-500 text-white animate-pulse hover:bg-red-600 transition-colors"
                    >
                        <MicOff className="h-4 w-4" /> Stop
                    </button>
                )}

                {/* Recording indicator */}
                {state === 'recording' && (
                    <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                        Listening…
                    </span>
                )}
            </div>

            {/* Transcript + translation */}
            {transcript && (
                <div className="text-xs space-y-1 bg-background/60 rounded-lg p-3 border border-border/50">
                    <p className="text-muted-foreground">
                        Heard: <span className="text-foreground font-medium italic">"{transcript}"</span>
                    </p>
                    {translation && translation !== transcript && (
                        <p className="text-muted-foreground">
                            Translated: <span className="text-foreground font-medium">"{translation}"</span>
                        </p>
                    )}
                </div>
            )}

            {/* Result */}
            {state === 'done' && (
                <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-green-700 font-medium">
                        {matchCount > 0
                            ? `Auto-selected ${matchCount} symptom${matchCount > 1 ? 's' : ''}${usedFallback ? ' (matched locally)' : ''} — you can adjust below`
                            : 'No symptoms matched — please select manually from the list below'}
                    </span>
                </div>
            )}

            {/* Error */}
            {(state === 'error' || state === 'unsupported') && (
                <div className="flex items-start gap-2 text-xs text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
