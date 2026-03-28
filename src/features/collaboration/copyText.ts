function copyWithExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;

  const active = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const range =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.padding = "0";
    textarea.style.border = "0";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    textarea.style.fontSize = "16px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const copied =
      typeof document.execCommand === "function"
        ? document.execCommand("copy")
        : false;
    document.body.removeChild(textarea);

    if (selection) {
      selection.removeAllRanges();
      if (range) selection.addRange(range);
    }
    active?.focus?.();
    return copied;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  // Try sync copy first while we're still in the click gesture context.
  if (copyWithExecCommand(text)) return true;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
