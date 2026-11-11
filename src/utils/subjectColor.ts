import type { CSSProperties } from "react";

/**
 * Subject colours.
 *
 * A subject's colour is chosen when it's added or edited. Until one is chosen
 * (subjects from before colours existed), one is picked from the palette by
 * the subject's id, so it stays the same on every screen and every visit.
 */

/** Mid-tones that sit well on the cream paper, and read as dots and tints. */
export const SUBJECT_PALETTE: { value: string; name: string }[] = [
  { value: "#3d7a4f", name: "Forest" },
  { value: "#2a8a83", name: "Teal" },
  { value: "#3a7cc0", name: "Sky" },
  { value: "#5b5fc7", name: "Indigo" },
  { value: "#8e4fa3", name: "Plum" },
  { value: "#c24d6e", name: "Rose" },
  { value: "#c2622d", name: "Terracotta" },
  { value: "#c4952b", name: "Ochre" },
  { value: "#7d8a2e", name: "Olive" },
  { value: "#5c6b7a", name: "Slate" },
];

const HEX = /^#[0-9a-f]{6}$/;

export function isSubjectColor(value: string): boolean {
  return HEX.test(value);
}

/** The same palette colour for the same key, every time. */
export function fallbackColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return SUBJECT_PALETTE[Math.abs(hash) % SUBJECT_PALETTE.length].value;
}

/** The colour to show: the chosen one, or the stable fallback. */
export function subjectColor(subject: { id: string; color?: string }): string {
  return subject.color && isSubjectColor(subject.color) ? subject.color : fallbackColor(subject.id);
}

/** For a new subject: the first palette colour no other subject is using. */
export function nextFreeColor(taken: string[]): string {
  const used = new Set(taken);
  return (SUBJECT_PALETTE.find((each) => !used.has(each.value)) ?? SUBJECT_PALETTE[0]).value;
}

/** Inline style setting a CSS custom property, e.g. `--subject`. */
export function cssVar(name: `--${string}`, value: string): CSSProperties {
  return { [name]: value } as CSSProperties;
}
