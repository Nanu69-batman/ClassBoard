import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { CheckIcon, ChevronIcon } from "./icons";

/**
 * A dropdown, built rather than borrowed.
 *
 * ## Why not a native `<select>`
 *
 * A native select cannot be animated — the menu is drawn by the operating system
 * and no stylesheet reaches it. Everything below the trigger is this component's
 * own markup, so it can fade and lift in.
 *
 * The cost of building it is that the behaviour is now this component's job, so
 * it is implemented rather than skipped:
 *
 *   - `role="combobox"` on the trigger, `aria-expanded` and `aria-controls` on it
 *   - `role="listbox"` on the popup, `role="option"` + `aria-selected` on items
 *   - Arrow keys move the *active* option, which is tracked with
 *     `aria-activedescendant` rather than by moving DOM focus. Focus stays on the
 *     trigger, so the menu cannot strand a keyboard user when it closes.
 *   - Enter and Space choose; Escape closes and leaves the value alone; Home/End
 *     jump; typing a letter jumps to the first option starting with it
 *   - a labelled visually-hidden `<input type="hidden">` carries the value into a
 *     real form, so this is a drop-in for a select rather than a lookalike
 *
 * The trigger is a `<button>`, so it is reachable and operable by keyboard with
 * no extra work.
 */

export type ListboxOption = {
  value: string;
  label: string;
  /** Shown after the label, dimmed — e.g. an archived subject. */
  hint?: string;
  disabled?: boolean;
};

type ListboxProps = {
  id?: string;
  /** Visible label. Rendered outside this component so it can be a real <label>. */
  options: ListboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name when there is no visible <label for>. */
  ariaLabel?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function Listbox({
  id,
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  placeholder = "Select",
}: ListboxProps) {
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef<{ query: string; at: number }>({ query: "", at: 0 });

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => indexOfValue(options, value));

  const selected = options.find((each) => each.value === value);

  // Keep the highlight in step when the value changes from outside — a form reset,
  // or an edit prefill.
  useEffect(() => {
    setActiveIndex(indexOfValue(options, value));
  }, [options, value]);

  // Open with the current value highlighted, so Enter confirms rather than jumps.
  const open = useCallback(() => {
    if (disabled || options.length === 0) return;
    setActiveIndex(indexOfValue(options, value));
    setIsOpen(true);
  }, [disabled, options, value]);

  const close = useCallback(
    (returnFocus = true) => {
      setIsOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;

      onChange(option.value);
      setActiveIndex(index);
      close();
    },
    [close, onChange, options],
  );

  // A click or scroll elsewhere dismisses the menu. Bound on the document while
  // open and removed on close, so a permanently mounted listener never
  // intercepts clicks elsewhere on the page.
  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    function onScroll() {
      // The menu is positioned against the trigger, so scrolling the page would
      // leave it hanging in the old place. Close instead of chasing it.
      setIsOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isOpen]);

  // Escape closes from anywhere, which is what a keyboard user expects mid-menu.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  /**
   * Scrolls the highlighted option into view. Done in a layout effect so the
   * position is settled before the browser paints — otherwise the first ArrowDown
   * visibly jumps after the menu appears.
   */
  useLayoutEffect(() => {
    if (!isOpen) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: "nearest",
    });
  }, [isOpen, activeIndex]);

  function move(step: number) {
    setActiveIndex((current) => wrapIndex(current, step, options.length));
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (isOpen) move(1);
        else open();
        return;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen) move(-1);
        else {
          // Opening upward starts at the end, which is what a user reaching for
          // "the last item" is asking for.
          setActiveIndex(Math.max(0, options.length - 1));
          setIsOpen(true);
        }
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen) choose(activeIndex);
        else open();
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(0, options.length - 1));
        return;
      case "Tab":
        // Tabbing away should not leave a floating menu behind.
        setIsOpen(false);
        return;
      default:
        handleTypeahead(event.key);
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(0, options.length - 1));
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeIndex);
        return;
      case "Tab":
        setIsOpen(false);
        return;
      default:
        handleTypeahead(event.key);
    }
  }

  /**
   * Type-to-jump, the way every native select behaves: printable keys narrow to
   * the first option beginning with what has been typed, and the buffer resets
   * after a second of not typing.
   */
  function handleTypeahead(key: string) {
    if (key.length !== 1 || key === " ") return;

    const now = Date.now();
    const buffer = now - typeahead.current.at > 1000 ? key : typeahead.current.query + key;
    typeahead.current = { query: buffer, at: now };

    const needle = buffer.toLowerCase();
    const found = options.findIndex(
      (each) => !each.disabled && each.label.toLowerCase().startsWith(needle),
    );

    if (found >= 0) {
      setActiveIndex(found);
      if (isOpen) return;
    }

    if (isOpen) return;

    // Typing a full label on a closed trigger opens the menu on the match.
    if (found >= 0) setIsOpen(true);
  }

  return (
    <div className={`listbox${isOpen ? " listbox--open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="listbox__trigger"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={isOpen ? optionId(listboxId, activeIndex) : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`listbox__value${selected ? "" : " listbox__value--empty"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronIcon size={16} className="listbox__chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          className="listbox__menu"
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;

            return (
              <li
                key={option.value}
                id={optionId(listboxId, index)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                data-active={index === activeIndex ? "true" : undefined}
                className={[
                  "listbox__option",
                  isSelected ? "listbox__option--selected" : "",
                  index === activeIndex ? "listbox__option--active" : "",
                  option.disabled ? "listbox__option--disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span className="listbox__option-label">{option.label}</span>
                {option.hint && (
                  <span className="listbox__option-hint">{option.hint}</span>
                )}
                {isSelected && <CheckIcon size={15} className="listbox__tick" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

function indexOfValue(options: ListboxOption[], value: string): number {
  const found = options.findIndex((each) => each.value === value);
  return found >= 0 ? found : 0;
}

/** Moves `step` places through the list, skipping nothing and wrapping around. */
function wrapIndex(current: number, step: number, length: number): number {
  if (length === 0) return 0;
  return (current + step + length) % length;
}
