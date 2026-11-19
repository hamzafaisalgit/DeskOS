import { filesystem as fs } from "../filesystem/service";
import { resolveVirtual } from "./paths";
export async function buildWebPreview(id: string) {
  const entry = await fs.getEntry(id);
  if (!/html?$/.test(entry.extension))
    throw Error(
      "Open an HTML document to preview. Only browser-native HTML, CSS and classic JavaScript are supported.",
    );
  const { blob } = await fs.readDocument(id);
  const doc = new DOMParser().parseFromString(await blob.text(), "text/html");
  const base = entry.parentId!;
  const read = async (path: string) => {
    if (/^(?:[a-z]+:|\/\/|\/)/i.test(path))
      throw Error("Preview supports relative local resources only.");
    return fs.getFileContent(
      (await resolveVirtual(path.split(/[?#]/)[0], base)).id,
    );
  };
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const style = doc.createElement("style");
    style.textContent = await (
      await read(link.getAttribute("href") ?? "")
    ).text();
    link.replaceWith(style);
  }
  for (const script of doc.querySelectorAll("script[src]")) {
    if (script.getAttribute("type") === "module")
      throw Error(
        "Module imports and npm builds are not supported by this preview. Use classic local scripts.",
      );
    const text = await (await read(script.getAttribute("src")!)).text();
    script.removeAttribute("src");
    script.textContent = text;
  }
  for (const script of doc.querySelectorAll('script[type="module"]')) {
    if (script)
      throw Error(
        "ES modules require a build system and are not supported in this preview.",
      );
  }
  for (const image of doc.querySelectorAll("img[src]")) {
    const b = await read(image.getAttribute("src")!);
    if (b.size > 5 * 1024 * 1024)
      throw Error("Preview images must be below 5 MB.");
    const bytes = new Uint8Array(await b.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    image.setAttribute(
      "src",
      `data:${b.type || "application/octet-stream"};base64,${btoa(binary)}`,
    );
  }
  const csp = doc.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
  doc.head.prepend(csp);
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}
