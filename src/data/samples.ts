import { ExamType, Question, PracticeSet } from "../types";

export const SAMPLE_TOPICS = [
  {
    examType: ExamType.CFA,
    level: "Level_1",
    label: "CAPM (Capital Asset Pricing Model)",
    concept: "CAPM required rate of return with semi-annual inflation adjustment"
  },
  {
    examType: ExamType.CFA,
    level: "Level_1",
    label: "DuPont Analysis (3-stage)",
    concept: "Decomposing ROE using profit margin, asset turnover, and leverage multiplier"
  },
  {
    examType: ExamType.CFA,
    level: "Level_2",
    label: "Free Cash Flow to Firm (FCFF)",
    concept: "Calculating FCFF starting from Net Income with lease adjustments and key capital additions"
  },
  {
    examType: ExamType.FRM,
    level: "Part_1",
    label: "Value at Risk (VaR) Scaling",
    concept: "Scaling 1-day 95% Parametric VaR to 10-day 99% VaR assuming autocorrelated returns"
  },
  {
    examType: ExamType.FRM,
    level: "Part_2",
    label: "Credit Default Swap (CDS) Valuation",
    concept: "Expected payout under single-name CDS after credit event with varying recovery rates"
  }
];

export const STATIC_SAMPLE_PRACTICES: { [key: string]: PracticeSet } = {
  "CFA_Level_1_CAPM (Capital Asset Pricing Model)": {
    id: "sample_cfa_1",
    examType: ExamType.CFA,
    subLevel: "Level_1",
    conceptInput: "CAPM required rate of return with inflation adjustment",
    generatedAt: new Date().toLocaleDateString(),
    questions: [
      {
        id: "q1",
        text: "An analyst is evaluating a common stock with a beta of 1.25. The risk-free rate of return is 3.5%, and the expected return on the market portfolio is 9.0%. Due to recent geopolitical tensions, the expected inflation rate increases by 100 basis points. If the market risk premium remains constant, the newly adjusted expected rate of return for the stock is closest to:",
        options: [
          "11.38%",
          "10.38%",
          "12.25%"
        ],
        correctOptionIndex: 0,
        stepByStepSolution: "1. Identify initial parameters: Risk-free rate (Rf) = 3.5%; Market portfolio return (Rm) = 9.0%; Beta (β) = 1.25.\n2. Calculate the initial Market Risk Premium (MRP) = Rm - Rf = 9.0% - 3.5% = 5.5%.\n3. When inflation expectation increases by 100 basis points (1.0%), the risk-free rate (which incorporates inflation compensation) increases by 1.0% to: New risk-free rate Rf' = 3.5% + 1.0% = 4.5%.\n4. The question specifies that the Market Risk Premium (Rm - Rf) remains constant, so MRP is still 5.5% (meaning the expected market return Rm' has also increased to 4.5% + 5.5% = 10.0%).\n5. Apply the CAPM model to calculate the new expected return: E(R) = Rf' + β * MRP = 4.5% + 1.25 * 5.5% = 4.5% + 6.875% = 11.375%, which is closest to 11.38%.",
        knowledgeAnalysis: "This question focuses on how the Capital Asset Pricing Model (CAPM) reacts in an inflationary environment. An increase in inflation results in a one-for-one increase in the nominal risk-free rate (Rf). When the market risk premium (MRP) is held constant, the change in the expected rate of return comes directly from the shift in Rf. Candidates who incorrectly adjust both Rf and Rm while widening the MRP or assume that inflation does not shift the baseline return line will fall into this trap.",
        examLogicInsight: "A frequent CFA Level 1 trap is distinguishing between a shift in the market return (Rm) and a shift in the market risk premium (Rm - Rf). When inflation changes, the nominal risk-free rate adjusts first. If the MRP is constant, the multiplier for Beta is unchanged, meaning the entire Security Market Line (SML) shifts upward parallel by 1.0%.",
        pointsTested: "CAPM SML Shift (Impact of Inflation on SML)",
        difficulty: "Medium"
      },
      {
        id: "q2",
        text: "Which of the following statements best describes the risk premium on an asset according to Capital Asset Pricing Model (CAPM) assumptions?",
        options: [
          "The risk premium is determined entirely by the asset's total risk, measured by standard deviation.",
          "The risk premium is proportional only to the systematic risk of the asset, represented by its beta coefficient.",
          "The risk premium increases linearly as idiosyncratic risk increases, to compensate the investor for non-diversification."
        ],
        correctOptionIndex: 1,
        stepByStepSolution: "1. Statement 1 is incorrect: CAPM assumes investors can eliminate unsystematic risk through diversification, so the market does not reward unsystematic risk (standard deviation does not determine risk premium).\n2. Statement 2 is correct: Under the CAPM framework, the expected risk premium on an asset (E(Ri) - Rf) is proportional only to its systematic risk, represented by its Beta coefficient: E(Ri) - Rf = βi * (E(Rm) - Rf).\n3. Statement 3 is incorrect: Idiosyncratic/unsystematic risk can be fully diversified away by holding the market portfolio, hence it receives no risk premium compensation.",
        knowledgeAnalysis: "A core conclusion of Modern Portfolio Theory (MPT) and CAPM is that 'the market does not pay for unsystematic risk.' Asset risk is divided into systematic risk (market risk/undiverisifiable risk) and unsystematic risk (unique risk/idiosyncratic risk). Since adding assets can reduce unsystematic risk to zero, rational investors will not demand compensation for this volatility. Therefore, the sole pricing factor is exposure to systematic risk (Beta).",
        examLogicInsight: "Conceptual questions make up almost half of the CFA Level 1 exam. Examiners often swap 'systematic/unsystematic risk' with 'standard deviation/Beta' to confuse candidates. Keep in mind: the Security Market Line (SML) measures systematic risk (using Beta), while the Capital Market Line (CML) measures total risk (using standard deviation).",
        pointsTested: "Systematic vs. Unsystematic Risk Pricing",
        difficulty: "Easy"
      }
    ]
  },
  "CFA_Level_1_DuPont Analysis (3-stage)": {
    id: "sample_cfa_2",
    examType: ExamType.CFA,
    subLevel: "Level_1",
    conceptInput: "DuPont Decomposing ROE using profit margin, asset turnover, and leverage multiplier",
    generatedAt: new Date().toLocaleDateString(),
    questions: [
      {
        id: "q_dupont_1",
        text: "A pharmaceutical company reports the following financial metrics for the current fiscal year:\n- Profit Margin (Net Income / Sales): 8.5%\n- Total Asset Turnover (Sales / Average Assets): 1.40\n- Equity Multiplier (Average Assets / Average Equity): 1.85\n\nIf the company's competitor has an ROE of 24.50% achieved with an Equity Multiplier of 2.20, an Asset Turnover of 1.10, and a Net Profit Margin of 10.12%, which of the following is the most accurate conclusion regarding the first firm's financial efficiency?",
        options: [
          "The first firm has a higher return on equity (ROE) due to superior operating efficiency.",
          "The competitor achieves a higher ROE, primarily driven by higher leverage and better pricing power.",
          "The first firm demonstrates stronger asset utilization, offsetting its lower financial leverage and lower margin."
        ],
        correctOptionIndex: 1,
        stepByStepSolution: "1. First, calculate the 3-stage DuPont ROE for the first company:\n   ROE = Net Profit Margin * Asset Turnover * Equity Multiplier\n   ROE = 8.5% * 1.40 * 1.85 = 11.9% * 1.85 = 22.015%\n2. Competitor's ROE metrics:\n   ROE = 10.12% * 1.10 * 2.20 = 11.132% * 2.20 = 24.49% (approximately 24.50%)\n3. Compare the drivers of ROE for both companies:\n   - Operating Efficiency (Net Profit Margin): First firm (8.5%) < Competitor (10.12%). The competitor has better pricing power.\n   - Asset Utilization (Asset Turnover): First firm (1.40) > Competitor (1.10). The first firm utilizes assets more efficiently.\n   - Leverage (Equity Multiplier): First firm (1.85) < Competitor (2.20). The competitor is highly leveraged.\n4. Analyze options:\n   - Option 1 is incorrect: The first firm has an ROE of 22.015%, which is lower than the competitor's 24.50%, and its operating efficiency is lower.\n   - Option 2 is correct: The competitor achieves a higher ROE, primarily driven by higher leverage (2.20 vs 1.85) and stronger pricing power/profit margin (10.12% vs 8.5%).\n   - Option 3 is incorrect: Although the first firm has superior asset utilization (1.40 vs 1.10), this does not fully offset the drag from lower leverage and profit margin, resulting in a lower overall ROE.",
        knowledgeAnalysis: "The 3-stage DuPont model decomposes the Return on Equity (ROE) into: ROE = Net Profit Margin * Asset Turnover * Equity Multiplier. These three components represent operating efficiency, asset utilization efficiency, and financial leverage. Decomposing ROE allows investors to understand whether a company generates returns through high pricing margins, rapid asset turnover, or high debt leverage.",
        examLogicInsight: "CFA exam questions rarely ask you to just compute a single number. Instead, they provide data for two companies or two years, requiring you to decompose the ROE and identify the operational or financial drivers of change. This question perfectly aligns with that core analytical skill.",
        pointsTested: "3-stage DuPont Analysis and Comparative Analysis",
        difficulty: "Medium"
      }
    ]
  },
  "FRM_Part_1_Value at Risk (VaR) Scaling": {
    id: "sample_frm_1",
    examType: ExamType.FRM,
    subLevel: "Part_1",
    conceptInput: "Scaling 1-day 95% Parametric VaR to 10-day 99% VaR assuming autocorrelated returns",
    generatedAt: new Date().toLocaleDateString(),
    questions: [
      {
        id: "q_var_1",
        text: "A risk manager calculates the 1-day Value at Risk (VaR) of a portfolio at the 95% confidence level to be $2,500,000, assuming daily price returns are normally distributed and independent. However, further econometric testing reveals that the daily returns exhibit a first-order positive autocorrelation coefficient (ρ) of 0.15. If the risk manager wants to scale this VaR estimate to a 10-day 99% VaR, while correctly adjusting for the autocorrelation, the scaled VaR is closest to:",
        options: [
          "$12,987,550",
          "$15,116,400",
          "$7,905,690",
          "$11,180,300"
        ],
        correctOptionIndex: 0,
        stepByStepSolution: "1. Find the standard Z-score for a 95% confidence level (single tail): Z_0.95 = 1.645.\n   Daily VaR = Z_0.95 * σ_d = 1.645 * σ_d = $2,500,000.\n   Calculate daily standard deviation σ_d = 2,500,000 / 1.645 = $1,519,756.84.\n2. For 99% confidence, the standard Z-score is Z_0.99 = 2.326.\n   Without time scaling, the 1-day 99% VaR = Z_0.99 * σ_d = 2.326 * 1,519,756.84 = $3,534,954.34.\n3. Under standard IID assumptions, the 10-day VaR scales with the square root of time: σ_10d = σ_d * √10.\n   But with first-order autocorrelation ρ = 0.15, the multi-day variance scaling factor is modified to:\n   Variance Scale Factor = T + 2 * ∑_{i=1}^{T-1} (T-i) * ρ^i.\n   For T = 10, utilizing the first-order approximation: Scale Factor = 10 + 2 * (10 - 1) * 0.15 = 10 + 18 * 0.15 = 12.7.\n   Therefore, the 10-day adjusted standard deviation: σ_10d_adjusted = σ_d * √12.7 = 1,519,756.84 * 3.5637 = $5,415,960.33.\n4. Calculate the adjusted 10-day 99% VaR:\n   VaR_10d_99%_adjusted = Z_0.99 * σ_10d_adjusted = 2.326 * $5,415,960.33 = $12,597,523.\n   (Using the full exact AR(1) multi-period scaling factor yields a value closest to A).\n5. Compare options:\n   If the simple square root of time rule is used without autocorrelation: VaR_10d_99% = 3,534,954.34 * √10 = $11,178,000 (which is close to D, showing the outcome without autocorrelation). Positive autocorrelation accumulates risk (momentum), resulting in a much higher VaR. Option A is the correct adjusted estimate.",
        knowledgeAnalysis: "This question touches on classic FRM Part 1 quant topics:\n- 1. Converting VaR across different confidence levels (95% to 99%) by adjusting the Z-score.\n- 2. The square root of time scaling rule assumes returns are independent and identically distributed (IID).\n- 3. In the presence of positive autocorrelation (ρ > 0), simple square root scaling underestimates risk. Since yesterday's loss tends to spill over into today, risk aggregates non-linearly, requiring an autocorrelation adjustment factor.",
        examLogicInsight: "A classic FRM trap is 'Time Scaling'. Applying the simple square root of time rule only works if returns are uncorrelated. If 'first-order autocorrelation ρ' is provided, you must apply the variance multiplier. Remember to take the square root of the variance scale factor before multiplying by the Z-score and standard deviation.",
        pointsTested: "VaR Time Scaling with Autocorrelation and Confidence level adjustment",
        difficulty: "Hard"
      }
    ]
  }
};
