/**
 * Centralized timing constants for the application.
 * All timeout, interval, and debounce values should be defined here
 * to ensure consistency across the codebase.
 */

// Collaboration / WebSocket timeouts
/** Ping interval for WebSocket heartbeat (25 seconds) */
export const CLIENT_PING_INTERVAL_MS = 25_000;
/** Timeout waiting for pong response before disconnecting (10 seconds) */
export const CLIENT_PONG_TIMEOUT_MS = 10_000;
/** Coalescing interval for batching patches (50ms) */
export const BATCH_INTERVAL_MS = 50;

// Persistence / Storage
/** Debounce delay for persisting diagram state to storage (1 second) */
export const PERSIST_DEBOUNCE_MS = 1_000;
/** Interval for checking localStorage health (30 seconds) */
export const CHECK_INTERVAL_MS = 30_000;

// Debounce / Throttle
/** Debounce delay for diagram change notifications (300ms) */
export const DIAGRAM_CHANGE_DEBOUNCE_MS = 300;
/** Debounce delay for field updates (300ms) */
export const FIELD_DEBOUNCE_MS = 300;
