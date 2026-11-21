import JSZip from "jszip";
import { safeJson, preflightZip } from "../backup/validation";
import { capabilities } from "./types";
import type { AppManifest, AppPackage, PlatformState } from "./types";
export const PACKAGE_LIMIT = 512 * 1024,
  PLATFORM_LIMIT = 2 * 1024 * 1024,
  DATA_LIMIT = 64 * 1024;
const textFiles = ["manifest.json", "index.html", "styles.css", "app.js"];
export function validateManifest(value: unknown): AppManifest {
  const m = value as AppManifest;
  if (
    !m ||
    m.format !== "deskos-app" ||
    m.packageVersion !== 1 ||
    m.sdk !== 1 ||
    typeof m.id !== "string" ||
    !/^([a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/.test(m.id) ||
    m.id.length > 80
  )
    throw Error("Invalid app manifest, ID or SDK version.");
  for (const [key, max] of [
    ["name", 70],
    ["description", 1000],
    ["developer", 100],
    ["category", 40],
    ["icon", 4],
  ] as const)
    if (typeof m[key] !== "string" || !m[key].trim() || m[key].length > max)
      throw Error("Invalid manifest " + key);
  if (
    !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(m.version) ||
    m.entrypoint !== "index.html" ||
    typeof m.multiple !== "boolean" ||
    !Array.isArray(m.capabilities) ||
    m.capabilities.some((c) => !capabilities.includes(c)) ||
    new Set(m.capabilities).size !== m.capabilities.length ||
    !Array.isArray(m.fileTypes) ||
    m.fileTypes.length > 12 ||
    m.fileTypes.some((e) => typeof e !== "string" || !/^\w{1,12}$/.test(e)) ||
    !Array.isArray(m.keywords) ||
    m.keywords.length > 20 ||
    m.keywords.some((k) => typeof k !== "string" || k.length > 40)
  )
    throw Error("Invalid manifest fields, version or capabilities.");
  return {
    ...m,
    capabilities: [...m.capabilities],
    fileTypes: [...m.fileTypes],
    keywords: [...m.keywords],
  };
}
export function validatePackage(value: unknown): AppPackage {
  const p = value as AppPackage;
  const manifest = validateManifest(p?.manifest);
  if (
    !p.files ||
    typeof p.files !== "object" ||
    Array.isArray(p.files) ||
    Object.keys(p.files).length > 40
  )
    throw Error("Invalid package resources");
  let size = 0;
  for (const [name, content] of Object.entries(p.files)) {
    if (
      typeof content !== "string" ||
      (!textFiles.includes(name) &&
        !/^assets\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(name))
    )
      throw Error("Unsupported package resource: " + name);
    if (
      name.startsWith("assets/") &&
      !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(content)
    )
      throw Error("Invalid embedded image");
    size += new TextEncoder().encode(content).length;
  }
  if (
    size > PACKAGE_LIMIT ||
    !p.files["index.html"] ||
    !p.files["app.js"] ||
    !p.files["styles.css"]
  )
    throw Error(
      "Package exceeds 512 KB or is missing index.html, app.js or styles.css",
    );
  return {
    manifest,
    files: { ...p.files, "manifest.json": JSON.stringify(manifest, null, 2) },
  };
}
export async function parseAppPackage(blob: Blob) {
  if (blob.size > PACKAGE_LIMIT)
    throw Error("App package must be below 512 KB");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (preflightZip(bytes) > PACKAGE_LIMIT)
    throw Error("Expanded app package exceeds 512 KB");
  const zip = await JSZip.loadAsync(bytes);
  if (Object.keys(zip.files).length > 45)
    throw Error("Too many package entries");
  const files: Record<string, string> = {};
  let total = 0;
  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    if (
      !textFiles.includes(file.name) &&
      !/^assets\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(file.name)
    )
      throw Error("Unsupported resource " + file.name);
    const content = await limited(file, PACKAGE_LIMIT - total);
    total += content.length;
    if (total > PACKAGE_LIMIT) throw Error("Package too large");
    if (file.name.startsWith("assets/")) {
      let binary = "";
      for (const b of content) binary += String.fromCharCode(b);
      const ext = file.name.split(".").at(-1);
      files[file.name] =
        "data:image/" +
        (ext === "jpg" ? "jpeg" : ext) +
        ";base64," +
        btoa(binary);
    } else
      files[file.name] = new TextDecoder("utf-8", { fatal: true }).decode(
        content,
      );
  }
  await JSZip.loadAsync(bytes, { checkCRC32: true });
  if (!files["manifest.json"]) throw Error("Missing manifest.json");
  return validatePackage({ manifest: safeJson(files["manifest.json"]), files });
}
async function limited(
  file: JSZip.JSZipObject,
  limit: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    type Stream = {
      pause: () => void;
      resume: () => void;
      on: (
        event: string,
        cb: ((x: Uint8Array) => void) | ((e: unknown) => void) | (() => void),
      ) => Stream;
    };
    const stream = (
      file as unknown as { internalStream: (t: string) => Stream }
    ).internalStream("uint8array");
    const chunks: Uint8Array[] = [];
    let size = 0;
    stream
      .on("data", (c: Uint8Array) => {
        size += c.length;
        if (size > limit) {
          stream.pause();
          reject(Error("Decompression limit exceeded"));
          return;
        }
        chunks.push(c);
      })
      .on("error", reject)
      .on("end", () => {
        const result = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
          result.set(c, offset);
          offset += c.length;
        }
        resolve(result);
      });
    stream.resume();
  });
}
export async function packageApp(p: AppPackage) {
  const valid = validatePackage(p),
    zip = new JSZip();
  for (const [path, content] of Object.entries(valid.files)) {
    if (path.startsWith("assets/"))
      zip.file(path, content.split(",")[1], { base64: true });
    else zip.file(path, content);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
export function validatePlatform(
  value: unknown,
  imported = false,
): PlatformState {
  const s = value as PlatformState;
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.installed) ||
    s.installed.length > 20 ||
    !s.data ||
    typeof s.data !== "object" ||
    Array.isArray(s.data) ||
    !s.grants ||
    typeof s.grants !== "object" ||
    !Array.isArray(s.events) ||
    typeof s.externalPackages !== "boolean"
  )
    throw Error("Invalid platform storage");
  if (new TextEncoder().encode(JSON.stringify(s)).length > PLATFORM_LIMIT)
    throw Error("App platform storage exceeds 2 MB");
  const seen = new Set<string>();
  const installed = s.installed.map((item) => {
    const p = validatePackage(item.package);
    if (seen.has(p.manifest.id)) throw Error("Duplicate installed app");
    seen.add(p.manifest.id);
    return {
      ...item,
      package: p,
      enabled: !imported && item.enabled === true,
      previous: item.previous ? validatePackage(item.previous) : undefined,
    };
  });
  const grants: PlatformState["grants"] = {};
  if (!imported)
    for (const [id, list] of Object.entries(s.grants)) {
      if (!Array.isArray(list) || list.some((c) => !capabilities.includes(c)))
        throw Error("Invalid capability grants");
      grants[id] = list;
    }
  for (const data of Object.values(s.data))
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      new TextEncoder().encode(JSON.stringify(data)).length > DATA_LIMIT
    )
      throw Error("Invalid app-owned data");
  return {
    ...s,
    installed,
    grants,
    events: s.events
      .filter(
        (e) =>
          e &&
          typeof e.appId === "string" &&
          typeof e.action === "string" &&
          Number.isFinite(e.time),
      )
      .slice(-100),
  };
}
export function compareVersions(a: string, b: string) {
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return Math.sign(x[i] - y[i]);
  return 0;
}
