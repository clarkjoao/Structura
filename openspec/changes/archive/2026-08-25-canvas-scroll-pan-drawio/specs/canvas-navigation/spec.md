# Spec: canvas-navigation

## REMOVED Requirements

### Requirement: Canvas detects trackpad vs mouse at runtime

**Reason**: The heuristic misclassifies the most common gesture. `isTrackpadLikeEvent` requires
`deltaX !== 0`, so a plain vertical two-finger scroll never reaches the trackpad threshold and
falls into the mouse branch, which zooms. The classification is also one-way and has no user
override. Replaced by a device-independent model plus an explicit preference.

**Migration**: `likelyTrackpad` is removed from `CanvasInputProfile`. Behavior that used to
depend on it is now driven by the `scrollMode` preference, which defaults to `"pan"` — the
behavior a trackpad user expected all along.

### Requirement: Trackpad wheel pans and pinch zooms

**Reason**: Folded into the new device-independent requirements. Pinch still zooms, because the
browser delivers it as a wheel event with `ctrlKey` true, which the new zoom requirement covers.

**Migration**: None. Trackpad behavior is unchanged in effect and now applies without needing
the device to be identified first.

### Requirement: Mouse wheel zooms and Shift+wheel pans horizontally

**Reason**: The zoom-on-plain-wheel half contradicts draw.io parity and is now the non-default
half of a user preference. The `Shift`+wheel half is restated in the new horizontal-pan
requirement.

**Migration**: Users who want wheel-to-zoom set the scroll-mode preference to `"zoom"`.

### Requirement: No new translation keys

**Reason**: The scroll-mode preference needs a visible control, which needs labels.

**Migration**: New keys are added to both `en.json` and `pt-BR.json`, per the repo i18n rule.

## ADDED Requirements

### Requirement: Scroll pans the canvas by default

With no modifier key, a wheel event MUST translate the viewport on both axes, on every pointing
device. Content follows the fingers/wheel: the viewport moves by `(-deltaX, -deltaY)`. The
canvas MUST NOT attempt to classify the device before deciding this.

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
of panning; `Ctrl`/`Cmd`+wheel and `Shift`+wheel are unaffected by the preference. The
preference MUST persist across reloads and MUST be reachable from a control on the canvas, since
the application has no settings page. Its labels MUST come from `t()` with entries in both
`en.json` and `pt-BR.json`.

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

## MODIFIED Requirements

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
