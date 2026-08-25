# Spec: service-relink-on-import

## ADDED Requirements

### Requirement: Diagram exports carry the services they reference

`exportJSON` MUST embed, in the versioned envelope, a `services` array describing every service
referenced by `snapshot.components[*].serviceId` (including components inside the resolved
scene). Services not referenced by the diagram MUST NOT be exported. Each entry MUST carry
`id`, `name`, `repositoryUrl`, `technology`, `owner`, `tags` and `sources`, plus
`github: { repoId, fullName }` when the local service has GitHub metadata.

The field MUST be optional on the envelope so that `DIAGRAM_SCHEMA_VERSION` does not change and
readers that predate it keep importing the file.

#### Scenario: Only referenced services are exported

- **GIVEN** a workspace catalog with five services, two of which are linked to components in the
  diagram being exported
- **WHEN** the diagram is exported as JSON
- **THEN** the envelope's `services` array contains exactly those two entries

#### Scenario: Diagram with no linked services

- **WHEN** a diagram whose components have no `serviceId` is exported
- **THEN** `services` is absent or an empty array
- **AND** the rest of the file is byte-compatible with the previous format

#### Scenario: Older reader ignores the manifest

- **WHEN** a file containing `services` is read by the existing `validateDiagramFile` logic for
  the diagram payload
- **THEN** the diagram is extracted from `data` exactly as before and the import succeeds

### Requirement: A service match requires two independent signals

The matcher MUST score a manifest entry against each local service on these independent signals:
GitHub `repoId` equality, normalized repository URL equality (via the existing `repoUrlsMatch`),
normalized service name equality, normalized GitHub `fullName` equality, and a component
`externalLink.url` that normalizes to a local service's `repositoryUrl`. A local service is a
match only when it scores **two or more distinct signals** and is the **unique** highest scorer.

#### Scenario: Name plus repo id matches

- **GIVEN** a local service named `checkout` with GitHub `repoId` 42
- **WHEN** a manifest entry named `checkout` with `repoId` 42 and a different `id` is evaluated
- **THEN** the local service is reported as a match, listing both signals

#### Scenario: Name alone does not match

- **GIVEN** a local service named `api` with no repository URL and no GitHub metadata
- **WHEN** a manifest entry named `api` with a repository URL is evaluated
- **THEN** no match is reported

#### Scenario: Ambiguity is reported, not guessed

- **GIVEN** two local services that both match the entry on name and repository URL
- **WHEN** the entry is evaluated
- **THEN** no match is reported and the entry is listed as ambiguous

#### Scenario: Repository URLs match across formats

- **GIVEN** a local service with `repositoryUrl` `git@github.com:acme/checkout.git`
- **WHEN** a manifest entry carries `https://github.com/acme/checkout`
- **THEN** the repository-URL signal counts as matched

### Requirement: Files without a manifest fall back to component evidence

When an imported file carries no `services` array, the matcher MUST build a synthetic entry per
distinct `serviceId` from the component that references it — its `name`, its `externalLinks`
URLs and its `technology`, which the store already copies from the linked service. The
two-signal rule MUST apply unchanged, so weaker evidence yields fewer matches rather than wrong
ones.

#### Scenario: Legacy file with a GitHub link on the component

- **GIVEN** an imported component named `checkout` with an external link to
  `https://github.com/acme/checkout` and a dangling `serviceId`
- **AND** a local service named `checkout` whose `repositoryUrl` is that repository
- **WHEN** the import is evaluated
- **THEN** the local service is reported as a match on name and repository URL

#### Scenario: Legacy file with nothing but a name

- **GIVEN** an imported component whose only evidence is its name
- **WHEN** the import is evaluated
- **THEN** no match is reported and the entry is listed as unmatched

### Requirement: Relinking is reviewed before it is applied

When the plan contains at least one entry to relink or clear, the import MUST present the
proposal before writing to the store, grouped as *relink* (pre-selected, showing the matched
signals), *no match* (offering to clear the dangling `serviceId`) and *already local* (the id
exists in the receiving catalog; no action). The user MUST be able to accept or reject each
entry, to apply all at once, and to cancel. Nothing MUST be remapped without confirmation.

All dialog strings MUST come from `t()` with entries in both `en.json` and `pt-BR.json`.

#### Scenario: User confirms the proposed relink

- **GIVEN** an import whose plan proposes relinking one service
- **WHEN** the user confirms
- **THEN** every component referencing the old id — in `snapshot.components` and in every
  `scenes[*].addedComponents` — references the local service id
- **AND** the diagram opens with the component linked in the element panel

#### Scenario: User rejects a proposed relink

- **GIVEN** an import whose plan proposes relinking one service
- **WHEN** the user unchecks it and confirms
- **THEN** the component keeps the `serviceId` from the file and no local service is linked

#### Scenario: User cancels the dialog

- **WHEN** the user cancels the relink dialog
- **THEN** no diagram is imported and the workspace is unchanged

#### Scenario: Nothing to reconcile

- **GIVEN** an import whose services all already resolve in the local catalog, or a diagram with
  no linked services
- **WHEN** the file is imported
- **THEN** no dialog is shown and the existing import flow runs unchanged

### Requirement: Relinking is applied as a single store write

The `serviceId` rewrite MUST be applied to the in-memory `Diagram` before the import action runs,
so the import remains one store write. Relinking MUST NOT create, modify or delete any entry in
the receiving service catalog, and MUST NOT push separate undo-history steps.

#### Scenario: Import with relink produces one history entry

- **WHEN** a diagram is imported with three services relinked
- **THEN** the store is written once and the undo history is not polluted with per-component steps

#### Scenario: Import never mutates the local catalog

- **GIVEN** an import with two unmatched services
- **WHEN** the user confirms the dialog
- **THEN** the local service catalog contains exactly the services it contained before
