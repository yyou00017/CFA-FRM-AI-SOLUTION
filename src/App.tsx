import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Bookmark,
  BrainCircuit,
  Calculator,
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
  Network,
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

type Source = "api" | "backup" | "static";
type Panel = "diagnosis" | "history";
type Gap = { point: string; dimension: string; misses: number; examType: string };

const STORAGE_KEY = "examlogic_saved_practices";
const DIMENSIONS = [
  ["Concept_Mastery", "Concept", "Definitions, assumptions, and curriculum rules"],
  ["Calculation", "Calculation", "Formula application and numerical derivation"],
  ["Sensitivity_Analysis", "Sensitivity", "Risk factor and market variable transmission"],
  ["Case_Study", "Case", "Institutional multi-variable scenarios"],
  ["Risk_Management", "Risk", "Capital, controls, hedging, and compliance"],
  ["Reverse_Engineering", "Reverse", "Solve backward from target metrics"],
] as const;

function levelLabel(level: string) {
  return level.replace("_", " ");
}

function score(set: PracticeSet | null, answers: Record<string, number>) {
  if (!set?.questions.length) return { correct: 0, total: 0, percent: 0 };
  const correct = set.questions.filter((q) => answers[q.id] === q.correctOptionIndex).length;
  return { correct, total: set.questions.length, percent: Math.round((correct / set.questions.length) * 100) };
}

function sourceText(source: Source) {
  if (source === "api") return "Live AI";
  if (source === "backup") return "Backup Engine";
  return "Curated Sample";
}

function dimensionName(key?: string) {
  return DIMENSIONS.find(([dimensionKey]) => dimensionKey === key)?.[1] || "Core";
}

