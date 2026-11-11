/**
 * Line drawings in the style of a pencil sketch. Purely decorative: every one is
 * aria-hidden, and each takes its colours from CSS custom properties so the
 * stylesheet decides how loud they are.
 */

/** Two closed books, one on the other, with a ribbon trailing off the bottom one. */
export function BooksIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 250 120"
      fill="none"
      stroke="var(--sketch-stroke)"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* The ribbon and the line it falls along. */}
      <path d="M78 96c-14 4-22 2-30 8-9 6-22 9-46 7" strokeWidth={1.1} />
      <path d="M60 99c-6 3-8 8-4 10" strokeWidth={1.1} />

      {/* Bottom book: cover, spine, page block. */}
      <path d="M70 70 182 56l58 13-112 16z" fill="var(--sketch-fill)" />
      <path d="M70 70v18l58 16V85z" fill="var(--sketch-fill-deep)" />
      <path d="M128 85v19l112-16V69z" fill="var(--sketch-paper)" />
      <path d="M134 89l100-14M134 94l100-14M134 99l100-14" strokeWidth={0.8} />
      <path d="M76 76l46 13M76 82l46 13" strokeWidth={0.8} />

      {/* Top book, a little smaller and turned. */}
      <path d="M88 44 186 30l46 12-98 15z" fill="var(--sketch-fill)" />
      <path d="M88 44v16l46 13V57z" fill="var(--sketch-fill-deep)" />
      <path d="M134 57v16l98-15V42z" fill="var(--sketch-paper)" />
      <path d="M140 61l86-13M140 66l86-13" strokeWidth={0.8} />
      <path d="M94 50l36 10M94 55l36 10" strokeWidth={0.8} />

      {/* A few hatching strokes on the shadow side. */}
      <path d="M180 58l10 3M196 55l10 3M212 52l10 3" strokeWidth={0.7} />
    </svg>
  );
}

/** A small college building with columns and trees, drawn lightly. */
export function CampusIllustration({ className }: { className?: string }) {
  const columns = [62, 78, 94, 110, 126, 142];
  return (
    <svg
      className={className}
      viewBox="0 0 220 150"
      fill="none"
      stroke="var(--sketch-stroke)"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ground. */}
      <path d="M0 140c40-3 90-2 220-1" />

      {/* Pediment and entablature. */}
      <path d="M48 62 102 34l56 28z" fill="var(--sketch-paper)" />
      <path d="M86 52h32" strokeWidth={0.8} />
      <path d="M44 62h118v8H44z" fill="var(--sketch-paper)" />

      {/* Columns. */}
      {columns.map((x) => (
        <g key={x}>
          <path d={`M${x} 70v52M${x + 7} 70v52`} />
          <path d={`M${x - 2} 70h11M${x - 2} 122h11`} strokeWidth={0.8} />
        </g>
      ))}
      <path d="M52 76h104" strokeWidth={0.6} />

      {/* Steps. */}
      <path d="M40 122h126v6H40zM34 128h138v6H34zM28 134h150v6" fill="var(--sketch-paper)" />

      {/* Wing with windows. */}
      <path d="M162 84h44v50h-44" />
      <path d="M170 92h8v12h-8zM188 92h8v12h-8zM170 112h8v12h-8zM188 112h8v12h-8z" strokeWidth={0.8} />

      {/* Trees. */}
      <path d="M14 140v-18" />
      <path d="M14 122c-12 0-14-14-6-18-2-10 10-14 14-8 8-2 12 8 6 12 6 6 0 14-8 14z" fill="var(--sketch-fill)" />
      <path d="M204 140v-14" />
      <path d="M204 126c-9 0-11-10-4-13-1-8 8-10 11-5 6-1 8 6 4 9 4 5 0 9-11 9z" fill="var(--sketch-fill)" />
    </svg>
  );
}
