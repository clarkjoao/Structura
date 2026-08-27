import "./commands";

if (typeof window !== "undefined") {
  const win = window as unknown as {
    Cypress?: { log: (s: string) => void };
    __cypressDebug?: boolean;
  };
  // Mark so application code knows we are under Cypress.
  win.__cypressDebug = true;
}
