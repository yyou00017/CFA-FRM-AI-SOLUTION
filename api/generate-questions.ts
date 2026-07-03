import { GoogleGenAI, Type } from "@google/genai";

const VALID_DIMENSIONS = [
  "Concept_Mastery",
  "Calculation",
  "Sensitivity_Analysis",
  "Case_Study",
  "Risk_Management",
  "Reverse_Engineering",
] as const;

const SYSTEM_INSTRUCTION = `
You are an expert CFA and FRM exam-practice item writer.

Generate realistic original practice questions from the user's concept. Do not reproduce official or past exam questions verbatim.

Rules:
- Write all question content, options, explanations, knowledge analysis, and exam logic insight in professional US English.
- CFA questions must have exactly 3 options. FRM questions must have exactly 4 options.
- Do not prefix options with A, B, C, or D.
- Every question must be distinct, with different facts, numbers, and tested angles.
- Return exactly the requested number of questions.
- Each question must include one dimension key from: Concept_Mastery, Calculation, Sensitivity_Analysis, Case_Study, Risk_Management, Reverse_Engineering.
- Explanations must include formulas, assumptions, and why distractors are wrong when relevant.
`;

type GeneratedQuestion = {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  stepByStepSolution: string;
  knowledgeAnalysis: string;
  examLogicInsight: string;
  pointsTested: string;
  difficulty: "Easy" | "Medium" | "Hard";
  dimension?: string;
};

type QualityReport = {
  score: number;
  passed: boolean;
  duplicateRisk: "low" | "medium" | "high";
  issues: string[];
  fingerprints: string[];
  attempts: number;
  guardrails: string[];
};

function clampQuestionCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.floor(parsed)));
}

function normalizeDimension(value: unknown) {
  if (typeof value !== "string") return undefined;
  return VALID_DIMENSIONS.includes(value as any) ? value : undefined;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.%$ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 3));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => {
    if (b.has(token)) overlap += 1;
  });
  return overlap / (a.size + b.size - overlap);
}

function compactFingerprint(question: GeneratedQuestion) {
  const numbers = question.text.match(/(?:\$?\d+(?:\.\d+)?%?)/g)?.slice(0, 6).join("|") || "no-numbers";
  return normalizeText(`${question.dimension || "Core"} ${question.pointsTested} ${question.difficulty} ${numbers}`).slice(0, 220);
}

function parseHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as any;
        return [record.text, record.pointsTested, record.fingerprint, record.conceptInput].filter(Boolean).join(" ");
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 40);
}

function optionCountFor(examType: string) {
  return examType === "FRM" ? 4 : 3;
}

