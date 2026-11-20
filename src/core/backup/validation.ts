import { HOME, folders, folderId, validateName } from "../filesystem/types";
import type { Entry } from "../filesystem/types";
import { MAX_CAPSULE, MAX_ITEMS } from "./types";
export function safeJson(text: string): unknown {
  return JSON.parse(text, (key, value) => {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw Error("Unsafe JSON property");
    return value;
  });
}
export function validateEntries(value: unknown): Entry[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS)
    throw Error("Invalid filesystem metadata");
  const entries = value as Entry[],
    ids = new Map<string, Entry>(),
    names = new Set<string>();
  for (const e of entries) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(e.id) ||
      ids.has(e.id) ||
      !["file", "directory"].includes(e.kind) ||
      typeof e.name !== "string" ||
      typeof e.mime !== "string" ||
      e.mime.length > 200 ||
      typeof e.extension !== "string" ||
      !Number.isInteger(e.size) ||
      e.size < 0 ||
      e.size > MAX_CAPSULE ||
      !Number.isFinite(e.created) ||
      !Number.isFinite(e.modified) ||
      typeof e.trashed !== "boolean" ||
      typeof e.favorite !== "boolean" ||
      typeof e.protected !== "boolean" ||
      !(e.parentId === null || typeof e.parentId === "string")
    )
      throw Error("Malformed filesystem entry");
    validateName(e.name);
    if (
      e.revision !== undefined &&
      (!Number.isSafeInteger(e.revision) || e.revision < 0)
    )
      throw Error("Invalid revision");
    ids.set(e.id, e);
    if (!e.trashed) {
      const name = e.parentId + "/" + e.name.toLowerCase();
      if (names.has(name)) throw Error("Duplicate filesystem name");
      names.add(name);
    }
  }
  const home = ids.get(HOME);
  if (
    !home ||
    home.kind !== "directory" ||
    home.parentId !== null ||
    home.name !== "Home" ||
    home.trashed ||
    !home.protected
  )
    throw Error("Missing Home directory");
  for (const e of entries) {
    if (folders.some((name) => folderId(name) === e.id)) {
      const name = folders.find((name) => folderId(name) === e.id)!;
      if (
        e.name !== name ||
        e.parentId !== HOME ||
        e.kind !== "directory" ||
        e.trashed ||
        !e.protected
      )
        throw Error("Invalid system folder");
    }
    if (e.id !== HOME) {
      const parent = ids.get(e.parentId!);
      if (!parent || parent.kind !== "directory")
        throw Error("Missing parent folder");
    }
    const seen = new Set<string>();
    let current: Entry | undefined = e;
    while (current) {
      if (seen.has(current.id)) throw Error("Directory cycle");
      seen.add(current.id);
      current = ids.get(current.parentId!);
    }
    if (
      e.protected &&
      e.id !== HOME &&
      !folders.some(
        (f) =>
          folderId(f) === e.id &&
          e.name === f &&
          e.parentId === HOME &&
          e.kind === "directory" &&
          !e.trashed,
      )
    )
      throw Error("Invalid protected folder");
  }
  return entries;
}
// Inspect ZIP central directory before any decompression; reject ZIP64, encryption and oversized entries.
export function preflightZip(bytes: Uint8Array) {
  if (bytes.length > MAX_CAPSULE)
    throw Error("Capsules are limited to 100 MB compressed and expanded.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw Error("Invalid or multi-volume ZIP");
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (count > MAX_ITEMS + 10 || count === 65535 || offset + size > end)
    throw Error("Unsupported or excessive ZIP directory");
  let pos = offset,
    total = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
      throw Error("Malformed ZIP directory");
    const flags = view.getUint16(pos + 8, true),
      method = view.getUint16(pos + 10, true),
      packed = view.getUint32(pos + 20, true),
      expanded = view.getUint32(pos + 24, true),
      len = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true),
      disk = view.getUint16(pos + 34, true);
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      expanded === 0xffffffff ||
      packed === 0xffffffff ||
      disk
    )
      throw Error("Unsupported ZIP feature");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(pos + 46, pos + 46 + len),
    );
    if (
      !name ||
      name.startsWith("/") ||
      name.includes(String.fromCharCode(92)) ||
      name.includes(":") ||
      name.split("/").some((s) => s === ".." || s === ".") ||
      names.has(name) ||
      pos + 46 + len + extra + comment > end
    )
      throw Error("Unsafe or duplicate archive path");
    names.add(name);
    total += expanded;
    if (
      total > MAX_CAPSULE ||
      expanded > MAX_CAPSULE ||
      (packed > 0 && expanded / packed > 10000)
    )
      throw Error("Archive decompression limit exceeded");
    pos += 46 + len + extra + comment;
  }
  if (pos !== offset + size) throw Error("Invalid ZIP directory size");
  return total;
}
export async function sha256(bytes: Uint8Array) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
