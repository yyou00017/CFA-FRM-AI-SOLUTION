import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Bookmark,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  Download,
  Flame,
  Gauge,
  History,
  Layers3,
  Loader2,
  Maximize2,
  Network,
  Palette,
  Radar,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Zap,
  XCircle,
} from "lucide-react";
import { ExamType, CFALevel, FRMPart, PracticeSet, SavedPractice } from "./types";
import { SAMPLE_TOPICS, STATIC_SAMPLE_PRACTICES } from "./data/samples";
import {
  AuthSession,
  BillingProfile,
  fetchProfile,
  hasClientAuthConfig,
  loadSession,
  saveSession,
  signIn,
  signUp,
} from "./saas";

type Source = "api" | "backup" | "static";
type Panel = "diagnosis" | "history";
type SkillStatus = "Weak" | "Medium" | "Strong" | "Baseline";
type ThemeKey = "nexus" | "mist" | "terminal" | "paper" | "amber";
type WorkspaceSize = "balanced" | "wide" | "focus";
type ReadingSize = "standard" | "large" | "xl";

const STORAGE_KEY = "examlogic_saved_practices";
const THEME_STORAGE_KEY = "harborquant_theme";
const WORKSPACE_STORAGE_KEY = "harborquant_workspace";
const READING_STORAGE_KEY = "harborquant_reading";
const DIMENSIONS = [
  ["Concept_Mastery", "Concept", "Definitions, assumptions, and curriculum rules"],
  ["Calculation", "Calculation", "Formula application and numerical derivation"],
  ["Sensitivity_Analysis", "Sensitivity", "Risk factor and market transmission"],
  ["Case_Study", "Case", "Institutional multi-variable scenarios"],
  ["Risk_Management", "Risk", "Capital, controls, hedging, and compliance"],
  ["Reverse_Engineering", "Reverse", "Solve backward from target metrics"],
] as const;

const THEMES: { key: ThemeKey; name: string; tone: string; swatch: string }[] = [
  { key: "nexus", name: "Nexus Dark", tone: "cinematic", swatch: "linear-gradient(135deg,#03070b,#22d3ee,#34d399)" },
  { key: "mist", name: "Focus Mist", tone: "eye comfort", swatch: "linear-gradient(135deg,#eef7f3,#8dd4c8,#2f8f9d)" },
  { key: "terminal", name: "Graphite Mint", tone: "low glare", swatch: "linear-gradient(135deg,#101820,#1f8a70,#d8f3dc)" },
  { key: "paper", name: "Analyst Light", tone: "clean desk", swatch: "linear-gradient(135deg,#f7fafc,#dbeafe,#38bdf8)" },
  { key: "amber", name: "Warm Focus", tone: "long study", swatch: "linear-gradient(135deg,#17130c,#f6d78b,#22c55e)" },
];

function levelLabel(level: string) {
  return level.replace("_", " ");
}

function sourceText(source: Source) {
  if (source === "api") return "Live Engine";
  if (source === "backup") return "Backup Engine";
  return "Curated Sample";
}

function score(set: PracticeSet | null, answers: Record<string, number>) {
  if (!set?.questions.length) return { correct: 0, total: 0, percent: 0 };
  const correct = set.questions.filter((q) => answers[q.id] === q.correctOptionIndex).length;
  return { correct, total: set.questions.length, percent: Math.round((correct / set.questions.length) * 100) };
}

function dimensionName(key?: string) {
  return DIMENSIONS.find(([dimensionKey]) => dimensionKey === key)?.[1] || "Core";
}

function skillBucket(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("capm") || lower.includes("beta") || lower.includes("sml")) return "CAPM";
  if (lower.includes("dcf") || lower.includes("fcff") || lower.includes("fcfe") || lower.includes("cash flow")) return "DCF";
  if (lower.includes("derivative") || lower.includes("option") || lower.includes("swap") || lower.includes("future")) return "Derivatives";
  if (lower.includes("fixed income") || lower.includes("bond") || lower.includes("duration") || lower.includes("convexity")) return "Fixed Income";
  if (lower.includes("var") || lower.includes("value at risk") || lower.includes("expected shortfall")) return "Market Risk";
  if (lower.includes("dupont") || lower.includes("roe") || lower.includes("financial statement")) return "Financial Statements";
  if (lower.includes("cds") || lower.includes("credit")) return "Credit Risk";
  return text.split(/[(:,-]/)[0]?.trim().slice(0, 30) || "Core Finance";
}

function skillStatus(accuracy: number, attempted: number): SkillStatus {
  if (!attempted) return "Baseline";
  if (accuracy < 55) return "Weak";
  if (accuracy < 75) return "Medium";
  return "Strong";
}

function statusClass(status: SkillStatus) {
  if (status === "Strong") return "bg-emerald-100 text-emerald-800";
  if (status === "Medium") return "bg-amber-100 text-amber-800";
  if (status === "Weak") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-500";
}

function qualityTone(value: number) {
  if (value >= 80) return "text-emerald-300";
  if (value >= 60) return "text-amber-300";
  return "text-red-300";
}

