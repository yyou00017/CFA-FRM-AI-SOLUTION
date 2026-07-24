import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Download,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
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
import { ProgrammePage } from "./ProgrammePage";

type QuestionSource = "api" | "backup" | "static";
type WorkspaceView = "practice" | "record" | "history";

const STORAGE_KEY = "kensworth_saved_practices";
const LEGACY_STORAGE_KEY = "examlogic_saved_practices";

const DIMENSIONS = [
  ["Concept_Mastery", "Concepts", "Definitions, assumptions and curriculum rules"],
  ["Calculation", "Calculations", "Formula selection and numerical work"],
  ["Sensitivity_Analysis", "Sensitivity", "Risk-factor and market transmission"],
  ["Case_Study", "Cases", "Multi-variable professional scenarios"],
  ["Risk_Management", "Risk practice", "Capital, controls, hedging and compliance"],
  ["Reverse_Engineering", "Reverse problems", "Working back from target metrics"],
] as const;

const PRACTICE_FORMATS = [
  ["Logic-Based Item Set (Modified Data)", "Exam-style item set"],
  ["Calculative Focus (Formula Logic)", "Calculation practice"],
  ["Conceptual Drill Questions", "Concept review"],
] as const;

function levelLabel(level: string) {
  return level.replace("_", " ");
}

function sourceLabel(source: QuestionSource) {
  if (source === "api") return "Kensworth question bank";
  if (source === "backup") return "Reserve question bank";
  return "Model paper";
}

function score(set: PracticeSet | null, answers: Record<string, number>) {
  if (!set?.questions.length) return { correct: 0, total: 0, percent: 0 };
  const correct = set.questions.filter((question) => answers[question.id] === question.correctOptionIndex).length;
  return {
    correct,
    total: set.questions.length,
    percent: Math.round((correct / set.questions.length) * 100),
  };
}

function dimensionLabel(key?: string) {
  return DIMENSIONS.find(([dimensionKey]) => dimensionKey === key)?.[1] || "Core curriculum";
}

function programmeFromPath(pathname: string) {
  if (pathname === "/cfa" || pathname.startsWith("/cfa/")) return ExamType.CFA;
  if (pathname === "/frm" || pathname.startsWith("/frm/")) return ExamType.FRM;
  return null;
}

