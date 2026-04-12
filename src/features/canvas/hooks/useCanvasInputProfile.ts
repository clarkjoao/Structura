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