function validateQuestion(question: any, examType: string, selectedDimension?: string): GeneratedQuestion | null {
  const optionCount = optionCountFor(examType);
  if (!question || typeof question !== "object") return null;
  if (typeof question.text !== "string" || question.text.trim().length < 80) return null;
  if (!Array.isArray(question.options) || question.options.length !== optionCount) return null;
  if (!Number.isInteger(question.correctOptionIndex) || question.correctOptionIndex < 0 || question.correctOptionIndex >= optionCount) return null;
  if (typeof question.stepByStepSolution !== "string" || question.stepByStepSolution.trim().length < 80) return null;
  if (typeof question.knowledgeAnalysis !== "string" || question.knowledgeAnalysis.trim().length < 40) return null;
  if (typeof question.examLogicInsight !== "string" || question.examLogicInsight.trim().length < 40) return null;
  if (typeof question.pointsTested !== "string" || !question.pointsTested.trim()) return null;
  if (!["Easy", "Medium", "Hard"].includes(question.difficulty)) return null;
  const dimension = normalizeDimension(question.dimension) || selectedDimension || "Concept_Mastery";
  if (selectedDimension && dimension !== selectedDimension) return null;

  const uniqueOptions = new Set(question.options.map((option: unknown) => normalizeText(String(option || ""))));
  if (uniqueOptions.size !== optionCount) return null;

  return {
    id: typeof question.id === "string" && question.id ? question.id : `q_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    text: question.text.trim(),
    options: question.options.map((option: string) => option.trim()),
    correctOptionIndex: question.correctOptionIndex,
    stepByStepSolution: question.stepByStepSolution.trim(),
    knowledgeAnalysis: question.knowledgeAnalysis.trim(),
    examLogicInsight: question.examLogicInsight.trim(),
    pointsTested: question.pointsTested.trim(),
    difficulty: question.difficulty,
    dimension,
  };
}

function scoreQuestionQuality(question: GeneratedQuestion, peers: GeneratedQuestion[], history: string[], examType: string) {
  const issues: string[] = [];
  let score = 100;
  const textTokens = tokens(`${question.text} ${question.pointsTested}`);
  const historySimilarity = Math.max(0, ...history.map((item) => jaccard(textTokens, tokens(item))));
  const peerSimilarity = Math.max(0, ...peers.filter((peer) => peer.id !== question.id).map((peer) => jaccard(textTokens, tokens(`${peer.text} ${peer.pointsTested}`))));
  const duplicateScore = Math.max(historySimilarity, peerSimilarity);

  if (duplicateScore > 0.72) {
    issues.push("High semantic overlap with existing or peer question.");
    score -= 35;
  } else if (duplicateScore > 0.52) {
    issues.push("Medium similarity; accepted only if other quality signals are strong.");
    score -= 16;
  }

  if (question.text.length < 120) {
    issues.push("Question stem is too short for professional exam style.");
    score -= 12;
  }
  if (question.stepByStepSolution.length < 160) {
    issues.push("Solution lacks detailed step-by-step reasoning.");
    score -= 14;
  }
  if (!/[0-9]/.test(question.text) && question.dimension === "Calculation") {
    issues.push("Calculation question lacks numerical inputs.");
    score -= 18;
  }
  if (!/(because|therefore|distractor|incorrect|trap|assumption|formula|step)/i.test(question.stepByStepSolution + " " + question.examLogicInsight)) {
    issues.push("Explanation does not clearly address reasoning or distractors.");
    score -= 10;
  }
  if (question.options.length !== optionCountFor(examType)) {
    issues.push("Incorrect number of answer options.");
    score -= 30;
  }

  const duplicateRisk = duplicateScore > 0.72 ? "high" : duplicateScore > 0.52 ? "medium" : "low";
  return { score: Math.max(0, Math.min(100, score)), duplicateRisk, issues };
}

function applyQualityControl(questions: any[], examType: string, count: number, selectedDimension: string | undefined, history: string[], attempts: number): { questions: GeneratedQuestion[]; quality: QualityReport } {
  const validated = questions
    .map((question) => validateQuestion(question, examType, selectedDimension))
    .filter(Boolean) as GeneratedQuestion[];

  const reports = validated.map((question) => scoreQuestionQuality(question, validated, history, examType));
  const accepted = validated
    .map((question, index) => ({ question, report: reports[index] }))
    .filter(({ report }) => report.score >= 78 && report.duplicateRisk !== "high")
    .sort((a, b) => b.report.score - a.report.score)
    .slice(0, count);

  const selected = accepted.length >= count ? accepted : validated.map((question, index) => ({ question, report: reports[index] })).sort((a, b) => b.report.score - a.report.score).slice(0, count);
  const avgScore = selected.length ? Math.round(selected.reduce((sum, item) => sum + item.report.score, 0) / selected.length) : 0;
  const issues = Array.from(new Set(selected.flatMap((item) => item.report.issues))).slice(0, 8);
  const duplicateRisk = selected.some((item) => item.report.duplicateRisk === "high") ? "high" : selected.some((item) => item.report.duplicateRisk === "medium") ? "medium" : "low";

  return {
    questions: selected.map((item) => item.question),
    quality: {
      score: avgScore,
      passed: selected.length === count && avgScore >= 78 && duplicateRisk !== "high",
      duplicateRisk,
      issues,
      fingerprints: selected.map((item) => compactFingerprint(item.question)),
      attempts,
      guardrails: [
        "Schema validation",
        "Single-answer validation",
        "Option-count validation",
        "Duplicate fingerprint check",
        "Explanation-depth check",
        "Dimension consistency check",
      ],
    },
  };
}

const MAX_MEMORY_FINGERPRINTS = 80;
const AI_TIMEOUT_MS = Number(process.env.AI_GENERATION_TIMEOUT_MS || 9000);
const MIN_FAST_ACCEPT_SCORE = 72;
const recentFingerprints = new Map<string, string[]>();

function memoryKey(examType: string, level: string, concept: string, selectedDimension?: string) {
  return normalizeText(`${examType} ${level} ${concept} ${selectedDimension || "mixed"}`).slice(0, 180);
}

function getQualityHistory(key: string, providedHistory: string[]) {
  return [...providedHistory, ...(recentFingerprints.get(key) || [])].slice(0, MAX_MEMORY_FINGERPRINTS);
}

function rememberFingerprints(key: string, fingerprints: string[]) {
  const current = recentFingerprints.get(key) || [];
  recentFingerprints.set(key, Array.from(new Set([...fingerprints, ...current])).slice(0, MAX_MEMORY_FINGERPRINTS));
}

function shouldRetryForQuality(controlled: { questions: GeneratedQuestion[]; quality: QualityReport }, count: number) {
  if (!controlled.questions.length) return true;
  if (controlled.questions.length < count) return true;
  if (controlled.quality.duplicateRisk === "high") return true;
  return controlled.quality.score < MIN_FAST_ACCEPT_SCORE;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`AI generation timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function shuffleOptions(options: string[], correctOptionIndex: number) {
  const paired = options.map((text, index) => ({ text, isCorrect: index === correctOptionIndex }));
  for (let i = paired.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [paired[i], paired[j]] = [paired[j], paired[i]];
  }

  return {
    options: paired.map((item) => item.text),
    correctOptionIndex: paired.findIndex((item) => item.isCorrect),
  };
}

function buildFallbackQuestions(
  examType: string,
  level: string,
  concept: string,
  count: number,
  selectedDimension?: string
) {
  const optionCount = examType === "FRM" ? 4 : 3;
  const dimensions = selectedDimension ? [selectedDimension] : [...VALID_DIMENSIONS];
  const cleanConcept = concept.trim();

  return Array.from({ length: count }, (_, index) => {
    const dimension = dimensions[index % dimensions.length];
    const baseId = `fallback_${Date.now()}_${index}`;
    const institution = ["Northstar Capital", "Apex Risk Group", "Meridian Advisory", "Summit Pension Trust", "Bluewater Bank"][index % 5];
    const roles = ["portfolio manager", "risk analyst", "investment committee", "compliance lead", "research director"];
    const settings = [
      "during a quarterly review",
      "while preparing a client memo",
      "after a market volatility shock",
      "before an internal model validation meeting",
      "while reviewing a candidate's mock exam response",
    ];

    let text = "";
    let options: string[] = [];
    let correctOptionIndex = 0;
    let stepByStepSolution = "";
    let knowledgeAnalysis = "";
    let examLogicInsight = "";
    let pointsTested = concept;
    let difficulty: "Easy" | "Medium" | "Hard" = "Medium";

    if (dimension === "Calculation") {
      const sample = 42 + index * 8;
      const exceptions = 3 + index;
      const exceptionRate = exceptions / sample;
      const materiality = 5 + index;
      const answer = exceptionRate * 100;
      text = `${institution} is applying ${cleanConcept} procedures for ${examType} ${level}. In a sample of ${sample} items, the team identifies ${exceptions} control exceptions. Management's tolerance threshold is ${materiality.toFixed(1)}%. Which conclusion is most defensible based on the exception rate?`;
      options = [
        `The exception rate is ${answer.toFixed(1)}%, so the result should be compared with the ${materiality.toFixed(1)}% tolerance threshold before concluding on control reliance.`,
        `The exception rate is ${exceptions.toFixed(1)}%, because the number of exceptions itself is the rate.`,
        `The result is automatically immaterial because the sample contains fewer than ${sample + 20} observations.`,
        `The control is effective as long as at least one tested item did not show an exception.`,
      ].slice(0, optionCount);
      stepByStepSolution = `Compute the exception rate as exceptions divided by sample size: ${exceptions} / ${sample} = ${answer.toFixed(1)}%. The rate must then be evaluated against the stated tolerance threshold of ${materiality.toFixed(1)}%. The distractors confuse a count with a rate, rely on arbitrary sample-size wording, or ignore the need to evaluate exceptions against a threshold.`;
      knowledgeAnalysis = "This tests quantitative interpretation inside an audit-style control evaluation, not just mechanical arithmetic.";
      examLogicInsight = "The exam trap is to treat the number of exceptions as the conclusion. A professional answer ties the calculated rate back to the audit threshold and control reliance decision.";
      pointsTested = `${cleanConcept} exception-rate interpretation`;
    } else if (dimension === "Risk_Management") {
      text = `${institution} is reviewing ${cleanConcept} evidence ${settings[index % settings.length]}. The ${roles[index % roles.length]} notices that the same employee both approves vendor onboarding and releases payments. Which response best addresses the risk?`;
      options = [
        "Treat the issue as a segregation-of-duties weakness and design additional review or approval controls around the payment process.",
        "Ignore the issue if the employee has significant experience with the process.",
        "Assume the financial statements are misstated without performing further procedures.",
        "Reduce documentation because the same employee understands the full workflow.",
      ].slice(0, optionCount);
      stepByStepSolution = "The best response identifies the control weakness and connects it to an appropriate risk response. Segregation of duties matters because one person can initiate and complete a transaction without independent review. The other options rely on experience, premature conclusions, or weaker documentation, none of which mitigates the control risk.";
      knowledgeAnalysis = `${cleanConcept} questions often test whether the candidate can connect evidence to risk response, not merely define a control.`;
      examLogicInsight = "A common exam trap is choosing an extreme answer such as immediately assuming misstatement. Professional audit reasoning usually requires identifying the weakness and adjusting procedures.";
      pointsTested = `${cleanConcept} control-risk response`;
    } else if (dimension === "Sensitivity_Analysis") {
      text = `${institution} is evaluating ${cleanConcept} ${settings[index % settings.length]}. If the assessed control-risk level increases from low to high, which change in planned procedures is most consistent with exam logic?`;
      options = [
        "Increase substantive testing or obtain stronger evidence because reliance on the control environment has decreased.",
        "Decrease substantive testing because a high control-risk assessment provides more comfort.",
        "Keep the same audit plan because control-risk assessment never changes evidence requirements.",
        "Remove analytical procedures because sensitivity to control risk is only relevant in valuation models.",
      ].slice(0, optionCount);
      stepByStepSolution = "When assessed control risk rises, the auditor or reviewer can rely less on controls and typically needs stronger substantive evidence. The incorrect options reverse the risk-evidence relationship, claim the audit plan is insensitive to risk, or misclassify sensitivity analysis as only a valuation topic.";
      knowledgeAnalysis = "This tests how a change in an input assumption affects the evidence strategy and procedure mix.";
      examLogicInsight = "The trap is directional: higher risk does not reduce work. It usually increases the quantity, quality, or directness of evidence required.";
      pointsTested = `${cleanConcept} sensitivity to risk assessment`;
    } else if (dimension === "Case_Study") {
      text = `${institution} is considering whether a revenue-recognition review under ${cleanConcept} is sufficient. The file includes management explanations, unsigned customer confirmations, and a large quarter-end sales spike. Which next step is most appropriate?`;
      options = [
        "Seek more persuasive external evidence around the quarter-end transactions before concluding.",
        "Accept management explanations because they are internally consistent.",
        "Conclude immediately that fraud occurred because sales increased near quarter-end.",
        "Ignore the confirmations because unsigned documents are always stronger than signed external evidence.",
      ].slice(0, optionCount);
      stepByStepSolution = "The evidence set contains a risk indicator: a quarter-end spike. Management explanations and unsigned confirmations may not be sufficient. The best response is to obtain more persuasive evidence. The distractors either over-rely on management, jump to a fraud conclusion without sufficient evidence, or misunderstand evidence reliability.";
      knowledgeAnalysis = "Case-style questions test the hierarchy of evidence, risk indicators, and proportional response.";
      examLogicInsight = "The exam often rewards the answer that escalates evidence quality without making an unsupported final conclusion.";
      pointsTested = `${cleanConcept} evidence reliability case`;
    } else if (dimension === "Reverse_Engineering") {
      text = `${institution} wants to justify a conclusion that ${cleanConcept} procedures support moderate assurance, not high assurance. Which missing condition would most weaken that conclusion?`;
      options = [
        "Key evidence came mostly from internal explanations rather than independent external sources.",
        "The review team documented the procedures performed and the conclusion reached.",
        "The workpaper references the period under review and responsible reviewer.",
        "The sample selection method is described in the file.",
      ].slice(0, optionCount);
      stepByStepSolution = "To reverse-engineer the conclusion, identify what condition would make the stated assurance level harder to defend. Heavy reliance on internal explanations weakens the evidence base. Documentation, date references, and sample-method descriptions generally strengthen rather than weaken support.";
      knowledgeAnalysis = "Reverse-engineering questions ask the candidate to work backward from a conclusion to the assumption that supports or undermines it.";
      examLogicInsight = "A frequent trap is picking a procedural detail that sounds formal. The stronger answer focuses on evidence reliability and independence.";
      pointsTested = `${cleanConcept} conclusion support`;
    } else {
      const conceptStatements = [
        `It requires matching the nature and reliability of evidence to the assessed risk, rather than accepting every source equally.`,
        `It is a structured judgment process in which evidence, controls, and materiality are considered together.`,
        `It should distinguish between a risk indicator and a final conclusion supported by sufficient evidence.`,
        `It requires professional skepticism when evidence comes mainly from interested or internal parties.`,
      ];
      text = `${institution} is evaluating ${cleanConcept} for ${examType} ${level} ${settings[index % settings.length]}. Which statement best reflects the exam-relevant interpretation of this concept?`;
      options = [
        conceptStatements[index % conceptStatements.length],
        "The concept always produces the same conclusion regardless of evidence quality or assessed risk.",
        "The concept eliminates the need for professional judgment once a checklist has been completed.",
        "The concept is valid only when all transactions are identical and no sampling judgment is required.",
      ].slice(0, optionCount);
      stepByStepSolution = "The correct answer preserves the role of judgment, evidence quality, and risk assessment. The other choices use absolute wording or unrealistic conditions, which are rarely correct in professional exam settings.";
      knowledgeAnalysis = "Professional exam questions often test how a framework should be applied in context, not just whether the candidate can recite a definition.";
      examLogicInsight = "Absolute words such as always, only, or eliminates often signal overly broad distractors.";
      pointsTested = `${cleanConcept} conceptual interpretation`;
    }

    const shuffled = shuffleOptions(options, correctOptionIndex);

    return {
      id: baseId,
      text,
      options: shuffled.options,
      correctOptionIndex: shuffled.correctOptionIndex,
      stepByStepSolution,
      knowledgeAnalysis,
      examLogicInsight,
      pointsTested,
      difficulty,
      dimension,
    };
  });
}

function getResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctOptionIndex: { type: Type.INTEGER },
            stepByStepSolution: { type: Type.STRING },
            knowledgeAnalysis: { type: Type.STRING },
            examLogicInsight: { type: Type.STRING },
            pointsTested: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            dimension: { type: Type.STRING },
          },
          required: [
            "id",
            "text",
            "options",
            "correctOptionIndex",
            "stepByStepSolution",
            "knowledgeAnalysis",
            "examLogicInsight",
            "pointsTested",
            "difficulty",
            "dimension",
          ],
        },
      },
    },
    required: ["questions"],
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { examType, level, concept } = req.body || {};
  const count = clampQuestionCount(req.body?.count);
  const dimension = normalizeDimension(req.body?.dimension);

  if (!["CFA", "FRM"].includes(examType) || typeof level !== "string" || typeof concept !== "string" || !concept.trim()) {
    return res.status(400).json({ error: "Please provide examType, level, and a non-empty concept." });
  }

  const historyKey = memoryKey(examType, level, concept.trim(), dimension);
  const providedHistory = parseHistory(req.body?.history || req.body?.recentQuestions || req.body?.seenQuestions);
  const history = getQualityHistory(historyKey, providedHistory);

  const sendControlled = (controlled: { questions: GeneratedQuestion[]; quality: QualityReport }, source: string, notice?: string) => {
    rememberFingerprints(historyKey, controlled.quality.fingerprints);
    return res.status(200).json({
      questions: controlled.questions,
      quality: controlled.quality,
      source,
      ...(notice ? { notice } : {}),
    });
  };

  const fallback = (attempts = 1) => {
    const controlled = applyQualityControl(
      buildFallbackQuestions(examType, level, concept.trim(), count, dimension),
      examType,
      count,
      dimension,
      history,
      attempts
    );

    return sendControlled(
      controlled,
      "local-backup",
      "Generated by the built-in backup engine because the AI request was unavailable or did not pass quality checks."
    );
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const optionCount = examType === "FRM" ? 4 : 3;
    const candidateCount = Math.min(6, count + 2);
    const dimensionDirective = dimension
      ? `Every question must use this exact cognitive dimension: ${dimension}.`
      : "Distribute questions across different cognitive dimensions where possible.";

    let bestControlled: { questions: GeneratedQuestion[]; quality: QualityReport } | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await withTimeout(
        ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          contents: `Generate exactly ${candidateCount} original ${examType} ${level} practice question candidate(s) about: ${concept.trim()}.
Each question must have exactly ${optionCount} options.
${dimensionDirective}

Quality requirements:
- Use different facts, numbers, assumptions, and testing angles across candidates.
- Avoid semantic overlap with these recent fingerprints:
${history.length ? history.slice(0, 10).map((item, index) => `${index + 1}. ${item.slice(0, 180)}`).join("\n") : "No recent fingerprints provided."}
- Prefer exam-like stems with enough data to solve, one clearly best answer, and explanations that address why distractors are wrong.
- Return only JSON that matches the schema.`,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: attempt === 1 ? 0.25 : 0.38,
            responseMimeType: "application/json",
            responseSchema: getResponseSchema(),
          },
        }),
        AI_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || "{}");
      const controlled = applyQualityControl(
        Array.isArray(parsed.questions) ? parsed.questions : [],
        examType,
        count,
        dimension,
        history,
        attempt
      );

      if (!bestControlled || controlled.quality.score > bestControlled.quality.score) {
        bestControlled = controlled;
      }

      if (controlled.questions.length === count && controlled.quality.passed) {
        return sendControlled(controlled, "gemini-api");
      }

      if (!shouldRetryForQuality(controlled, count)) {
        return sendControlled(
          controlled,
          "gemini-api",
          "Returned without a second AI retry to keep response time fast; quality guard accepted the strongest candidates."
        );
      }
    }

    if (bestControlled?.questions.length) {
      return sendControlled(
        bestControlled,
        "gemini-api",
        bestControlled.quality.passed ? undefined : "The quality guard accepted the strongest available candidates after retry."
      );
    }

    return fallback(2);
  } catch (error: any) {
    console.info("Gemini generation failed; serving fallback questions.", error?.message || error);
    return fallback();
  }
}
