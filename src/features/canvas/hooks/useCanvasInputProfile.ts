import { useEffect, useState } from "react";

export interface CanvasInputProfile {
  isTouchDevice: boolean;
  isCoarsePointer: boolean;
  prefersTouchCanvasUi: boolean;
}

function readInputProfile(): CanvasInputProfile {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isTouchDevice: false,
      isCoarsePointer: false,
      prefersTouchCanvasUi: false,
    };
  }

  const isTouchDevice = navigator.maxTouchPoints > 0;
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  return {
    isTouchDevice,
    isCoarsePointer,
    prefersTouchCanvasUi: isTouchDevice || isCoarsePointer,
  };
}

/**
 * Pointer capabilities of the device, used only to pick the touch-specific React Flow props.
 *
 * There is deliberately no trackpad-vs-mouse signal here. The wheel-sampling heuristic this
 * hook used to run required a non-zero `deltaX` to classify a trackpad, so a plain vertical
 * two-finger scroll never qualified and fell into the mouse branch, which zoomed. Wheel
 * behavior is now device-independent and driven by the `scrollMode` preference instead.
 */
export function useCanvasInputProfile(): CanvasInputProfile {
  const [profile, setProfile] = useState<CanvasInputProfile>(() => readInputProfile());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateProfile = () => setProfile(readInputProfile());

    updateProfile();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateProfile);
    } else {
      mediaQuery.addListener(updateProfile);
    }
    window.addEventListener("resize", updateProfile);

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateProfile);
      } else {
        mediaQuery.removeListener(updateProfile);
      }
      window.removeEventListener("resize", updateProfile);
    };
  }, []);

  return profile;
}
