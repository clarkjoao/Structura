import { lazy } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  forgetFamilyIconResolver,
  rememberFamilyIconResolver,
} from "@/features/elements/families/family-icon-resolvers";
import type { CloudFamilyId } from "@/features/elements/families/cloud-family.types";
import type { IconResolver } from "../model/cloud.types";
import CloudIcon from "./CloudIcon";

const FAMILY = "load-failure" as CloudFamilyId;

// What Vite's 504 "Outdated Optimize Dep" turns a dynamic import into.
const LazyIcon = lazy(() =>
  Promise.reject(new Error("Failed to fetch dynamically imported module")),
);

const failing: IconResolver = {
  resolve: () => LazyIcon,
  Fallback: () => <span data-testid="family-fallback" />,
};

afterEach(() => forgetFamilyIconResolver(FAMILY));

describe("CloudIcon", () => {
  it("shows the family's icon when the icon's module fails to load", async () => {
    rememberFamilyIconResolver(FAMILY, failing);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<CloudIcon familyId={FAMILY} iconName="Lambda" />);
    expect(await screen.findByTestId("family-fallback")).toBeTruthy();
    spy.mockRestore();
  });
});
