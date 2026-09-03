# canvas-navigation Specification

## Purpose

TBD - created by archiving change ux-002-canvas-zoom; consolidated during cleanup with the deltas from `canvas-findability` and `canvas-scroll-pan-drawio`. Update Purpose after archive.

## Requirements

### Requirement: Scroll pans the canvas by default

With no modifier key, a wheel event MUST translate the viewport on both axes, on every pointing
device. Content follows the fingers/wheel: the viewport moves by `(-deltaX, -deltaY)`. The canvas
MUST NOT attempt to classify the device before deciding this.

#### Scenario: Vertical two-finger scroll pans

- **WHEN** a user produces a wheel event with `deltaY` non-zero, `deltaX` zero and no modifier keys
- **THEN** the viewport translates vertically by `-deltaY`
- **AND** the zoom level is unchanged

#### Scenario: Diagonal two-finger scroll pans both axes

- **WHEN** a user produces a wheel event with both `deltaX` and `deltaY` non-zero and no modifiers
- **THEN** the viewport translates by `(-deltaX, -deltaY)`
- **AND** the zoom level is unchanged

#### Scenario: Mouse wheel pans in the default mode

- **WHEN** a mouse user scrolls the wheel with no modifier and the scroll-mode preference is `"pan"`
- **THEN** the viewport translates vertically
- **AND** the zoom level is unchanged

### Requirement: Ctrl/Cmd+wheel zooms centered on the cursor

A wheel event with `ctrlKey` or `metaKey` true MUST zoom, regardless of the scroll-mode
preference and regardless of the pointing device. The zoom MUST keep the world point under the
cursor fixed, and MUST clamp to the same `maxZoom` as the `<Controls>` buttons. Because browsers
synthesize `ctrlKey` for a trackpad pinch, this requirement also covers pinch-to-zoom.

#### Scenario: Ctrl+wheel zooms in place

- **WHEN** a user scrolls the wheel with `ctrlKey` true
- **THEN** the zoom changes by the standard factor
- **AND** the world point under the cursor before the zoom is under the cursor after it

#### Scenario: Cmd+wheel zooms in place

- **WHEN** a macOS user scrolls the wheel with `metaKey` true
- **THEN** the zoom changes by the standard factor, cursor-centered

#### Scenario: Trackpad pinch zooms

- **WHEN** a trackpad user pinches and the browser delivers a wheel event with `ctrlKey` true
- **THEN** the canvas zooms, cursor-centered
- **AND** no panning occurs

### Requirement: Zoom keeps the world point under the cursor fixed

The zoom handler MUST keep the world point under the cursor fixed across the zoom step. The
clamp MUST use the same `maxZoom` advertised by the React Flow `<Controls>` zoom buttons, so a user
MUST be able to reach the same maximum zoom by wheel and by clicking the on-screen "Zoom in"
button.

#### Scenario: Wheel zoom reaches the configured max

- **WHEN** a user scrolls the wheel up repeatedly starting from the default zoom
- **THEN** the zoom increases and saturates at the React Flow `maxZoom` value
- **AND** further wheel events do not push the zoom above that value

#### Scenario: Cursor-centered zoom keeps the world point stable

- **WHEN** a user zooms in via wheel
- **THEN** the world point under the cursor before the zoom is the same world point under the cursor after the zoom
- **AND** the visual center of the canvas does not jump to a different element

### Requirement: Shift+wheel pans horizontally

A wheel event with `shiftKey` true and neither `ctrlKey` nor `metaKey` MUST translate the
viewport horizontally by `deltaY`, leaving the vertical position and the zoom unchanged.

#### Scenario: Shift+wheel scrolls sideways

- **WHEN** a user scrolls the wheel with `shiftKey` true
- **THEN** the viewport translates horizontally
- **AND** the vertical position and the zoom are unchanged

### Requirement: Scroll behavior is a persisted user preference

The canvas MUST expose a `scrollMode` preference with the values `"pan"` and `"zoom"`,
defaulting to `"pan"`. In `"zoom"` mode an unmodified wheel event zooms cursor-centered instead
of panning; `Ctrl`/`Cmd`+wheel and `Shift`+wheel are unaffected by the preference. The preference
MUST persist across reloads and MUST be reachable from a control on the canvas, since the
application has no settings page. Its labels MUST come from `t()` with entries in both `en.json`
and `pt-BR.json`.

#### Scenario: Preference defaults to pan

- **GIVEN** a user who has never changed the setting
- **WHEN** they scroll the canvas with no modifier
- **THEN** the canvas pans

#### Scenario: Switching to zoom mode

- **GIVEN** the user sets the scroll mode to `"zoom"`
- **WHEN** they scroll the canvas with no modifier
- **THEN** the canvas zooms cursor-centered
- **AND** `Shift`+wheel still pans horizontally

#### Scenario: Preference survives a reload

- **GIVEN** the user set the scroll mode to `"zoom"`
- **WHEN** they reload the application
- **THEN** the scroll mode is still `"zoom"`

### Requirement: Wheel deltas are normalized across delta modes

The wheel handler MUST normalize `WheelEvent.deltaMode` to pixels before using the deltas:
`DOM_DELTA_LINE` scaled by a line height, `DOM_DELTA_PAGE` scaled by the pane height,
`DOM_DELTA_PIXEL` used as-is. Without this, devices reporting line deltas pan a few pixels per
notch.

#### Scenario: Line-mode wheel pans a usable distance

