import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized GenAI client to prevent startup crashes if key is omitted initially
let aiClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please populate it in the Secrets panel in AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// System Instructions to shape the character and outputs of the CFA/FRM examiner model
const SYSTEM_INSTRUCTION = `
You are an elite, world-class CFA (Chartered Financial Analyst) and FRM (Financial Risk Manager) exam developer.
Your goal is to generate extremely realistic practice questions based on a user's input knowledge point, concept, or keyword.

CRITICAL DIRECTIVES:
1. NEVER output direct past exam questions or official curriculum questions verbatim.
2. ALWAYS modify the scenario, entity names, numbers, values, and contextual factors.
3. RETAIN THE ABSOLUTE LOGICAL AND MATHEMATICAL STRUCTURE of the real exams. The core formulas, tricky phrasing, multi-step calculation constraints, and testable insights must remain 100% authentic to actual exam levels.
4. LANGUAGE REQUIREMENTS:
   - The question text ('text'), options ('options'), detailed step-by-step solutions ('stepByStepSolution'), knowledge analysis ('knowledgeAnalysis'), and exam logic insight ('examLogicInsight') must be written in professional, high-quality, clear English (US English).
   - DO NOT provide any Chinese translation, headers, or Chinese text anywhere. The entire output must be written solely in professional English.
5. OPTION QUANTITY & FORMATTING RULES:
   - For CFA (Level 1, 2, and 3), you must provide EXACTLY 3 options in the array.
   - For FRM (Part 1 and 2), you must provide EXACTLY 4 options in the array.
   - CRITICAL: DO NOT prefix any option with letter labels (such as 'A. ', 'B. ', 'C. ', 'D. '). The option strings in the JSON array must contain ONLY the content text itself. The platform's frontend automatically prepends letters (A/B/C/D) and handles option shuffling dynamically. If you prepend letters, they will clash with the frontend layout.
6. UNIQUENESS & VARIETY:
   - If you are asked to generate multiple questions (e.g., 3 questions), they MUST be completely distinct and non-repetitive questions.
   - Each question must test a different angle, scenario, or cognitive dimension (e.g., one on conceptual foundation, one on calculation, and one on sensitivity or regulatory risk).
   - NEVER generate duplicate or highly similar questions in the same request. Every question in the returned array must be entirely unique, with different company names, numbers, scenarios, and tested points.
7. EXAM LEVEL SEGREGATION:
   - "CFA Level 1": focuses on basic knowledge, direct formula applications, ethics, micro/macro economics, financial statement analysis, corporate issuers, equity, fixed income, derivatives, alternative investments, and portfolio management.
   - "CFA Level 2": focuses on asset valuation, multi-stage models, complex quantitative modeling, intercorporate investments, pension accounting, lease adjustments, currency swaps, and derivatives pricing.
   - "CFA Level 3": focuses on portfolio management, wealth planning, asset allocation, trading, and asset classes integration.
   - "FRM Part 1": quantitative analysis, regression, foundation of risk, financial markets (futures, options, swaps), and valuation/risk models (VaR, option greeks, bond pricing, convexity).
   - "FRM Part 2": advanced risk management, market risk, credit risk (models, PD, credit derivatives), operational risk (EVT, Basel I-IV), liquidity risk, and current financial regulations.
7. COMPREHENSIVE EXPLANATIONS:
   - The 'stepByStepSolution' should be exhaustive, showing formulas, inputs, calculations steps, and explaining why other incorrect options are incorrect.
   - The 'knowledgeAnalysis' must explain the theoretical backdrop, core assumptions, and key pitfalls.
   - The 'examLogicInsight' must explain the exact logical pattern or "trap" used by examiners in these types of questions.
8. RETURN EXACTLY THE REQUESTED QUANTITY OF HIGH-QUALITY QUESTIONS IN THE ARRAY.
9. COGNITIVE TESTING DIMENSIONS (考核维度):
   Each generated question must align with one of these six professional cognitive testing dimensions. Assign the exact key string to the "dimension" field:
   - "Concept_Mastery" (Concept Mastery): Focuses on conceptual definitions, core theoretical assumptions, framework terminology, or qualitative rules.
   - "Calculation" (Direct Calculation): Direct mathematical calculations using standard curriculum formulas and simple inputs.
   - "Sensitivity_Analysis" (Sensitivity Analysis): Tests how shifts in market conditions, interest rates, correlations, or greeks dynamically impact other portfolios or balance sheet values.
   - "Case_Study" (Case Study / ALM Scenario): Multi-variable matching, immunization, cash flow matching, or asset-liability management scenario analysis.
   - "Risk_Management" (Risk Management & Compliance): High-level risk management policies, capital adequacy ratio calculations (Basel regulations), hedging execution, or institutional actions.
   - "Reverse_Engineering" (Reverse Engineering): Advanced reverse-engineering, where the final target metric (e.g. Duration Gap, Leverage Ratio, or Portfolio Value) is given, and the candidate must solve backward for an implicit starting variable, coupon, yield, or other parameter.
`;

