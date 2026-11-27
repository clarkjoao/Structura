/**
 * Centralized timing constants for the application.
 * All timeout, interval, and debounce values should be defined here
 * to ensure consistency across the codebase.
 */

// Persistence / Storage
/** Debounce delay for persisting diagram state to storage (1 second) */
export const PERSIST_DEBOUNCE_MS = 1_000;
/** Interval for checking localStorage health (30 seconds) */
export const CHECK_INTERVAL_MS = 30_000;

// Debounce / Throttle
/** Debounce delay for diagram change notifications (300ms) */
export const DIAGRAM_CHANGE_DEBOUNCE_MS = 300;
