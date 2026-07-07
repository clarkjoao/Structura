# Structura UI — conventions for building with this design system

Structura UI is a shadcn-style React kit (Radix primitives + Tailwind) with an
HSL design-token theme. Components are exported from `window.StructuraUI`
(e.g. `Button`, `Card`, `Dialog`, `Select`, `Command`). Compose them for
controls; use Tailwind utility classes bound to the tokens below for your own
layout — never hand-roll a lookalike of a component that already exists.

## Setup / wrapping

- **No global provider is required for styling** — tokens live in `:root` in
  `styles.css` and apply as soon as that stylesheet loads. Dark mode is
  class-based: add `class="dark"` on a wrapping element to switch themes.
- **`Tooltip` requires a `TooltipProvider`** ancestor (wrap the app or the
  subtree once), otherwise tooltips throw.
- **`Toaster`** (from `sonner`) is a mount-once host: render one `<Toaster />`
  near the app root, then call `toast("…")` to show notifications.
- Overlay components (`Dialog`, `AlertDialog`, `Popover`, `DropdownMenu`,
  `Select`, `Tooltip`) are Radix: compose `X` + `XTrigger` + `XContent`; they
  portal and handle open state themselves.

## Styling idiom — Tailwind utilities over token classes

Style with Tailwind classes that reference the theme tokens, NOT raw hex.
The tokens are HSL and exposed as these utility families (all verified in the
shipped CSS):

| Purpose         | Classes                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Surfaces        | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-accent`                                      |
| Text            | `text-foreground`, `text-muted-foreground`, `text-card-foreground`                                     |
| Brand / actions | `bg-primary` `text-primary-foreground`, `bg-secondary`, `bg-destructive` `text-destructive-foreground` |
| Lines / fields  | `border` `border-border`, `border-input`, `ring-ring`                                                  |
| Radius          | `rounded-md` / `rounded-lg` (driven by the `--radius` token)                                           |

Fonts: **Inter** (`font-sans`) and **JetBrains Mono** (`font-mono`), loaded via
a remote `@import` in `styles.css`.

Domain color tokens also exist for cloud providers (`--aws-*`, `--azure-*`,
`--gcp-*`) — use them via arbitrary values, e.g. `text-[hsl(var(--aws-orange))]`,
when coloring provider-specific nodes.

## Where the truth lives

- `styles.css` — the token definitions and the `@import` of component styles.
  Read it before choosing colors.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage.
- `components/<group>/<Name>/<Name>.d.ts` — the exact props (`<Name>Props`).

## One idiomatic example

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from "structura";

<Card className="max-w-sm">
  <CardHeader>
    <CardTitle>Deploy project</CardTitle>
    <CardDescription>Push the current diagram to your team workspace.</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">12 components will be shared.</p>
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="ghost">Cancel</Button>
    <Button>Deploy</Button>
  </CardFooter>
</Card>;
```
