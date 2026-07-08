# Spec: canvas-navigation

## ADDED Requirements

### Requirement: Canvas detects trackpad vs mouse at runtime

The canvas MUST distinguish a trackpad from a mouse at runtime, without persisting the choice, and MUST default to "mouse" behavior when no signal is available. The detection MUST be based on observed wheel events (small, frequent, non-integer deltas indicate a trackpad; large, isolated, integer deltas indicate a mouse) and MUST NOT call `preventDefault` on the events it observes.

#### Scenario: First wheel event uses mouse behavior

- **WHEN** a user opens the canvas for the first time and has not yet produced any wheel events
- **THEN** the canvas treats input as a mouse (wheel = zoom, Shift+wheel = horizontal pan)
- **AND** no trackpad-specific behavior is active

#### Scenario: Repeated small wheel deltas flip to trackpad mode

- **WHEN** a user produces several wheel events with `Math.abs(deltaY) < 50` and non-zero `deltaX` within a short window
- **THEN** the canvas flips to trackpad mode (two-finger scroll = pan, Ctrl+wheel = zoom)
- **AND** a subsequent isolated large `deltaY` event does NOT flip the mode back to mouse on its own

#### Scenario: Detection does not block the event

- **WHEN** the detector is observing wheel events for classification
- **THEN** the observed event is delivered to the main wheel handler with no additional latency
- **AND** the main handler still calls `preventDefault` as it does today

### Requirement: Trackpad wheel pans and pinch zooms

On a trackpad, the canvas MUST treat a two-finger scroll as a pan (both axes) and a pinch (delivered as a wheel event with `ctrlKey` true on most platforms) as a zoom. The zoom MUST be centered on the cursor.

#### Scenario: Two-finger trackpad scroll pans the canvas

- **WHEN** a trackpad user produces a wheel event with `deltaY` and `deltaX` and no modifier keys
- **THEN** the canvas viewport translates by `(-deltaX, -deltaY)` (content follows fingers)

#### Scenario: Trackpad pinch zooms in place

- **WHEN** a trackpad user produces a wheel event with `ctrlKey` true (synthesized by the browser for pinch)
- **THEN** the canvas zoom changes by the standard factor
- **AND** the world point under the cursor remains under the cursor after the zoom

### Requirement: Mouse wheel zooms and Shift+wheel pans horizontally

On a mouse, the canvas MUST treat the wheel as a zoom centered on the cursor and Shift+wheel as a horizontal pan. The previous Cmd/Ctrl+wheel shortcut MUST still work as a fallback for users who learned it.

#### Scenario: Mouse wheel zooms in place

- **WHEN** a mouse user scrolls the wheel without modifiers
- **THEN** the canvas zoom changes by the standard factor
- **AND** the world point under the cursor remains under the cursor after the zoom

#### Scenario: Shift+wheel pans horizontally on a mouse

- **WHEN** a mouse user scrolls the wheel with `shiftKey` true
- **THEN** the canvas viewport translates horizontally by `deltaY`
- **AND** the vertical position is unchanged

#### Scenario: Cmd+wheel on a mouse zooms (legacy fallback)

- **WHEN** a mouse user scrolls the wheel with `ctrlKey` or `metaKey` true
- **THEN** the canvas zoom changes by the standard factor (same as the unmodifed wheel case)

### Requirement: Middle-button drag pans the canvas on desktop

On a desktop device that is not a coarse pointer / touch device, the canvas MUST allow the user to pan by holding the middle mouse button and dragging. Left-drag MUST continue to perform selection (or move nodes when applicable), and right-drag MUST continue to pan as it does today.

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

### Requirement: Wheel zoom respects the configured maximum

The wheel handler MUST clamp the zoom to the same `maxZoom` advertised by the React Flow `<Controls>` zoom buttons. A user MUST be able to reach the same maximum zoom by wheel and by clicking the on-screen "Zoom in" button.

#### Scenario: Wheel zoom reaches the configured max

- **WHEN** a user scrolls the wheel up repeatedly starting from the default zoom
- **THEN** the zoom increases and saturates at the React Flow `maxZoom` value
- **AND** further wheel events do not push the zoom above that value

#### Scenario: Cursor-centered zoom keeps the world point stable

- **WHEN** a user zooms in via wheel
- **THEN** the world point under the cursor before the zoom is the same world point under the cursor after the zoom
- **AND** the visual center of the canvas does not jump to a different element

### Requirement: Only one handler processes wheel events

The canvas MUST NOT run two wheel handlers at the same time. React Flow's own `panOnScroll` MUST be disabled, and the custom wheel handler in `useCanvasEffects` MUST be the single source of truth for wheel-driven pan and zoom.

#### Scenario: No dual-handler race

- **WHEN** a user produces a wheel event on the canvas
- **THEN** the custom handler in `useCanvasEffects` is the only code that updates the viewport in response
- **AND** the canvas viewport does not jump or stutter as a result of two competing handlers

### Requirement: Touch and stylus behavior is unchanged

The existing `prefersTouchCanvasUi` branch in `useCanvasInputProfile` MUST continue to drive the touch-specific React Flow props (`panOnDrag={true}`, `selectionOnDrag={false}`, `panActivationKeyCode={null}`). The new "likely trackpad" signal MUST be consulted only when `prefersTouchCanvasUi` is false.

#### Scenario: Touch device still pans with one finger

- **WHEN** a user opens the canvas on a touch device
- **THEN** the canvas uses the touch-specific pan behavior regardless of the new trackpad signal
- **AND** pinch-to-zoom continues to work via React Flow's `zoomOnPinch`

### Requirement: No new translation keys

This change introduces no new user-visible strings. Existing `canvasToolbar.*` keys are unaffected. The `<Controls>` zoom/fit buttons keep their built-in React Flow aria labels. If implementation surfaces a new user-facing string (status, hint, error), it MUST be added to both `en.json` and `pt-BR.json`.

#### Scenario: Locale files unchanged by this change

- **WHEN** the implementation is reviewed against the locale files
- **THEN** `src/infrastructure/i18n/locales/en.json` and `src/infrastructure/i18n/locales/pt-BR.json` contain no new keys added by this change
