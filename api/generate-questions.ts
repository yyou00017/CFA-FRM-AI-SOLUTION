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

  return Array.from({ length: count }, (_, index) => {
    const dimension = dimensions[index % dimensions.length];
    const baseId = `fallback_${Date.now()}_${index}`;
    const company = ["Northstar Capital", "Apex Risk Group", "Meridian Advisory", "Summit Pension Trust"][index % 4];

    let text = "";
    let options: string[] = [];
    let correctOptionIndex = 0;
    let stepByStepSolution = "";
    let knowledgeAnalysis = "";
    let examLogicInsight = "";
    let pointsTested = concept;
    let difficulty: "Easy" | "Medium" | "Hard" = "Medium";

    if (dimension === "Calculation") {
      const rf = 3.5 + index * 0.3;
      const beta = 0.9 + index * 0.1;
      const premium = 5.2 + index * 0.4;
      const answer = rf + beta * premium;
      text = `${company} is estimating a required return under ${concept} for ${examType} ${level}. The risk-free rate is ${rf.toFixed(1)}%, beta is ${beta.toFixed(2)}, and the expected market risk premium is ${premium.toFixed(1)}%. The required return is closest to:`;
      options = [`${answer.toFixed(2)}%`, `${(beta * premium).toFixed(2)}%`, `${((rf + premium) * beta).toFixed(2)}%`, `${(rf + premium).toFixed(2)}%`].slice(0, optionCount);
      stepByStepSolution = `Use the CAPM form E(R) = Rf + beta x market risk premium. Substitute the inputs: ${rf.toFixed(1)}% + ${beta.toFixed(2)} x ${premium.toFixed(1)}% = ${answer.toFixed(2)}%. The distractors either omit the risk-free rate or multiply beta by the full market return.`;
      knowledgeAnalysis = "This tests whether the candidate distinguishes expected market return from market risk premium and applies the correct required-return structure.";
      examLogicInsight = "A common exam trap is to multiply beta by the total market return rather than only by the market risk premium.";
      pointsTested = "Required return calculation";
    } else if (dimension === "Risk_Management") {
      const exposure = 120 + index * 25;
      const weight = index % 2 === 0 ? 100 : 150;
      const rwa = exposure * (weight / 100);
      const capital = rwa * 0.045;
      text = `${company} is reviewing a Basel-style capital requirement connected with ${concept}. An exposure of $${exposure} million has a ${weight}% risk weight. The minimum CET1 capital before buffers is closest to:`;
      options = [`$${capital.toFixed(2)} million`, `$${(rwa * 0.06).toFixed(2)} million`, `$${(rwa * 0.08).toFixed(2)} million`, `$${(exposure * 0.045).toFixed(2)} million`].slice(0, optionCount);
      stepByStepSolution = `First calculate RWA: $${exposure} million x ${weight}% = $${rwa.toFixed(2)} million. Minimum CET1 before buffers is 4.5%, so required CET1 is $${rwa.toFixed(2)} million x 4.5% = $${capital.toFixed(2)} million.`;
      knowledgeAnalysis = "The key is separating exposure size from risk-weighted assets before applying regulatory capital ratios.";
      examLogicInsight = "Distractors usually apply the wrong capital ratio or skip the risk-weighting step.";
      pointsTested = "Risk-weighted assets and CET1 capital";
    } else {
      text = `${company} is evaluating ${concept} for ${examType} ${level}. Which statement best reflects the exam-relevant interpretation of this concept?`;
      options = [
        "The concept should be applied with attention to assumptions, measurement limits, and the economic meaning of each input.",
        "The concept always produces the same answer regardless of market conditions or model assumptions.",
        "The concept is valid only when all assets have identical returns and zero volatility.",
        "The concept eliminates the need for professional judgment in risk assessment.",
      ].slice(0, optionCount);
      stepByStepSolution = "The correct answer is the statement that preserves the role of assumptions, model limits, and economic interpretation. The other choices use absolute wording or unrealistic market conditions, which are rarely valid in CFA or FRM contexts.";
      knowledgeAnalysis = "Professional exam questions often test how a framework should be used, not just whether the candidate can recite a definition.";
      examLogicInsight = "Absolute words such as always, only, or eliminates often signal overly broad distractors.";
      pointsTested = "Conceptual interpretation and model assumptions";
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
    const candidateCount = Math.min(8, count + 3);
    const dimensionDirective = dimension
      ? `Every question must use this exact cognitive dimension: ${dimension}.`
      : "Distribute questions across different cognitive dimensions where possible.";

    let bestControlled: { questions: GeneratedQuestion[]; quality: QualityReport } | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: `Generate exactly ${candidateCount} original ${examType} ${level} practice question candidate(s) about: ${concept.trim()}.
Each question must have exactly ${optionCount} options.
${dimensionDirective}

Quality requirements:
- Use different facts, numbers, assumptions, and testing angles across candidates.
- Avoid semantic overlap with these recent fingerprints:
${history.length ? history.slice(0, 16).map((item, index) => `${index + 1}. ${item.slice(0, 240)}`).join("\n") : "No recent fingerprints provided."}
- Prefer exam-like stems with enough data to solve, one clearly best answer, and explanations that address why distractors are wrong.
- Return only JSON that matches the schema.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: attempt === 1 ? 0.25 : 0.38,
          responseMimeType: "application/json",
          responseSchema: getResponseSchema(),
        },
      });

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
