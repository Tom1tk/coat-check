# Plan 011: The city-search autocomplete is keyboard-navigable and passes the ARIA lint rule

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/components/LocationSearch.tsx`
> Plan 007 legitimately modified this file (AbortController + timer cleanup).
> The suggestion-list JSX excerpted below must still be recognizable; on a
> structural mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/007-locationsearch-race-and-cleanup.md (same file; land 007 first)
- **Category**: bug (accessibility)
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

The autocomplete claims combobox semantics (`role="listbox"`,
`role="option"`) without delivering them: options lack the required
`aria-selected` attribute (the repo's one standing eslint warning), the input
has no `role="combobox"`/`aria-expanded` wiring, and there is no keyboard
path from the input into the list — arrow keys do nothing; a keyboard user
must Tab through every option. Screen-reader users get a widget that
announces as a listbox but doesn't behave like one. This closes the gap and
zeroes the lint warnings.

## Current state

`src/app/components/LocationSearch.tsx` (post-007 the file also contains an
AbortController; irrelevant to this plan). The relevant JSX at `6e85bba`:

- Input (lines 72–82): plain `<input id="location-search" ...>`, no combobox ARIA.
- Suggestion list (lines 85–109):

```tsx
{suggestions.length > 0 && (
    <ul className="mt-1 max-h-40 overflow-y-auto w-full border border-gray-300 rounded-md bg-white" role="listbox">
        {suggestions.map((s, i) => (
            <li
                key={i}
                role="option"
                className="p-2 cursor-pointer hover:bg-blue-100 focus-visible:bg-blue-100 focus-visible:outline-none"
                tabIndex={0}
                onClick={() => {
                    // Just update the search box, don't submit yet
                    setSearchQuery(`${s.name}, ${s.country}`);
                    setSuggestions([]);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        setSearchQuery(`${s.name}, ${s.country}`);
                        setSuggestions([]);
                    }
                }}
            >
                {s.name}, {s.country}
            </li>
        ))}
    </ul>
)}
```

- Lint warning to clear:
  `LocationSearch.tsx:90 warning Elements with the ARIA role "option" must have the following attributes defined: aria-selected jsx-a11y/role-has-required-aria-props`
- Behavior contract to preserve: selecting a suggestion fills the input and
  closes the list but does NOT submit; Submit is a separate button.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npx eslint src`         | exit 0, **0 warnings in LocationSearch.tsx** |
| Dev       | `npm run dev`            | serves on http://localhost:3000 |

## Scope

**In scope**:
- `src/app/components/LocationSearch.tsx`

**Out of scope**:
- The fetch/debounce/abort logic (plan 007's work — don't reshuffle it).
- Visual styling changes beyond the active-option highlight.
- Other components' a11y (none currently warn).

## Git workflow

- Branch: `advisor/011-locationsearch-a11y`
- Commit style: short imperative sentence matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Implement the active-descendant combobox pattern

Follow the WAI-ARIA combobox-with-listbox pattern (focus stays on the input;
`aria-activedescendant` tracks the highlighted option):

1. Add state: `const [activeIndex, setActiveIndex] = useState(-1);`
   Reset to `-1` whenever `suggestions` changes (set it alongside every
   `setSuggestions` call).
2. Extract the duplicated select logic into one function:
   ```tsx
   const selectSuggestion = (s: Suggestion) => {
       setSearchQuery(`${s.name}, ${s.country}`);
       setSuggestions([]);
       setActiveIndex(-1);
   };
   ```
   Use it in both the option `onClick` and the input's Enter handling.
3. Input attributes: `role="combobox"`, `aria-expanded={suggestions.length > 0}`,
   `aria-controls="location-suggestions"`, `aria-autocomplete="list"`,
   `aria-activedescendant={activeIndex >= 0 ? \`location-option-${activeIndex}\` : undefined}`.
4. Input `onKeyDown`:
   - `ArrowDown` / `ArrowUp`: `e.preventDefault()`; move `activeIndex`
     through `suggestions` with wrap-around.
   - `Enter`: if `activeIndex >= 0`, `e.preventDefault()` and
     `selectSuggestion(suggestions[activeIndex])`.
   - `Escape`: clear suggestions and reset `activeIndex`.
5. List: `id="location-suggestions"`; keep `role="listbox"`.
6. Options: `id={\`location-option-${i}\`}`,
   `aria-selected={i === activeIndex}`, remove `tabIndex={0}` and the
   per-option `onKeyDown` (keyboard is handled at the input now; click stays).
   Add a highlight class when active, matching the hover style:
   `${i === activeIndex ? 'bg-blue-100' : ''}`.

**Verify**: `npx tsc --noEmit` → exit 0.
`npx eslint src` → the `role-has-required-aria-props` warning is gone and no
new a11y warnings appear.

### Step 2: Manual keyboard walkthrough

`npm run dev`, open search, type "lond", wait for suggestions:
1. ArrowDown highlights the first option (visible highlight; input keeps focus).
2. ArrowDown to the last option then once more wraps to the first.
3. Enter fills the input with "London, United Kingdom" (or similar) and
   closes the list — does NOT submit.
4. Reopen suggestions, press Escape → list closes, input text intact.
5. Mouse click on an option still fills the input as before.

**Verify**: all five observations.

## Test plan

Manual walkthrough (Step 2). Component tests would need jsdom, deliberately
not in the test setup (plan 004 decision) — if that changes later, this
keyboard state machine is a prime candidate.

## Done criteria

- [ ] `npx eslint src` exits 0 with zero warnings attributed to `LocationSearch.tsx`
- [ ] `grep -n "aria-activedescendant\|aria-selected\|role=\"combobox\"" src/app/components/LocationSearch.tsx` → all three present
- [ ] `grep -n "tabIndex={0}" src/app/components/LocationSearch.tsx` → no match
- [ ] Manual walkthrough (Step 2) fully observed
- [ ] `git status` shows only `LocationSearch.tsx` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The suggestion-list JSX no longer matches the excerpt structurally (drift
  beyond plan 007's known changes).
- Preserving "select fills but doesn't submit" conflicts with any part of the
  pattern (it shouldn't — report rather than changing the submit behavior).

## Maintenance notes

- If suggestions ever become clickable links or gain sections, re-evaluate
  the pattern (grid/menu roles differ).
- Reviewer: check `e.preventDefault()` on ArrowDown/ArrowUp — without it the
  input caret jumps and the page may scroll.
- Deferred: `aria-live` announcement of result counts — nice-to-have, adds
  markup; do it if a screen-reader user reports friction.