- **WHEN** a wheel event arrives with `deltaMode === DOM_DELTA_LINE` and `deltaY === 3`
- **THEN** the viewport translates by a pixel distance scaled from the line height, not by 3 px

#### Scenario: Pixel-mode wheel is unscaled

- **WHEN** a wheel event arrives with `deltaMode === DOM_DELTA_PIXEL` and `deltaY === 120`
- **THEN** the viewport translates by 120 px

### Requirement: Only one handler processes wheel events

The canvas MUST NOT run two wheel handlers at the same time. React Flow's own `panOnScroll` MUST
be disabled, and the custom wheel handler in `useCanvasEffects` MUST be the single source of
truth for wheel-driven pan and zoom.

#### Scenario: No dual-handler race

- **WHEN** a user produces a wheel event on the canvas
- **THEN** the custom handler in `useCanvasEffects` is the only code that updates the viewport in response
- **AND** the canvas viewport does not jump or stutter as a result of two competing handlers

### Requirement: Touch and stylus behavior is unchanged

The existing `prefersTouchCanvasUi` branch in `useCanvasInputProfile` MUST continue to drive the
touch-specific React Flow props (`panOnDrag={true}`, `selectionOnDrag={false}`,
`panActivationKeyCode={null}`). `CanvasInputProfile` MUST keep exposing `isTouchDevice`,
`isCoarsePointer` and `prefersTouchCanvasUi`, and MUST NOT expose any device-classification
signal derived from wheel events.

#### Scenario: Touch device still pans with one finger

- **WHEN** a user opens the canvas on a touch device
- **THEN** the canvas uses the touch-specific pan behavior
- **AND** pinch-to-zoom continues to work via React Flow's `zoomOnPinch`

#### Scenario: Input profile carries no wheel-derived signal

- **WHEN** the canvas reads `CanvasInputProfile`
- **THEN** the profile contains only pointer-capability fields
- **AND** no global wheel listener is registered for device classification

### Requirement: Middle-button drag pans the canvas on desktop

On a desktop device that is not a coarse pointer / touch device, the canvas MUST allow the user
to pan by holding the middle mouse button and dragging. Left-drag MUST continue to perform
selection (or move nodes when applicable), and right-drag MUST continue to pan as it does today.

#### Scenario: Middle-button drag pans

- **WHEN** a desktop user presses the middle button on the canvas pane and drags
- **THEN** the canvas viewport follows the pointer movement
- **AND** no node is selected, moved, or connected as a result

#### Scenario: Middle-button pan does not interfere with left-drag selection

- **WHEN** a user drags with the left button (no modifier) over empty pane
- **THEN** a selection rectangle is drawn (existing behavior unchanged)

#### Scenario: Middle-button release returns to default

- **WHEN** a user releases the middle button after a pan
- **THEN** the canvas returns to its default interaction mode immediately

### Requirement: Canvas offers a spatial overview

The editor canvas MUST render a minimap giving a scaled overview of the whole diagram and of the
current viewport within it. The minimap MUST be pannable and zoomable, so clicking or dragging
in it moves the viewport. Node color MUST be derived from the component's type descriptor, with
a neutral fallback for plugin and unknown types, and the minimap chrome MUST use the same theme
tokens as the existing `<Controls>` so it reads correctly in light and dark.

#### Scenario: Minimap reflects the diagram

- **GIVEN** a diagram with nodes spread across the canvas
- **WHEN** the canvas is open
- **THEN** the minimap shows a scaled representation of every visible node
- **AND** it highlights the region covered by the current viewport

#### Scenario: Clicking the minimap navigates

- **WHEN** the user clicks a point in the minimap
- **THEN** the viewport moves to that region of the diagram

#### Scenario: Unknown node type still renders

- **GIVEN** a diagram containing a component whose type belongs to an absent plugin
- **WHEN** the minimap renders
- **THEN** that node is drawn with the neutral fallback color and no error is raised

### Requirement: Minimap visibility is a persisted preference

The minimap MUST be toggleable, default on, and the choice MUST persist across reloads. The
control MUST live alongside the other canvas view preferences, and its label MUST come from
`t()` with entries in both `en.json` and `pt-BR.json`.

#### Scenario: Turning the minimap off

- **WHEN** the user turns the minimap off
- **THEN** it stops rendering and the canvas area it occupied is free
- **AND** after a reload it is still off

### Requirement: Canvas recovers an empty viewport

When the diagram contains at least one node and none of them intersect the current viewport, the
canvas MUST show a floating recovery card naming how many elements exist and offering an action
that fits all of them into view. The card MUST disappear as soon as any node is visible again,
and MUST NOT appear for an empty diagram. Its strings MUST come from `t()` with entries in both
`en.json` and `pt-BR.json`.

#### Scenario: User pans away from all content

- **GIVEN** a diagram with nodes
- **WHEN** the user pans until no node intersects the viewport
- **THEN** the recovery card appears with the element count

#### Scenario: Recovery action brings the content back

- **GIVEN** the recovery card is showing
- **WHEN** the user activates its fit action
- **THEN** the viewport is fitted to all nodes using the canvas fit-view constants
- **AND** the card disappears

#### Scenario: Empty diagram shows nothing

- **GIVEN** a diagram with no components
- **WHEN** the canvas is open
- **THEN** the recovery card is not rendered

#### Scenario: Partially visible node counts as visible

- **GIVEN** a node whose bounding box only partly overlaps the viewport
- **WHEN** occupancy is evaluated
- **THEN** the node counts as visible and the card is not shown
