import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@/infrastructure/i18n";
import { CollabSessionClosedModal } from "../components/CollabSessionClosedModal";
import { endReasonMessage } from "../utils/endReasonMessage";
import type { CollabEndReason } from "../types";

const MB = 1024 * 1024;

describe("why a session ended", () => {
  it("states a too-large diagram's size and the limit", async () => {
    await i18n.changeLanguage("en");
    expect(endReasonMessage(i18n.t, "too_large", { size: 9.5 * MB, limit: 8 * MB }, "Ana")).toBe(
      "This diagram is too large for a live session (9.5 MB, limit 8 MB).",
    );
  });

  it("has a localised sentence for every reason, in both languages", async () => {
    const reasons: CollabEndReason[] = [
      "host_closed",
      "host_timeout",
      "room_unknown",
      "room_full",
      "protocol_mismatch",
      "too_large",
      "invalid_seed",
      "unauthorized",
      "unreachable",
    ];
    for (const language of ["en", "pt-BR"]) {
      await i18n.changeLanguage(language);
      for (const reason of reasons) {
        const text = endReasonMessage(i18n.t, reason, { size: MB, limit: 8 * MB }, "Ana");
        expect(text, `${language}/${reason}`).not.toMatch(/collaboration\./);
        expect(text.length).toBeGreaterThan(10);
      }
    }
    await i18n.changeLanguage("en");
  });

  it("names the room limit when the room is full", async () => {
    await i18n.changeLanguage("pt-BR");
    expect(endReasonMessage(i18n.t, "room_full", { limit: 50 }, "Ana")).toContain("50");
    await i18n.changeLanguage("en");
  });

  it("the guest's closing dialog shows the reason and offers the import", async () => {
    await i18n.changeLanguage("en");
    render(
      <CollabSessionClosedModal
        open
        hostName="Ana"
        reason="host_timeout"
        canImport
        onImportAndContinue={() => {}}
        onBackToWorkspace={() => {}}
      />,
    );
    expect(screen.getByText("Host disconnected")).toBeTruthy();
    expect(screen.getByText(/Ana left/)).toBeTruthy();
    expect(screen.getByText("Import and continue")).toBeTruthy();
  });
});
