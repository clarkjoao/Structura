import { useEffect, useRef, useState } from "react";

export interface CanvasInputProfile {
  isTouchDevice: boolean;
  isCoarsePointer: boolean;
  prefersTouchCanvasUi: boolean;
  /**
   * Best-effort runtime signal that the user is on a trackpad rather than a mouse.
   * Always false on touch / coarse-pointer devices. Non-persistent: re-detected on
   * each load from observed wheel events.
   */
  likelyTrackpad: boolean;
}

interface TrackpadSample {
  timestamp: number;
  deltaX: number;
  deltaY: number;
}

const TRACKPAD_WINDOW_MS = 400;
/** Maximum number of samples kept in the rolling window. */
const TRACKPAD_BUFFER_SIZE = 16;
/** At least this many small-delta events inside the window flip the mode to trackpad. */
const TRACKPAD_HIT_THRESHOLD = 4;
/** Below this absolute deltaY we consider the event "small" (likely a trackpad). */
const TRACKPAD_DELTA_THRESHOLD = 50;

function readInputProfile(): CanvasInputProfile {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isTouchDevice: false,
      isCoarsePointer: false,
      prefersTouchCanvasUi: false,
      likelyTrackpad: false,
    };
  }

  const isTouchDevice = navigator.maxTouchPoints > 0;
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  return {
    isTouchDevice,
    isCoarsePointer,
    prefersTouchCanvasUi: isTouchDevice || isCoarsePointer,
    likelyTrackpad: false,
  };
}

function isTrackpadLikeEvent(sample: TrackpadSample): boolean {
  if (Math.abs(sample.deltaY) >= TRACKPAD_DELTA_THRESHOLD) return false;
  // Trackpad two-finger swipes produce non-zero deltaX; mouse wheel rarely does.
  return sample.deltaX !== 0;
}

export function useCanvasInputProfile(): CanvasInputProfile {
  const [profile, setProfile] = useState<CanvasInputProfile>(() => readInputProfile());
  const samplesRef = useRef<TrackpadSample[]>([]);
  const likelyTrackpadRef = useRef(false);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (profile.prefersTouchCanvasUi) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if (event.shiftKey) return;

      const now = performance.now();
      const samples = samplesRef.current;
      samples.push({ timestamp: now, deltaX: event.deltaX, deltaY: event.deltaY });
      while (samples.length > TRACKPAD_BUFFER_SIZE) samples.shift();

      const fresh = samples.filter((s) => now - s.timestamp <= TRACKPAD_WINDOW_MS);
      samples.length = 0;
      fresh.forEach((s) => samples.push(s));

      if (likelyTrackpadRef.current) return;

      const trackpadHits = fresh.filter(isTrackpadLikeEvent).length;
      if (trackpadHits >= TRACKPAD_HIT_THRESHOLD) {
        likelyTrackpadRef.current = true;
        setProfile((prev) => (prev.likelyTrackpad ? prev : { ...prev, likelyTrackpad: true }));
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [profile.prefersTouchCanvasUi]);

  return profile;
}
