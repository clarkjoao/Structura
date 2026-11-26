# Spec Delta

## ADDED Requirements

### Requirement: Host UI kit for plugins

The API SHALL expose, as `api.ui`, a UI kit of host components — `Button`, `Input`, `Textarea`,
`Label`, `Field`, `Checkbox`, `Switch`, `Select`, `Badge`, `Card`, `Tabs`, `Tooltip`,
`Separator`, `Stack` — rendered with the host's design system (its theme, light and dark, focus
and disabled states). The same components SHALL be published on the host global
`__STRUCTURA_UI__` before plugin code runs, so a bundled plugin can import them from
`@structura/ui` as a build-time external. Their props SHALL be the documented kit props, not
those of the underlying library, and SHALL change only with the API version. Every
user-visible string a kit component shows by default SHALL come from the host's i18n layer.
The API version SHALL be `1.18.0`.

#### Scenario: No-build plugin uses a host button

- **GIVEN** an active plugin whose panel renders `api.ui.Button` with `variant: "outline"`
- **WHEN** the panel is shown in dark mode
- **THEN** the button is the host's outline button, with the host's dark colours and focus ring

#### Scenario: Bundled plugin imports the kit

- **GIVEN** a plugin bundle built with `@structura/ui` external, bound to `__STRUCTURA_UI__`
- **WHEN** the plugin is installed and its panel renders `Select` from `@structura/ui`
- **THEN** the host's select renders with the plugin's options and reports the picked value

#### Scenario: Simplified compound components

- **WHEN** a plugin renders `Select` with `options: [{ value: "a", label: "A" }]` and `onValueChange`
- **THEN** picking "A" calls `onValueChange("a")`, with no Radix sub-components involved
