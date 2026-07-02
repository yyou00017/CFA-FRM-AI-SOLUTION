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

function clampQuestionCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.floor(parsed)));
}

function normalizeDimension(value: unknown) {
  if (typeof value !== "string") return undefined;
  return VALID_DIMENSIONS.includes(value as any) ? value : undefined;
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

  const fallback = () =>
    res.status(200).json({
      questions: buildFallbackQuestions(examType, level, concept.trim(), count, dimension),
      source: "local-backup",
      notice: "Generated by the built-in backup engine because the Gemini request was unavailable.",
    });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const optionCount = examType === "FRM" ? 4 : 3;
    const dimensionDirective = dimension
      ? `Every question must use this exact cognitive dimension: ${dimension}.`
      : "Distribute questions across different cognitive dimensions where possible.";

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: `Generate exactly ${count} original ${examType} ${level} practice question(s) about: ${concept.trim()}.
Each question must have exactly ${optionCount} options.
${dimensionDirective}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.25,
        responseMimeType: "application/json",
        responseSchema: getResponseSchema(),
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) return fallback();

    return res.status(200).json({ questions: parsed.questions.slice(0, count), source: "gemini-api" });
  } catch (error: any) {
    console.info("Gemini generation failed; serving fallback questions.", error?.message || error);
    return fallback();
  }
}
