# design-sync notes — Structura UI

Repo is a private Vite app, not a published library. The "design system" is the
shadcn-style kit at `src/components/ui/*.tsx` + Tailwind tokens in `src/index.css`.

## How the bundle is built (package/synth-entry shape)

- **Entry**: `.design-sync/entry.tsx` is a barrel that `export *`s all 20 UI files
  so `window.StructuraUI` carries every compound sub-component. Passed via `--entry`.
- **CSS is Tailwind-compiled**, not shipped. `cfg.buildCmd` runs
  `tailwindcss -c .design-sync/tailwind.sync.ts -i src/index.css -o .design-sync/.cache/compiled.css`
  and `cfg.cssEntry` points at that output. `tailwind.sync.ts` reuses the project
  theme but scopes `content` to `src/components/ui` + `.design-sync/entry.tsx` +
  `.design-sync/previews`. **Re-run the compile before every `package-build`** so
  utility classes used in previews are emitted (previews mostly use inline styles,
  so this rarely matters, but keep it in the buildCmd).
- `@/` alias resolves via `.design-sync/tsconfig.build.json` (baseUrl `..`, jsx react-jsx).
- Fonts load remotely (Google Fonts `@import` in index.css) → `[FONT_REMOTE]`, no action.
- `guidelinesGlob: []` — repo `docs/` are internal (edge prompts etc.), not design guidance.

## Preview authoring conventions (learned on the calibration set)

- Import DS components from `"structura"` (the pkg name); the converter maps it to the bundle.
- **Use inline `style={{}}` for layout** in previews (gap/flex/maxWidth), not Tailwind
  classes — avoids depending on the Tailwind content scan. Component classes are already compiled.
- **Overlay components** (Dialog, and expect the same for AlertDialog/Popover/DropdownMenu/
  Select/Tooltip): render the open state inline with
  `modal={false}` + `<Content style={{position:"static", transform:"none"}}
onOpenAutoFocus={e=>e.preventDefault()} onInteractOutside={e=>e.preventDefault()}>`,
  and set `cfg.overrides.<Name> = {"cardMode":"single","viewport":"WxH"}`.
- The review-capture cell is **narrow (< Tailwind `sm` 640px)**: any footer/action row that
  relies on `sm:flex-row` will stack. Force it with inline `style={{flexDirection:"row",
justifyContent:"flex-end", gap:8}}` on the footer.
- **Changing `cfg.overrides` requires a full `package-build`** — `preview-rebuild.mjs` aborts
  with `[CONFIG_STALE]`. Author `.tsx`-only changes can use `preview-rebuild`.

## Deliberate floor cards

- **Toaster** (sonner) ships as the floor card — it's a mount-once toast host that
  renders nothing statically. Authorable later only with a runtime toast trigger; not worth it.

## Known render warns (triaged, expected)

- `[RENDER_BLANK]` on unauthored floor cards (Badge/Button/Card/Checkbox/Input/Textarea) — a
  small default-prop render; fixed by authoring the preview.

## Re-sync risks

- Tokens/CSS are Tailwind-compiled at sync time from `src/index.css` + `tailwind.config.ts`.
  If those change, re-run `buildCmd` (it's wired) — output is deterministic.
- Overlay previews depend on Radix `modal={false}` + static positioning tricks; if a Radix
  major bump changes portal/focus behavior, re-verify the overlay cards.
- Preview import specifier is the bare pkg name `"structura"`; keep `cfg.pkg` = "structura".
