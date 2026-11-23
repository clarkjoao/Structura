# guided-journey-experience Specification

## Purpose

Per-element kind data: a kind may store small JSON data on its elements (`kindProps`), kept through copy, paste, versions and freehand mode. Guided steps use it for phase starts and participants.

## Requirements

### Requirement: An element can carry its kind's data

A component SHALL accept an optional `kindProps` JSON object, owned by the diagram's kind and opaque to every other surface.

- **Validation.** It SHALL be validated like `kindData`: JSON only, a bounded depth, and a size cap of 4 096 characters per element. An invalid value SHALL be dropped on import, not rejected.
- **Lifetime.** It SHALL be kept in freehand mode, saved, versioned and synced with its component. It SHALL be copied with the component and removed with it.
- **Kind edits.** A kind edit SHALL be able to set it on an added node (`add[].kindProps`) and replace or clear it on an existing one (`update[].kindProps`, with `null` to clear).

#### Scenario: Survives freehand and reload

- **WHEN** a guided step has `kindProps.experience = 2`, the author switches to "Edit freehand", reloads, and returns to guided
- **THEN** the step still has experience 2

#### Scenario: Invalid on import

- **WHEN** an imported diagram has a component whose `kindProps` is a string
- **THEN** the diagram imports and that component has no `kindProps`