// Local highly targeted backup questions synthesizer for 100% service uptime (SLA) with randomized dynamic variety
function generateBackupQuestions(
  examType: string,
  level: string,
  concept: string,
  count: number,
  selectedDim?: string
) {
  const questions = [];
  const dimsList = [
    "Concept_Mastery",
    "Calculation",
    "Sensitivity_Analysis",
    "Case_Study",
    "Risk_Management",
    "Reverse_Engineering"
  ];

  const shuffledDims = [...dimsList];
  for (let s = shuffledDims.length - 1; s > 0; s--) {
    const r = Math.floor(Math.random() * (s + 1));
    const temp = shuffledDims[s];
    shuffledDims[s] = shuffledDims[r];
    shuffledDims[r] = temp;
  }

  const conceptMasteryIndices = [0, 1, 2];
  for (let s = conceptMasteryIndices.length - 1; s > 0; s--) {
    const r = Math.floor(Math.random() * (s + 1));
    const temp = conceptMasteryIndices[s];
    conceptMasteryIndices[s] = conceptMasteryIndices[r];
    conceptMasteryIndices[r] = temp;
  }

  const calculationIndices = [0, 1];
  for (let s = calculationIndices.length - 1; s > 0; s--) {
    const r = Math.floor(Math.random() * (s + 1));
    const temp = calculationIndices[s];
    calculationIndices[s] = calculationIndices[r];
    calculationIndices[r] = temp;
  }

  const companies = [
    "Aether Wealth Partners", "Apex Risk Advisors", "Zenith Pension Group", 
    "Boreal Quantitative Funds", "Sovereign Asset Corp", "Meridian Trust", 
    "Valiant Capital Management", "Oasis Hedge Fund", "Aegis Investment Committee",
    "Pinnacle Capital", "Meridian Wealth Advisory"
  ];
  const roles = [
    "Senior Analyst", "Portfolio Risk Manager", "Chief Investment Officer", 
    "Asset Allocation Specialist", "Risk Audit Director", "Senior ALM Specialist"
  ];

  for (let i = 0; i < count; i++) {
    const dim = selectedDim || shuffledDims[i % shuffledDims.length];
    const qId = "local_fallback_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 10000);
    const company = companies[(i + Math.floor(Math.random() * companies.length)) % companies.length];
    const role = roles[(i + Math.floor(Math.random() * roles.length)) % roles.length];

    let text = "";
    let options: string[] = [];
    let correctOptionIndex = 0;
    let stepByStepSolution = "";
    let knowledgeAnalysis = "";
    let examLogicInsight = "";
    let pointsTested = "";
    let difficulty = "Medium";

    // Randomize some numerical values for variety
    const spotVal = 100 + (i * 20) + Math.floor(Math.random() * 30);
    const rVal = 3.5 + (i * 0.5) + parseFloat((Math.random() * 0.8).toFixed(2));
    const uVal = 0.5 + (i * 0.3) + parseFloat((Math.random() * 0.5).toFixed(2));
    const tVal = i % 2 === 0 ? 1.0 : 0.5;
    const rateSum = (rVal + uVal) / 100;
    const correctVal = parseFloat((spotVal * (1 + rateSum * tVal)).toFixed(2));

    if (dim === "Concept_Mastery") {
      difficulty = "Medium";
      pointsTested = "Core assumptions and boundary constraints of " + concept;
      
      const qType = conceptMasteryIndices[i % conceptMasteryIndices.length]; // dynamic template selection
      if (qType === 0) {
        text = "An executive investment committee at " + company + " is analyzing the theoretical foundation of " + concept + " in relation to " + examType + " " + level + " guidelines. According to standard academic frameworks, which of the following statements most accurately describes the core assumption or boundary constraint of this concept?";
        options = [
          "The model assumes perfect market efficiency, symmetrical information, and friction-free asset rebalancing.",
          "It assumes idiosyncratic risks cannot be fully diversified, requiring a high systemic risk premium.",
          "It assumes investors are completely irrational and have highly heterogeneous information structures."
        ];
        if (examType === "FRM") {
          options.push("It assumes asset returns are highly fat-tailed and strictly violate any mean-variance frontiers.");
        }
        correctOptionIndex = 0;
        stepByStepSolution = "1. Under the standard academic assumptions for " + concept + ", the market is assumed to be perfectly efficient (Perfect Market Efficiency), information is costless to obtain (Symmetrical Information), and investors are able to rebalance their positions frictionlessly.\n" +
                             "2. Incorrect option analysis: Unsystematic risks can be fully diversified away in the market portfolio, and therefore do not require a systemic risk premium.\n" +
                             "3. Incorrect option analysis: Standard benchmark models assume that investors are rational and have homogeneous expectations and symmetric access to information.";
      } else if (qType === 1) {
        text = "A " + role + " at " + company + " is conducting an empirical critique of " + concept + " under stress conditions for " + examType + " " + level + " compliance. Which of the following is considered the most critical model limitation or vulnerability?";
        options = [
          "It relies on static historical parameter correlations which fail to capture sudden regime shifts during severe liquidity crises.",
          "It completely ignores the time value of money, treating all future payments as equivalent to present values.",
          "It requires all underlying asset positions to be fully liquidated, ignoring continuous trading assumptions."
        ];
        if (examType === "FRM") {
          options.push("It assumes all asset correlations are strictly negative, preventing standard diversification benefits.");
        }
        correctOptionIndex = 0;
        stepByStepSolution = "1. Model limitation is correctly identified: In actual financial crises or high-stress environments, asset parameters (such as volatility and correlations) experience severe structural 'Regime Shifts', causing models based on static historical correlations to fail and underestimate potential extreme losses.\n" +
                             "2. Incorrect option analysis: The model carefully accounts for discount rates and the time value of money.\n" +
                             "3. Incorrect option analysis: The model supports continuous hedging and does not require full immediate liquidation of all asset positions.";
      } else {
        text = "Under the standard " + examType + " " + level + " curriculum, the homogeneous expectations assumption of " + concept + " implies that:";
        options = [
          "All investors analyze the same set of securities and arrive at identical probability distributions of future returns.",
          "Investors have completely differing expectations and trade in segmented, uncorrelated markets.",
          "No investor is rational, and all asset trades are driven exclusively by sentiment or speculative bubbles."
        ];
        if (examType === "FRM") {
          options.push("All asset returns are strictly deterministic, eliminating any need for statistical covariance modeling.");
        }
        correctOptionIndex = 0;
        stepByStepSolution = "1. Standard assumption definition is correct: Homogeneous expectations mean that all investors use the same model and identical information, arriving at the same probability distributions for future returns, variances, and covariances.\n" +
                             "2. Incorrect option analysis: This is the exact opposite of the homogeneous expectation assumption.\n" +
                             "3. Incorrect option analysis: Homogeneous expectations assume investors are rational and do not assume trades are solely driven by sentiment.";
      }

      knowledgeAnalysis = "This question tests the core theoretical boundaries, assumptions, and practical limitations of " + concept + ". All financial pricing and risk models exhibit Model Risk; understanding their idealized assumptions (e.g., symmetric information, normal distribution) vs. real-world friction is key to qualitative exam questions.";
      examLogicInsight = "In qualitative analysis questions, examiners frequently swap qualifiers (e.g., changing 'homogeneous' to 'heterogeneous') or design overly negative or absolute distractors. Focus on logical precision and prudence.";

    } else if (dim === "Calculation") {
      difficulty = "Medium";
      pointsTested = "Quantitative adjusted valuation and carrier pricing under " + concept;
      
      const qType = calculationIndices[i % calculationIndices.length];
      if (qType === 0) {
        const periodEn = tVal === 1.0 ? "1-year" : "6-month (0.5-year)";
        const spotStr = spotVal.toFixed(2);
        const rStr = rVal.toFixed(2);
        const uStr = uVal.toFixed(2);

        text = "A " + role + " at " + company + " is calculating the forward value using the standard curriculum formula for " + concept + " under " + examType + " " + level + ". " +
               "The current spot asset value is $" + spotStr + ", the risk-free rate of interest is " + rStr + "% per annum, and the annualized net holding or carrying cost is estimated at " + uStr + "%. " +
               "Assuming a " + periodEn + " contract period, the theoretically adjusted price of this position is closest to:";

        const optA = "$" + correctVal.toFixed(2);
        const optB = "$" + (correctVal * 1.05).toFixed(2);
        const optC = "$" + (correctVal * 0.95).toFixed(2);
        const optD = "$" + (correctVal * 0.90).toFixed(2);

        options = [optA, optB, optC];
        if (examType === "FRM") {
          options.push(optD);
        }
        correctOptionIndex = 0;

        const rateSumStr = rateSum.toFixed(4);
        const rPlusU = (rVal + uVal).toFixed(2);
        const correctValStr = correctVal.toFixed(2);
        stepByStepSolution = "1. Under the cost-of-carry model for " + concept + ", the forward price formula is: F = S * [1 + (r + u) * T].\n" +
                             "2. Identify parameters: Spot price S = $" + spotStr + "; risk-free rate r = " + rStr + "%; holding cost rate u = " + uStr + "%; contract period T = " + tVal + " years.\n" +
                             "3. Calculate combined rate: r + u = " + rPlusU + "% (or " + rateSumStr + ").\n" +
                             "4. Calculate theoretically adjusted price: F = $" + spotStr + " * [1 + " + rateSumStr + " * " + tVal + "] = $" + correctValStr + ". This matches Option A.";
      } else {
        const rf_val = 3.0 + Math.floor(Math.random() * 3);
        const mrp_val = 5.0 + Math.floor(Math.random() * 3);
        const beta_val = parseFloat((0.8 + Math.random() * 0.7).toFixed(2));
        const correctRet = parseFloat((rf_val + beta_val * mrp_val).toFixed(2));

        const rfStr = rf_val.toFixed(2);
        const marketRetStr = (rf_val + mrp_val).toFixed(2);
        const mrpStr = mrp_val.toFixed(2);
        const betaStr = beta_val.toFixed(2);
        const correctRetStr = correctRet.toFixed(2);

        text = "A " + role + " at " + company + " is performing an asset expected return calculation using the standard framework of " + concept + " in " + examType + " " + level + ". " +
               "The current risk-free rate of return is " + rfStr + "%, the expected return on the market index is " + marketRetStr + "% (implying a market risk premium of " + mrpStr + "%), and the asset's Beta is estimated at " + betaStr + ". The required rate of return is closest to:";

        const optA = correctRetStr + "%";
        const optB = (beta_val * mrp_val).toFixed(2) + "%";
        const optC = ((rf_val + mrp_val) * beta_val).toFixed(2) + "%";
        const optD = (rf_val + mrp_val).toFixed(2) + "%";

        options = [optA, optB, optC];
        if (examType === "FRM") {
          options.push(optD);
        }
        correctOptionIndex = 0;
        stepByStepSolution = "1. Apply the pricing equation: E(R) = Rf + Beta * [E(Rm) - Rf].\n" +
                             "2. Substitute inputs: Rf = " + rfStr + "%, Market Risk Premium = " + mrpStr + "%, Beta = " + betaStr + ".\n" +
                             "3. Calculate required return: E(R) = " + rfStr + "% + " + betaStr + " * " + mrpStr + "% = " + correctRetStr + "%. This matches Option A.";
      }

      knowledgeAnalysis = "The cost of carry and capital asset pricing models are fundamental valuation tools. The cost of carry model is primarily used for pricing forwards and futures, whereas expected return models (like CAPM) generate equity discount rates.";
      examLogicInsight = "A common calculation trap is confusing 'Expected Market Return E(Rm)' with the 'Market Risk Premium (MRP)'. Always verify if the risk premium or the market index return is provided, and make sure time periods are correctly annualized.";

    } else if (dim === "Sensitivity_Analysis") {
      difficulty = "Hard";
      pointsTested = "Macro variable directional sensitivity under " + concept;
      
      const rfShift = 50 + (i * 20) + Math.floor(Math.random() * 20);
      const volShift = 2.0 + (i * 1.2) + parseFloat((Math.random() * 1.5).toFixed(1));
      const volShiftStr = volShift.toFixed(2);

      text = "A " + role + " at " + company + " is monitoring parameter shifts under the " + concept + " framework. " +
             "Specifically, the benchmark risk-free rate increases by " + rfShift + " basis points, while the implied asset volatility increases by " + volShiftStr + "%. " +
             "Under the standard sensitivity rules of " + concept + " in " + examType + " " + level + ", the portfolio's aggregate risk exposure change is best characterized by:";

      options = [
        "The aggregate risk exposure shifts non-linearly, requiring prompt dynamic hedging (such as Delta/Gamma rebalancing) to prevent skewness.",
        "The overall risk exposure remains perfectly balanced because the positive interest rate shift exactly offsets the volatility spike.",
        "The portfolio's risk profile drops linearly, eliminating the need for further option greek monitoring or risk capital charges."
      ];
      if (examType === "FRM") {
        options.push("The aggregate risk exposure increases in linear proportion to the interest rate change alone, independent of volatility.");
      }
      correctOptionIndex = 0;
      stepByStepSolution = "1. Analyze risk transmission: " + concept + " is impacted non-linearly by interest rates (Rho/Duration) and volatility (Vega).\n" +
                           "2. An increase in risk-free rates by " + rfShift + " bps affects opportunity costs, while a " + volShiftStr + "% spike in implied volatility dramatically changes option exposure.\n" +
                           "3. These factors do not combine linearly. Due to convexity (Gamma), asset sensitivities drift asymmetrical, making dynamic rebalancing (such as Delta/Gamma hedging) necessary to reset exposures. Thus, Option A is correct.";
      knowledgeAnalysis = "Sensitivity Analysis tests the joint transmission of first-order sensitivities (Delta, Duration) and second-order sensitivities (Gamma, Convexity) alongside volatility sensitivities (Vega) in actual markets. Asset parameters fluctuate dynamically and non-linearly.";
      examLogicInsight = "Never rely on static, linear addition when analyzing portfolios with option-like features or significant convexity. A classic exam trap is asserting that changes in two parameters will 'perfectly offset' each other.";

    } else if (dim === "Case_Study") {
      difficulty = "Hard";
      pointsTested = "ALM cash flow matching and immunization matching rules under " + concept;
      
      const pvVal = 40 + (i * 20) + Math.floor(Math.random() * 30);
      const durVal = 5.0 + (i * 1.0) + parseFloat((Math.random() * 0.8).toFixed(1));
      const durValStr = durVal.toFixed(1);

      text = "A financial institution is managing its active assets and liabilities matching structure based on " + concept + " at " + company + ". " +
             "The liabilities have a total present value of $" + pvVal + " million and a Macaulay duration of " + durValStr + " years. " +
             "To execute a successful immunization strategy against interest rate curve shifts under " + examType + " " + level + " guidelines, which of the following rules is mandatory?";

      options = [
        "The present value of assets must equal or exceed $" + pvVal + " million, asset Macaulay duration must equal " + durValStr + " years, and the convexity of assets must exceed that of liabilities.",
        "The Macaulay duration of assets must be kept strictly lower than " + durValStr + " years to capture reinvestment income.",
        "The assets must be structured in a zero-coupon format with asset convexity minimized strictly below liability convexity."
      ];
      if (examType === "FRM") {
        options.push("The Macaulay duration of assets must equal exactly " + (durVal * 1.5).toFixed(1) + " years to provide leverage buffers.");
      }
      correctOptionIndex = 0;
      stepByStepSolution = "1. According to the principles of Multiple Liability Immunization under Asset-Liability Management (ALM):\n" +
                           "   - Condition 1: The present value of assets must equal or exceed the present value of liabilities (PV_A >= PV_L = $" + pvVal + "M).\n" +
                           "   - Condition 2: The Macaulay duration of assets must match the Macaulay duration of liabilities (D_A = D_L = " + durValStr + " years).\n" +
                           "   - Condition 3: The convexity of assets must exceed the convexity of liabilities (C_A > C_L) to protect against non-parallel yield curve shifts. Option A is the only correct statement.";
      knowledgeAnalysis = "In Asset-Liability Management (ALM), Immunization is a frequent core concept. It aims to ensure that when yield curves shift (small or non-parallel movements), the growth of asset values outpaces or matches the volatility of liability values.";
      examLogicInsight = "A common trick is stating that 'asset convexity should be less than liability convexity to minimize risk.' In fact, positive convexity acts as a protective buffer for the holder against interest rate changes, so having greater asset convexity is highly desirable.";

    } else if (dim === "Risk_Management") {
      difficulty = "Medium";
      pointsTested = "Regulatory Risk compliance and capital adequacy under " + concept;
      
      const portSize = 100 + (i * 30) + Math.floor(Math.random() * 40);
      const rwVal = i % 2 === 0 ? 100 : 150;
      const rwa = portSize * (rwVal / 100);
      const cet1 = rwa * 0.045;
      const cet1Str = cet1.toFixed(3);
      const rwaStr = rwa.toFixed(2);

      text = "Under Basel III capital frameworks, a bank managed by " + company + " must assess risk-weighted assets when applying " + concept + " to its trading portfolio. " +
             "If the asset size is $" + portSize + " million with a risk-weight of " + rwVal + "%, the standard minimum Tier 1 Common Equity Capital (CET1) specifically required to support this exposure is closest to:";

      options = [
        "$" + cet1Str + " million",
        "$" + (cet1 * 1.333).toFixed(3) + " million",
        "$" + (cet1 * 1.777).toFixed(3) + " million"
      ];
      if (examType === "FRM") {
        options.push("$" + (cet1 * 0.5).toFixed(3) + " million");
      }
      correctOptionIndex = 0;
      stepByStepSolution = "1. Calculate credit Risk-Weighted Assets (RWA) = Exposure * Risk Weight = $" + portSize + "M * " + rwVal + "% = $" + rwaStr + "M.\n" +
                           "2. Under standard Basel III guidelines, the minimum Common Equity Tier 1 (CET1) capital ratio is 4.5% (excluding capital buffers).\n" +
                           "3. Minimum CET1 capital requirement = RWA * 4.5% = $" + rwaStr + "M * 4.5% = $" + cet1Str + " million. Option A is correct.";
      knowledgeAnalysis = "The Basel III Accord outlines core capital metrics for bank solvency and leverage. Remembering the regulatory thresholds—CET1 (4.5%), Tier 1 Capital (6.0%), and Total Capital (8.0%)—is essential for risk compliance questions.";
      examLogicInsight = "Examiners often trick candidates by having them multiply the asset size directly without weighting for risk (RWA), or by using the Tier 1 Capital (6%) or Total Capital (8%) ratio instead of CET1 (4.5%).";

    } else if (dim === "Reverse_Engineering") {
      difficulty = "Hard";
      pointsTested = "Reverse-engineering and dynamic contract hedging under " + concept;
      
      const shares = 80000 + (i * 20000) + Math.floor(Math.random() * 10) * 1000;
      const deltaOption = parseFloat((0.45 + (i * 0.05) + Math.random() * 0.1).toFixed(2));
      const contractsNeeded = Math.round(shares / deltaOption);
      const sharesStr = shares.toLocaleString();
      const deltaOptionStr = deltaOption.toFixed(2);
      const contractsNeededStr = contractsNeeded.toLocaleString();

      text = "An executive risk auditor at " + company + " is investigating a derivative portfolio structured around " + concept + ". " +
             "The reported aggregate delta sensitivity of the portfolio is managed to be perfectly neutral (Portfolio Delta = 0). " +
             "Currently, the portfolio holds a long position of " + sharesStr + " shares of the underlying equity and a short position in call options, where each individual option has a delta of " + deltaOptionStr + ". " +
             "To support this reverse-engineered delta neutrality under " + examType + " " + level + " rules, the implicit number of short option contracts outstanding must be closest to:";

      options = [
        contractsNeededStr + " contracts",
        (Math.round(contractsNeeded * 0.6)).toLocaleString() + " contracts",
        (Math.round(contractsNeeded * 1.5)).toLocaleString() + " contracts"
      ];
      if (examType === "FRM") {
        options.push((Math.round(contractsNeeded * 0.8)).toLocaleString() + " contracts");
      }
      correctOptionIndex = 0;
      stepByStepSolution = "1. Under delta hedging principles, the portfolio delta is: Delta_Total = Delta_Stock * N_Stock + Delta_Option * N_Option = 0.\n" +
                           "2. Given: Long underlying position N_Stock = +" + sharesStr + " (each share has a delta of +1.0); Option Delta = +" + deltaOptionStr + ".\n" +
                           "3. Substitute into formula: (" + shares + " * 1.0) + (N_Option * " + deltaOptionStr + ") = 0.\n" +
                           "4. Solve for option quantity: N_Option = -" + shares + " / " + deltaOptionStr + " = -" + contractsNeededStr + ".\n" +
                           "The negative sign denotes selling options (Short Call) of " + contractsNeededStr + " contracts. Option A is correct.";
      knowledgeAnalysis = "Reverse Engineering requires working backward from target portfolio exposures to find implicit position sizes, which reflects a risk auditor's real-world auditing challenges.";
      examLogicInsight = "Be extremely careful with sign conventions (+ or -) for calls/puts and long/short combinations. A short call has a negative delta contribution, which must be accurately modeled.";
    }

    // Dynamic Option Shuffling to make sure correct answer is not always A!
    const paired = options.map((opt, idx) => ({ text: opt, isCorrect: idx === correctOptionIndex }));
    for (let s = paired.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      const temp = paired[s];
      paired[s] = paired[r];
      paired[r] = temp;
    }
    const shuffledOptions = paired.map(p => p.text);
    const newCorrectIndex = paired.findIndex(p => p.isCorrect);

    questions.push({
      id: qId,
      text,
      options: shuffledOptions,
      correctOptionIndex: newCorrectIndex,
      stepByStepSolution,
      knowledgeAnalysis,
      examLogicInsight,
      pointsTested,
      difficulty,
      dimension: dim
    });
  }

  return questions;
}

