import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Award, 
  HelpCircle, 
  Send, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Search, 
  FileText, 
  Check, 
  Layers, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  History, 
  ChevronRight, 
  Download, 
  BookMarked, 
  Sparkles,
  Bookmark,
  Calendar,
  Layers3,
  ExternalLink,
  ClipboardCheck,
  RotateCcw,
  Cloud
} from "lucide-react";
import { ExamType, CFALevel, FRMPart, Question, PracticeSet, SavedPractice } from "./types";
import { SAMPLE_TOPICS, STATIC_SAMPLE_PRACTICES } from "./data/samples";

export default function App() {
  // Current Exam configuration
  const [examType, setExamType] = useState<ExamType>(ExamType.CFA);
  const [cfaLevel, setCfaLevel] = useState<CFALevel>("Level_1");
  const [frmPart, setFrmPart] = useState<FRMPart>("Part_1");

  // Input states
  const [conceptInput, setConceptInput] = useState<string>(
    "CAPM required rate of return with inflation adjustment"
  );
  const [generationMode, setGenerationMode] = useState<string>("Logic-Based Item Set (Modified Data)");
  const [questionCount, setQuestionCount] = useState<number>(3);
  const [selectedDimension, setSelectedDimension] = useState<string>("");
  const [bottomTab, setBottomTab] = useState<"history" | "diagnosis">("history");
  
  // App primary states
  const [activeSet, setActiveSet] = useState<PracticeSet | null>(null);
  const [activeSetSource, setActiveSetSource] = useState<"api" | "backup" | "static">("static");
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<{ message: string; isApiKeyMissing?: boolean } | null>(null);
  
  // User interaction with current active set
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qId: string]: number }>({});
  const [graded, setGraded] = useState<boolean>(false);
  const [userNotes, setUserNotes] = useState<{ [qId: string]: string }>({});
  const [isEditingNoteId, setIsEditingNoteId] = useState<string | null>(null);
  const [noteEditTemp, setNoteEditTemp] = useState<string>("");

  // History / Saved practices stored in LocalStorage
  const [savedPractices, setSavedPractices] = useState<SavedPractice[]>([]);
  const [savedTab, setSavedTab] = useState<"generate" | "saved">("generate");
  const [searchHistoryQuery, setSearchHistoryQuery] = useState<string>("");

  // Load baseline on component mount
  useEffect(() => {
    // Attempt to load default sample
    const initialKey = "CFA_Level_1_CAPM (Capital Asset Pricing Model)";
    if (STATIC_SAMPLE_PRACTICES[initialKey]) {
      setActiveSet(STATIC_SAMPLE_PRACTICES[initialKey]);
      setActiveSetSource("static");
    }

    try {
      const stored = localStorage.getItem("examlogic_saved_practices");
      if (stored) {
        setSavedPractices(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history from LocalStorage", e);
    }
  }, []);

  // Sync saved practices to local storage
  const savePracticesToStorage = (updated: SavedPractice[]) => {
    setSavedPractices(updated);
    try {
      localStorage.setItem("examlogic_saved_practices", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to write history to LocalStorage", e);
    }
  };

  // Switch Exam Type
  const handleExamTypeChange = (type: ExamType) => {
    setExamType(type);
    // Find first sample of this type and auto-populate to make UX fluid
    const match = SAMPLE_TOPICS.find(t => t.examType === type);
    if (match) {
      setConceptInput(match.concept);
      const levelKey = `${type}_${match.level}_${match.label}`;
      if (STATIC_SAMPLE_PRACTICES[levelKey]) {
        setActiveSet(STATIC_SAMPLE_PRACTICES[levelKey]);
        setActiveSetSource("static");
        setSelectedAnswers({});
        setGraded(false);
        setApiError(null);
      }
    }
  };

  // Generate implementation call to the backend
  const handleGenerateQuestions = async (overrideConcept?: string) => {
    setLoading(true);
    setApiError(null);
    setSelectedAnswers({});
    setGraded(false);

    const targetLevel = examType === ExamType.CFA ? cfaLevel : frmPart;
    const finalConcept = overrideConcept || conceptInput;

    if (!finalConcept.trim()) {
      setApiError({ message: "Please input specific exam points, concepts, or keywords for targeted question generation." });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType,
          level: targetLevel.replace("_", " "), // e.g. "Level 1" or "Part 1"
          concept: finalConcept,
          count: questionCount,
          dimension: selectedDimension || undefined
        })
      });

      let data: any = {};
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (!response.ok) {
          throw new Error(`Server response failed (HTTP ${response.status}). Please check if the API Key is correctly entered in the Secrets panel, or shorten your keywords and try again. Details: ${responseText.substring(0, 150)}`);
        } else {
          throw new Error("The model response structure could not be parsed.");
        }
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Request encountered an error (Status code ${response.status}).`);
      }

      if (data.questions && Array.isArray(data.questions)) {
        const generatedPracticeSet: PracticeSet = {
          id: "generated_" + Date.now(),
          examType,
          subLevel: targetLevel.replace("_", " "),
          conceptInput: finalConcept,
          generatedAt: new Date().toLocaleString(),
          questions: data.questions
        };

        setActiveSet(generatedPracticeSet);
        setActiveSetSource(data.source === "local-backup" ? "backup" : "api");
        
        // Auto add to saved list to preserve user content
        const newSaved: SavedPractice = {
          id: "saved_" + Date.now(),
          practiceSet: generatedPracticeSet,
          userAnswers: {},
          score: 0,
          isCompleted: false,
          savedAt: new Date().toLocaleString()
        };
        savePracticesToStorage([newSaved, ...savedPractices]);
      } else {
        throw new Error("The data structure returned from the model is incorrect; cannot read questions list.");
      }
    } catch (err: any) {
      console.error(err);
      
      // Look for API Key missing pattern
      const isMissingKey = err.message && (
        err.message.includes("GEMINI_API_KEY") || 
        err.message.includes("api_key") || 
        err.message.includes("API key")
      );

      setApiError({
        message: err.message || "Failed to contact the backend API. Please check your connection or API Key status.",
        isApiKeyMissing: isMissingKey || false
      });
    } finally {
      setLoading(false);
    }
  };

  // Apply predefined sample
  const handleSelectSample = (sample: typeof SAMPLE_TOPICS[0]) => {
    setConceptInput(sample.concept);
    const key = `${sample.examType}_${sample.level}_${sample.label}`;
    const staticData = STATIC_SAMPLE_PRACTICES[key];
    
    if (staticData) {
      setActiveSet(staticData);
      setActiveSetSource("static");
      setSelectedAnswers({});
      setGraded(false);
      setApiError(null);
    } else {
      // If there is no pre-mock set for this specific template, we alert or encourage generation
      handleGenerateQuestions(sample.concept);
    }
  };

  // Save current progress/session to LocalStorage list
  const handleSaveCurrentPractice = () => {
    if (!activeSet) return;
    
    // Check if copy already exists
    const exists = savedPractices.find(p => p.practiceSet.id === activeSet.id);
    if (exists) {
      // Update answers and stats
      const correctCount = activeSet.questions.reduce((acc, q) => {
        return selectedAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
      }, 0);
      const scorePercentage = Math.round((correctCount / activeSet.questions.length) * 100);

      const updated = savedPractices.map(p => {
        if (p.practiceSet.id === activeSet.id) {
          return {
            ...p,
            userAnswers: selectedAnswers,
            score: scorePercentage,
            isCompleted: graded,
            savedAt: new Date().toLocaleString()
          };
        }
        return p;
      });
      savePracticesToStorage(updated);
    } else {
      // Add fresh copy
      const correctCount = activeSet.questions.reduce((acc, q) => {
        return selectedAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
      }, 0);
      const scorePercentage = Math.round((correctCount / activeSet.questions.length) * 100);

      const newSaved: SavedPractice = {
        id: "saved_" + Date.now(),
        practiceSet: activeSet,
        userAnswers: selectedAnswers,
        score: scorePercentage,
        isCompleted: graded,
        savedAt: new Date().toLocaleString()
      };
      savePracticesToStorage([newSaved, ...savedPractices]);
    }
    
    // Trigger user absolute visual delight
    alert("The progress of this practice set has been successfully saved to your local study archives. You can load it anytime using the History panel.");
  };

  // Load from history
  const handleLoadSaved = (saved: SavedPractice) => {
    setActiveSet(saved.practiceSet);
    
    // Set activeSetSource based on the question IDs
    if (saved.practiceSet.questions.some(q => q.id.includes("local_fallback"))) {
      setActiveSetSource("backup");
    } else if (saved.practiceSet.questions.some(q => q.id.startsWith("q") || q.id.includes("dupont") || q.id.includes("var"))) {
      setActiveSetSource("static");
    } else {
      setActiveSetSource("api");
    }

    setSelectedAnswers(saved.userAnswers || {});
    setGraded(saved.isCompleted || false);
    setApiError(null);
  };

  // Delete from history
  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this local practice history?")) {
      const filtered = savedPractices.filter(p => p.id !== id);
      savePracticesToStorage(filtered);
    }
  };

  // Handing option select clicked
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (graded) return; // Cannot edit once graded
    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: optionIndex
    });
  };

  // Grade the answer set
  const handleGradePracticeSet = () => {
    if (!activeSet) return;
    
    // Warn if missed some answers
    const unanswered = activeSet.questions.filter(q => selectedAnswers[q.id] === undefined);
    if (unanswered.length > 0) {
      if (!confirm(`You have ${unanswered.length} unanswered questions. Are you sure you want to submit for grading now?`)) {
        return;
      }
    }

    setGraded(true);
    
    // Automatically save history status
    const correctCount = activeSet.questions.reduce((acc, q) => {
      return selectedAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
    }, 0);
    const scorePercentage = Math.round((correctCount / activeSet.questions.length) * 100);

    // If exists in saved lists, update. Otherwise inject
    const matchIndex = savedPractices.findIndex(p => p.practiceSet.id === activeSet.id);
    if (matchIndex > -1) {
      const updated = [...savedPractices];
      updated[matchIndex] = {
        ...updated[matchIndex],
        userAnswers: selectedAnswers,
        score: scorePercentage,
        isCompleted: true,
        savedAt: new Date().toLocaleString()
      };
      savePracticesToStorage(updated);
    } else {
      const newSaved: SavedPractice = {
        id: "saved_" + Date.now(),
        practiceSet: activeSet,
        userAnswers: selectedAnswers,
        score: scorePercentage,
        isCompleted: true,
        savedAt: new Date().toLocaleString()
      };
      savePracticesToStorage([newSaved, ...savedPractices]);
    }
  };

  // Reset custom test to re-attempt
  const handleResetTest = () => {
    setSelectedAnswers({});
    setGraded(false);
  };

  // Note management logic
  const handleStartEditingNote = (qId: string) => {
    setIsEditingNoteId(qId);
    setNoteEditTemp(userNotes[qId] || "");
  };

  const handleSaveNote = (qId: string) => {
    const updated = { ...userNotes, [qId]: noteEditTemp };
    setUserNotes(updated);
    setIsEditingNoteId(null);
  };

  // Quick action to print/export as text
  const handleExportText = () => {
    if (!activeSet) return;
    
    let content = `=============================\n`;
    content += `[ExamLogic AI] ${activeSet.examType} ${activeSet.subLevel} Practice Set\n`;
    content += `Core Exam Point: ${activeSet.conceptInput}\n`;
    content += `Generated At: ${activeSet.generatedAt}\n`;
    content += `=============================\n\n`;

    activeSet.questions.forEach((q, idx) => {
      content += `Q${idx + 1}. [${q.difficulty}] ${q.text}\n\n`;
      q.options.forEach(opt => {
        content += `  ${opt}\n`;
      });
      content += `\n-----------------------------\n`;
      if (graded) {
        content += `Correct Option: ${q.options[q.correctOptionIndex]}\n`;
        content += `[Detailed Step-by-Step Solution]\n${q.stepByStepSolution}\n\n`;
        content += `[Knowledge Assessment]\n${q.knowledgeAnalysis}\n\n`;
        content += `[Examiner's Trap Guide]\n${q.examLogicInsight}\n`;
        content += `-----------------------------\n\n`;
      } else {
        content += `(Submit answers on the platform to view detailed step-by-step solutions and trap guides)\n-----------------------------\n\n`;
      }
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ExamLogic_${activeSet.examType}_${activeSet.subLevel}_Practice.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get dynamic breakdown stats for cognitive testing dimensions based on user exercises
  const getDimensionStats = () => {
    const dimensions = {
      Concept_Mastery: { name: "Concept Mastery", description: "Analysis of theoretical assumptions, concepts, and qualitative rules", attempted: 0, correct: 0 },
      Calculation: { name: "Calculation", description: "Standard curriculum formula application and quantitative derivation", attempted: 0, correct: 0 },
      Sensitivity_Analysis: { name: "Sensitivity Analysis", description: "Impact of variable shifts (e.g., interest rates, Greeks) on target metrics", attempted: 0, correct: 0 },
      Case_Study: { name: "Case Study", description: "Multi-variable matching, immunization, and real-world scenarios", attempted: 0, correct: 0 },
      Risk_Management: { name: "Risk Management", description: "Regulatory metrics, Basel rules, hedging execution, and policy actions", attempted: 0, correct: 0 },
      Reverse_Engineering: { name: "Reverse Engineering", description: "Working backward from targets to find implicit variables and formula traps", attempted: 0, correct: 0 }
    };

    savedPractices.forEach(practice => {
      if (!practice.isCompleted) return;
      const qAnswers = practice.userAnswers || {};
      practice.practiceSet.questions.forEach(q => {
        let dimKey = (q.dimension || "") as keyof typeof dimensions;
        // Map legacy keys if present
        if (dimKey === "Level_A" as any) dimKey = "Concept_Mastery";
        if (dimKey === "Level_B" as any) dimKey = "Calculation";
        if (dimKey === "Level_C" as any) dimKey = "Sensitivity_Analysis";
        if (dimKey === "Level_D" as any) dimKey = "Case_Study";
        if (dimKey === "Level_E" as any) dimKey = "Risk_Management";
        if (dimKey === "Level_F" as any) dimKey = "Reverse_Engineering";

        if (dimensions[dimKey]) {
          dimensions[dimKey].attempted += 1;
          if (qAnswers[q.id] === q.correctOptionIndex) {
            dimensions[dimKey].correct += 1;
          }
        } else {
          // Fallback heuristic classification for older/static data to populate the stats elegantly
          let fallbackDim: keyof typeof dimensions = "Concept_Mastery";
          const textLower = (q.text + " " + (q.pointsTested || "")).toLowerCase();
          if (textLower.includes("calculate") || textLower.includes("compute") || textLower.includes("数学") || textLower.includes("计算") || textLower.includes("roeq") || textLower.includes("fcf")) {
            fallbackDim = textLower.includes("reverse") || textLower.includes("逆向") || textLower.includes("反推") ? "Reverse_Engineering" : "Calculation";
          } else if (textLower.includes("sensitivity") || textLower.includes("direction") || textLower.includes("敏感") || textLower.includes("利率变化") || textLower.includes("greeks") || textLower.includes("delta")) {
            fallbackDim = "Sensitivity_Analysis";
          } else if (textLower.includes("matching") || textLower.includes("immuniz") || textLower.includes("matching") || textLower.includes("匹配") || textLower.includes("gap")) {
            fallbackDim = "Case_Study";
          } else if (textLower.includes("risk") || textLower.includes("regula") || textLower.includes("basel") || textLower.includes("风险") || textLower.includes("巴塞尔") || textLower.includes("cds")) {
            fallbackDim = "Risk_Management";
          }
          
          dimensions[fallbackDim].attempted += 1;
          if (qAnswers[q.id] === q.correctOptionIndex) {
            dimensions[fallbackDim].correct += 1;
          }
        }
      });
    });

    return Object.entries(dimensions).map(([key, value]) => {
      const accuracy = value.attempted > 0 ? Math.round((value.correct / value.attempted) * 100) : 100;
      let status: "Excellent" | "Good" | "NeedsImprovement" | "Unattempted" = "Unattempted";
      if (value.attempted > 0) {
        if (accuracy >= 80) status = "Excellent";
        else if (accuracy >= 60) status = "Good";
        else status = "NeedsImprovement";
      }
      return {
        key,
        ...value,
        accuracy,
        status
      };
    });
  };

  // Dynamically analyze incorrect answers to extract exact tested points for the diagnostic engine
  const getIncorrectPoints = () => {
    const wrongPoints: { point: string; examType: string; dimension: string; count: number }[] = [];
    savedPractices.forEach(practice => {
      if (!practice.isCompleted) return;
      const qAnswers = practice.userAnswers || {};
      practice.practiceSet.questions.forEach(q => {
        if (qAnswers[q.id] !== undefined && qAnswers[q.id] !== q.correctOptionIndex) {
          const pointName = q.pointsTested || "Unknown Exam Point";
          const existing = wrongPoints.find(p => p.point === pointName);
          if (existing) {
            existing.count += 1;
          } else {
            wrongPoints.push({
              point: pointName,
              examType: practice.practiceSet.examType,
              dimension: q.dimension || "Concept_Mastery",
              count: 1
            });
          }
        }
      });
    });
    return wrongPoints.sort((a, b) => b.count - a.count).slice(0, 5);
  };

  // Get current weakest dimension for targeted adaptation advice
  const getWeakestDimension = () => {
    const stats = getDimensionStats().filter(d => d.attempted > 0);
    if (stats.length === 0) return null;
    return stats.sort((a, b) => a.accuracy - b.accuracy)[0];
  };

  // Filtered lists of suggestions
  const currentLevelLabel = examType === ExamType.CFA ? cfaLevel : frmPart;
  const filteredSuggestions = SAMPLE_TOPICS.filter(
    t => t.examType === examType && t.level === currentLevelLabel
  );

  // Filter search history
  const filteredHistory = savedPractices.filter(p => {
    if (!searchHistoryQuery) return true;
    const qText = searchHistoryQuery.toLowerCase();
    return (
      p.practiceSet.conceptInput.toLowerCase().includes(qText) ||
      p.practiceSet.subLevel.toLowerCase().includes(qText) ||
      p.practiceSet.examType.toLowerCase().includes(qText)
    );
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] font-sans text-slate-900 antialiased selection:bg-blue-100">
      
      {/* GLOBAL HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#0F172A] text-white shadow-lg border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center font-extrabold text-2xl text-white shadow-md shadow-blue-500/20 transform hover:scale-105 transition-transform duration-200">
            Σ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-500 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">PRO</span>
              <h1 className="text-xl font-bold tracking-tight">ExamLogic AI</h1>
            </div>
            <p className="text-xs text-slate-400 font-medium">CFA & FRM Dynamic Exam Generator & Diagnostic System</p>
          </div>
        </div>

        {/* Exam Module Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-inner">
            <button
              id="cfa-module-toggle"
              onClick={() => handleExamTypeChange(ExamType.CFA)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                examType === ExamType.CFA
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Award className="w-4 h-4" />
              CFA Prep Module
            </button>
            <button
              id="frm-module-toggle"
              onClick={() => handleExamTypeChange(ExamType.FRM)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                examType === ExamType.FRM
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers3 className="w-4 h-4" />
              FRM Prep Module
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Curriculum 2026 Ready
          </div>
        </div>
      </header>

      {/* SUB-NAV LEVEL SELECTOR */}
      <nav className="flex flex-wrap items-center justify-between border-b bg-white px-6 py-2 shadow-sm shrink-0">
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
          {examType === ExamType.CFA ? (
            <>
              <button
                id="cfa-l1-btn"
                onClick={() => setCfaLevel("Level_1")}
                className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  cfaLevel === "Level_1"
                    ? "border-blue-600 text-blue-600 bg-blue-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-950 hover:bg-slate-50"
                }`}
              >
                CFA Level I
              </button>
              <button
                id="cfa-l2-btn"
                onClick={() => setCfaLevel("Level_2")}
                className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  cfaLevel === "Level_2"
                    ? "border-blue-600 text-blue-600 bg-blue-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-950 hover:bg-slate-50"
                }`}
              >
                CFA Level II
              </button>
              <button
                id="cfa-l3-btn"
                onClick={() => setCfaLevel("Level_3")}
                className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  cfaLevel === "Level_3"
                    ? "border-blue-600 text-blue-600 bg-blue-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-950 hover:bg-slate-50"
                }`}
              >
                CFA Level III
              </button>
            </>
          ) : (
            <>
              <button
                id="frm-p1-btn"
                onClick={() => setFrmPart("Part_1")}
                className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  frmPart === "Part_1"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-950 hover:bg-slate-50"
                }`}
              >
                FRM Part I
              </button>
              <button
                id="frm-p2-btn"
                onClick={() => setFrmPart("Part_2")}
                className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  frmPart === "Part_2"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-950 hover:bg-slate-50"
                }`}
              >
                FRM Part II
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-slate-700">
            <span className="font-bold">Curriculum:</span>
            2026 Latest Official Syllabus
          </span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">Standard CBT Simulation</span>
        </div>
      </nav>

      {/* CORE WORKSPACE */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 sm:p-6 gap-6 overflow-hidden max-w-[1600px] mx-auto w-full">
        
        {/* LEFT COLUMN: CONTROL & INPUT */}
        <section className="w-full lg:w-[390px] flex flex-col gap-5 shrink-0">
          
          {/* Main generator Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4">
            
            {/* Header label */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Syllabus Configuration
              </h2>
              <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full">
                {examType} • {currentLevelLabel.replace("_", " ")}
              </span>
            </div>

            {/* Topic Input Area */}
            <div className="flex flex-col gap-2">
              <label htmlFor="concept-input-textarea" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Enter Exam Point, Concept, or Text Segment
              </label>
              <div className="relative">
                <textarea
                  id="concept-input-textarea"
                  value={conceptInput}
                  onChange={(e) => setConceptInput(e.target.value)}
                  className="w-full h-36 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none shadow-inner"
                  placeholder="Example: Duration Gap, DuPont ROE decomposition, VaR scaling..."
                />
                <button
                  id="clear-input-btn"
                  onClick={() => setConceptInput("")}
                  className="absolute right-2.5 bottom-2.5 text-xs text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 px-2 py-1 rounded"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Advanced configurations */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="mode-select" className="text-xs font-semibold text-slate-500">Generation Mode</label>
                <select 
                  id="mode-select"
                  value={generationMode}
                  onChange={(e) => setGenerationMode(e.target.value)}
                  className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="Logic-Based Item Set (Modified Data)">Real Exam Logic & Adaptation</option>
                  <option value="Calculative Focus (Formula Logic)">Quantitative Formula Derivation</option>
                  <option value="Conceptual Drill Questions">Qualitative Conceptual Analysis</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="count-select" className="text-xs font-semibold text-slate-500">Questions Count</label>
                <select 
                  id="count-select"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value={1}>1 Practice Question</option>
                  <option value={3}>3 Practice Questions</option>
                  <option value={5}>5 Practice Questions</option>
                </select>
              </div>
            </div>

            {/* Target Cognitive Testing Dimension */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dimension-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span>Target Cognitive Dimension</span>
              </label>
              <select 
                id="dimension-select"
                value={selectedDimension}
                onChange={(e) => setSelectedDimension(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Balanced Mix (All Dimensions)</option>
                <option value="Concept_Mastery">Concept Mastery: Definitions & Core Theory</option>
                <option value="Calculation">Calculation: Quantitative Formula Application</option>
                <option value="Sensitivity_Analysis">Sensitivity Analysis: Variable Shifts & Greeks</option>
                <option value="Case_Study">Case Study: ALM & Yield Curve Matching</option>
                <option value="Risk_Management">Risk Management: Regulation & Hedging Policy</option>
                <option value="Reverse_Engineering">Reverse Engineering: Dynamic Backward Inference</option>
              </select>
            </div>

            {/* Generate Action Button */}
            <button
              id="generate-action-btn"
              onClick={() => handleGenerateQuestions()}
              disabled={loading}
              className={`relative overflow-hidden w-full text-white py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.98] ${
                loading 
                  ? "bg-slate-400 cursor-not-allowed" 
                  : examType === ExamType.CFA 
                    ? "bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 shadow-blue-500/20"
                    : "bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 shadow-indigo-500/20"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Synthesizing Questions...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="w-4.5 h-4.5" />
                  Generate Custom Exam Set
                </span>
              )}
            </button>

            {/* Disclaimer alerting core logic changes */}
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <strong>IMPORTANT COMPLIANCE NOTICE:</strong>
                To comply with copyright guidelines and maintain absolute integrity, this platform strictly prohibits verbatim reproduction of official past exam questions. Every generated question utilizes simulated corporate scenarios and randomized variables while maintaining 100% logical and mathematical alignment with the official curriculum standards.
              </div>
            </div>

          </div>

          {/* Quick Select Predefined Samples list */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              High-Yield Quick Demonstrations
            </h3>
            
            {filteredSuggestions.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                {filteredSuggestions.map((sample, idx) => (
                  <button
                    key={idx}
                    id={`sample-topic-item-${idx}`}
                    onClick={() => handleSelectSample(sample)}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-100 hover:border-blue-200 rounded-lg text-xs font-medium transition-all flex items-center justify-between"
                  >
                    <span className="truncate pr-2 font-semibold text-slate-700">{sample.label}</span>
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No cached topics for this level. Enter any concept in the configuration panel above to generate questions in real-time.</p>
            )}
          </div>

          {/* HISTORY & COGNITIVE DIAGNOSIS TABBED PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[350px] flex-1">
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-1 flex items-center justify-between shrink-0">
              <div className="flex">
                <button
                  id="tab-history-btn"
                  onClick={() => setBottomTab("history")}
                  className={`px-3 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                    bottomTab === "history"
                      ? "border-blue-600 text-blue-600 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Practice History
                </button>
                <button
                  id="tab-diagnosis-btn"
                  onClick={() => setBottomTab("diagnosis")}
                  className={`px-3 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                    bottomTab === "diagnosis"
                      ? "border-blue-600 text-blue-600 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  AI Diagnosis
                </button>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded">
                {bottomTab === "history" ? `${savedPractices.length} Set(s)` : "6D Competency Profile"}
              </span>
            </div>

            {bottomTab === "history" ? (
              <>
                {/* History items filter box */}
                <div className="p-2.5 border-b border-slate-100 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      id="history-search-input"
                      type="text"
                      value={searchHistoryQuery}
                      onChange={(e) => setSearchHistoryQuery(e.target.value)}
                      placeholder="Search history..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white outline-none"
                    />
                  </div>
                </div>

                {/* List scroll */}
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredHistory.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {filteredHistory.map((item) => {
                        const isSelected = activeSet?.id === item.practiceSet.id;
                        return (
                          <div
                            key={item.id}
                            id={`history-item-row-${item.id}`}
                            onClick={() => handleLoadSaved(item)}
                            className={`group w-full text-left p-2.5 rounded-xl transition-all cursor-pointer border flex flex-col gap-1 ${
                              isSelected
                                ? "bg-blue-50/60 border-blue-200 text-blue-950"
                                : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100 text-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className={`px-1.5 py-0.5 rounded uppercase ${
                                item.practiceSet.examType === ExamType.CFA 
                                  ? "bg-blue-100 text-blue-800" 
                                  : "bg-indigo-100 text-indigo-800"
                              }`}>
                                {item.practiceSet.examType} {item.practiceSet.subLevel}
                              </span>
                              <button
                                id={`delete-history-btn-${item.id}`}
                                onClick={(e) => handleDeleteSaved(item.id, e)}
                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                title="删除记录"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <p className="text-xs font-black truncate text-slate-800">{item.practiceSet.conceptInput}</p>
                            
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                              <span>{item.savedAt}</span>
                              {item.isCompleted ? (
                                <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                                  Graded Score: {item.score}%
                                </span>
                              ) : (
                                <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.2 rounded">
                                  Incomplete
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400 italic">
                      No practice history records found.
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Cognitive Assessment Radar & Adaptation Panel */
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3.5">
                <div className="bg-slate-900 text-slate-100 rounded-xl p-3 text-[11px] leading-relaxed border border-slate-800 shrink-0">
                  <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>CFA/FRM 6-Dimensional Cognitive Diagnosis</span>
                  </div>
                  The diagnostic engine dynamically rates your mastery across the curriculum based on your historical practice answers. Click <b>"Reinforce"</b> next to any weak area to focus training.
                </div>

                <div className="flex flex-col gap-3">
                  {getDimensionStats().map((dim) => {
                    return (
                      <div key={dim.key} className="p-2.5 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1.5 transition-colors">
                        <div className="flex items-center justify-between gap-1.5">
                          <div>
                            <h4 className="text-xs font-black text-slate-800">{dim.name}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">{dim.description}</p>
                          </div>
                          
                          <div className="text-right shrink-0">
                            {dim.attempted === 0 ? (
                              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                Untested
                              </span>
                            ) : dim.status === "Excellent" ? (
                              <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-2 py-0.5 rounded">
                                Excellent {dim.accuracy}%
                              </span>
                            ) : dim.status === "Good" ? (
                              <span className="text-[10px] text-blue-700 font-extrabold bg-blue-100 px-2 py-0.5 rounded">
                                Good {dim.accuracy}%
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-700 font-extrabold bg-rose-100 px-2 py-0.5 rounded animate-pulse">
                                Weak {dim.accuracy}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mini progress bar */}
                        {dim.attempted > 0 && (
                          <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                dim.accuracy >= 80 
                                  ? "bg-emerald-500" 
                                  : dim.accuracy >= 60 
                                    ? "bg-blue-500" 
                                    : "bg-rose-500"
                              }`}
                              style={{ width: `${dim.accuracy}%` }}
                            />
                          </div>
                        )}

                        {/* Action details */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Total Attempted: {dim.attempted}</span>
                          
                          {/* Adaptation Reinforcement Trigger */}
                          <button
                            id={`reinforce-dim-${dim.key}`}
                            onClick={() => {
                              setSelectedDimension(dim.key);
                              // Auto seed concept based on the weak dimension to help candidate start
                              if (dim.key === "Reverse_Engineering") {
                                setConceptInput(examType === ExamType.CFA ? "Reverse equation analysis of DuPont asset leverage" : "Duration Gap sensitivity reverse equation inference");
                              } else if (dim.key === "Risk_Management") {
                                setConceptInput(examType === ExamType.CFA ? "Basel III Liquidity Coverage Ratio compliance constraints" : "Basel III CAR Capital Adequacy Ratio risk management");
                              } else if (dim.key === "Case_Study") {
                                setConceptInput(examType === ExamType.CFA ? "Asset Liability duration gap matching immunization" : "Interest rate immunization and cash flow matching");
                              } else {
                                setConceptInput(conceptInput || "CAPM required rate of return with inflation adjustment");
                              }
                              
                              // Visual confirmation alert
                              alert(`Target reinforcement parameters for [${dim.name}] have been successfully configured! Click "Generate Custom Exam Set" above to start.`);
                            }}
                            className={`px-2 py-0.5 rounded font-black transition-all ${
                              dim.attempted === 0
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                                : dim.status === "NeedsImprovement"
                                  ? "bg-rose-600 text-white hover:bg-rose-700 shadow-xs shadow-rose-500/10"
                                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100"
                            }`}
                          >
                            {dim.status === "NeedsImprovement" ? "⚠️ Reinforce Weakness" : "Reinforce"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SECTION 2: DYNAMIC KNOWLEDGE GAP DEDUCTION (Core Diagnostic Value) */}
                <div className="border-t border-slate-200/60 pt-3.5 mt-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs mb-2">
                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cognitive Insights: Knowledge Gap Analysis</span>
                  </div>

                  {getIncorrectPoints().length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] text-slate-400 mb-1 leading-relaxed">
                        Based on your recent incorrect answers, the diagnosis engine has pinpointed these specific curriculum gaps:
                      </p>
                      {getIncorrectPoints().map((wp, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-rose-50/50 hover:bg-rose-50 border border-rose-100/60 rounded-xl transition-all">
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                            Gap #{idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-slate-800 truncate">{wp.point}</h5>
                            <p className="text-[10px] text-slate-400">
                              Dimension: <span className="font-medium text-slate-600">{wp.dimension}</span> • Incorrect: {wp.count} time(s)
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-xl text-center text-[10px] text-slate-400 italic">
                      🎯 No incorrect answers logged yet.
                      <br />
                      Once you complete exercises and submit them, the diagnostic engine will pinpoint specific knowledge gaps.
                    </div>
                  )}
                </div>

                {/* SECTION 3: ADAPTIVE TRAINING PATHWAY (Next Steps) */}
                <div className="border-t border-slate-200/60 pt-3.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Adaptive Training Path & Improvement Tracker</span>
                  </div>

                  {getWeakestDimension() ? (
                    <div className="p-3 bg-amber-50/40 border border-amber-200/50 rounded-xl flex flex-col gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-black text-amber-800">
                        <span>Gap Alert: Next focus is recommended on [{getWeakestDimension()?.name}]</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Your accuracy in this dimension is currently <b>{getWeakestDimension()?.accuracy}%</b>.
                        <br />
                        <b>Recommended path:</b> Click "Reinforce Weakness" to automatically seed dynamic variables testing this competency. Repeat until your accuracy climbs above 80%.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-xl text-center text-[10px] text-slate-400">
                      💡 We recommend generating a <b>"Balanced Mix"</b> exam set to establish your baseline competency.
                      <br />
                      Detailed insights will unlock upon grading.
                    </div>
                  )}
                </div>

                {/* SECTION 4: CLOUD SYNC & MONETIZATION TRANSITION (Proactive Risk 2) */}
                <div className="border-t border-slate-200/60 pt-3 mt-1 shrink-0">
                  <div className="p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
                    <Cloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[10px] font-black text-blue-900 uppercase tracking-wide">
                          ☁️ Multi-Device Cloud Sync (Pro Preview)
                        </h5>
                        <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-1 rounded">
                          Cloud Sync
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-950/70 leading-relaxed mt-0.5">
                        Currently running in local-only MVP mode. For cross-device tracking of mock history and 6D diagnostic profiles, a cloud database (such as Firebase Firestore) with Authentication can be seamlessly connected.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

        </section>

        {/* RIGHT COLUMN: OUTPUT / EXAM PANEL */}
        <section className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
          
          {/* Active set status header */}
          {activeSet && (
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className={`px-2 py-1 text-xs font-black rounded uppercase ${
                  activeSet.examType === ExamType.CFA 
                    ? "bg-blue-600 text-white" 
                    : "bg-indigo-600 text-white"
                }`}>
                  {activeSet.examType} {activeSet.subLevel}
                </span>
                <div>
                  <h2 id="active-set-concept" className="font-bold text-slate-800 text-sm md:text-base tracking-tight">
                    Target Concept: {activeSet.conceptInput}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-slate-400">
                      Generated at: {activeSet.generatedAt} • with {activeSet.questions.length} high-fidelity exam questions
                    </p>
                    {activeSetSource === "backup" && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                        Fallback Engine Active
                      </span>
                    )}
                    {activeSetSource === "static" && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full">
                        Cached Core Practice
                      </span>
                    )}
                    {activeSetSource === "api" && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded-full">
                        Live AI Generation
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Utility buttons for active set */}
              <div className="flex items-center gap-2">
                <button
                  id="export-test-btn"
                  onClick={handleExportText}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-bold transition-all shadow-sm"
                  title="Export as clean text for printing or word processors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Exam</span>
                </button>
                <button
                  id="bookmark-progress-btn"
                  onClick={handleSaveCurrentPractice}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg font-bold transition-all shadow-sm"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Save Progress</span>
                </button>
              </div>
            </div>
          )}

          {/* MAIN CORE BODY FOR EXAM DISPLAY */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            
            {/* Show API Error with manual fallback instruction to user */}
            {apiError && (
              <div id="api-error-alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  出题引擎受阻：{apiError.message}
                </div>
                {apiError.isApiKeyMissing ? (
                  <div className="text-xs text-red-700 space-y-2 mt-1 leading-relaxed">
                    <p>
                      <strong>原因说明：</strong>
                      系统未检测到 <code>GEMINI_API_KEY</code> 密钥配置。这是因为当部署在服务器端时，由于您的AI Studio Secrets面板还没有配置相关的API Key，模型因而无法启动。
                    </p>
                    <div className="bg-slate-900 text-slate-300 p-3.5 rounded-lg font-mono text-[11px] overflow-x-auto border border-slate-800">
                      提示: 请在 AI Studio 的【Settings】或【Secrets】(秘钥设置) 中添加名称为 <b className="text-white">GEMINI_API_KEY</b> 的密钥，值设置为您的 Gemini 官方 API Key。
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 italic">
                      💡 <b>好消息：</b>尽管由于缺失API Key无法立刻在线根据任意词定制题目，您依然可以点击左下角<b>“高频核心考点快捷演示”</b>中的预热词，或者通过右侧演练，体验我们预先内建的两套高仿真CFA和FRM官方大纲经典考题！
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-700">请检查您的输入参数，缩短包含的关键词，或重试生成。</p>
                )}
              </div>
            )}

            {/* SKELETON SHIMMER LOADING PREVIEW */}
            {loading ? (
              <div className="flex flex-col gap-6 max-w-3xl mx-auto py-8">
                <div className="p-6 bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col gap-4 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-16 bg-slate-200 rounded-md"></div>
                    <div className="h-5 w-48 bg-slate-200 rounded-md"></div>
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-full"></div>
                  <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                  <div className="h-4 bg-slate-200 rounded w-4/6"></div>
                  <div className="mt-4 space-y-2">
                    <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                    <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                    <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                  </div>
                </div>

                <div className="text-center text-slate-400 text-xs py-4 flex flex-col items-center gap-2 justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  <span>Assembling curriculum developer agents. Extracting exam logic, rewriting corporate financial statements, and embedding conceptual traps...</span>
                </div>
              </div>
            ) : activeSet ? (
              
              /* EXAM WORK AREA */
              <div id="exam-work-area" className="max-w-3xl mx-auto flex flex-col gap-8 pb-12">
                
                {/* Introduction or Top Alert inside practice set */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm animate-pulse"></span>
                    <span>
                      <b>Practice Mode Active:</b>
                      Select your answers below. CFA questions feature 3 options, and FRM features 4. Once completed, click <b>"Submit & View Detailed Explanations"</b> at the bottom.
                    </span>
                  </div>
                  {graded && (
                    <button
                      id="reset-answers-btn"
                      onClick={handleResetTest}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-300 px-2 py-1 rounded transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Practice
                    </button>
                  )}
                </div>

                {/* Score Card Banner upon submission */}
                {graded && (
                  <div id="graded-score-card" className="p-6 bg-gradient-to-r from-slate-900 to-slate-850 text-white rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 transform animate-fade-in">
                    <div>
                      <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                        <Award className="w-4 h-4" />
                        Performance Diagnostics & Review Board
                      </div>
                      <h4 className="text-lg font-bold">
                        Practice set evaluated successfully!
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        CFA and FRM exams test conceptual agility as much as mathematical accuracy. Read the "Step-by-Step Derivation" and "Trap Guide" carefully for every question.
                      </p>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-800/80 px-5 py-3 rounded-xl border border-slate-700/60 shrink-0">
                      <div className="text-center">
                        <div className="text-2xl font-black text-amber-400">
                          {activeSet.questions.reduce((acc, q) => {
                            return selectedAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
                          }, 0)} <span className="text-slate-300 text-xs">/ {activeSet.questions.length}</span>
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Correct</div>
                      </div>
                      <div className="w-px h-8 bg-slate-700"></div>
                      <div className="text-center">
                        <div className="text-3xl font-black text-white">
                          {Math.round((activeSet.questions.reduce((acc, q) => {
                            return selectedAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
                          }, 0) / activeSet.questions.length) * 100)}%
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Accuracy</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Individual Question Rendering */}
                {activeSet.questions.map((question, qIdx) => {
                  const userAnswer = selectedAnswers[question.id];
                  const hasAnswered = userAnswer !== undefined;
                  const isCorrect = userAnswer === question.correctOptionIndex;

                  return (
                    <article
                      key={question.id}
                      id={`question-card-${question.id}`}
                      className={`relative p-5 md:p-6 rounded-2xl border transition-all duration-300 ${
                        graded
                          ? isCorrect
                            ? "bg-emerald-50/[0.15] border-emerald-300/40 shadow-sm"
                            : "bg-red-50/[0.15] border-red-300/30"
                          : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
                      }`}
                    >
                      {/* Top badges bar */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-black rounded-lg">
                            Q{qIdx + 1}
                          </span>
                          <span className="text-[11px] md:text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            Exam Point: {question.pointsTested || activeSet.conceptInput}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            question.difficulty === "Easy" 
                              ? "bg-green-100 text-green-700" 
                              : question.difficulty === "Medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}>
                            {question.difficulty === "Easy" ? "Easy" : question.difficulty === "Medium" ? "Medium" : "Hard"}
                          </span>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="text-slate-800 text-sm md:text-base leading-relaxed font-medium mb-6">
                        <p className="font-semibold text-slate-950 font-sans">
                          {question.text.split("[Chinese Translation")[0].trim()}
                        </p>
                      </div>

                      {/* Selectable Options List */}
                      <div id={`options-container-for-${question.id}`} className="space-y-3 mb-6">
                        {question.options.map((option, optIdx) => {
                          const isOptionSelected = userAnswer === optIdx;
                          const isThisCorrectOption = question.correctOptionIndex === optIdx;

                          // Dynamic classes depending on state
                          let optionClass = "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700";
                          let prefixSymbol = <span className="w-5 h-5 rounded-full border border-slate-300 text-xs flex items-center justify-center font-bold text-slate-400 group-hover:border-slate-400">{String.fromCharCode(65 + optIdx)}</span>;

                          if (graded) {
                            if (isThisCorrectOption) {
                              optionClass = "border-2 border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold";
                              prefixSymbol = <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />;
                            } else if (isOptionSelected) {
                              optionClass = "border-2 border-red-500 bg-red-50/50 text-red-950";
                              prefixSymbol = <XCircle className="w-5 h-5 text-red-600 shrink-0" />;
                            } else {
                              optionClass = "border border-slate-100 bg-slate-50 text-slate-400 opacity-60";
                              prefixSymbol = <span className="w-5 h-5 rounded-full border border-slate-200 text-xs flex items-center justify-center font-bold text-slate-300">{String.fromCharCode(65 + optIdx)}</span>;
                            }
                          } else if (isOptionSelected) {
                            optionClass = `border-2 ${
                              examType === ExamType.CFA 
                                ? "border-blue-600 bg-blue-50/20 text-blue-950 font-semibold shadow-sm" 
                                : "border-indigo-600 bg-indigo-50/20 text-indigo-950 font-semibold shadow-sm"
                            }`;
                            prefixSymbol = <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold text-white shadow-xs ${
                              examType === ExamType.CFA ? "bg-blue-600" : "bg-indigo-600"
                            }`}>{String.fromCharCode(65 + optIdx)}</span>;
                          }

                          return (
                            <button
                              key={optIdx}
                              id={`q-${question.id}-opt-${optIdx}`}
                              onClick={() => handleSelectOption(question.id, optIdx)}
                              disabled={graded}
                              className={`group w-full text-left p-3.5 rounded-xl text-xs md:text-sm flex items-center gap-3 transition-all ${optionClass}`}
                            >
                              {prefixSymbol}
                              <span className="flex-1">{option}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* DISPLAY DETAILED ANALYSIS & CALCULATIONS IF SUBMITTED */}
                      {graded && (
                        <div id={`solution-analysis-for-${question.id}`} className="mt-6 border-t border-slate-100 pt-5 space-y-4 animate-fade-in">
                          
                          {/* Step by Step calculations block */}
                          <div className="bg-[#FAFBFD] rounded-xl border border-blue-100/50 p-4 shadow-xs">
                            <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                              <ClipboardCheck className="w-4 h-4" />
                              Step-by-Step Derivation
                            </h4>
                            <div className="text-xs md:text-sm text-slate-700 leading-relaxed space-y-1">
                              {question.stepByStepSolution.split("\n").map((line, lIdx) => (
                                <p key={lIdx}>{line}</p>
                              ))}
                            </div>
                          </div>

                          {/* Knowledge analysis theory */}
                          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4 text-slate-400" />
                              Knowledge Assessment
                            </h4>
                            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                              {question.knowledgeAnalysis}
                            </p>
                          </div>

                          {/* Real exam trap/logic insight */}
                          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
                            <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              Examiner's Trap Guide
                            </h4>
                            <p className="text-xs md:text-sm text-amber-900 font-medium leading-relaxed">
                              {question.examLogicInsight}
                            </p>
                          </div>

                          {/* Personal notes for study */}
                          <div className="border border-slate-100 rounded-xl p-3 bg-white">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400">
                                Personal Study Notes / Review Summary:
                              </span>
                              {isEditingNoteId === question.id ? (
                                <button
                                  id={`save-note-btn-${question.id}`}
                                  onClick={() => handleSaveNote(question.id)}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                                >
                                  Save Note
                                </button>
                              ) : (
                                <button
                                  id={`edit-note-btn-${question.id}`}
                                  onClick={() => handleStartEditingNote(question.id)}
                                  className="text-xs font-semibold text-slate-500 hover:text-blue-600"
                                >
                                  {userNotes[question.id] ? "Edit Note" : "+ Add Note"}
                                </button>
                              )}
                            </div>

                            {isEditingNoteId === question.id ? (
                              <textarea
                                id={`note-textarea-${question.id}`}
                                value={noteEditTemp}
                                onChange={(e) => setNoteEditTemp(e.target.value)}
                                className="w-full mt-2 p-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="Write your personal review and summary of this question..."
                                rows={2}
                              />
                            ) : (
                              userNotes[question.id] ? (
                                <p className="text-xs text-slate-700 bg-blue-50/40 p-2 rounded mt-1 border-l-2 border-blue-400 font-sans italic">
                                  {userNotes[question.id]}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 italic mt-1 font-sans">No notes saved yet. Use this space to document unfamiliar formulas or concept gaps.</p>
                              )
                            )}
                          </div>

                        </div>
                      )}
                    </article>
                  );
                })}

                {/* Submit button bar */}
                {!graded && (
                  <div className="flex justify-center pt-4">
                    <button
                      id="submit-exam-set-btn"
                      onClick={handleGradePracticeSet}
                      className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm tracking-wide rounded-xl shadow-lg transition-all transform active:scale-95 duration-200 flex items-center gap-2"
                    >
                      <ClipboardCheck className="w-5 h-5 text-emerald-400 animate-bounce" />
                      Submit Practice Set & Unlock Detailed Explanations
                    </button>
                  </div>
                )}

              </div>
              
            ) : (
              
              /* WELCOME INTRO STATE WITH MOCK EXAM INFO BENTO GRIDS */
              <div id="welcome-intro-screen" className="max-w-2xl mx-auto py-8">
                <div className="text-center mb-8 flex flex-col items-center">
                  <div className="w-14 h-14 bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300 rounded-2xl flex items-center justify-center text-slate-500 shadow-xs mb-3 text-2xl">
                    ✏️
                  </div>
                  <h3 id="intro-screen-title" className="text-xl font-bold text-slate-800 mb-1">
                    Welcome to ExamLogic AI Prep Platform
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md">
                    A specialized exam generation and curriculum logic alignment engine for CFA & FRM candidates.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="p-5 bg-white border border-slate-200 rounded-xl relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <h4 className="font-bold text-sm text-slate-800">CFA Curriculum & Cognitive Outline</h4>
                    </div>
                    <ul className="text-xs text-slate-500 space-y-2 leading-relaxed">
                      <li>• <b>Level I:</b> Emphasizes theoretical concepts, basic valuation, financial statement analysis, and ethical standards.</li>
                      <li>• <b>Level II:</b> Emphasizes equity and fixed income valuation models, and complex financial reporting.</li>
                      <li>• <b>Level III:</b> Focuses on Portfolio Management, IPS (Individual/Institutional), and Asset Allocation.</li>
                    </ul>
                  </div>

                  <div className="p-5 bg-white border border-slate-200 rounded-xl relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <h4 className="font-bold text-sm text-slate-800">FRM Quantitative Risk Outline</h4>
                    </div>
                    <ul className="text-xs text-slate-500 space-y-2 leading-relaxed">
                      <li>• <b>Part I:</b> Covers Foundations of Risk Management, Quantitative Analysis, Financial Markets & Products, and Valuation Models.</li>
                      <li>• <b>Part II:</b> Covers Market Risk, Credit Risk, Operational Risk, Liquidity Risk, and current regulatory issues.</li>
                    </ul>
                  </div>

                  <div className="md:col-span-2 p-5 bg-blue-50/50 border border-blue-200/50 rounded-xl flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-sm text-blue-900 leading-none mb-1">Quick Start Guide (Trial Mode):</h5>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        You can enter any curriculum keyword on the left (e.g., <b>"FCFF"</b>, <b>"GIPS"</b>, <b>"VaR scaling"</b>, or <b>"Black-Scholes model"</b>) and click generate.
                        <br />
                        If your API key is not configured, simply select <b>"CAPM"</b> or <b>"DuPont"</b> from the High-Yield Demonstrations to practice with cached high-fidelity curriculum sets.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN BOTTOM BAR SUMMARY */}
          {activeSet && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-55 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 shrink-0">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Adapted for CFA/FRM syllabus (Randomized metrics with 100% curriculum formula alignment)</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Progress: <b>{Object.keys(selectedAnswers).length} / {activeSet.questions.length}</b></span>
                {graded && (
                  <span className="text-slate-700 font-bold">
                    Score: <b>{Math.round((activeSet.questions.reduce((acc, q) => {
                      return selectedAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
                    }, 0) / activeSet.questions.length) * 100)}%</b>
                  </span>
                )}
              </div>
            </div>
          )}

        </section>

      </main>

      {/* COMPACT CLEAN FOOTER */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-5 px-6 border-t border-slate-900 flex flex-wrap justify-between items-center gap-4 shrink-0">
        <p>© 2026 ExamLogic AI. Designed for CFA, FRM potential charterholders global training.</p>
        <div className="flex items-center gap-4 text-slate-500">
          <span className="hover:text-slate-300">Curriculum Advisory Panel</span>
          <span>•</span>
          <span className="hover:text-slate-300">GARP/CFA Institute Standard Alignment</span>
        </div>
      </footer>

    </div>
  );
}
