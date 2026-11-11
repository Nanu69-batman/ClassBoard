import { LeafIcon } from "./icons";

/** The wordmark: the leaf, then the name in the display serif. */
export function Brand({ size = 22 }: { size?: number }) {
  return (
    <span className="brand">
      <LeafIcon size={size} className="brand__mark" />
      <span className="brand__name">Classboard</span>
    </span>
  );
}
