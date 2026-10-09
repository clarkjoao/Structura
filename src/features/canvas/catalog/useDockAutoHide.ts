import { useCallback, useEffect, useRef, useState } from "react";

/** How long the pointer may be away before the toolbar slides out. */
export const DOCK_HIDE_DELAY_MS = 400;

interface DockAutoHide {
  visible: boolean;
  /** Spread on the toolbar and on the reveal strip under it. */
  pointerHandlers: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
  /** Spread on the toolbar: keyboard focus inside it keeps it out. */
  focusHandlers: {
    onFocus: (event: React.FocusEvent<HTMLElement>) => void;
    onBlur: (event: React.FocusEvent<HTMLElement>) => void;
  };
}

/**
 * macOS Dock behaviour for the bottom toolbar. With `enabled` off it is always
 * visible. On, it shows while the pointer is over it (or the reveal strip at
 * the bottom edge), while it holds keyboard focus, and while `held` — a menu
 * or the catalog it opened is up — and hides a moment after none is true.
 */
export function useDockAutoHide(enabled: boolean, held: boolean): DockAutoHide {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLeave = () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };

  useEffect(() => cancelLeave, []);

  const onPointerEnter = useCallback(() => {
    cancelLeave();
    setHovered(true);
  }, []);

  const onPointerLeave = useCallback(() => {
    cancelLeave();
    leaveTimer.current = setTimeout(() => setHovered(false), DOCK_HIDE_DELAY_MS);
  }, []);

  // Only keyboard focus holds it: the catalog hands focus back to its button
  // when it closes, and a mouse user should not find the toolbar stuck out.
  const onFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (event.target.matches(":focus-visible")) setFocused(true);
  }, []);
  const onBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setFocused(false);
  }, []);

  return {
    visible: !enabled || hovered || focused || held,
    pointerHandlers: { onPointerEnter, onPointerLeave },
    focusHandlers: { onFocus, onBlur },
  };
}
