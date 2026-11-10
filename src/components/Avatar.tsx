/** A round initial for a person, tinted by their name so people are easy to tell apart. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <span className={`avatar avatar--${size} avatar--tone-${hue(name)}`} aria-hidden="true">
      {letter}
    </span>
  );
}

function hue(name: string): number {
  let sum = 0;
  for (const char of name) sum = (sum + char.charCodeAt(0)) % 6;
  return sum;
}
