import type { ReactNode } from "react";

/** "Tuesday, 11 November", in the reader's own locale order. */
export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

type PageHeroProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** A line under the subtitle: badges, a description. */
  meta?: ReactNode;
  /** Buttons, top-right on wide screens. */
  actions?: ReactNode;
  /** A decorative drawing beside the title. Hidden on narrow screens. */
  art?: ReactNode;
};

/** The top of a page: today's date, a serif title with a drawn underline, one line of status. */
export function PageHero({ title, subtitle, meta, actions, art }: PageHeroProps) {
  return (
    <header className="hero">
      <div className="hero__text">
        <p className="hero__eyebrow">{todayLabel()}</p>
        <h1 className="hero__title">{title}</h1>
        {subtitle && <p className="hero__subtitle">{subtitle}</p>}
        {meta && <div className="hero__meta">{meta}</div>}
      </div>
      {art && <div className="hero__art">{art}</div>}
      {actions && <div className="hero__actions">{actions}</div>}
    </header>
  );
}
