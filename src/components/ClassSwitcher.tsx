import type { ClassInfo } from "../data/types";

import { ChevronIcon } from "./icons";

type ClassSwitcherProps = {
  classes: ClassInfo[];
  selectedId: string | null;
  onSelect: (classId: string) => void;
  disabled?: boolean;
};

/**
 * The class switcher, in the top bar (§25).
 *
 * A native `<select>`, not a custom listbox. It behaves correctly on a phone,
 * with a screen reader and with a keyboard, for free — and a class is a short
 * list where the trade does not pay for custom behaviour.
 *
 * Only active classes are ever offered. A deactivated class is not listed, so a
 * student cannot switch into an empty dashboard; if they arrived by a link that
 * has since gone inactive, the dashboard says so instead of showing nothing.
 */
export function ClassSwitcher({
  classes,
  selectedId,
  onSelect,
  disabled = false,
}: ClassSwitcherProps) {
  if (classes.length === 0) return null;

  return (
    <div className="class-switcher">
      <label className="sr-only" htmlFor="class-switcher">
        Class
      </label>
      <div className="class-switcher__control">
        <select
          id="class-switcher"
          className="class-switcher__select"
          value={selectedId ?? ""}
          disabled={disabled || selectedId === null}
          onChange={(event) => onSelect(event.target.value)}
        >
          {selectedId === null && <option value="">Choose a class</option>}
          {classes.map((each) => (
            <option key={each.id} value={each.id}>
              {each.displayName}
            </option>
          ))}
        </select>
        <ChevronIcon size={15} className="class-switcher__chevron" aria-hidden="true" />
      </div>
    </div>
  );
}

type ClassPickerProps = {
  classes: ClassInfo[];
  onSelect: (classId: string) => void;
};

/**
 * First-run class choice, shown when no class is known yet.
 *
 * The primary way students join is a shared link. This is the fallback for
 * someone who landed on the bare homepage — it is a convenience, not the front
 * door, so it stays a plain list of the active classes.
 */
export function ClassPicker({ classes, onSelect }: ClassPickerProps) {
  return (
    <div className="picker">
      <h1 className="picker__title">Choose your class</h1>
      <p className="picker__message">
        Pick your class to see its assignments. If your class representative
        shared a link with you, opening that link does this for you.
      </p>

      <ul className="picker__list">
        {classes.map((each) => (
          <li key={each.id}>
            <button
              type="button"
              className="picker__option"
              onClick={() => onSelect(each.id)}
            >
              <span className="picker__option-name">{each.displayName}</span>
              <span className="picker__option-meta">
                {each.name} · {each.batch} · Section {each.section}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
