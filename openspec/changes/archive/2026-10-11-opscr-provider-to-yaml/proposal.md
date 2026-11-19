# Proposal

## Why

The last canvas edit that did not reach the YAML: picking another catalog service (Lambda → ECS)
or technology on a bound element stayed canvas-only, and the manifest's `spec.provider` disagreed
with the picture.

## What Changes

- **opscr plugin:** reconcile notices a bound element whose catalog service or technology differs
  from what the binding drew. A new catalog service sets `spec.provider` to the provider listing it
  for the element's Kind; a new technology is accepted when it names a provider of the same service
  (or, for an Application or external system without a service, as the provider itself). What the
  manifest cannot express — another Kind's service, a cleared service, free text on a catalog
  element — is reverted on the canvas with a message. The element keeps its id; the sync then aligns
  the technology label with the provider.
- Plugin tests read the opscr sample from git, as the e2e does.

## Capabilities

### Modified Capabilities

- `opscr-text-editing`: catalog service and technology edits reach `spec.provider`.

## Impact

- Plugin only: `setSpecField`, `providerFromCanvas`, a reconcile step, pane message, tests, e2e.
