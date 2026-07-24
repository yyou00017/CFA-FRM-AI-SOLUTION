import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { ExamType } from "./types";

type ProgrammePageProps = {
  programme: ExamType;
  onPreview: () => void;
  accessPanel: ReactNode;
};

const PROGRAMMES = {
  [ExamType.CFA]: {
    code: "CFA",
    utility: "Investment analysis programme",
    eyebrow: "CFA examination preparation · Levels I, II and III",
    title: "Develop investment judgment across all three CFA levels.",
    introduction:
      "A dedicated preparation route for candidates building from core investment concepts to advanced analysis, portfolio construction and professional judgment.",
    descriptor: "Investment analysis and portfolio management",
    progression: "Learn · Analyse · Integrate",
    stages: [
      {
        index: "Level I",
        title: "Learn and describe",
        text: "Establish command of essential terms, relationships, formulas and ethical standards across the investment curriculum.",
        note: "Foundation knowledge · Multiple-choice practice",
      },
      {
        index: "Level II",
        title: "Analyse and evaluate",
        text: "Work through vignette-based assignments that require valuation, interpretation and defensible analytical conclusions.",
        note: "Applied analysis · Item-set practice",
      },
      {
        index: "Level III",
        title: "Integrate and apply",
        text: "Combine portfolio decisions, client objectives, ethics and written reasoning in complex professional scenarios.",
        note: "Portfolio judgment · Constructed response",
      },
    ],
    curriculumTitle: "An investment curriculum organised for deliberate practice.",
    curriculumIntro:
      "Assignments are separated by level and subject so candidates can strengthen individual decision processes before progressing to mixed work.",
    subjects: [
      ["Ethics & Professional Standards", "Decision frameworks, professional conduct and application of standards."],
      ["Quantitative Methods", "Rates of return, probability, statistics and analytical techniques."],
      ["Financial Statement Analysis", "Reporting quality, accounting choices and analytical interpretation."],
      ["Equity & Fixed Income", "Security analysis, valuation, yield, duration and credit fundamentals."],
      ["Derivatives & Alternatives", "Pricing relationships, risk transfer and portfolio applications."],
      ["Portfolio Management", "Asset allocation, portfolio construction and wealth-planning judgment."],
    ],
    methodTitle: "From a calculation to an investment conclusion.",
    methodSteps: [
      ["Establish", "Identify the governing investment concept and its assumptions."],
      ["Analyse", "Work through valuation, evidence and decision alternatives."],
      ["Explain", "State why the chosen response is defensible and the alternatives are not."],
      ["Integrate", "Connect the result to portfolio objectives and professional standards."],
    ],
    accessTitle: "Open your CFA candidate workspace.",
    accessCopy:
      "Your CFA assignments, level selection, subject record and saved work remain within one dedicated investment-analysis programme.",
    accessBenefits: ["CFA-only curriculum record", "Level-specific assignment archive", "Investment-subject recommendations"],
    previewLabel: "Enter CFA programme preview",
    accent: "cfa",
  },
  [ExamType.FRM]: {
    code: "FRM",
    utility: "Financial risk programme",
    eyebrow: "FRM examination preparation · Parts I and II",
    title: "Turn risk theory into disciplined measurement and action.",
    introduction:
      "A dedicated preparation route for candidates who need to quantify financial risk, challenge model assumptions and apply risk tools in professional decisions.",
    descriptor: "Financial risk measurement and management",
    progression: "Measure · Challenge · Manage",
    stages: [
      {
        index: "Part I",
        title: "Build the risk toolkit",
        text: "Develop the foundations, quantitative techniques, market knowledge and valuation methods used to assess financial risk.",
        note: "Foundations and tools · 100-question format",
      },
      {
        index: "Part II",
        title: "Apply risk management",
        text: "Use the Part I toolkit across market, credit, operational, liquidity, treasury and investment-risk decisions.",
        note: "Applied risk practice · 80-question format",
      },
    ],
    curriculumTitle: "A risk curriculum organised by how institutions make decisions.",
    curriculumIntro:
      "Practice moves from model mechanics to interpretation, limitations, controls and management action—without mixing the programme with investment-analyst preparation.",
    subjects: [
      ["Foundations of Risk Management", "Risk governance, frameworks and the role of the risk function."],
      ["Quantitative Analysis", "Probability, estimation, regression and time-series reasoning."],
      ["Markets & Products", "Forwards, futures, options, swaps and market structure."],
      ["Valuation & Risk Models", "VaR, stress testing, option valuation and model limitations."],
      ["Market & Credit Risk", "Measurement, exposure, migration, default and mitigation decisions."],
      ["Operational, Liquidity & Treasury Risk", "Resilience, funding, liquidity and current market issues."],
    ],
    methodTitle: "From a model output to a risk decision.",
    methodSteps: [
      ["Define", "Identify the exposure, horizon, confidence level and decision context."],
      ["Measure", "Select and apply the appropriate quantitative or valuation method."],
      ["Challenge", "Test assumptions, limitations, sensitivity and model risk."],
      ["Act", "Translate the result into limits, controls, hedging or management action."],
    ],
    accessTitle: "Open your FRM candidate workspace.",
    accessCopy:
      "Your FRM assignments, part selection, risk-domain record and saved work remain within one dedicated risk-management programme.",
    accessBenefits: ["FRM-only risk-domain record", "Part-specific assignment archive", "Risk-management recommendations"],
    previewLabel: "Enter FRM programme preview",
    accent: "frm",
  },
} as const;

