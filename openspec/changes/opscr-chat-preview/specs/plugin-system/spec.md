# Spec Delta

## ADDED Requirements

### Requirement: Previewing plugin chat replies

When a plugin chat context returns a preview, the host SHALL show its components and connections
as pending (highlighted, with Keep and Discard), fit the canvas to them, and list the change as a
suggestion in the chat. Keep SHALL call the plugin's `keep`; Discard SHALL call its `discard` and,
when that returns a message, show it and keep the change. A new message on the diagram SHALL keep
the plugin's earlier pending reply.

#### Scenario: Discarding a reply

- **GIVEN** a plugin reply previewed component `c1`
- **WHEN** the user clicks Discard on `c1`
- **THEN** the plugin's `discard` runs once and `c1` is no longer pending