function planName(plan?: string) {
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export default function App() {
  const [examType, setExamType] = useState<ExamType>(ExamType.CFA);
  const [cfaLevel, setCfaLevel] = useState<CFALevel>("Level_1");
  const [frmPart, setFrmPart] = useState<FRMPart>("Part_1");
  const [conceptInput, setConceptInput] = useState("CAPM required rate of return with inflation adjustment");
  const [mode, setMode] = useState("Logic-Based Item Set (Modified Data)");
  const [count, setCount] = useState(3);
  const [dimension, setDimension] = useState("");
  const [activeSet, setActiveSet] = useState<PracticeSet | null>(null);
  const [source, setSource] = useState<Source>("static");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [graded, setGraded] = useState(false);
  const [saved, setSaved] = useState<SavedPractice[]>([]);
  const [panel, setPanel] = useState<Panel>("diagnosis");
  const [historySearch, setHistorySearch] = useState("");
  const [theme, setTheme] = useState<ThemeKey>("nexus");
  const [workspaceSize, setWorkspaceSize] = useState<WorkspaceSize>("wide");
  const [readingSize, setReadingSize] = useState<ReadingSize>("large");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const activeLevel = examType === ExamType.CFA ? cfaLevel : frmPart;
  const result = score(activeSet, answers);
  const answered = activeSet ? activeSet.questions.filter((q) => answers[q.id] !== undefined).length : 0;
  const completed = useMemo(() => saved.filter((item) => item.isCompleted), [saved]);

  useEffect(() => {
    const initial = STATIC_SAMPLE_PRACTICES["CFA_Level_1_CAPM (Capital Asset Pricing Model)"];
    if (initial) setActiveSet(initial);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null;
      const storedWorkspace = localStorage.getItem(WORKSPACE_STORAGE_KEY) as WorkspaceSize | null;
      const storedReading = localStorage.getItem(READING_STORAGE_KEY) as ReadingSize | null;
      if (storedTheme && THEMES.some((item) => item.key === storedTheme)) setTheme(storedTheme);
      if (storedWorkspace && ["balanced", "wide", "focus"].includes(storedWorkspace)) setWorkspaceSize(storedWorkspace);
      if (storedReading && ["standard", "large", "xl"].includes(storedReading)) setReadingSize(storedReading);
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => {
    const savedSession = loadSession();
    if (!savedSession) {
      fetchProfile(null).then(setProfile).catch(() => undefined);
      return;
    }
    setSession(savedSession);
    fetchProfile(savedSession)
      .then(setProfile)
      .catch(() => {
        saveSession(null);
        setSession(null);
      });
  }, []);

  const refreshProfile = async (nextSession = session) => {
    try {
      const nextProfile = await fetchProfile(nextSession);
      setProfile(nextProfile);
    } catch {
      // Keep the study flow responsive even if profile refresh fails.
    }
  };

  const submitAuth = async () => {
    setAuthError("");
    if (!hasClientAuthConfig()) {
      setAuthError("Supabase public settings are not configured yet.");
      return;
    }
    if (!authEmail || authPassword.length < 6) {
      setAuthError("Enter an email and a password with at least 6 characters.");
      return;
    }
    setAuthLoading(true);
    try {
      const nextSession = authMode === "signup" ? await signUp(authEmail, authPassword) : await signIn(authEmail, authPassword);
      saveSession(nextSession);
      setSession(nextSession);
      await refreshProfile(nextSession);
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err?.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    saveSession(null);
    setSession(null);
    setProfile(null);
    setAuthPassword("");
    fetchProfile(null).then(setProfile).catch(() => undefined);
  };

  const changeTheme = (next: ThemeKey) => {
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  const changeWorkspaceSize = (next: WorkspaceSize) => {
    setWorkspaceSize(next);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, next);
  };

  const changeReadingSize = (next: ReadingSize) => {
    setReadingSize(next);
    localStorage.setItem(READING_STORAGE_KEY, next);
  };

  const persist = (items: SavedPractice[]) => {
    setSaved(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const resetWork = () => {
    setAnswers({});
    setGraded(false);
    setError("");
  };

  const loadSampleFor = (type: ExamType, level: string) => {
    const sample = SAMPLE_TOPICS.find((item) => item.examType === type && item.level === level);
    if (!sample) return;
    setConceptInput(sample.concept);
    const set = STATIC_SAMPLE_PRACTICES[`${sample.examType}_${sample.level}_${sample.label}`];
    if (set) {
      setActiveSet(set);
      setSource("static");
      resetWork();
    }
  };

  const changeExam = (next: ExamType) => {
    setExamType(next);
    loadSampleFor(next, next === ExamType.CFA ? cfaLevel : frmPart);
  };

  const generate = async (overrideConcept?: string, overrideDimension?: string, overrideCount?: number) => {
    const concept = (overrideConcept || conceptInput).trim();
    const targetDimension = overrideDimension ?? dimension;
    if (!concept) {
      setError("Please enter a CFA or FRM curriculum concept first.");
      return;
    }
    setLoading(true);
    resetWork();
    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        },
        body: JSON.stringify({
          examType,
          level: levelLabel(activeLevel),
          concept,
          count: overrideCount ?? count,
          dimension: targetDimension || undefined,
          mode,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation request failed.");
      if (!Array.isArray(data.questions)) throw new Error("The API did not return a valid question list.");
      const set: PracticeSet = {
        id: `generated_${Date.now()}`,
        examType,
        subLevel: levelLabel(activeLevel),
        conceptInput: concept,
        generatedAt: new Date().toLocaleString(),
        questions: data.questions,
        targetDimension: targetDimension || undefined,
      };
      setActiveSet(set);
      setSource(data.source === "local-backup" ? "backup" : "api");
      persist([{ id: `saved_${Date.now()}`, practiceSet: set, userAnswers: {}, score: 0, isCompleted: false, savedAt: new Date().toLocaleString() }, ...saved]);
      refreshProfile();
    } catch (err: any) {
      setError(err?.message || "Unable to generate questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveCurrent = (completedSet = graded) => {
    if (!activeSet) return;
    const current = score(activeSet, answers);
    const item: SavedPractice = {
      id: `saved_${Date.now()}`,
      practiceSet: activeSet,
      userAnswers: answers,
      score: current.percent,
      isCompleted: completedSet,
      savedAt: new Date().toLocaleString(),
    };
    const existing = saved.findIndex((entry) => entry.practiceSet.id === activeSet.id);
    if (existing >= 0) {
      const copy = [...saved];
      copy[existing] = { ...item, id: copy[existing].id };
      persist(copy);
    } else {
      persist([item, ...saved]);
    }
  };

  const grade = () => {
    if (!activeSet) return;
    const missing = activeSet.questions.length - answered;
    if (missing && !confirm(`You have ${missing} unanswered question(s). Submit anyway?`)) return;
    setGraded(true);
    setTimeout(() => saveCurrent(true), 0);
  };

  const startTargetedDrill = (concept: string, targetDimension?: string) => {
    setConceptInput(concept);
    if (targetDimension) setDimension(targetDimension);
    setMode("Conceptual Drill Questions");
    setCount(3);
    generate(concept, targetDimension, 3);
  };

  const exportSet = () => {
    if (!activeSet) return;
    const lines = [`HarborQuant ${activeSet.examType} ${activeSet.subLevel}`, `Concept: ${activeSet.conceptInput}`, ""];
    activeSet.questions.forEach((q, index) => {
      lines.push(`Q${index + 1}. ${q.text}`);
      q.options.forEach((option, optionIndex) => lines.push(`${String.fromCharCode(65 + optionIndex)}. ${option}`));
      if (graded) lines.push(`Correct: ${String.fromCharCode(65 + q.correctOptionIndex)}`, q.stepByStepSolution, q.knowledgeAnalysis, q.examLogicInsight);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `HarborQuant_${activeSet.examType}_${activeSet.subLevel}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    return DIMENSIONS.map(([key, name, prompt]) => {
      let attempted = 0;
      let correct = 0;
      completed.forEach((practice) => {
        practice.practiceSet.questions.forEach((question) => {
          if ((question.dimension || "Concept_Mastery") !== key || practice.userAnswers?.[question.id] === undefined) return;
          attempted += 1;
          if (practice.userAnswers[question.id] === question.correctOptionIndex) correct += 1;
        });
      });
      return { key, name, prompt, attempted, accuracy: attempted ? Math.round((correct / attempted) * 100) : 0 };
    });
  }, [completed]);

  const intelligence = useMemo(() => {
    let totalQuestions = 0;
    let totalCorrect = 0;
    const gaps = new Map<string, { point: string; dimension: string; misses: number }>();
    completed.forEach((practice) => {
      practice.practiceSet.questions.forEach((question) => {
        if (practice.userAnswers?.[question.id] === undefined) return;
        totalQuestions += 1;
        const correct = practice.userAnswers[question.id] === question.correctOptionIndex;
        if (correct) {
          totalCorrect += 1;
          return;
        }
        const point = question.pointsTested || practice.practiceSet.conceptInput;
        const key = `${question.dimension || "Concept_Mastery"}:${point}`;
        const current = gaps.get(key);
        gaps.set(key, { point, dimension: question.dimension || "Concept_Mastery", misses: (current?.misses || 0) + 1 });
      });
    });
    const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const coverage = Math.min(100, Math.round((totalQuestions / 120) * 100));
    const readiness = totalQuestions ? Math.min(99, Math.round(accuracy * 0.72 + coverage * 0.28)) : 0;
    const weakDimension = stats.filter((item) => item.attempted > 0).sort((a, b) => a.accuracy - b.accuracy)[0];
    const topGaps = Array.from(gaps.values()).sort((a, b) => b.misses - a.misses).slice(0, 5);
    const readinessLabel = readiness >= 82 ? "Exam Ready" : readiness >= 62 ? "Acceleration" : totalQuestions ? "Repair Mode" : "Baseline";
    return { totalQuestions, totalCorrect, accuracy, coverage, readiness, readinessLabel, weakDimension, topGaps };
  }, [completed, stats]);

  const skillMap = useMemo(() => {
    const seed = ["CAPM", "DCF", "Fixed Income", "Derivatives", "Market Risk", "Financial Statements"];
    const map = new Map<string, { name: string; attempted: number; correct: number }>();
    seed.forEach((name) => map.set(name, { name, attempted: 0, correct: 0 }));
    completed.forEach((practice) => {
      practice.practiceSet.questions.forEach((question) => {
        if (practice.userAnswers?.[question.id] === undefined) return;
        const name = skillBucket(`${question.pointsTested} ${practice.practiceSet.conceptInput}`);
        const row = map.get(name) || { name, attempted: 0, correct: 0 };
        row.attempted += 1;
        if (practice.userAnswers[question.id] === question.correctOptionIndex) row.correct += 1;
        map.set(name, row);
      });
    });
    return Array.from(map.values())
      .map((item) => {
        const accuracy = item.attempted ? Math.round((item.correct / item.attempted) * 100) : 0;
        return { ...item, accuracy, status: skillStatus(accuracy, item.attempted) };
      })
      .sort((a, b) => (a.attempted && !b.attempted ? -1 : !a.attempted && b.attempted ? 1 : a.accuracy - b.accuracy))
      .slice(0, 7);
  }, [completed]);

  const learningBrain = useMemo(() => {
    const weakSkill = skillMap.find((skill) => skill.attempted > 0 && skill.accuracy < 75);
    const baselineSkill = skillMap.find((skill) => skill.attempted === 0);
    const topGap = intelligence.topGaps[0];
    const focus = topGap ? skillBucket(topGap.point) : weakSkill?.name || baselineSkill?.name || "CAPM";
    const focusConcept = topGap?.point || `${focus} core exam logic`;
    const focusDimension = topGap?.dimension || intelligence.weakDimension?.key || "Concept_Mastery";
    const difficulty = !intelligence.totalQuestions || (weakSkill && weakSkill.accuracy < 55) ? "Easy" : intelligence.readiness >= 75 ? "Hard" : "Medium";
    const action = topGap ? "错题强化" : weakSkill ? "弱项修复" : !intelligence.totalQuestions ? "建立基线" : "提高难度";
    const prompt = `Generate 1 ${focus} question. Difficulty: ${difficulty}. Dimension: ${dimensionName(focusDimension)}.`;
    return { focus, focusConcept, focusDimension, difficulty, action, prompt };
  }, [intelligence, skillMap]);

  const adaptiveFlow = useMemo(() => {
    const hasBaseline = intelligence.totalQuestions > 0;
    const hasWeakness = intelligence.topGaps.length > 0 || !!intelligence.weakDimension;
    return [
      { label: `${learningBrain.focus} foundation`, state: hasBaseline ? "done" : "active" },
      { label: "Wrong-answer repair", state: hasWeakness ? "active" : "locked" },
      { label: "Raise difficulty", state: intelligence.accuracy >= 65 && hasBaseline ? "active" : "locked" },
      { label: "Mixed exam simulation", state: intelligence.readiness >= 80 ? "active" : "locked" },
    ];
  }, [intelligence, learningBrain.focus]);

  const dispatchBrainInstruction = () => {
    setConceptInput(learningBrain.focusConcept);
    setDimension(learningBrain.focusDimension);
    setMode(learningBrain.difficulty === "Hard" ? "Logic-Based Item Set (Modified Data)" : "Conceptual Drill Questions");
    setCount(1);
    generate(learningBrain.focusConcept, learningBrain.focusDimension, 1);
  };

  const selectSample = (sample: (typeof SAMPLE_TOPICS)[number]) => {
    setExamType(sample.examType);
    if (sample.examType === ExamType.CFA) setCfaLevel(sample.level as CFALevel);
    if (sample.examType === ExamType.FRM) setFrmPart(sample.level as FRMPart);
    setConceptInput(sample.concept);
    const set = STATIC_SAMPLE_PRACTICES[`${sample.examType}_${sample.level}_${sample.label}`];
    if (set) {
      setActiveSet(set);
      setSource("static");
      resetWork();
    } else {
      generate(sample.concept);
    }
  };

  const history = saved.filter((entry) => {
    const query = historySearch.toLowerCase();
    return !query || `${entry.practiceSet.examType} ${entry.practiceSet.subLevel} ${entry.practiceSet.conceptInput}`.toLowerCase().includes(query);
  });
  const launchpads = SAMPLE_TOPICS.filter((topic) => topic.examType === examType && topic.level === activeLevel);
  const activeTheme = THEMES.find((item) => item.key === theme) || THEMES[0];
  const shellWidthClass = workspaceSize === "balanced" ? "max-w-[1500px]" : workspaceSize === "wide" ? "max-w-[1760px]" : "max-w-[1840px]";
  const mainGridClass = workspaceSize === "focus" ? "xl:grid-cols-[330px_minmax(0,1fr)]" : workspaceSize === "wide" ? "xl:grid-cols-[350px_minmax(0,1fr)]" : "xl:grid-cols-[390px_minmax(0,1fr)]";
  const workspaceGridClass = workspaceSize === "focus" ? "grid gap-5" : workspaceSize === "wide" ? "grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]" : "grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]";
  const questionTextClass = readingSize === "standard" ? "text-base leading-7" : readingSize === "large" ? "text-lg leading-8" : "text-xl leading-9";
  const optionTextClass = readingSize === "standard" ? "text-sm" : readingSize === "large" ? "text-base" : "text-lg";
  const articlePaddingClass = readingSize === "xl" ? "p-7" : readingSize === "large" ? "p-6" : "p-5";

  return (
    <div data-theme={theme} className="app-shell min-h-screen bg-[#03070b] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,#03070b,#06131f_38%,#071713_68%,#120f05)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(#22d3ee_1px,transparent_1px),linear-gradient(90deg,#34d399_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="fixed inset-x-0 top-0 -z-10 h-40 bg-[linear-gradient(180deg,rgba(34,211,238,.18),transparent)]" />

      <header className="border-b border-cyan-300/20 bg-black/55 backdrop-blur-xl shadow-[0_18px_80px_rgba(34,211,238,.10)]">
        <div className={`mx-auto flex ${shellWidthClass} flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-cyan-300/40 bg-[linear-gradient(135deg,rgba(34,211,238,.25),rgba(52,211,153,.10),rgba(251,191,36,.18))] text-xl font-black text-cyan-100 shadow-[0_0_42px_rgba(34,211,238,0.34)]">
              <span className="absolute inset-x-0 top-0 h-px bg-cyan-200" />
              H/Q
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase text-cyan-200 ring-1 ring-cyan-300/30">Quant Nexus</span>
                <h1 className="text-2xl font-black text-white">HarborQuant Nexus</h1>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-400">CFA and FRM adaptive exam intelligence console</p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(300px,420px)_auto] lg:items-stretch">
            <div className="rounded-lg border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(255,255,255,.09),rgba(34,211,238,.08))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
              {session ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-cyan-200"><ShieldCheck className="h-3.5 w-3.5" />{planName(profile?.plan)} Plan</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{profile?.email || session.email}</div>
                    <div className="mt-1 text-[11px] font-bold text-slate-400">{profile?.credits_remaining ?? "--"} / {profile?.monthly_credit_limit ?? "--"} question credits</div>
                  </div>
                  <button onClick={signOut} className="shrink-0 rounded-md border border-white/10 px-3 py-2 text-[11px] font-black text-slate-300 hover:bg-white/5">Sign out</button>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase text-cyan-200">{authMode === "signup" ? "Create free account" : "Sign in"}</div>
                    <button onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")} className="text-[10px] font-black uppercase text-slate-400 hover:text-cyan-200">{authMode === "signup" ? "I have an account" : "Create account"}</button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="email" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold outline-none focus:border-cyan-300" />
                    <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="password" type="password" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold outline-none focus:border-cyan-300" />
                    <button onClick={submitAuth} disabled={authLoading} className="rounded-md bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:bg-slate-500">{authLoading ? "..." : authMode === "signup" ? "Free" : "Login"}</button>
                  </div>
                  {authError && <div className="mt-2 text-[11px] font-bold text-red-300">{authError}</div>}
                  {!hasClientAuthConfig() && <div className="mt-2 text-[11px] font-bold text-amber-200">Auth is in dev mode until Supabase env vars are added.</div>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Readiness", `${intelligence.readiness}%`, Gauge],
                ["Answered", String(intelligence.totalQuestions), Activity],
                ["Engine", sourceText(source), ShieldCheck],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="rounded-lg border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(255,255,255,.09),rgba(34,211,238,.08))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500"><Icon className="h-3.5 w-3.5 text-cyan-300" />{label}</div>
                  <div className="mt-1 text-sm font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className={`mx-auto grid ${shellWidthClass} gap-5 px-5 py-5 ${mainGridClass}`}>
        <aside className="space-y-5">
          <section className="rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-cyan-200">Mission Control</p>
                <h2 className="mt-1 text-lg font-black text-white">Exam Generator</h2>
              </div>
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
              <button onClick={() => changeExam(ExamType.CFA)} className={`rounded-md px-3 py-2 text-sm font-black ${examType === ExamType.CFA ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/5"}`}><Award className="mr-2 inline h-4 w-4" />CFA</button>
              <button onClick={() => changeExam(ExamType.FRM)} className={`rounded-md px-3 py-2 text-sm font-black ${examType === ExamType.FRM ? "bg-emerald-300 text-slate-950" : "text-slate-400 hover:bg-white/5"}`}><Layers3 className="mr-2 inline h-4 w-4" />FRM</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {examType === ExamType.CFA
                ? (["Level_1", "Level_2", "Level_3"] as CFALevel[]).map((level) => (
                    <button key={level} onClick={() => { setCfaLevel(level); loadSampleFor(ExamType.CFA, level); }} className={`rounded-md border px-3 py-2 text-xs font-black ${cfaLevel === level ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/10 text-slate-400"}`}>{levelLabel(level)}</button>
                  ))
                : (["Part_1", "Part_2"] as FRMPart[]).map((part) => (
                    <button key={part} onClick={() => { setFrmPart(part); loadSampleFor(ExamType.FRM, part); }} className={`rounded-md border px-3 py-2 text-xs font-black ${frmPart === part ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-white/10 text-slate-400"}`}>{levelLabel(part)}</button>
                  ))}
            </div>
            <label className="mt-5 block text-[11px] font-black uppercase text-slate-400">Exam point</label>
            <textarea value={conceptInput} onChange={(event) => setConceptInput(event.target.value)} className="mt-2 h-28 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <select value={mode} onChange={(event) => setMode(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b1718] p-2.5 text-xs font-bold">
                <option value="Logic-Based Item Set (Modified Data)">Exam Logic</option>
                <option value="Calculative Focus (Formula Logic)">Formula Drill</option>
                <option value="Conceptual Drill Questions">Concept Drill</option>
              </select>
              <select value={count} onChange={(event) => setCount(Number(event.target.value))} className="rounded-lg border border-white/10 bg-[#0b1718] p-2.5 text-xs font-bold">
                <option value={1}>1 Question</option>
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
              </select>
            </div>
            <select value={dimension} onChange={(event) => setDimension(event.target.value)} className="mt-3 w-full rounded-lg border border-white/10 bg-[#0b1718] p-2.5 text-xs font-bold">
              <option value="">Balanced Mix</option>
              {DIMENSIONS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
            <button onClick={() => generate()} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3.5 text-sm font-black text-slate-950 shadow-[0_12px_36px_rgba(34,211,238,0.22)] hover:bg-cyan-200 disabled:bg-slate-600">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Generate Exam Set</button>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-cyan-200">Visual Console</p>
                <h3 className="mt-1 text-base font-black text-white">Study Appearance</h3>
              </div>
              <Palette className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="grid gap-2">
              {THEMES.map((item) => (
                <button key={item.key} onClick={() => changeTheme(item.key)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${theme === item.key ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/20 hover:border-cyan-300/30"}`}>
                  <span className="h-7 w-7 shrink-0 rounded-md border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,.24)]" style={{ background: item.swatch }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-black text-slate-100">{item.name}</span>
                    <span className="block text-[10px] font-black uppercase text-slate-500">{item.tone}</span>
                  </span>
                  {theme === item.key && <CheckCircle2 className="h-4 w-4 text-cyan-300" />}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><Maximize2 className="h-3.5 w-3.5 text-cyan-300" />Workspace</span>
                <span className="text-[10px] font-black uppercase text-cyan-200">{activeTheme.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["balanced", "Balanced"],
                  ["wide", "Wide"],
                  ["focus", "Focus"],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => changeWorkspaceSize(key as WorkspaceSize)} className={`rounded-md border px-2 py-2 text-[11px] font-black ${workspaceSize === key ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>{label}</button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["standard", "Normal"],
                  ["large", "Large"],
                  ["xl", "XL"],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => changeReadingSize(key as ReadingSize)} className={`rounded-md border px-2 py-2 text-[11px] font-black ${readingSize === key ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>{label}</button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-cyan-300/20 bg-slate-950/80 p-4 shadow-2xl shadow-cyan-950/20">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-cyan-200">Learning Brain</p>
                <h3 className="mt-1 text-base font-black text-white">Quant Dispatch System</h3>
              </div>
              <BrainCircuit className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Focus", learningBrain.focus],
                ["Action", learningBrain.action],
                ["Difficulty", learningBrain.difficulty],
                ["Dimension", dimensionName(learningBrain.focusDimension)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2">
                  <div className="text-[9px] font-black uppercase text-slate-500">{label}</div>
                  <div className="mt-1 truncate text-xs font-black text-slate-100">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] p-3">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase text-emerald-200"><Send className="h-3.5 w-3.5" />Question Generator Command</div>
              <p className="text-xs font-bold leading-5 text-slate-300">{learningBrain.prompt}</p>
            </div>
            <button onClick={dispatchBrainInstruction} disabled={loading} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 text-xs font-black text-slate-950 hover:bg-emerald-200 disabled:bg-slate-600">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Run Quant Signal</button>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-black text-white"><Flame className="h-4 w-4 text-amber-300" />High-Yield Launchpads</h3>
              <span className="text-[10px] font-black uppercase text-slate-500">{launchpads.length} live</span>
            </div>
            <div className="space-y-2">
              {launchpads.map((sample, index) => (
                <button key={index} onClick={() => selectSample(sample)} className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-left text-xs font-bold text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-300/10">
                  <span className="truncate pr-3">{sample.label}</span>
                  <ChevronRight className="h-4 w-4 text-cyan-300" />
                </button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] backdrop-blur-xl">
            <div className="grid grid-cols-2 border-b border-white/10 bg-black/20 p-1">
              <button onClick={() => setPanel("diagnosis")} className={`rounded-md px-3 py-2 text-xs font-black ${panel === "diagnosis" ? "bg-emerald-300 text-slate-950" : "text-slate-400"}`}><Radar className="mr-2 inline h-4 w-4" />Diagnosis</button>
              <button onClick={() => setPanel("history")} className={`rounded-md px-3 py-2 text-xs font-black ${panel === "history" ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}><History className="mr-2 inline h-4 w-4" />History</button>
            </div>
            {panel === "diagnosis" ? (
              <div className="space-y-3 p-4">
                {stats.map((item) => (
                  <div key={item.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-white">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.prompt}</div>
                      </div>
                      <div className="text-xs font-black text-cyan-200">{item.attempted ? `${item.accuracy}%` : "N/A"}</div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-cyan-300" style={{ width: `${item.attempted ? item.accuracy : 8}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-xs font-medium outline-none" placeholder="Search history" />
                </div>
                <div className="max-h-[320px] space-y-2 overflow-y-auto">
                  {history.map((entry) => (
                    <button key={entry.id} onClick={() => { setActiveSet(entry.practiceSet); setAnswers(entry.userAnswers || {}); setGraded(entry.isCompleted); setSource("api"); }} className="group w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left hover:border-cyan-300/40">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-black text-cyan-100">{entry.practiceSet.examType} {entry.practiceSet.subLevel}</span>
                        <span onClick={(event) => { event.stopPropagation(); persist(saved.filter((item) => item.id !== entry.id)); }} className="text-slate-500 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></span>
                      </div>
                      <div className="mt-2 truncate text-xs font-black text-white">{entry.practiceSet.conceptInput}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </aside>

        <section className="min-h-[720px] overflow-hidden rounded-lg border border-cyan-300/20 bg-[#061018] text-slate-100 shadow-[0_26px_90px_rgba(0,0,0,.55),0_0_42px_rgba(34,211,238,.10)]">
          <div className="border-b border-cyan-300/15 bg-[linear-gradient(135deg,rgba(2,6,23,.96),rgba(8,24,34,.94),rgba(5,46,40,.70))] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-200 ring-1 ring-cyan-300/30">{activeSet ? `${activeSet.examType} ${activeSet.subLevel}` : `${examType} ${levelLabel(activeLevel)}`}</span>
                  <span className="rounded border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-200">{sourceText(source)}</span>
                  <span className="rounded border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-black uppercase text-amber-200">Adaptive Loop</span>
                </div>
                <h2 className="mt-3 max-w-4xl text-xl font-black text-white lg:text-2xl">{activeSet?.conceptInput || "Professional exam intelligence workspace"}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Answered", activeSet ? `${answered}/${activeSet.questions.length}` : "0/0", ClipboardCheck],
                  ["Score", graded ? `${result.percent}%` : "Pending", BarChart3],
                  ["Saved", String(saved.length), Database],
                ].map(([label, value, Icon]: any) => (
                  <div key={label} className="rounded-lg border border-cyan-300/15 bg-white/[0.06] px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500"><Icon className="h-3.5 w-3.5 text-cyan-300" />{label}</div>
                    <div className="mt-1 text-sm font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {activeSet && (
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-cyan-300/15 pt-3">
                <button onClick={exportSet} className="rounded-lg border border-cyan-300/20 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200 hover:bg-cyan-300/10"><Download className="mr-2 inline h-4 w-4 text-cyan-300" />Export</button>
                <button onClick={() => saveCurrent()} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.22)]"><Bookmark className="mr-2 inline h-4 w-4" />Save</button>
              </div>
            )}
          </div>

          <div className="max-h-[calc(100vh-170px)] overflow-y-auto p-5 lg:p-7">
            <div className={workspaceGridClass}>
              <div className="min-w-0">
                {error && <div className="mb-5 rounded-lg border border-red-400/30 bg-red-950/40 p-4 text-sm font-bold text-red-100">{error}</div>}
                {loading ? (
                  <div className="grid gap-4">{[1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-lg border border-cyan-300/10 bg-white/[0.05]" />)}</div>
                ) : activeSet ? (
                  <div className="space-y-5">
                    {graded && (
                      <div className="rounded-lg border border-amber-300/20 bg-[linear-gradient(135deg,rgba(15,23,42,.98),rgba(34,21,5,.85))] p-5 text-white shadow-[0_0_30px_rgba(251,191,36,.12)]">
                        <div className="flex items-center justify-between">
                          <div><div className="text-xs font-black uppercase text-cyan-200"><Target className="mr-2 inline h-4 w-4" />Performance Board</div><div className="mt-2 text-2xl font-black">{result.correct} of {result.total} correct</div></div>
                          <div className="text-5xl font-black text-amber-300">{result.percent}%</div>
                        </div>
                      </div>
                    )}
                    {activeSet.questions.map((question, index) => {
                      const selected = answers[question.id];
                      const isCorrect = selected === question.correctOptionIndex;
                      return (
                        <article key={question.id} className={`overflow-hidden rounded-lg border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.96))] ${articlePaddingClass} shadow-[0_16px_55px_rgba(0,0,0,.32)]`}>
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-cyan-300 px-2.5 py-1 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.22)]">Q{index + 1}</span>
                              <span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-200">{question.dimension || "Core"}</span>
                              <span className="rounded border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-black uppercase text-amber-200">{question.difficulty}</span>
                            </div>
                            {graded && <span className={`text-xs font-black ${isCorrect ? "text-emerald-300" : "text-red-300"}`}>{isCorrect ? <CheckCircle2 className="mr-1 inline h-4 w-4" /> : <XCircle className="mr-1 inline h-4 w-4" />}{isCorrect ? "Correct" : "Review"}</span>}
                          </div>
                          <p className={`whitespace-pre-line font-bold text-slate-100 ${questionTextClass}`}>{question.text}</p>
                          <div className="mt-5 grid gap-3">
                            {question.options.map((option, optionIndex) => {
                              const picked = selected === optionIndex;
                              const correct = question.correctOptionIndex === optionIndex;
                              let className = "border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-300/35 hover:bg-cyan-300/[0.06]";
                              if (!graded && picked) className = "border-cyan-300 bg-cyan-300/10 text-cyan-50 ring-2 ring-cyan-300/20";
                              if (graded && correct) className = "border-emerald-300 bg-emerald-300/10 text-emerald-50 ring-2 ring-emerald-300/20";
                              if (graded && picked && !correct) className = "border-red-300 bg-red-300/10 text-red-50 ring-2 ring-red-300/20";
                              return <button key={optionIndex} disabled={graded} onClick={() => setAnswers({ ...answers, [question.id]: optionIndex })} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left font-bold ${optionTextClass} ${className}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-950 text-xs font-black text-cyan-200 ring-1 ring-cyan-300/20">{String.fromCharCode(65 + optionIndex)}</span>{option}</button>;
                            })}
                          </div>
                          {graded && (
                            <div className="mt-5 grid gap-3 border-t border-cyan-300/15 pt-5">
                              <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] p-4"><h4 className="text-xs font-black uppercase text-cyan-200">Step-by-step solution</h4><p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-slate-200">{question.stepByStepSolution}</p></div>
                              <div className="grid gap-3 lg:grid-cols-2">
                                <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4"><h4 className="text-xs font-black uppercase text-slate-400">Knowledge analysis</h4><p className="mt-2 text-sm font-medium leading-6 text-slate-200">{question.knowledgeAnalysis}</p></div>
                                <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-4"><h4 className="text-xs font-black uppercase text-amber-200">Examiner logic</h4><p className="mt-2 text-sm font-medium leading-6 text-slate-200">{question.examLogicInsight}</p></div>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                    <div className="sticky bottom-0 rounded-lg border border-cyan-300/15 bg-slate-950/90 p-3 shadow-[0_0_34px_rgba(34,211,238,.12)] backdrop-blur">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-black text-slate-300">Progress {answered} / {activeSet.questions.length}</div>
                        <div className="flex gap-2">
                          {graded && <button onClick={() => { setAnswers({}); setGraded(false); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-black text-slate-200"><RefreshCcw className="mr-2 inline h-4 w-4" />Reset</button>}
                          {!graded && <button onClick={grade} className="rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.22)]"><ClipboardCheck className="mr-2 inline h-4 w-4" />Submit and Review</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-[560px] place-items-center rounded-lg border border-dashed border-cyan-300/25 bg-white/[0.04] text-center">
                    <div className="max-w-xl p-8"><BrainCircuit className="mx-auto h-12 w-12 text-cyan-300" /><h2 className="mt-5 text-2xl font-black text-white">Exam intelligence workspace ready</h2><p className="mt-3 text-sm font-medium text-slate-400">Select a CFA or FRM module, enter a curriculum point, and generate a professional practice set.</p></div>
                  </div>
                )}
              </div>

              {workspaceSize !== "focus" && <aside className="space-y-4 2xl:sticky 2xl:top-0 2xl:self-start">
                <section className="overflow-hidden rounded-lg border border-slate-900 bg-slate-950 text-white shadow-xl">
                  <div className="border-b border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,.16),rgba(251,191,36,.08))] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase text-cyan-200">Exam Readiness</p>
                        <h3 className="mt-1 text-xl font-black">{intelligence.readinessLabel}</h3>
                      </div>
                      <div className={`text-4xl font-black ${qualityTone(intelligence.readiness)}`}>{intelligence.readiness}%</div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-[linear-gradient(90deg,#22d3ee,#34d399,#fbbf24)]" style={{ width: `${Math.max(6, intelligence.readiness)}%` }} /></div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[["Questions", intelligence.totalQuestions], ["Accuracy", `${intelligence.accuracy}%`], ["Sets", completed.length]].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2"><div className="text-[9px] font-black uppercase text-slate-500">{label}</div><div className="mt-1 text-sm font-black">{value}</div></div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-xs font-black uppercase text-slate-300"><Network className="h-4 w-4 text-cyan-300" />Skill Map</h4>
                      <span className="text-[10px] font-black text-slate-500">{intelligence.coverage}% coverage</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {skillMap.map((item) => (
                        <div key={item.name}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-black">
                            <span className="truncate text-slate-300">{item.name}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[9px] ${statusClass(item.status)}`}>{item.status}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-cyan-300" style={{ width: `${item.attempted ? item.accuracy : 4}%` }} /></div>
                          <div className="mt-1 flex justify-between text-[10px] font-black text-slate-500"><span>{item.attempted ? `${item.accuracy}% accuracy` : "not measured"}</span><span>{item.attempted} Q</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-amber-300/20 bg-[linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.96))] p-4 shadow-[0_16px_55px_rgba(0,0,0,.26)]">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-black text-white"><AlertTriangle className="h-4 w-4 text-amber-300" />Weakness Queue</h3>
                    <span className="rounded bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-200 ring-1 ring-amber-300/20">{intelligence.topGaps.length} gaps</span>
                  </div>
                  {intelligence.topGaps.length ? (
                    <div className="space-y-2">
                      {intelligence.topGaps.map((gap) => (
                        <div key={`${gap.dimension}-${gap.point}`} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><p className="truncate text-xs font-black text-slate-100">{gap.point}</p><p className="mt-1 text-[10px] font-black uppercase text-slate-500">{dimensionName(gap.dimension)} · {gap.misses} miss{gap.misses > 1 ? "es" : ""}</p></div>
                            <button onClick={() => startTargetedDrill(gap.point, gap.dimension)} className="shrink-0 rounded-md bg-amber-300 px-2.5 py-1.5 text-[10px] font-black text-slate-950">Drill</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.04] p-4 text-center"><BrainCircuit className="mx-auto h-6 w-6 text-slate-500" /><p className="mt-2 text-xs font-bold text-slate-500">Submit a practice set to activate weakness diagnosis.</p></div>
                  )}
                </section>

                <section className="rounded-lg border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(6,78,59,.24),rgba(2,6,23,.96))] p-4 shadow-[0_16px_55px_rgba(0,0,0,.26)]">
                  <div className="flex items-center gap-2 text-sm font-black text-emerald-200"><TrendingUp className="h-4 w-4" />Adaptive Flow</div>
                  <div className="mt-3 space-y-2">
                    {adaptiveFlow.map((step, index) => (
                      <div key={step.label} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-black ${step.state === "done" ? "bg-emerald-600 text-white" : step.state === "active" ? "bg-slate-950 text-cyan-200" : "bg-slate-100 text-slate-400"}`}>{index + 1}</span>
                        <div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-100">{step.label}</div><div className="text-[10px] font-black uppercase text-emerald-300">{step.state}</div></div>
                      </div>
                    ))}
                  </div>
                  <button onClick={dispatchBrainInstruction} disabled={loading} className="mt-3 w-full rounded-lg bg-emerald-300 px-3 py-2.5 text-xs font-black text-slate-950 shadow-[0_0_24px_rgba(52,211,153,.20)] disabled:bg-slate-400">Generate Next Flow Step</button>
                </section>
              </aside>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
