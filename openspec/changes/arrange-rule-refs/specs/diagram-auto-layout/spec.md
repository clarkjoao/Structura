# Spec Delta

## Purpose

Arranging a diagram ends a connection that points far back against the reading direction on a
reference beside its consumer, under rules the author can tune.

## ADDED Requirements

### Requirement: References follow reading rules

When the diagram's `references` setting is absent or `rules`, the whole-diagram arrangement MUST
measure a layout without automatic references and, for each connection:

- whose target sits more than `refNeighborColumns` columns back along the reading (default 2), or
- with `refForward` on, whose target sits more than 6 columns ahead,

end it on an automatic reference to the target inside the consumer's container.

A connection within the neighbour distance MUST stay a back-edge drawn as ADR-0013 requires.
Columns MUST be counted as the columns the diagram's elements occupy, not as a distance. A
top-to-bottom diagram MUST apply the same rules along its own axis.

#### Scenario: A loop far back

- **GIVEN** a chain of five elements whose last calls the first, arranged left to right
- **WHEN** the user arranges the diagram with default settings
- **THEN** the connection that points four columns back ends on a reference to its target beside
  its consumer
- **AND** every other connection is unchanged

#### Scenario: The loop within the neighbour distance

- **GIVEN** the same chain, with the neighbour distance set to 6 columns
- **WHEN** the user arranges the diagram
- **THEN** no reference is made and the connection is drawn as a back-edge

### Requirement: References group by container and never empty an original

Under `rules`, the arrangement MUST:

- make one reference per original and consumer container, never one per connection;
- move a consumer's connections to the original together;
- leave the original with at least `refMinKeep` connections (default 1) of any direction, keeping
  the closest consumers on it when the rules would take more.

#### Scenario: Two consumers in one panel

- **GIVEN** two elements in the same panel that both point far back to the same element
- **WHEN** the user arranges the diagram
- **THEN** one reference in that panel stands for both connections

#### Scenario: Every connection would move

- **GIVEN** an element whose only connections all point far back to it
- **WHEN** the user arranges the diagram
- **THEN** the closest consumer stays connected to the original
- **AND** the others end on references

### Requirement: The reference mode is chosen in the Arrange menu

The Arrange menu's Advanced section MUST offer a References mode:

- **Rules** (the default);
- **Trial**: references tried on the busiest elements and kept only where the layout reads
  measurably better;
- **Off**: no automatic references, and the ones an earlier arrangement made are removed.

Under Rules it MUST offer:

- the neighbour distance (1–6 columns);
- the connections kept on the original (1–5);
- whether long forward connections make references.

A change MUST re-arrange the diagram and store the setting as one undo step, like the other layout
settings. The settings MUST be normalised: defaults are dropped, and values out of range or
unrecognised are clamped or dropped.

#### Scenario: Turning references off

- **GIVEN** a diagram arranged with references by rules
- **WHEN** the user picks Off under References
- **THEN** the diagram is re-arranged without automatic references
- **AND** one undo brings back the references and the previous arrangement

#### Scenario: Reporting what the rules did

- **GIVEN** a diagram with connections that point back
- **WHEN** the user arranges it under Rules
- **THEN** the success message says how many connections point back, how many stay back-edges,
  how many moved, and how many references were made

### Requirement: Automatic references are compact

An automatic reference SHALL be laid out and stored at the compact size (`AUTO_REF_W` × `AUTO_REF_H`)
and drawn as a pill with the link glyph and the original's name. A reference the user made SHALL
keep its card.

#### Scenario: An arrangement makes a reference

- **WHEN** an arrangement makes or keeps an automatic reference
- **THEN** its stored size is the compact one, even if it was stored larger before
- **AND** it is drawn without the `ref` chip

#### Scenario: A user's reference

- **WHEN** the user made the reference
- **THEN** it is drawn as a card with the `ref` chip

### Requirement: An element nothing enters starts the reading

The whole-diagram arrangement SHALL place every element that no connection enters, and every
container no connection enters from outside, in the first layer of its container, so the diagram
grows along the reading direction from it.

#### Scenario: A source connected far ahead

- **WHEN** an element's only connection goes to an element several columns along the reading
- **AND** no connection enters it
- **THEN** it is placed in the first column of its container
