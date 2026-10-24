# Spec Delta

## ADDED Requirements

### Requirement: Moving an element between panels

Moving a bound element into another bound panel on the canvas SHALL retarget its `belongsTo` to
that panel, and taking it out of every panel SHALL remove its `belongsTo`, keeping the element in
place. A move into a panel outside the YAML SHALL change nothing until the panel is added.

#### Scenario: Out of its panel

- **GIVEN** `order-tracker` sits in the `orders` panel
- **WHEN** the user ungroups it on the canvas
- **THEN** its `belongsTo` to `orders` is gone from the text and the element stays where it is
