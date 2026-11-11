import { Link } from "react-router-dom";

import { Brand } from "../components/Brand";
import { CheckSquareIcon, ClockIcon, DocumentIcon, PaperclipIcon, PlusIcon, UsersIcon } from "../components/icons";

const FEATURES = [
  {
    icon: UsersIcon,
    title: "Classes you can join",
    text: "Create a class in seconds and share its invite link. Classmates join with one click — no admin needed.",
  },
  {
    icon: DocumentIcon,
    title: "Every assignment in one place",
    text: "Class reps post work with a subject, due date, priority and notes, so nothing gets lost in a group chat.",
  },
  {
    icon: PaperclipIcon,
    title: "Files attached",
    text: "PDFs, slides, docs and images up to 25 MB, visible only to members of the class.",
  },
  {
    icon: CheckSquareIcon,
    title: "Track what you've done",
    text: "Tick work off as you finish it. Your progress is saved to your account and follows you to any device.",
  },
  {
    icon: ClockIcon,
    title: "See what's urgent",
    text: "Overdue, due today and due soon are grouped at the top, so you always know what to do next.",
  },
  {
    icon: PlusIcon,
    title: "Roles that make sense",
    text: "The owner can promote admins to post work, manage subjects and keep the member list tidy.",
  },
];

const STEPS = [
  { title: "Sign up", text: "Make an account with your email or Google." },
  { title: "Create or join", text: "Start a class for your section, or open the invite link your rep shared." },
  { title: "Stay on top", text: "New assignments appear live. Tick them off as you go." },
];

/** The front door for signed-out visitors: what ClassBoard is, and the way in. */
export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing__nav">
        <span className="landing__brand">
          <Brand size={24} />
        </span>
        <nav className="landing__nav-actions" aria-label="Account">
          <Link className="button button--ghost" to="/login">
            Log in
          </Link>
          <Link className="button button--primary" to="/signup">
            Sign up
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing__hero">
          <div className="landing__glow" aria-hidden="true" />
          <p className="landing__eyebrow">Assignments for your whole class</p>
          <h1 className="landing__title">Your class's homework, finally in one place.</h1>
          <p className="landing__lead">
            ClassBoard gives every class its own space. Reps post assignments and files, everyone
            sees what's due, and you tick work off as you finish it.
          </p>
          <div className="landing__cta">
            <Link className="button button--primary button--large" to="/signup">
              Get started — it's free
            </Link>
            <Link className="button button--ghost button--large" to="/login">
              I already have an account
            </Link>
          </div>
        </section>

        <section className="landing__section" aria-labelledby="features-title">
          <h2 className="landing__section-title" id="features-title">
            Everything a class needs, nothing it doesn't
          </h2>
          <ul className="landing__features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="feature">
                <span className="feature__icon">
                  <Icon size={20} />
                </span>
                <h3 className="feature__title">{title}</h3>
                <p className="feature__text">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing__section" aria-labelledby="steps-title">
          <h2 className="landing__section-title" id="steps-title">
            How it works
          </h2>
          <ol className="landing__steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="step">
                <span className="step__number">{index + 1}</span>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__text">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing__final">
          <h2 className="landing__section-title">Ready for your next deadline?</h2>
          <Link className="button button--primary button--large" to="/signup">
            Create your account
          </Link>
        </section>
      </main>

      <footer className="landing__footer">classboard</footer>
    </div>
  );
}
