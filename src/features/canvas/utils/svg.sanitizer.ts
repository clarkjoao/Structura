const DANGEROUS_TAG_NAMES = new Set(["script", "iframe", "object", "embed", "link"]);

function walkElements(root: Element, visit: (element: Element) => void): void {
  visit(root);
  for (const child of root.children) {
    walkElements(child, visit);
  }
}

function removeDangerousTags(svgRoot: Element): void {
  const toRemove: Element[] = [];
  walkElements(svgRoot, (element) => {
    if (DANGEROUS_TAG_NAMES.has(element.tagName.toLowerCase())) {
      toRemove.push(element);
    }
  });
  for (const element of toRemove) {
    element.remove();
  }
}

function sanitizeAttributes(svgRoot: Element): void {
  walkElements(svgRoot, (element) => {
    const attributes = [...element.attributes];
    for (const attribute of attributes) {
      const nameLower = attribute.name.toLowerCase();
      if (nameLower.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      const isHref =
        nameLower === "href" || nameLower === "xlink:href" || nameLower.endsWith(":href");
      if (isHref) {
        const valueLower = attribute.value.trim().toLowerCase();
        if (valueLower.startsWith("javascript:")) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
      if (nameLower === "style") {
        const valueLower = attribute.value.toLowerCase();
        if (valueLower.includes("expression(") || valueLower.includes("javascript:")) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  });
}

function isSvgRootElement(document: Document): boolean {
  const root = document.documentElement;
  return root !== null && root.tagName.toLowerCase() === "svg";
}

function stripOuterSvgNoise(markup: string): string {
  let result = markup.replace(/^\uFEFF/, "").trim();
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(/^<\?xml[\s\S]*?\?>\s*/i, "").trim();
    result = result.replace(/^<!DOCTYPE[\s\S]*?(?:>\s*|\n+|$)/i, "").trim();
    result = result.replace(/^<!--[\s\S]*?-->\s*/, "").trim();
  }
  return result;
}

export function sanitizeSvg(rawSvg: string): string | null {
  if (!rawSvg.trim()) {
    return null;
  }
  const trimmed = stripOuterSvgNoise(rawSvg);
  if (!/^<svg(\s|>)/i.test(trimmed)) {
    return null;
  }

  const parsed = new DOMParser().parseFromString(trimmed, "image/svg+xml");

  if (parsed.getElementsByTagName("parsererror").length > 0) {
    return null;
  }

  if (!isSvgRootElement(parsed)) {
    return null;
  }

  const svgRoot = parsed.documentElement;
  removeDangerousTags(svgRoot);
  sanitizeAttributes(svgRoot);

  svgRoot.setAttribute("width", "100%");
  svgRoot.setAttribute("height", "100%");

  return new XMLSerializer().serializeToString(svgRoot);
}
