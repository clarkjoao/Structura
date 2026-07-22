import { Component, type ReactNode } from "react";

interface PluginErrorBoundaryProps {
  /** Rendered in place of the children once they have thrown. */
  fallback: ReactNode;
  /** Context label for the logged error, e.g. "panel" or "modal content". */
  label: string;
  children: ReactNode;
}

/**
 * A crashing plugin surface (panel, toolbar item, modal content) must never take down the
 * hosting page — plugin code is third-party. This boundary swaps in a small fallback and
 * logs, so the rest of the app keeps running (plugin-system spec: containment).
 */
export class PluginErrorBoundary extends Component<PluginErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(`[plugins] ${this.props.label} crashed:`, error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