export function ProgrammePage({ programme, onPreview, accessPanel }: ProgrammePageProps) {
  const content = PROGRAMMES[programme];

  return (
    <div className={`institution-shell programme-landing programme-${content.accent}`}>
      <div className="utility-bar">
        <div className="page-width utility-inner">
          <span>{content.utility}</span>
          <span className="utility-separator">Independent · Online · Candidate-led</span>
        </div>
      </div>

      <header className="public-header page-width">
        <a className="wordmark" href="/" aria-label="Kensworth Institute of Finance home">
          <span className="wordmark-name">KENSWORTH</span>
          <span className="wordmark-subtitle">Institute of Finance</span>
        </a>
        <nav className="public-nav" aria-label={`${content.code} programme navigation`}>
          <a href="#overview">Programme</a>
          <a href="#curriculum">Curriculum</a>
          <a href="#candidate-access">Candidate Access</a>
          <a className="all-programmes-link" href="/"><ArrowLeft aria-hidden="true" /> All programmes</a>
        </nav>
      </header>

      <main>
        <section className="programme-hero" id="overview">
          <div className="page-width programme-hero-grid">
            <div className="programme-hero-copy">
              <p className="eyebrow">{content.eyebrow}</p>
              <h1>{content.title}</h1>
              <p>{content.introduction}</p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={onPreview}>
                  {content.previewLabel} <ArrowRight aria-hidden="true" />
                </button>
                <a className="text-link" href="#candidate-access">Create a candidate account</a>
              </div>
            </div>

            <aside className="programme-dossier">
              <div className="programme-dossier-code">{content.code}</div>
              <p className="folio">Programme dossier · 2026</p>
              <h2>{programme === ExamType.CFA ? "Investment Programme" : "Risk Programme"}</h2>
              <dl>
                <div><dt>Coverage</dt><dd>{programme === ExamType.CFA ? "Levels I–III" : "Parts I–II"}</dd></div>
                <div><dt>Primary field</dt><dd>{content.descriptor}</dd></div>
                <div><dt>Progression</dt><dd>{content.progression}</dd></div>
                <div><dt>Learning record</dt><dd>Programme-specific</dd></div>
              </dl>
              <p>Independent preparation built around focused assignments, worked rationale and disciplined review.</p>
            </aside>
          </div>
        </section>

        <section className="programme-stages">
          <div className="page-width">
            <div className="programme-section-heading">
              <div>
                <p className="eyebrow">Programme structure</p>
                <h2>{programme === ExamType.CFA ? "Three levels. One analytical progression." : "Two parts. One professional risk discipline."}</h2>
              </div>
              <p>
                Each stage has its own practice format and record. Work completed in this programme is not mixed with the other Kensworth qualification route.
              </p>
            </div>
            <div className={`stage-grid stage-grid-${content.stages.length}`}>
              {content.stages.map((stage) => (
                <article key={stage.index}>
                  <span>{stage.index}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.text}</p>
                  <small>{stage.note}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="programme-curriculum" id="curriculum">
          <div className="page-width programme-curriculum-grid">
            <div className="programme-curriculum-intro">
              <p className="eyebrow">Curriculum focus</p>
              <h2>{content.curriculumTitle}</h2>
              <p>{content.curriculumIntro}</p>
              <button className="text-link" onClick={onPreview}>Review a model assignment <ArrowRight aria-hidden="true" /></button>
            </div>
            <div className="subject-directory">
              {content.subjects.map(([title, text], index) => (
                <article key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                  <ChevronRight aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="programme-method">
          <div className="page-width">
            <div className="programme-method-title">
              <p className="eyebrow">The Kensworth method</p>
              <h2>{content.methodTitle}</h2>
            </div>
            <div className="programme-method-grid">
              {content.methodSteps.map(([title, text], index) => (
                <article key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="access-section programme-access" id="candidate-access">
          <div className="page-width access-grid">
            <div className="access-copy">
              <p className="eyebrow">{content.code} candidate access</p>
              <h2>{content.accessTitle}</h2>
              <p>{content.accessCopy}</p>
              <ul>
                {content.accessBenefits.map((benefit) => <li key={benefit}><Check aria-hidden="true" /> {benefit}</li>)}
              </ul>
            </div>
            {accessPanel}
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="page-width footer-grid">
          <div className="wordmark footer-wordmark">
            <span className="wordmark-name">KENSWORTH</span>
            <span className="wordmark-subtitle">Institute of Finance</span>
          </div>
          <p>
            Kensworth Institute of Finance is an independent examination-preparation provider. CFA and FRM are trademarks of their respective owners; no affiliation is implied.
          </p>
        </div>
      </footer>
    </div>
  );
}
