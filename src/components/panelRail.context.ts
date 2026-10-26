import { createContext } from "react";

/**
 * True under a page that draws the panel rail: the panels it toggles then fold away entirely
 * instead of leaving their own rail to expand them from.
 */
export const PanelRailContext = createContext(false);
