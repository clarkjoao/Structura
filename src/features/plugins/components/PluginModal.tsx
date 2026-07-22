import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { overlayRegistry } from "../overlay-registry";
import { PluginErrorBoundary } from "./PluginErrorBoundary";

interface PluginModalProps {
  title: string;
  content: React.ComponentType<{ onClose: () => void }>;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "max-w-[400px]",
  md: "max-w-[500px]",
  lg: "max-w-[700px]",
};

export function PluginModal({ title, content: Content, size = "md" }: PluginModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store previously focused element and focus modal on mount
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal
    modalRef.current?.focus();

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        overlayRegistry.closeModal();
      }
    };

    document.addEventListener("keydown", handleEscape);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";

      // Restore focus
      previousActiveElement.current?.focus();
    };
  }, []);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTab);
    return () => modal.removeEventListener("keydown", handleTab);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      overlayRegistry.closeModal();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plugin-modal-title"
        tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} rounded-lg bg-card shadow-xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="plugin-modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => overlayRegistry.closeModal()}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content — error-boundaried: a throwing plugin dialog must not crash the app. */}
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <PluginErrorBoundary
            label="modal content"
            fallback={
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {t("plugins.modal.crashed")}
              </p>
            }
          >
            <Content onClose={() => overlayRegistry.closeModal()} />
          </PluginErrorBoundary>
        </div>
      </div>
    </div>
  );
}
