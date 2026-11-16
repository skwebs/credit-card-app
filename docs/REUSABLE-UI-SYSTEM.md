# Reusable UI system

The application now has a shared primitive layer in `src/components/ui.tsx`.

## Buttons

Use `Button` for application actions. Supported variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `link`. Supported sizes: `sm`, `md` (default), `lg`. Optional `fullWidth` and `loading` props provide common responsive and async states. The default HTML type is `button`; set `type="submit"` for form submission.

## Form controls

`Input`, `Select`, and `Textarea` provide the shared control classes and sizes (`sm`, `md`, `lg`). Use native HTML `type` values for semantic input behavior, for example `type="email"`, `type="number"`, `type="date"`, `type="password"`, and `type="search"`. `INPUT_CLASS`, `SELECT_CLASS`, and `TEXTAREA_CLASS` are available when a native element must be retained or a component is passed as a class string.

## Form layout

`Field` provides a consistent label and optional required, hint, and error presentation. `Stack` and `Inline` provide standard vertical and horizontal spacing primitives.

## Design tokens

Shared control heights, spacing, focus color, and control radius are defined in `src/style.css`. Theme-specific colors remain in the existing application theme layer. Existing business logic, API contracts, and persisted data are unchanged.

## Migration guidance

Prefer these primitives for new UI and when touching existing forms. Avoid a risky mechanical rewrite of every legacy element in one pass; migrate screen-by-screen and preserve specialized controls (date/time, currency, receipt upload, and search) where their behavior is intentional.
