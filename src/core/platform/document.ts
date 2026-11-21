import type { AppPackage } from "./types";
import { sdkRuntime } from "./sdk";
export function buildAppDocument(p: AppPackage, token: string) {
  const doc = new DOMParser().parseFromString(
    p.files["index.html"],
    "text/html",
  );
  for (const node of doc.querySelectorAll(
    "base,iframe,object,embed,form,meta[http-equiv],link:not([rel=stylesheet])",
  ))
    node.remove();
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    if (link.getAttribute("href") !== "styles.css")
      throw Error("Only local styles.css is supported");
    const style = doc.createElement("style");
    style.textContent = p.files["styles.css"];
    link.replaceWith(style);
  }
  if (!doc.querySelector("style")) {
    const style = doc.createElement("style");
    style.textContent = p.files["styles.css"];
    doc.head.append(style);
  }
  for (const image of doc.querySelectorAll("img[src]")) {
    const path = image.getAttribute("src")!;
    if (!p.files[path] || !path.startsWith("assets/"))
      throw Error("Images must reference included assets");
    image.setAttribute("src", p.files[path]);
  }
  for (const script of doc.querySelectorAll("script")) script.remove();
  const sdk = doc.createElement("script");
  sdk.textContent = sdkRuntime(token);
  doc.head.prepend(sdk);
  const code = doc.createElement("script");
  code.textContent = p.files["app.js"];
  doc.body.append(code);
  const csp = doc.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
  doc.head.prepend(csp);
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}