function qualityTone(value: number) {
  if (value >= 80) return "text-emerald-300";
  if (value >= 60) return "text-amber-300";
  return "text-red-300";
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

  const activeLevel = examType === ExamType.CFA ? cfaLevel : frmPart;
  const result = score(activeSet, answers);
  const answered = activeSet ? activeSet.questions.filter((q) => answers[q.id] !== undefined).length : 0;

  useEffect(() => {
    const initial = STATIC_SAMPLE_PRACTICES["CFA_Level_1_CAPM (Capital Asset Pricing Model)"];
    if (initial) setActiveSet(initial);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      setSaved([]);
    }
  }, []);

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

  const generate = async (overrideConcept?: string, overrideDimension?: string) => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType,
          level: levelLabel(activeLevel),
          concept,
          count,
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
      persist([
        {
          id: `saved_${Date.now()}`,
          practiceSet: set,
          userAnswers: {},
          score: 0,
          isCompleted: false,
          savedAt: new Date().toLocaleString(),
        },
        ...saved,
      ]);
    } catch (err: any) {
      setError(err?.message || "Unable to generate questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startTargetedDrill = (concept: string, targetDimension?: string) => {
    setConceptInput(concept);
    if (targetDimension) setDimension(targetDimension);
    setMode("Conceptual Drill Questions");
    setCount(3);
    generate(concept, targetDimension);
  };

  const saveCurrent = (completed = graded) => {
    if (!activeSet) return;
    const current = score(activeSet, answers);
    const item: SavedPractice = {
      id: `saved_${Date.now()}`,
      practiceSet: activeSet,
      userAnswers: answers,
      score: current.percent,
      isCompleted: completed,
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

  const exportSet = () => {
    if (!activeSet) return;
    const lines = [`ExamLogic AI ${activeSet.examType} ${activeSet.subLevel}`, `Concept: ${activeSet.conceptInput}`, ""];
    activeSet.questions.forEach((q, index) => {
      lines.push(`Q${index + 1}. ${q.text}`);
      q.options.forEach((option, optionIndex) => lines.push(`${String.fromCharCode(65 + optionIndex)}. ${option}`));
      if (graded) {
        lines.push(`Correct: ${String.fromCharCode(65 + q.correctOptionIndex)}`, q.stepByStepSolution, q.knowledgeAnalysis, q.examLogicInsight);
      }
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ExamLogic_${activeSet.examType}_${activeSet.subLevel}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    return DIMENSIONS.map(([key, name, prompt]) => {
      let attempted = 0;
      let correct = 0;
      saved.forEach((practice) => {
        if (!practice.isCompleted) return;
        practice.practiceSet.questions.forEach((question) => {
          if ((question.dimension || "Concept_Mastery") !== key) return;
          attempted += 1;
          if (practice.userAnswers?.[question.id] === question.correctOptionIndex) correct += 1;
        });
      });
      return { key, name, prompt, attempted, accuracy: attempted ? Math.round((correct / attempted) * 100) : 0 };
    });
  }, [saved]);

  const completedPractices = useMemo(() => saved.filter((practice) => practice.isCompleted), [saved]);

  const intelligence = useMemo(() => {
    let totalQuestions = 0;
    let totalCorrect = 0;
    const gaps = new Map<string, Gap>();

    completedPractices.forEach((practice) => {
      practice.practiceSet.questions.forEach((question) => {
        const answeredQuestion = practice.userAnswers?.[question.id] !== undefined;
        if (!answeredQuestion) return;
        totalQuestions += 1;
        const correct = practice.userAnswers?.[question.id] === question.correctOptionIndex;
        if (correct) {
          totalCorrect += 1;
          return;
        }
        const point = question.pointsTested || practice.practiceSet.conceptInput;
        const key = `${question.dimension || "Concept_Mastery"}:${point}`;
        const existing = gaps.get(key);
        gaps.set(key, {
          point,
          dimension: question.dimension || "Concept_Mastery",
          misses: (existing?.misses || 0) + 1,
          examType: practice.practiceSet.examType,
        });
      });
    });

    const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const coverage = Math.min(100, Math.round((totalQuestions / 120) * 100));
    const readiness = totalQuestions ? Math.min(99, Math.round(accuracy * 0.72 + coverage * 0.28)) : 0;
    const weakDimension = stats.filter((item) => item.attempted > 0).sort((a, b) => a.accuracy - b.accuracy)[0];
    const topGaps = Array.from(gaps.values()).sort((a, b) => b.misses - a.misses).slice(0, 5);
    const readinessLabel = readiness >= 82 ? "Exam Ready" : readiness >= 62 ? "Acceleration" : totalQuestions ? "Repair Mode" : "Baseline";

    return {
      totalQuestions,
      totalCorrect,
      accuracy,
      coverage,
      readiness,
      readinessLabel,
      weakDimension,
      topGaps,
    };
  }, [completedPractices, stats]);

  const visibleHistory = saved.filter((entry) => {
    const query = historySearch.toLowerCase();
    return !query || `${entry.practiceSet.examType} ${entry.practiceSet.subLevel} ${entry.practiceSet.conceptInput}`.toLowerCase().includes(query);
  });

  const launchpads = SAMPLE_TOPICS.filter((topic) => topic.examType === examType && topic.level === activeLevel);

  return (
    <div className="min-h-screen bg-[#07110f] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,#07110f,#0b1e24_42%,#15180d)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] [background-size:42px_42px]" />

      <header className="border-b border-cyan-300/15 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-xl font-black text-cyan-200 shadow-[0_0_36px_rgba(34,211,238,0.22)]">
              EL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-300/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-200 ring-1 ring-emerald-300/20">
                  Fintech Lab
                </span>
                <h1 className="text-2xl font-black text-white">ExamLogic AI</h1>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-400">CFA and FRM adaptive exam intelligence console</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Readiness", `${intelligence.readiness}%`, Gauge],
              ["Answered", String(intelligence.totalQuestions), Activity],
              ["Engine", sourceText(source), ShieldCheck],
            ].map(([label, value, Icon]: any) => (
              <div key={label} className="rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(34,211,238,.06))] px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                  <Icon className="h-3.5 w-3.5 text-cyan-300" />
                  {label}
                </div>
                <div className="mt-1 text-sm font-black text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 xl:grid-cols-[390px_minmax(0,1fr)]">
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
              <button onClick={() => changeExam(ExamType.CFA)} className={`rounded-md px-3 py-2 text-sm font-black ${examType === ExamType.CFA ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/5"}`}>
                <Award className="mr-2 inline h-4 w-4" /> CFA
              </button>
              <button onClick={() => changeExam(ExamType.FRM)} className={`rounded-md px-3 py-2 text-sm font-black ${examType === ExamType.FRM ? "bg-emerald-300 text-slate-950" : "text-slate-400 hover:bg-white/5"}`}>
                <Layers3 className="mr-2 inline h-4 w-4" /> FRM
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {examType === ExamType.CFA
                ? (["Level_1", "Level_2", "Level_3"] as CFALevel[]).map((level) => (
                    <button key={level} onClick={() => { setCfaLevel(level); loadSampleFor(ExamType.CFA, level); }} className={`rounded-md border px-3 py-2 text-xs font-black ${cfaLevel === level ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/10 text-slate-400"}`}>
                      {levelLabel(level)}
                    </button>
                  ))
                : (["Part_1", "Part_2"] as FRMPart[]).map((part) => (
                    <button key={part} onClick={() => { setFrmPart(part); loadSampleFor(ExamType.FRM, part); }} className={`rounded-md border px-3 py-2 text-xs font-black ${frmPart === part ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-white/10 text-slate-400"}`}>
                      {levelLabel(part)}
                    </button>
                  ))}
            </div>
            <label className="mt-5 block text-[11px] font-black uppercase text-slate-400">Exam point</label>
            <textarea value={conceptInput} onChange={(event) => setConceptInput(event.target.value)} className="mt-2 h-32 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300" />
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
            <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-cyan-200">Adaptive next action</p>
                  <p className="mt-1 text-xs font-bold text-slate-300">
                    {intelligence.weakDimension ? `${intelligence.weakDimension.name} repair set` : "Build baseline profile"}
                  </p>
                </div>
                <button
                  onClick={() => startTargetedDrill(intelligence.topGaps[0]?.point || conceptInput, intelligence.weakDimension?.key)}
                  disabled={loading}
                  className="rounded-md bg-amber-300 px-3 py-2 text-[11px] font-black text-slate-950 disabled:bg-slate-600"
                >
                  <Zap className="mr-1 inline h-3.5 w-3.5" /> Drill
                </button>
              </div>
            </div>
            <button onClick={() => generate()} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3.5 text-sm font-black text-slate-950 shadow-[0_12px_36px_rgba(34,211,238,0.22)] hover:bg-cyan-200 disabled:bg-slate-600">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Generate Exam Set
            </button>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-black text-white"><Flame className="h-4 w-4 text-amber-300" /> High-Yield Launchpads</h3>
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
                    <div className="flex items-center justify-between">
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
                <div className="max-h-[360px] space-y-2 overflow-y-auto">
                  {visibleHistory.map((entry) => (
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

        <section className="min-h-[720px] overflow-hidden rounded-lg border border-white/10 bg-[#f5f7f2] text-slate-950 shadow-2xl">
          <div className="border-b border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-200">{activeSet ? `${activeSet.examType} ${activeSet.subLevel}` : `${examType} ${levelLabel(activeLevel)}`}</span>
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">{sourceText(source)}</span>
                </div>
                <h2 className="mt-3 max-w-4xl text-xl font-black lg:text-2xl">{activeSet?.conceptInput || "Professional exam intelligence workspace"}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Answered", activeSet ? `${answered}/${activeSet.questions.length}` : "0/0", ClipboardCheck],
                  ["Score", graded ? `${result.percent}%` : "Pending", BarChart3],
                  ["Saved", String(saved.length), Database],
                ].map(([label, value, Icon]: any) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500"><Icon className="h-3.5 w-3.5" />{label}</div>
                    <div className="mt-1 text-sm font-black">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {activeSet && (
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                <button onClick={exportSet} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black"><Download className="mr-2 inline h-4 w-4" />Export</button>
                <button onClick={() => saveCurrent()} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white"><Bookmark className="mr-2 inline h-4 w-4 text-cyan-200" />Save</button>
              </div>
            )}
          </div>

          <div className="max-h-[calc(100vh-170px)] overflow-y-auto p-5 lg:p-7">
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
            {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
            {loading ? (
              <div className="grid gap-4">{[1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-lg bg-white" />)}</div>
            ) : activeSet ? (
              <div className="space-y-5">
                {graded && (
                  <div className="rounded-lg bg-slate-950 p-5 text-white">
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
                    <article key={question.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-950 px-2.5 py-1 text-xs font-black text-white">Q{index + 1}</span>
                          <span className="rounded bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">{question.dimension || "Core"}</span>
                          <span className="rounded bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">{question.difficulty}</span>
                        </div>
                        {graded && <span className={`text-xs font-black ${isCorrect ? "text-emerald-700" : "text-red-700"}`}>{isCorrect ? <CheckCircle2 className="mr-1 inline h-4 w-4" /> : <XCircle className="mr-1 inline h-4 w-4" />}{isCorrect ? "Correct" : "Review"}</span>}
                      </div>
                      <p className="whitespace-pre-line text-base font-bold leading-7">{question.text}</p>
                      <div className="mt-5 grid gap-3">
                        {question.options.map((option, optionIndex) => {
                          const picked = selected === optionIndex;
                          const correct = question.correctOptionIndex === optionIndex;
                          let className = "border-slate-200 bg-slate-50 hover:border-slate-400";
                          if (!graded && picked) className = "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100";
                          if (graded && correct) className = "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100";
                          if (graded && picked && !correct) className = "border-red-500 bg-red-50 ring-2 ring-red-100";
                          return <button key={optionIndex} disabled={graded} onClick={() => setAnswers({ ...answers, [question.id]: optionIndex })} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm font-bold ${className}`}><span className="flex h-7 w-7 items-center justify-center rounded bg-white text-xs font-black ring-1 ring-slate-200">{String.fromCharCode(65 + optionIndex)}</span>{option}</button>;
                        })}
                      </div>
                      {graded && (
                        <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5">
                          <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-4"><h4 className="text-xs font-black uppercase text-cyan-800">Step-by-step solution</h4><p className="mt-2 whitespace-pre-line text-sm font-medium leading-6">{question.stepByStepSolution}</p></div>
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><h4 className="text-xs font-black uppercase text-slate-600">Knowledge analysis</h4><p className="mt-2 text-sm font-medium leading-6">{question.knowledgeAnalysis}</p></div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h4 className="text-xs font-black uppercase text-amber-700">Examiner logic</h4><p className="mt-2 text-sm font-medium leading-6">{question.examLogicInsight}</p></div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                <div className="sticky bottom-0 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-black text-slate-700">Progress {answered} / {activeSet.questions.length}</div>
                    <div className="flex gap-2">
                      {graded && <button onClick={() => { setAnswers({}); setGraded(false); }} className="rounded-lg border px-4 py-2.5 text-sm font-black"><RefreshCcw className="mr-2 inline h-4 w-4" />Reset</button>}
                      {!graded && <button onClick={grade} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-black text-white"><ClipboardCheck className="mr-2 inline h-4 w-4 text-cyan-200" />Submit and Review</button>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[560px] place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
                <div className="max-w-xl p-8"><BrainCircuit className="mx-auto h-12 w-12 text-slate-950" /><h2 className="mt-5 text-2xl font-black">Exam intelligence workspace ready</h2><p className="mt-3 text-sm font-medium text-slate-600">Select a CFA or FRM module, enter a curriculum point, and generate a professional practice set.</p></div>
              </div>
            )}
              </div>

              <aside className="space-y-4 2xl:sticky 2xl:top-0 2xl:self-start">
                <section className="overflow-hidden rounded-lg border border-slate-900 bg-slate-950 text-white shadow-xl">
                  <div className="border-b border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,.16),rgba(251,191,36,.08))] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase text-cyan-200">Exam Readiness</p>
                        <h3 className="mt-1 text-xl font-black">{intelligence.readinessLabel}</h3>
                      </div>
                      <div className={`text-4xl font-black ${qualityTone(intelligence.readiness)}`}>{intelligence.readiness}%</div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded bg-white/10">
                      <div className="h-full rounded bg-[linear-gradient(90deg,#22d3ee,#34d399,#fbbf24)]" style={{ width: `${Math.max(6, intelligence.readiness)}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        ["Questions", intelligence.totalQuestions],
                        ["Accuracy", `${intelligence.accuracy}%`],
                        ["Sets", completedPractices.length],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2">
                          <div className="text-[9px] font-black uppercase text-slate-500">{label}</div>
                          <div className="mt-1 text-sm font-black">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-xs font-black uppercase text-slate-300"><Network className="h-4 w-4 text-cyan-300" /> Skill Radar</h4>
                      <span className="text-[10px] font-black text-slate-500">{intelligence.coverage}% coverage</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {stats.map((item) => (
                        <div key={item.key}>
                          <div className="mb-1 flex items-center justify-between text-[11px] font-black">
                            <span className="text-slate-300">{item.name}</span>
                            <span className={item.attempted ? qualityTone(item.accuracy) : "text-slate-600"}>{item.attempted ? `${item.accuracy}%` : "No data"}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-white/10">
                            <div className="h-full rounded bg-cyan-300" style={{ width: `${item.attempted ? item.accuracy : 4}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-black"><AlertTriangle className="h-4 w-4 text-amber-600" /> Weakness Queue</h3>
                    <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{intelligence.topGaps.length} gaps</span>
                  </div>
                  {intelligence.topGaps.length ? (
                    <div className="space-y-2">
                      {intelligence.topGaps.map((gap) => (
                        <div key={`${gap.dimension}-${gap.point}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black">{gap.point}</p>
                              <p className="mt-1 text-[10px] font-black uppercase text-slate-500">{dimensionName(gap.dimension)} · {gap.misses} miss{gap.misses > 1 ? "es" : ""}</p>
                            </div>
                            <button onClick={() => startTargetedDrill(gap.point, gap.dimension)} className="shrink-0 rounded-md bg-slate-950 px-2.5 py-1.5 text-[10px] font-black text-white">
                              Drill
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                      <Calculator className="mx-auto h-6 w-6 text-slate-500" />
                      <p className="mt-2 text-xs font-bold text-slate-500">Submit a practice set to activate weakness diagnosis.</p>
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-emerald-900">
                    <TrendingUp className="h-4 w-4" />
                    Adaptive Path
                  </div>
                  <div className="mt-3 space-y-2 text-xs font-bold text-emerald-900">
                    <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                      <span>Current focus</span>
                      <span>{intelligence.weakDimension?.name || dimensionName(dimension)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                      <span>Next target</span>
                      <span>{intelligence.topGaps[0]?.point ? "Weak point drill" : "Baseline set"}</span>
                    </div>
                  </div>
                  <button onClick={() => startTargetedDrill(intelligence.topGaps[0]?.point || conceptInput, intelligence.weakDimension?.key || dimension)} disabled={loading} className="mt-3 w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-black text-white disabled:bg-slate-400">
                    Generate Precision Practice
                  </button>
                </section>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