function topicBucket(text = "", programme = ExamType.CFA) {
  const lower = text.toLowerCase();
  if (lower.includes("ethic") || lower.includes("professional standard")) return "Ethics & Professional Standards";
  if (lower.includes("quantitative") || lower.includes("regression") || lower.includes("probability") || lower.includes("time series")) {
    return programme === ExamType.CFA ? "Quantitative Methods" : "Quantitative Analysis";
  }
  if (lower.includes("operational") || lower.includes("resilience")) return "Operational Risk";
  if (lower.includes("liquidity") || lower.includes("treasury") || lower.includes("funding risk")) return "Liquidity and Treasury Risk";
  if (lower.includes("capm") || lower.includes("beta") || lower.includes("sml")) return "Portfolio Management";
  if (lower.includes("dcf") || lower.includes("fcff") || lower.includes("fcfe") || lower.includes("cash flow")) return "Equity Valuation";
  if (lower.includes("derivative") || lower.includes("option") || lower.includes("swap") || lower.includes("future")) {
    return programme === ExamType.FRM ? "Financial Markets and Products" : "Derivatives";
  }
  if (lower.includes("fixed income") || lower.includes("bond") || lower.includes("duration") || lower.includes("convexity")) return "Fixed Income";
  if (lower.includes("var") || lower.includes("value at risk") || lower.includes("expected shortfall")) return "Market Risk";
  if (lower.includes("dupont") || lower.includes("roe") || lower.includes("financial statement")) return "Financial Statement Analysis";
  if (lower.includes("cds") || lower.includes("credit")) return "Credit Risk";
  return text.split(/[(:,-]/)[0]?.trim().slice(0, 34) || (programme === ExamType.FRM ? "Foundations of Risk Management" : "Portfolio Management");
}

function standing(accuracy: number, attempted: number) {
  if (!attempted) return "Not assessed";
  if (accuracy < 55) return "Review required";
  if (accuracy < 75) return "Developing";
  return "Secure";
}

function planLabel(plan?: string) {
  if (!plan) return "Foundation";
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
}

export default function App() {
  const initialProgramme = programmeFromPath(window.location.pathname);
  const [publicProgramme, setPublicProgramme] = useState<ExamType | null>(initialProgramme);
  const [examType, setExamType] = useState<ExamType>(initialProgramme || ExamType.CFA);
  const [cfaLevel, setCfaLevel] = useState<CFALevel>("Level_1");
  const [frmPart, setFrmPart] = useState<FRMPart>("Part_1");
  const [conceptInput, setConceptInput] = useState(
    initialProgramme === ExamType.FRM
      ? "Scaling Value at Risk across time horizons and confidence levels"
      : "CAPM required rate of return with inflation adjustment",
  );
  const [mode, setMode] = useState("Logic-Based Item Set (Modified Data)");
  const [count, setCount] = useState(3);
  const [dimension, setDimension] = useState("");
  const [activeSet, setActiveSet] = useState<PracticeSet | null>(null);
  const [source, setSource] = useState<QuestionSource>("static");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [graded, setGraded] = useState(false);
  const [saved, setSaved] = useState<SavedPractice[]>([]);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("practice");
  const [historySearch, setHistorySearch] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [guestMode, setGuestMode] = useState(false);

  const activeLevel = examType === ExamType.CFA ? cfaLevel : frmPart;
  const result = score(activeSet, answers);
  const answered = activeSet?.questions.filter((question) => answers[question.id] !== undefined).length || 0;
  const programmeSaved = useMemo(() => saved.filter((item) => item.practiceSet.examType === examType), [saved, examType]);
  const completed = useMemo(() => programmeSaved.filter((item) => item.isCompleted), [programmeSaved]);

  useEffect(() => {
    const initialKey = examType === ExamType.FRM
      ? "FRM_Part_1_Value at Risk (VaR) Scaling"
      : "CFA_Level_1_CAPM (Capital Asset Pricing Model)";
    const initial = STATIC_SAMPLE_PRACTICES[initialKey];
    if (initial) setActiveSet(initial);
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      const raw = current || legacy;
      if (raw) {
        const parsed = JSON.parse(raw);
        setSaved(parsed);
        if (!current) localStorage.setItem(STORAGE_KEY, raw);
      }
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => {
    const storedSession = loadSession();
    if (!storedSession) {
      fetchProfile(null).then(setProfile).catch(() => undefined);
      return;
    }
    setSession(storedSession);
    fetchProfile(storedSession)
      .then(setProfile)
      .catch(() => {
        saveSession(null);
        setSession(null);
      });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [guestMode, session]);

  useEffect(() => {
    const title = publicProgramme === ExamType.CFA
      ? "CFA Preparation | Kensworth Institute of Finance"
      : publicProgramme === ExamType.FRM
        ? "FRM Preparation | Kensworth Institute of Finance"
        : "Kensworth Institute of Finance | CFA & FRM Preparation";
    const description = publicProgramme === ExamType.CFA
      ? "A dedicated CFA preparation programme for Levels I, II and III."
      : publicProgramme === ExamType.FRM
        ? "A dedicated FRM preparation programme for Parts I and II."
        : "Independent CFA and FRM examination preparation built around disciplined practice and review.";
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [publicProgramme]);

  const refreshProfile = async (nextSession = session) => {
    try {
      setProfile(await fetchProfile(nextSession));
    } catch {
      // Practice remains available if the account summary is temporarily unavailable.
    }
  };

  const persist = (items: SavedPractice[]) => {
    setSaved(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const resetAssignment = () => {
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
      resetAssignment();
    }
  };

  useEffect(() => {
    const syncProgrammeFromLocation = () => {
      const nextProgramme = programmeFromPath(window.location.pathname);
      setPublicProgramme(nextProgramme);
      if (nextProgramme) {
        setExamType(nextProgramme);
        loadSampleFor(nextProgramme, nextProgramme === ExamType.CFA ? "Level_1" : "Part_1");
      }
    };
    window.addEventListener("popstate", syncProgrammeFromLocation);
    return () => window.removeEventListener("popstate", syncProgrammeFromLocation);
  }, []);

  const enterProgramme = (programme: ExamType) => {
    setExamType(programme);
    loadSampleFor(programme, programme === ExamType.CFA ? cfaLevel : frmPart);
    setWorkspaceView("practice");
    setGuestMode(true);
  };

  const submitAuth = async () => {
    setAuthError("");
    if (!hasClientAuthConfig()) {
      setAuthError("Candidate accounts are not yet enabled in this environment. You may use preview access instead.");
      return;
    }
    if (!authEmail || authPassword.length < 6) {
      setAuthError("Enter an email address and a password of at least six characters.");
      return;
    }
    setAuthLoading(true);
    try {
      const nextSession = authMode === "signup" ? await signUp(authEmail, authPassword) : await signIn(authEmail, authPassword);
      saveSession(nextSession);
      setSession(nextSession);
      setGuestMode(false);
      await refreshProfile(nextSession);
      setAuthPassword("");
    } catch (authFailure: any) {
      setAuthError(authFailure?.message || "We could not open your candidate account.");
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    saveSession(null);
    setSession(null);
    setGuestMode(false);
    setProfile(null);
    setAuthPassword("");
    fetchProfile(null).then(setProfile).catch(() => undefined);
  };

  const generate = async (overrideConcept?: string, overrideDimension?: string, overrideCount?: number) => {
    const concept = (overrideConcept || conceptInput).trim();
    const targetDimension = overrideDimension ?? dimension;
    if (!concept) {
      setError("Enter a curriculum topic before preparing a practice set.");
      return;
    }
    setLoading(true);
    resetAssignment();
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
      if (!response.ok) throw new Error(data.error || "The question bank could not prepare this set.");
      if (!Array.isArray(data.questions)) throw new Error("The question bank returned an incomplete set.");
      const set: PracticeSet = {
        id: `prepared_${Date.now()}`,
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
      setWorkspaceView("practice");
      refreshProfile();
    } catch (requestError: any) {
      setError(requestError?.message || "The practice set could not be prepared. Please try again.");
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
    if (missing && !confirm(`You have ${missing} unanswered question${missing > 1 ? "s" : ""}. Submit this assignment?`)) return;
    setGraded(true);
    setTimeout(() => saveCurrent(true), 0);
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
      resetAssignment();
      setWorkspaceView("practice");
    } else {
      generate(sample.concept);
    }
  };

  const exportSet = () => {
    if (!activeSet) return;
    const lines = [
      "Kensworth Institute of Finance",
      `${activeSet.examType} ${activeSet.subLevel} practice set`,
      `Topic: ${activeSet.conceptInput}`,
      "",
    ];
    activeSet.questions.forEach((question, index) => {
      lines.push(`Question ${index + 1}. ${question.text}`);
      question.options.forEach((option, optionIndex) => lines.push(`${String.fromCharCode(65 + optionIndex)}. ${option}`));
      if (graded) {
        lines.push(
          `Correct response: ${String.fromCharCode(65 + question.correctOptionIndex)}`,
          question.stepByStepSolution,
          question.knowledgeAnalysis,
          question.examLogicInsight,
        );
      }
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Kensworth_${activeSet.examType}_${activeSet.subLevel}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dimensionStats = useMemo(() => {
    return DIMENSIONS.map(([key, name, description]) => {
      let attempted = 0;
      let correct = 0;
      completed.forEach((practice) => {
        practice.practiceSet.questions.forEach((question) => {
          if ((question.dimension || "Concept_Mastery") !== key || practice.userAnswers?.[question.id] === undefined) return;
          attempted += 1;
          if (practice.userAnswers[question.id] === question.correctOptionIndex) correct += 1;
        });
      });
      return { key, name, description, attempted, accuracy: attempted ? Math.round((correct / attempted) * 100) : 0 };
    });
  }, [completed]);

  const record = useMemo(() => {
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
        } else {
          const point = question.pointsTested || practice.practiceSet.conceptInput;
          const key = `${question.dimension || "Concept_Mastery"}:${point}`;
          const current = gaps.get(key);
          gaps.set(key, {
            point,
            dimension: question.dimension || "Concept_Mastery",
            misses: (current?.misses || 0) + 1,
          });
        }
      });
    });
    const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const coverage = Math.min(100, Math.round((totalQuestions / 120) * 100));
    const topGaps = Array.from(gaps.values()).sort((a, b) => b.misses - a.misses).slice(0, 5);
    const weakestDimension = dimensionStats.filter((item) => item.attempted > 0).sort((a, b) => a.accuracy - b.accuracy)[0];
    return { totalQuestions, totalCorrect, accuracy, coverage, topGaps, weakestDimension };
  }, [completed, dimensionStats]);

  const subjectRecord = useMemo(() => {
    const subjectMap = new Map<string, { name: string; attempted: number; correct: number }>();
    const programmeSubjects = examType === ExamType.CFA
      ? ["Ethics & Professional Standards", "Quantitative Methods", "Financial Statement Analysis", "Equity Valuation", "Fixed Income", "Derivatives", "Portfolio Management"]
      : ["Foundations of Risk Management", "Quantitative Analysis", "Financial Markets and Products", "Valuation and Risk Models", "Market Risk", "Credit Risk", "Operational Risk", "Liquidity and Treasury Risk"];
    programmeSubjects.forEach((name) => {
      subjectMap.set(name, { name, attempted: 0, correct: 0 });
    });
    completed.forEach((practice) => {
      practice.practiceSet.questions.forEach((question) => {
        if (practice.userAnswers?.[question.id] === undefined) return;
        const name = topicBucket(`${question.pointsTested} ${practice.practiceSet.conceptInput}`, examType);
        const item = subjectMap.get(name) || { name, attempted: 0, correct: 0 };
        item.attempted += 1;
        if (practice.userAnswers[question.id] === question.correctOptionIndex) item.correct += 1;
        subjectMap.set(name, item);
      });
    });
    return Array.from(subjectMap.values())
      .map((item) => {
        const accuracy = item.attempted ? Math.round((item.correct / item.attempted) * 100) : 0;
        return { ...item, accuracy, standing: standing(accuracy, item.attempted) };
      })
      .sort((a, b) => (a.attempted && !b.attempted ? -1 : !a.attempted && b.attempted ? 1 : a.accuracy - b.accuracy));
  }, [completed, examType]);

  const recommendation = useMemo(() => {
    const weakSubject = subjectRecord.find((subject) => subject.attempted > 0 && subject.accuracy < 75);
    const unassessed = subjectRecord.find((subject) => subject.attempted === 0);
    const gap = record.topGaps[0];
    const subject = gap
      ? topicBucket(gap.point, examType)
      : weakSubject?.name || unassessed?.name || (examType === ExamType.CFA ? "Portfolio Management" : "Foundations of Risk Management");
    const concept = gap?.point || `${subject} core examination principles`;
    const focusDimension = gap?.dimension || record.weakestDimension?.key || "Concept_Mastery";
    return {
      subject,
      concept,
      focusDimension,
      note: gap
        ? `Return to ${gap.point}. This point has appeared more than once in your incorrect responses.`
        : weakSubject
          ? `Complete a short review set in ${weakSubject.name} before moving to a mixed paper.`
          : record.totalQuestions
            ? "Your next useful step is to broaden curriculum coverage with a new subject area."
            : "Begin with a short model paper to establish your first learning record.",
    };
  }, [record, subjectRecord, examType]);

  const beginRecommendation = () => {
    setConceptInput(recommendation.concept);
    setDimension(recommendation.focusDimension);
    setMode("Conceptual Drill Questions");
    setCount(3);
    generate(recommendation.concept, recommendation.focusDimension, 3);
  };

  const filteredHistory = programmeSaved.filter((entry) => {
    const query = historySearch.toLowerCase();
    return !query || `${entry.practiceSet.examType} ${entry.practiceSet.subLevel} ${entry.practiceSet.conceptInput}`.toLowerCase().includes(query);
  });

  const launchTopics = SAMPLE_TOPICS.filter((topic) => topic.examType === examType && topic.level === activeLevel);
  const canEnterWorkspace = Boolean(session) || guestMode;
  const candidateAccessPanel = (programme?: ExamType) => (
    <div className="access-form-card">
      <div className="access-tabs" role="tablist" aria-label="Candidate account">
        <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
          <UserPlus aria-hidden="true" /> New candidate
        </button>
        <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>
          <LogIn aria-hidden="true" /> Sign in
        </button>
      </div>
      <div className="access-form-heading">
        <p className="folio">{programme ? `${programme} candidate portal` : "Candidate portal"}</p>
        <h3>{authMode === "signup" ? "Create your study record" : "Continue your programme"}</h3>
      </div>
      <label className="field-label">
        <span>Email address</span>
        <div className="field-with-icon"><Mail aria-hidden="true" /><input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="name@domain.com" type="email" /></div>
      </label>
      <label className="field-label">
        <span>Password</span>
        <div className="field-with-icon"><KeyRound aria-hidden="true" /><input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Minimum 6 characters" type="password" /></div>
      </label>
      {authError && <div className="form-message error"><CircleAlert aria-hidden="true" />{authError}</div>}
      <button className="button button-primary button-full" onClick={submitAuth} disabled={authLoading}>
        {authLoading ? <Loader2 className="spin" aria-hidden="true" /> : null}
        {authMode === "signup" ? "Create candidate account" : "Open candidate portal"}
      </button>
      <button className="button button-secondary button-full" onClick={() => enterProgramme(programme || examType)}>
        Use {programme ? `${programme} ` : ""}programme preview
      </button>
      {!hasClientAuthConfig() && <p className="form-footnote">Account registration is currently in preview. Programme access remains available.</p>}
    </div>
  );

  if (!canEnterWorkspace) {
    if (publicProgramme) {
      return (
        <ProgrammePage
          programme={publicProgramme}
          onPreview={() => enterProgramme(publicProgramme)}
          accessPanel={candidateAccessPanel(publicProgramme)}
        />
      );
    }

    return (
      <div className="institution-shell">
        <div className="utility-bar">
          <div className="page-width utility-inner">
            <span>Professional examination preparation</span>
            <span className="utility-separator">Independent · Online · Candidate-led</span>
          </div>
        </div>

        <header className="public-header page-width">
          <a className="wordmark" href="#top" aria-label="Kensworth Institute of Finance home">
            <span className="wordmark-name">KENSWORTH</span>
            <span className="wordmark-subtitle">Institute of Finance</span>
          </a>
          <nav className="public-nav" aria-label="Main navigation">
            <a href="/cfa">CFA Programme</a>
            <a href="/frm">FRM Programme</a>
            <a href="#method">Our Method</a>
            <a href="#candidate-access">Candidate Access</a>
          </nav>
        </header>

        <main id="top">
          <section className="hero-section">
            <div className="page-width hero-grid">
              <div className="hero-copy">
                <p className="eyebrow">2026 examination preparation</p>
                <h1>Serious preparation for demanding finance examinations.</h1>
                <p className="hero-intro">
                  Structured CFA and FRM practice built around curriculum coverage, careful reasoning and disciplined review—not shortcuts.
                </p>
                <div className="hero-actions">
                  <a className="button button-primary" href="#programmes">
                    Choose your programme <ArrowRight aria-hidden="true" />
                  </a>
                  <a className="text-link" href="#candidate-access">Create a candidate account</a>
                </div>
                <div className="academic-note">
                  <span className="academic-rule" />
                  <p>Independent preparation for professional finance candidates. Progress is measured through completed work, not time spent online.</p>
                </div>
              </div>

              <aside className="programme-card" id="programmes">
                <p className="folio">Programme directory · 2026</p>
                <h2>Professional Qualifications</h2>
                <div className="programme-list">
                  <a href="/cfa">
                    <span><strong>CFA Programme</strong><small>Levels I, II and III</small></span>
                    <ChevronRight aria-hidden="true" />
                  </a>
                  <a href="/frm">
                    <span><strong>FRM Programme</strong><small>Parts I and II</small></span>
                    <ChevronRight aria-hidden="true" />
                  </a>
                </div>
                <dl className="programme-facts">
                  <div><dt>Study format</dt><dd>Question-led review</dd></div>
                  <div><dt>Assessment</dt><dd>Immediate rationale</dd></div>
                  <div><dt>Record</dt><dd>Subject-by-subject</dd></div>
                </dl>
                <p className="programme-footnote">Programme preview includes model assignments and an on-device learning record.</p>
              </aside>
            </div>
          </section>

          <section className="method-section" id="method">
            <div className="page-width">
              <div className="section-heading">
                <p className="eyebrow">The Kensworth method</p>
                <h2>A measured route from curriculum knowledge to exam judgment.</h2>
              </div>
              <div className="method-grid">
                {[
                  ["01", "Establish", "Begin with a focused assignment in the subject you intend to study."],
                  ["02", "Review", "Read the full rationale and identify where your reasoning diverged."],
                  ["03", "Consolidate", "Return to weak principles with shorter, deliberate practice."],
                  ["04", "Integrate", "Progress to mixed questions only when the underlying subject is secure."],
                ].map(([number, title, text]) => (
                  <article key={number} className="method-item">
                    <span>{number}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="access-section" id="candidate-access">
            <div className="page-width access-grid">
              <div className="access-copy">
                <p className="eyebrow">Candidate access</p>
                <h2>Your work should form a record, not disappear into a feed.</h2>
                <p>Open an account to retain completed assignments, subject standing and recommended next work across study sessions.</p>
                <ul>
                  <li><Check aria-hidden="true" /> Saved question sets and responses</li>
                  <li><Check aria-hidden="true" /> Topic and assessment-method record</li>
                  <li><Check aria-hidden="true" /> A clear next-study recommendation</li>
                </ul>
              </div>

              {candidateAccessPanel()}
            </div>
          </section>
        </main>

        <footer className="public-footer">
          <div className="page-width footer-grid">
            <div className="wordmark footer-wordmark">
              <span className="wordmark-name">KENSWORTH</span>
              <span className="wordmark-subtitle">Institute of Finance</span>
            </div>
            <p>Kensworth Institute of Finance is an independent examination-preparation provider and is not affiliated with CFA Institute or GARP.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <div className="utility-bar">
        <div className="page-width utility-inner">
          <span>{examType} Candidate Portal · 2026 Programme</span>
          <span className="utility-separator">{session ? `${planLabel(profile?.plan)} plan` : "Programme preview"}</span>
        </div>
      </div>

      <header className="portal-header">
        <div className="page-width portal-header-inner">
          <button className="wordmark wordmark-button" onClick={() => setWorkspaceView("practice")} aria-label="Return to practice desk">
            <span className="wordmark-name">KENSWORTH</span>
            <span className="wordmark-subtitle">Institute of Finance</span>
          </button>
          <nav className="portal-nav" aria-label="Candidate portal sections">
            <button className={workspaceView === "practice" ? "active" : ""} onClick={() => setWorkspaceView("practice")}>Practice desk</button>
            <button className={workspaceView === "record" ? "active" : ""} onClick={() => setWorkspaceView("record")}>Learning record</button>
            <button className={workspaceView === "history" ? "active" : ""} onClick={() => setWorkspaceView("history")}>Saved work</button>
          </nav>
          <div className="candidate-menu">
            <span>{session ? profile?.email || session.email : "Preview candidate"}</span>
            <button onClick={session ? signOut : () => setGuestMode(false)}>
              <LogOut aria-hidden="true" /> {session ? "Sign out" : "Leave preview"}
            </button>
          </div>
        </div>
      </header>

      {workspaceView === "practice" && (
        <main className="page-width portal-layout">
          <aside className="practice-desk">
            <div className="panel-heading">
              <p className="folio">{examType} practice desk</p>
              <h1>Prepare an assignment</h1>
              <p>Choose a {examType === ExamType.CFA ? "level" : "part"}, curriculum point and assessment format.</p>
            </div>

            <section className="programme-lock" aria-label="Current programme">
              <span>Current programme</span>
              <strong>{examType} Programme</strong>
              <small>{examType === ExamType.CFA ? "Investment analysis and portfolio management" : "Financial risk measurement and management"}</small>
            </section>

            <fieldset className="level-fieldset">
              <legend>Programme stage</legend>
              <div>
                {examType === ExamType.CFA
                  ? (["Level_1", "Level_2", "Level_3"] as CFALevel[]).map((level) => (
                      <button key={level} className={cfaLevel === level ? "active" : ""} onClick={() => { setCfaLevel(level); loadSampleFor(ExamType.CFA, level); }}>{levelLabel(level)}</button>
                    ))
                  : (["Part_1", "Part_2"] as FRMPart[]).map((part) => (
                      <button key={part} className={frmPart === part ? "active" : ""} onClick={() => { setFrmPart(part); loadSampleFor(ExamType.FRM, part); }}>{levelLabel(part)}</button>
                    ))}
              </div>
            </fieldset>

            <label className="field-label">
              <span>Curriculum point</span>
              <textarea value={conceptInput} onChange={(event) => setConceptInput(event.target.value)} rows={5} />
            </label>

            <label className="field-label">
              <span>Assessment format</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                {PRACTICE_FORMATS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <div className="two-field-grid">
              <label className="field-label">
                <span>Questions</span>
                <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                </select>
              </label>
              <label className="field-label">
                <span>Primary focus</span>
                <select value={dimension} onChange={(event) => setDimension(event.target.value)}>
                  <option value="">Balanced</option>
                  {DIMENSIONS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </select>
              </label>
            </div>

            <button className="button button-primary button-full" onClick={() => generate()} disabled={loading}>
              {loading ? <Loader2 className="spin" aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
              Prepare practice set
            </button>

            <section className="curriculum-list">
              <div className="curriculum-heading">
                <span>Curriculum references</span>
                <small>{launchTopics.length} available</small>
              </div>
              {launchTopics.length ? launchTopics.map((sample, index) => (
                <button key={`${sample.label}-${index}`} onClick={() => selectSample(sample)}>
                  <span>{sample.label}</span><ChevronRight aria-hidden="true" />
                </button>
              )) : <p>No model paper is available for this stage yet. Enter a curriculum point above.</p>}
            </section>
          </aside>

          <section className="assignment-panel">
            <header className="assignment-header">
              <div>
                <div className="assignment-meta">
                  <span>{activeSet ? `${activeSet.examType} ${levelLabel(activeSet.subLevel)}` : `${examType} ${levelLabel(activeLevel)}`}</span>
                  <span>{sourceLabel(source)}</span>
                  {activeSet?.targetDimension && <span>{dimensionLabel(activeSet.targetDimension)}</span>}
                </div>
                <p className="folio">Current assignment</p>
                <h2>{activeSet?.conceptInput || "Select a curriculum point to begin"}</h2>
                {activeSet && <p className="assignment-date">Prepared {activeSet.generatedAt}</p>}
              </div>
              {activeSet && (
                <div className="assignment-tools">
                  <button onClick={exportSet}><Download aria-hidden="true" /> Export</button>
                  <button onClick={() => saveCurrent()}><Bookmark aria-hidden="true" /> Save</button>
                </div>
              )}
            </header>

            <div className="assignment-summary">
              <div><span>Questions</span><strong>{activeSet?.questions.length || 0}</strong></div>
              <div><span>Answered</span><strong>{answered}</strong></div>
              <div><span>Result</span><strong>{graded ? `${result.percent}%` : "—"}</strong></div>
            </div>

            <div className="assignment-body">
              {error && <div className="form-message error"><CircleAlert aria-hidden="true" />{error}</div>}
              {loading ? (
                <div className="paper-loading" aria-label="Preparing practice set">
                  <Loader2 className="spin" aria-hidden="true" />
                  <strong>Preparing your assignment</strong>
                  <span>Reviewing the selected curriculum point and assessment format.</span>
                </div>
              ) : activeSet ? (
                <>
                  {graded && (
                    <section className="result-notice">
                      <div><p className="folio">Assignment result</p><h3>{result.correct} of {result.total} correct</h3></div>
                      <strong>{result.percent}%</strong>
                    </section>
                  )}

                  <div className="question-stack">
                    {activeSet.questions.map((question, questionIndex) => {
                      const selected = answers[question.id];
                      const isCorrect = selected === question.correctOptionIndex;
                      return (
                        <article className="question-paper" key={question.id}>
                          <div className="question-heading">
                            <span>Question {questionIndex + 1}</span>
                            <div>
                              <small>{dimensionLabel(question.dimension)}</small>
                              <small>{question.difficulty}</small>
                              {graded && <small className={isCorrect ? "correct" : "review"}>{isCorrect ? "Correct" : "Review"}</small>}
                            </div>
                          </div>
                          <p className="question-text">{question.text}</p>
                          <div className="option-list">
                            {question.options.map((option, optionIndex) => {
                              const picked = selected === optionIndex;
                              const correct = question.correctOptionIndex === optionIndex;
                              const optionState = !graded && picked ? "selected" : graded && correct ? "correct" : graded && picked && !correct ? "incorrect" : "";
                              return (
                                <button
                                  key={optionIndex}
                                  className={optionState}
                                  disabled={graded}
                                  onClick={() => setAnswers({ ...answers, [question.id]: optionIndex })}
                                >
                                  <span>{String.fromCharCode(65 + optionIndex)}</span>
                                  <p>{option}</p>
                                </button>
                              );
                            })}
                          </div>

                          {graded && (
                            <div className="review-notes">
                              <section>
                                <h4>Worked rationale</h4>
                                <p>{question.stepByStepSolution}</p>
                              </section>
                              <div className="review-note-grid">
                                <section><h4>Curriculum note</h4><p>{question.knowledgeAnalysis}</p></section>
                                <section><h4>Exam convention</h4><p>{question.examLogicInsight}</p></section>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  <div className="assignment-actions">
                    <span>{answered} of {activeSet.questions.length} questions answered</span>
                    <div>
                      {graded && <button className="button button-secondary" onClick={() => { setAnswers({}); setGraded(false); }}><RefreshCw aria-hidden="true" /> Try again</button>}
                      {!graded && <button className="button button-primary" onClick={grade}><ClipboardCheck aria-hidden="true" /> Submit assignment</button>}
                    </div>
                  </div>

                  <section className="adviser-note">
                    <p className="folio">Recommended next work</p>
                    <div>
                      <div><h3>{recommendation.subject}</h3><p>{recommendation.note}</p></div>
                      <button className="text-link" onClick={beginRecommendation}>Begin recommended review <ArrowRight aria-hidden="true" /></button>
                    </div>
                  </section>
                </>
              ) : (
                <div className="empty-assignment">
                  <BookOpen aria-hidden="true" />
                  <h3>Your practice desk is ready.</h3>
                  <p>Choose a programme and curriculum point, then prepare an assignment.</p>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {workspaceView === "record" && (
        <main className="page-width record-page">
          <header className="record-header">
            <p className="eyebrow">Candidate learning record</p>
            <h1>Completed work, organised for review.</h1>
            <p>This record is based only on submitted assignments. Unfinished sets do not affect standing.</p>
          </header>

          <section className="record-summary">
            <div><span>Questions assessed</span><strong>{record.totalQuestions}</strong><small>{completed.length} completed set{completed.length === 1 ? "" : "s"}</small></div>
            <div><span>Correct responses</span><strong>{record.totalCorrect}</strong><small>{record.accuracy}% overall accuracy</small></div>
            <div><span>Curriculum coverage</span><strong>{record.coverage}%</strong><small>Measured against a 120-question foundation</small></div>
          </section>

          <div className="record-grid">
            <section className="record-card subject-table-card">
              <div className="record-card-heading"><div><p className="folio">Subject record</p><h2>Curriculum standing</h2></div><span>{subjectRecord.filter((item) => item.attempted).length} assessed</span></div>
              <div className="subject-table" role="table" aria-label="Subject record">
                <div className="subject-row subject-row-head" role="row"><span>Subject</span><span>Standing</span><span>Questions</span><span>Accuracy</span></div>
                {subjectRecord.map((item) => (
                  <div className="subject-row" role="row" key={item.name}>
                    <strong>{item.name}</strong>
                    <span className={`standing ${item.standing.toLowerCase().replaceAll(" ", "-")}`}>{item.standing}</span>
                    <span>{item.attempted}</span>
                    <div className="accuracy-cell"><span>{item.attempted ? `${item.accuracy}%` : "—"}</span><i><b style={{ width: `${item.attempted ? item.accuracy : 0}%` }} /></i></div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="record-card adviser-card">
              <p className="folio">Adviser’s note</p>
              <h2>{recommendation.subject}</h2>
              <p>{recommendation.note}</p>
              <dl>
                <div><dt>Suggested focus</dt><dd>{dimensionLabel(recommendation.focusDimension)}</dd></div>
                <div><dt>Suggested length</dt><dd>3 questions</dd></div>
                <div><dt>Study format</dt><dd>Focused review</dd></div>
              </dl>
              <button className="button button-primary button-full" onClick={beginRecommendation}>Begin recommended work <ArrowRight aria-hidden="true" /></button>
            </aside>
          </div>

          <section className="record-card method-record-card">
            <div className="record-card-heading"><div><p className="folio">Assessment methods</p><h2>How your understanding has been tested</h2></div></div>
            <div className="method-record-grid">
              {dimensionStats.map((item) => (
                <article key={item.key}>
                  <div><h3>{item.name}</h3><strong>{item.attempted ? `${item.accuracy}%` : "—"}</strong></div>
                  <p>{item.description}</p>
                  <small>{item.attempted} question{item.attempted === 1 ? "" : "s"} assessed</small>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}

      {workspaceView === "history" && (
        <main className="page-width history-page">
          <header className="record-header history-header">
            <p className="eyebrow">Saved work</p>
            <h1>Your assignment archive.</h1>
            <p>Reopen a submitted paper, continue an unfinished set or remove work you no longer need.</p>
          </header>
          <div className="history-search">
            <Search aria-hidden="true" />
            <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search by programme or curriculum point" aria-label="Search saved work" />
          </div>
          <section className="history-list">
            {filteredHistory.length ? filteredHistory.map((entry) => (
              <article key={entry.id}>
                <button className="history-main" onClick={() => { setActiveSet(entry.practiceSet); setAnswers(entry.userAnswers || {}); setGraded(entry.isCompleted); setSource("api"); setWorkspaceView("practice"); }}>
                  <div className="history-programme"><span>{entry.practiceSet.examType}</span><small>{levelLabel(entry.practiceSet.subLevel)}</small></div>
                  <div className="history-title"><h2>{entry.practiceSet.conceptInput}</h2><p>Saved {entry.savedAt}</p></div>
                  <div className="history-result"><span>{entry.isCompleted ? "Completed" : "In progress"}</span><strong>{entry.isCompleted ? `${entry.score}%` : "—"}</strong></div>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button className="history-delete" onClick={() => persist(saved.filter((item) => item.id !== entry.id))} aria-label={`Remove ${entry.practiceSet.conceptInput}`}><Trash2 aria-hidden="true" /></button>
              </article>
            )) : (
              <div className="empty-history"><BookOpen aria-hidden="true" /><h2>No saved work found</h2><p>Prepared assignments will appear here.</p></div>
            )}
          </section>
        </main>
      )}

      <footer className="portal-footer">
        <div className="page-width">
          <span>Kensworth Institute of Finance</span>
          <p>Independent examination preparation. CFA and FRM are trademarks of their respective owners; no affiliation is implied.</p>
        </div>
      </footer>
    </div>
  );
}
