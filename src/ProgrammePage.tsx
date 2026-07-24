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
    overviewTitle: "A preparation environment for using the curriculum—not merely covering it.",
    overviewCopy: [
      "The CFA curriculum is broad, but examination performance depends on more than recalling definitions and formulas. Candidates must identify the relevant principle, interpret the information provided and reach a defensible investment conclusion under time pressure.",
      "Kensworth turns individual curriculum points into focused assignments. Each submission is followed by a worked rationale, a curriculum note and an examination-convention review, so practice develops both technical accuracy and analytical judgment.",
    ],
    candidateProfiles: [
      {
        title: "First-time candidates",
        text: "Build disciplined application alongside the core reading programme, one subject and level at a time.",
      },
      {
        title: "Returning candidates",
        text: "Isolate the concepts and question methods that remain insecure instead of repeating an entire question bank.",
      },
      {
        title: "Working professionals",
        text: "Prepare a short, purposeful assignment around the exact curriculum point available in the current study session.",
      },
    ],
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
    advantagesTitle: "Practice designed to reveal how an investment conclusion was reached.",
    advantagesIntro:
      "Kensworth combines candidate-directed practice with a structured academic record. The emphasis stays on the reasoning process behind the answer.",
    advantages: [
      {
        label: "Curriculum-point control",
        title: "Start from the exact concept you need to strengthen.",
        text: "Select a level, enter a precise curriculum point and prepare an assignment around that scope rather than searching through a general bank.",
      },
      {
        label: "Modified-data practice",
        title: "Test the same principle under different information.",
        text: "Reworked figures, assumptions and decision contexts help distinguish genuine understanding from recognition of a familiar question.",
      },
      {
        label: "Six assessment lenses",
        title: "Examine knowledge from more than one direction.",
        text: "Concept mastery, calculations, sensitivity, cases, professional application and reverse problems expose different forms of weakness.",
      },
      {
        label: "Three-part review",
        title: "See the calculation, curriculum meaning and exam convention.",
        text: "Every reviewed question separates the worked rationale from the underlying knowledge and the convention or trap that shaped the item.",
      },
      {
        label: "Dual-axis learning record",
        title: "Measure subjects and methods separately.",
        text: "A candidate may know a subject but struggle with a particular form of assessment. Kensworth records both dimensions instead of reducing progress to one percentage.",
      },
      {
        label: "Recommended next work",
        title: "Turn each result into a practical next assignment.",
        text: "Completed work informs a focused recommendation so the next session begins with a clear subject, assessment focus and assignment length.",
      },
    ],
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
    journey: [
      ["Define the scope", "Choose the CFA level and state the specific curriculum point to be assessed."],
      ["Prepare an assignment", "Select the question format, length and primary assessment focus for the study session."],
      ["Review the reasoning", "Submit responses and examine the worked rationale, curriculum note and examination convention."],
      ["Build the record", "Save the assignment, update subject standing and begin the recommended next work."],
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
    overviewTitle: "A preparation environment for moving from model mechanics to risk decisions.",
    overviewCopy: [
      "FRM candidates must do more than reproduce a formula. Strong performance requires recognising the exposure, choosing an appropriate method, understanding its assumptions and interpreting what the result means for limits, controls or management action.",
      "Kensworth organises practice around that professional sequence. Focused assignments test quantitative execution and model judgment separately, while the review explains both the technical method and the risk-management implication.",
    ],
    candidateProfiles: [
      {
        title: "Part I candidates",
        text: "Strengthen the quantitative toolkit, product knowledge and valuation methods that support later risk decisions.",
      },
      {
        title: "Part II candidates",
        text: "Practise applying models across market, credit, operational, liquidity, treasury and investment-risk settings.",
      },
      {
        title: "Candidates retaking a part",
        text: "Separate model-calculation gaps from interpretation and management-action gaps before the next examination attempt.",
      },
    ],
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
    advantagesTitle: "Practice designed to connect a risk measure with a management response.",
    advantagesIntro:
      "Kensworth gives candidates control over the exposure, method and assessment lens being practised, then records where the reasoning process breaks down.",
    advantages: [
      {
        label: "Risk-topic control",
        title: "Work on the exact model, exposure or risk domain.",
        text: "Choose the FRM part and define a precise scope—from VaR scaling to CDS exposure—without searching through unrelated investment-analysis material.",
      },
      {
        label: "Assumption changes",
        title: "Challenge the model when the conditions change.",
        text: "Modified confidence levels, horizons, correlations, recoveries and market inputs test whether candidates understand when a familiar method still applies.",
      },
      {
        label: "Six assessment lenses",
        title: "Separate mechanics from professional judgment.",
        text: "Concepts, calculations, sensitivity, cases, risk practice and reverse problems reveal whether the weakness lies in method selection, execution or interpretation.",
      },
      {
        label: "Three-part review",
        title: "Connect the calculation to its limitation and implication.",
        text: "The worked rationale explains the method, the curriculum note clarifies the underlying risk principle and the exam convention identifies the likely trap.",
      },
      {
        label: "Dual-axis learning record",
        title: "Track risk domains and assessment methods.",
        text: "Market risk may be secure while sensitivity analysis remains weak. The record keeps those findings distinct and usable.",
      },
      {
        label: "Recommended next work",
        title: "Convert every result into focused remediation.",
        text: "The next assignment is directed toward the weakest relevant risk domain or assessment method rather than a generic daily target.",
      },
    ],
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
    journey: [
      ["Define the scope", "Choose the FRM part and state the model, exposure or risk domain to be assessed."],
      ["Prepare an assignment", "Select the question format, length and primary assessment focus for the study session."],
      ["Review the reasoning", "Submit responses and examine the method, risk principle and examination convention."],
      ["Build the record", "Save the assignment, update risk-domain standing and begin the recommended next work."],
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
          <a href="#advantages">Advantages</a>
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

        <section className="programme-orientation">
          <div className="page-width programme-orientation-grid">
            <div className="programme-orientation-copy">
              <p className="eyebrow">Programme purpose</p>
              <h2>{content.overviewTitle}</h2>
              {content.overviewCopy.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <div className="candidate-profile-list">
              <p className="folio">Who this programme is for</p>
              {content.candidateProfiles.map((profile, index) => (
                <article key={profile.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{profile.title}</h3>
                    <p>{profile.text}</p>
                  </div>
                </article>
              ))}
            </div>
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

        <section className="programme-advantages" id="advantages">
          <div className="page-width">
            <div className="programme-section-heading programme-advantages-heading">
              <div>
                <p className="eyebrow">Why Kensworth</p>
                <h2>{content.advantagesTitle}</h2>
              </div>
              <p>{content.advantagesIntro}</p>
            </div>
            <div className="advantage-grid">
              {content.advantages.map((advantage, index) => (
                <article key={advantage.label}>
                  <div className="advantage-index">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>{advantage.label}</small>
                  </div>
                  <h3>{advantage.title}</h3>
                  <p>{advantage.text}</p>
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

        <section className="programme-journey">
          <div className="page-width programme-journey-grid">
            <div className="programme-journey-title">
              <p className="eyebrow">Candidate journey</p>
              <h2>One study session should produce evidence and a next step.</h2>
              <p>
                The programme turns a chosen curriculum point into an assessed assignment, a reviewed decision process and a durable candidate record.
              </p>
            </div>
            <ol className="programme-journey-list">
              {content.journey.map(([title, text], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
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
