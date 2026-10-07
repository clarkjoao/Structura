/**
 * The preview page for a webview: the built `embed.html` with a `<base>` pointing at its
 * folder (its assets are relative) and a Content-Security-Policy limited to the webview's
 * own resources. Styles allow `'unsafe-inline'`: the canvas positions nodes with inline
 * styles.
 */
export function previewHtml(embedHtml: string, baseUri: string, cspSource: string): string {
  const csp = [
    "default-src 'none'",
    `script-src ${cspSource}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `img-src ${cspSource} data: blob:`,
    `font-src ${cspSource} data:`,
    `connect-src ${cspSource}`,
  ].join("; ");
  const head = `<meta http-equiv="Content-Security-Policy" content="${csp}">\n    <base href="${baseUri.replace(/\/?$/, "/")}">`;
  return embedHtml.replace(/<head>/i, `<head>\n    ${head}`);
}