// API routes go here FIRST
app.post("/api/generate-questions", async (req, res) => {
  const { examType, level, concept, count = 3, dimension } = req.body;

  if (!examType || !level || !concept) {
    return res.status(400).json({ error: "Missing required fields: examType, level, and concept are mandatory." });
  }

  try {
    const ai = getGenAI();
    
    let dimensionDirective = "";
    if (dimension) {
      dimensionDirective = "CRITICAL: You MUST strictly generate questions belonging to the cognitive dimension: \"" + dimension + "\". Refer to the COGNITIVE TESTING DIMENSIONS list in your system instructions.";
    } else {
      dimensionDirective = "Please distribute the generated questions across different cognitive testing dimensions (e.g., Concept_Mastery, Calculation, Sensitivity_Analysis, Case_Study, Risk_Management, Reverse_Engineering) to keep the practice set diverse, comprehensive, and non-repetitive.";
    }

    const countText = count ? "Please generate exactly " + count + " highly targeted questions." : "Please generate exactly 3 targeted questions.";
    const userPrompt = "Generate a set of realistic practice exam questions for " + examType + " (" + level + ") based on the user's input/concept: \"" + concept + "\".\n" +
                       countText + "\n" +
                       dimensionDirective + "\n" +
                       "Make sure they demonstrate authentic exam logic but have altered scenario facts. Generate them according to the designated English language rules. Specify the matched cognitive testing dimension (\"Concept_Mastery\", \"Calculation\", \"Sensitivity_Analysis\", \"Case_Study\", \"Risk_Management\", \"Reverse_Engineering\") in the \"dimension\" field for each question.";

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "A simple unique string identifier like q1, q2" },
              text: { type: Type.STRING, description: "The full question text strictly in English." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "An array of exactly 3 options for CFA or 4 options for FRM."
              },
              correctOptionIndex: { type: Type.INTEGER, description: "The 0-based index of the correct option." },
              stepByStepSolution: { type: Type.STRING, description: "Detailed math or qualitative calculation steps, explained in English." },
              knowledgeAnalysis: { type: Type.STRING, description: "Core knowledge point theory and pitfalls, explained in English." },
              examLogicInsight: { type: Type.STRING, description: "The specific trap or logic pattern from actual examinations, explained in English." },
              pointsTested: { type: Type.STRING, description: "Name of the core knowledge point tested in English." },
              difficulty: { type: Type.STRING, description: "Difficulty level: 'Easy', 'Medium', or 'Hard'." },
              dimension: { 
                type: Type.STRING, 
                description: "The matched cognitive testing dimension: 'Concept_Mastery', 'Calculation', 'Sensitivity_Analysis', 'Case_Study', 'Risk_Management', or 'Reverse_Engineering'." 
              }
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
              "dimension"
            ]
          }
        }
      },
      required: ["questions"]
    };

    let response;
    
    // Call gemini-3.5-flash with an ultra-short 4.5 seconds timeout to guarantee instant page response and prevent browser "Load failed"
    try {
      console.log("Calling primary model gemini-3.5-flash...");
      
      const primaryCallPromise = ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Primary model gemini-3.5-flash call timed out (4.5s limit exceeded)")), 4500)
      );

      response = await Promise.race([primaryCallPromise, timeoutPromise]) as any;
    } catch (err: any) {
      console.info("Primary model call bypassed/failed, activating local-backup instantly. Details: " + (err.message || err));
      throw err; // Propagate to activate backup generator
    }

    if (!response) {
      throw new Error("No response received from the model.");
    }

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response text generated from Gemini model.");
    }

    const data = JSON.parse(textOutput);
    res.json({ questions: data.questions, source: "gemini-api" });
  } catch (error: any) {
    console.info("Gemini API stream interrupted/failed, serving high-fidelity local backup questions immediately.");
    try {
      const backupQuestions = generateBackupQuestions(examType, level, concept, count, dimension);
      console.info("Successfully generated " + backupQuestions.length + " highly targeted backup questions locally.");
      res.json({ 
        questions: backupQuestions, 
        source: "local-backup",
        notice: "Local dynamic fallback engine activated."
      });
    } catch (fallbackError: any) {
      console.error("Critical fallback engine failure:", fallbackError);
      res.status(500).json({ 
        error: "Failed to generate questions. Backup engine also failed: " + fallbackError.message
      });
    }
  }
});

// Start server
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("CFA & FRM Generator Server running on http://0.0.0.0:" + PORT);
  });
}

startServer();
