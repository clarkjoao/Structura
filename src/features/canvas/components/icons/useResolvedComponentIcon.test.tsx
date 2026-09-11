import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { IconDefinition } from "@/features/diagram";
import { ComponentIconLookupProvider } from "./ComponentIconLookupProvider";
import { useResolvedComponentIcon } from "./componentIconLookupContext";

const icon: IconDefinition = {
  id: "ico-1",
  name: "Box",
  source: { kind: "lucide", iconName: "box" },
  createdAt: 0,
  usageCount: 1,
};

describe("useResolvedComponentIcon", () => {
  it("uses the payload lookup when a provider is mounted", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ComponentIconLookupProvider lookup={(id) => (id === "n1" ? icon : null)}>
        {children}
      </ComponentIconLookupProvider>
    );
    const { result } = renderHook(() => useResolvedComponentIcon("n1"), { wrapper });
    expect(result.current).toEqual(icon);
  });

  it("does not fall back to the workspace store while a lookup is mounted", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ComponentIconLookupProvider lookup={() => null}>{children}</ComponentIconLookupProvider>
    );
    const { result } = renderHook(() => useResolvedComponentIcon("n1"), { wrapper });
    expect(result.current).toBeNull();
  });
});
