import type { ReactNode } from "react";

/** A centred card for loading and dead-end states outside the app layout. */
export function FullPageStatus({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="auth-page" role="status">
      <div className="auth-card auth-card--notice">
        <p className="auth-card__title">{title}</p>
        {children}
      </div>
    </div>
  );
}
