import { useEffect, useState } from "react";
import { KEY, keyIsOneOf } from "@/lib/keyboard-utils";

export function useModifierKey(): boolean {
  const [isModifierActive, setIsModifierActive] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (keyIsOneOf(event, [KEY.CONTROL, KEY.META])) {
        setIsModifierActive(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (keyIsOneOf(event, [KEY.CONTROL, KEY.META])) {
        setIsModifierActive(false);
      }
    };

    const handleWindowBlur = () => {
      setIsModifierActive(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  return isModifierActive;
}
