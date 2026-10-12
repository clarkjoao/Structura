import { defineConfig } from "cypress";
import {
  movePeerOnce,
  quietSwarm,
  readRoom,
  startSwarm,
  stopSwarm,
  movePointerPeer,
  pointerPeerSeen,
  startPointerPeer,
  stopPointerPeer,
} from "./cypress/support/collab-swarm";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4173",
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 15000,
    responseTimeout: 15000,
    taskTimeout: 60000,
    video: false,
    screenshotOnRunFailure: true,
    testIsolation: false,
    /** JSON output for `mochawesome-merge` + `marge` (see npm scripts `cy:report:*`). */
    reporter: "mochawesome",
    reporterOptions: {
      reportDir: "cypress/reports/mochawesome",
      overwrite: false,
      html: false,
      json: true,
      charts: true,
    },
    setupNodeEvents(on) {
      on("task", {
        log(message: string) {
          console.log(message);
          return null;
        },
        // Collaboration stress (collab-load.cy.ts): bots that share the browser's room.
        "collab:startSwarm": startSwarm,
        "collab:quietSwarm": quietSwarm,
        "collab:stopSwarm": stopSwarm,
        "collab:readRoom": readRoom,
        "collab:movePeerOnce": movePeerOnce,
        "collab:startPointerPeer": startPointerPeer,
        "collab:movePointerPeer": movePointerPeer,
        "collab:stopPointerPeer": stopPointerPeer,
        "collab:pointerPeerSeen": pointerPeerSeen,
      });
    },
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
  },
});
