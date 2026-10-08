import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PluginCodeEditor } from "./PluginCodeEditor";

describe("PluginCodeEditor", () => {
  it("saves on Ctrl/Cmd+S typed in the editor, before the canvas can claim it", () => {
    const onSave = vi.fn();
    const canvas = vi.fn();
    document.addEventListener("keydown", canvas, true);
    render(<PluginCodeEditor value="a: 1" onSave={onSave} />);
    fireEvent.keyDown(screen.getByTestId("monaco-stand-in"), { key: "s", metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(canvas).not.toHaveBeenCalled();
    document.removeEventListener("keydown", canvas, true);
  });

  it("leaves Ctrl/Cmd+S elsewhere alone", () => {
    const onSave = vi.fn();
    render(<PluginCodeEditor value="a: 1" onSave={onSave} />);
    fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("marks itself so React Flow does not treat keys typed in it as canvas shortcuts", () => {
    render(<PluginCodeEditor value="a: 1" />);
    expect(screen.getByTestId("monaco-stand-in").closest(".nokey")).not.toBeNull();
  });
});
