## Purpose

Lets a reader of a shared diagram start a script from the route in front of them, and lets the author
of a share say which script the link opens on.

## ADDED Requirements

### Requirement: A route reports the scripts associated with it

A route SHALL be associated with a script when one of its handlers names that script, or when a step of
that script names the route. The association SHALL be derived on request and SHALL NOT be stored on the
route. A handler naming a script that is no longer in the diagram SHALL be left out.

#### Scenario: A route its handler names

- **GIVEN** a route whose handler names a script in the diagram
- **WHEN** the routes's associated scripts are asked for
- **THEN** that script is among them

#### Scenario: A route a step calls

- **GIVEN** a script whose step names a route, and a route carrying no handler
- **WHEN** the route's associated scripts are asked for
- **THEN** that script is among them

#### Scenario: Both, once

- **GIVEN** a script that both implements a route and calls it from a step
- **WHEN** the route's associated scripts are asked for
- **THEN** the script appears once

#### Scenario: A handler naming a script that is gone

- **GIVEN** a route whose handler names a script the diagram no longer holds
- **WHEN** the route's associated scripts are asked for
- **THEN** it is not among them, and nothing fails

#### Scenario: Every handler counts, not the first

- **GIVEN** a route carrying two handlers naming two different scripts
- **WHEN** the route's associated scripts are asked for
- **THEN** both are among them

#### Scenario: A route nothing runs through

- **GIVEN** a route with no handler and no step naming it
- **WHEN** the route's associated scripts are asked for
- **THEN** there are none

### Requirement: An api-group reports the scripts running through its routes

An api-group SHALL be associated with every script associated with any route it holds, each named once.

#### Scenario: Scripts across two routes

- **GIVEN** a group holding two routes, each associated with a different script
- **WHEN** the group's associated scripts are asked for
- **THEN** both are named

#### Scenario: One script through two routes

- **GIVEN** a group holding two routes both associated with the same script
- **WHEN** the group's associated scripts are asked for
- **THEN** the script is named once

#### Scenario: A group whose routes run nothing

- **GIVEN** a group whose routes are associated with no script
- **WHEN** the group's associated scripts are asked for
- **THEN** there are none

### Requirement: A route offers its scripts on the canvas, playing or not

A route SHALL offer to play a script when it is associated with one, and SHALL offer nothing when it is
not. What it offers SHALL NOT depend on a reading being in progress: a route unrelated to the script
being read SHALL NOT offer that script.

#### Scenario: A route with one script

- **GIVEN** a route associated with one script
- **WHEN** its row is read
- **THEN** it offers to play that script, named

#### Scenario: A route with several

- **GIVEN** a route associated with more than one script
- **WHEN** its row is read
- **THEN** it says how many, names them all, and acting on it plays the first

#### Scenario: A route with none, during a reading

- **GIVEN** a script being read, and a route associated with no script
- **WHEN** its row is read
- **THEN** it offers nothing

### Requirement: A shared diagram lets a route start a reading

In a shared diagram, a route SHALL offer its associated scripts exactly as the editor does, and the
api-group SHALL list the scripts running through it. Choosing one SHALL start the reading that a
reader who chose it from the diagram's own list would get.

#### Scenario: Playing from a route

- **GIVEN** a shared diagram whose route is associated with a script
- **WHEN** the route's control is chosen
- **THEN** that script begins, with the diagram numbered from it

#### Scenario: The group lists what runs through it

- **GIVEN** a shared diagram holding a group whose routes are associated with two scripts
- **WHEN** the group is read
- **THEN** both are named, and each can be chosen

#### Scenario: A group with nothing through it

- **GIVEN** a shared diagram holding a group associated with no script
- **WHEN** the group is read
- **THEN** it lists nothing, and the diagram is unchanged otherwise

### Requirement: A shared diagram is read with the same rail as the editor

A reading in a shared diagram SHALL use the reading rail the editor uses, beside the canvas rather
than over it. There SHALL be one reading surface in the product.

#### Scenario: The rail is what opens

- **GIVEN** a shared diagram whose script is being read
- **WHEN** the reading is shown
- **THEN** it is the reading rail, with its spine, and no second reading surface exists

#### Scenario: The counter is the spine

- **GIVEN** a reader who has advanced a step
- **WHEN** the rail is read
- **THEN** the step behind them is in the spine, and no separate counter is shown

### Requirement: A reading answers the same keys wherever it runs

The keys that walk a reading — forward, back, and closing it — SHALL work in a shared diagram exactly
as they do in the editor. At a branch point the forward key SHALL NOT pick a way.

#### Scenario: Walking a shared reading from the keyboard

- **GIVEN** a script being read in a shared diagram
- **WHEN** the forward and back keys are pressed
- **THEN** the reading moves as it does in the editor

#### Scenario: Closing it

- **GIVEN** a script being read in a shared diagram
- **WHEN** the closing key is pressed
- **THEN** the reading closes and the diagram's list of scripts is offered

#### Scenario: A branch point is a choice, not a key

- **GIVEN** a reading stopped at a branch point
- **WHEN** the forward key is pressed
- **THEN** no way is taken

### Requirement: The canvas follows the reader

While a script is being read, the canvas SHALL bring what the step points at into view as the reader
moves between steps — the node a step happens at, or both ends of a call.

#### Scenario: Moving to a step on a node

- **GIVEN** a reading whose next step happens at a node off screen
- **WHEN** the reader advances
- **THEN** the canvas brings that node into view

#### Scenario: A step naming nothing on the canvas

- **GIVEN** a step that names no node and no connection
- **WHEN** the reader advances to it
- **THEN** the canvas stays where it is rather than jumping somewhere arbitrary

### Requirement: A share link may name the script it opens on

An author sharing a diagram SHALL be able to name one of its scripts, or none. The name SHALL travel in
the link beside the diagram rather than inside it. A reader opening such a link SHALL arrive with that
script already being read, and SHALL be able to close it and reach the diagram's own list of scripts.

#### Scenario: Sharing with a script

- **GIVEN** an author who names a script when sharing
- **WHEN** a reader opens the link
- **THEN** that script is being read

#### Scenario: Sharing without one

- **GIVEN** an author who names no script
- **WHEN** a reader opens the link
- **THEN** no script is being read, and the diagram's list of scripts is offered

#### Scenario: A named script the diagram does not hold

- **GIVEN** a link naming a script that is not in the diagram it carries
- **WHEN** a reader opens it
- **THEN** no script is being read, and nothing fails

#### Scenario: Closing the script that was named

- **GIVEN** a reader who arrived with a script being read
- **WHEN** they close it
- **THEN** the diagram is shown with its list of scripts, as for any other reader

### Requirement: Every string these surfaces add exists in both locales

Text introduced on the route, the api-group, the share dialog or the viewer SHALL be resolved through
the translation layer and SHALL be present in every shipped locale, with no default supplied at the
call site.

#### Scenario: A locale is missing a key

- **GIVEN** a string used by any of these surfaces
- **WHEN** the locale files are checked
- **THEN** the key is present in every shipped locale
