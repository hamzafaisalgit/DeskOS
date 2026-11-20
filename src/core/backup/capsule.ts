import JSZip from "jszip";
import { db } from "../filesystem/database";
import { filesystem } from "../filesystem/service";
import { coverage, categoryValues, validateDeepSettings } from "./coverage";
import { MAX_CAPSULE, MAX_JSON } from "./types";
import type { CapsuleData, Manifest, Stage } from "./types";
import { safeJson, preflightZip, sha256, validateEntries } from "./validation";
async function readLimited(
  file: JSZip.JSZipObject,
  limit: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Uint8Array[] = [];
    type Stream = {
      pause: () => void;
      resume: () => void;
      on: (
        name: string,
        callback:
          | ((chunk: Uint8Array) => void)
          | ((error: unknown) => void)
          | (() => void),
      ) => Stream;
    };
    const stream = (
      file as unknown as { internalStream: (type: string) => Stream }
    ).internalStream("uint8array");
    stream
      .on("data", (chunk: Uint8Array) => {
        size += chunk.length;
        if (size > limit) {
          stream.pause();
          reject(
            Error("Expanded archive entry exceeds its verified size limit"),
          );
          return;
        }
        chunks.push(chunk);
      })
      .on("error", reject)
      .on("end", () => {
        const output = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          output.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(output);
      });
    stream.resume();
  });
}
export async function exportCapsule(
  categories: string[],
  fileIds?: string[],
  stage: Stage = () => {},
): Promise<Blob> {
  stage("Reading persisted data");
  await filesystem.initialize();
  if (categories.some((id) => !coverage.some((c) => c.id === id)))
    throw Error("Unknown export category");
  const zip = new JSZip(),
    checksums: Manifest["checksums"] = {};
  let bytes = 0;
  const add = async (path: string, data: Uint8Array) => {
    bytes += data.byteLength;
    if (bytes > MAX_CAPSULE)
      throw Error("Export exceeds 100 MB. Choose a smaller scope.");
    checksums[path] = { sha256: await sha256(data), size: data.byteLength };
    zip.file(path, data);
  };
  let entries: CapsuleData["entries"] = [],
    contents: { id: string; blob: Blob }[];
  if (categories.includes("files")) {
    const snapshot = await db.transaction(
      "r",
      db.entries,
      db.contents,
      async () => ({
        entries: await db.entries.toArray(),
        contents: await db.contents.toArray(),
      }),
    );
    entries = snapshot.entries;
    contents = snapshot.contents;
    if (fileIds) {
      const ids = new Set(fileIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of entries)
          if (ids.has(e.parentId!) && !ids.has(e.id)) {
            ids.add(e.id);
            changed = true;
          }
      }
      for (const id of [...ids]) {
        let e = entries.find((e) => e.id === id);
        while (e) {
          ids.add(e.id);
          e = entries.find((p) => p.id === e!.parentId);
        }
      }
      entries = entries.filter((e) => ids.has(e.id) || e.protected);
    }
    validateEntries(entries);
    if (entries.reduce((n, e) => n + e.size, 0) > MAX_CAPSULE)
      throw Error("Choose a smaller export below 100 MB.");
    await add(
      "filesystem/metadata.json",
      new TextEncoder().encode(JSON.stringify(entries)),
    );
    let i = 0;
    for (const e of entries.filter((e) => e.kind === "file")) {
      stage(
        "Collecting files " +
          ++i +
          " / " +
          entries.filter((e) => e.kind === "file").length,
      );
      const content = contents.find((c) => c.id === e.id);
      if (!content || content.blob.size !== e.size)
        throw Error("Missing or inconsistent file content: " + e.name);
      await add(
        "filesystem/blobs/" + e.id,
        new Uint8Array(await content.blob.arrayBuffer()),
      );
    }
  }
  const settings = categoryValues(categories);
  for (const [key, value] of Object.entries(settings))
    validateDeepSettings(key, value);
  const json = new TextEncoder().encode(JSON.stringify(settings));
  if (json.length > MAX_JSON) throw Error("Settings exceed 8 MB.");
  await add("settings.json", json);
  const manifest: Manifest = {
    format: "deskos-capsule",
    version: 1,
    appVersion: "0.6.0",
    created: new Date().toISOString(),
    categories: [...new Set(categories)],
    fileCount: entries.filter((e) => e.kind === "file").length,
    logicalBytes: entries.reduce((n, e) => n + e.size, 0),
    checksums,
  };
  zip.file("manifest.json", JSON.stringify(manifest));
  stage("Packaging data");
  const result = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } },
    (m) => stage("Packaging data " + Math.floor(m.percent) + "%"),
  );
  if (result.size > MAX_CAPSULE)
    throw Error("Compressed package exceeds limit.");
  stage("Package generated");
  return result;
}
export async function inspectCapsule(
  blob: Blob,
  stage: Stage = () => {},
): Promise<CapsuleData> {
  stage("Inspecting ZIP directory");
  const data = new Uint8Array(await blob.arrayBuffer());
  preflightZip(data);
  const zip = await JSZip.loadAsync(data, {
    checkCRC32: false,
    createFolders: false,
  });
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw Error("Missing Capsule manifest");
  const text = new TextDecoder().decode(
    await readLimited(manifestFile, MAX_JSON),
  );
  if (text.length > MAX_JSON) throw Error("Manifest too large");
  const manifest = safeJson(text) as Manifest;
  if (
    !manifest ||
    manifest.format !== "deskos-capsule" ||
    manifest.version !== 1 ||
    typeof manifest.created !== "string" ||
    !Number.isFinite(Date.parse(manifest.created)) ||
    !Array.isArray(manifest.categories) ||
    manifest.categories.some((c) => !coverage.some((a) => a.id === c)) ||
    !manifest.checksums ||
    typeof manifest.checksums !== "object" ||
    Array.isArray(manifest.checksums)
  )
    throw Error("Unsupported or invalid Capsule manifest");
  const paths = Object.keys(manifest.checksums);
  if (paths.length > 10002 || !paths.includes("settings.json"))
    throw Error("Invalid archive inventory");
  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    if (file.name !== "manifest.json" && !paths.includes(file.name))
      throw Error("Unexpected archive content");
  }
  const verified = new Map<string, Uint8Array>();
  let total = 0;
  for (const [path, sum] of Object.entries(manifest.checksums)) {
    if (
      path !== "settings.json" &&
      path !== "filesystem/metadata.json" &&
      !/^filesystem\/blobs\/[a-zA-Z0-9-]{1,100}$/.test(path)
    )
      throw Error("Unknown archive path");
    if (
      !sum ||
      !Number.isSafeInteger(sum.size) ||
      sum.size < 0 ||
      sum.size > MAX_CAPSULE ||
      !/^([a-f0-9]{64})$/.test(sum.sha256)
    )
      throw Error("Invalid checksum inventory");
    const file = zip.file(path);
    if (!file) throw Error("Required archive entry missing: " + path);
    stage("Verifying " + path);
    const bytes = await readLimited(file, sum.size);
    total += bytes.length;
    if (
      total > MAX_CAPSULE ||
      bytes.length !== sum.size ||
      (await sha256(bytes)) !== sum.sha256
    )
      throw Error("Checksum or size mismatch: " + path);
    if (path.endsWith(".json") && bytes.length > MAX_JSON)
      throw Error("JSON entry exceeds 8 MB");
    verified.set(path, bytes);
  }
  const settings = safeJson(
    new TextDecoder().decode(verified.get("settings.json")!),
  ) as Record<string, unknown>;
  if (!settings || Array.isArray(settings) || typeof settings !== "object")
    throw Error("Invalid settings");
  for (const [key, value] of Object.entries(settings)) {
    validateDeepSettings(key, value);
    if (
      !coverage.some(
        (c) =>
          manifest.categories.includes(c.id) && c.keys.includes(key as never),
      )
    )
      throw Error("Setting outside declared scope");
  }
  const meta = verified.get("filesystem/metadata.json");
  const entries = meta
    ? validateEntries(safeJson(new TextDecoder().decode(meta)))
    : [];
  if (manifest.categories.includes("files") !== !!meta)
    throw Error("Filesystem scope mismatch");
  const blobs = new Map<string, Blob>();
  for (const e of entries.filter((e) => e.kind === "file")) {
    const bytes = verified.get("filesystem/blobs/" + e.id);
    if (!bytes || bytes.length !== e.size) throw Error("Missing file bytes");
    blobs.set(e.id, new Blob([new Uint8Array(bytes)], { type: e.mime }));
  }
  if (
    paths.filter((p) => p.startsWith("filesystem/blobs/")).length !==
      blobs.size ||
    manifest.fileCount !== blobs.size ||
    manifest.logicalBytes !== entries.reduce((n, e) => n + e.size, 0)
  )
    throw Error("Manifest totals do not match actual content");
  stage("Validation complete");
  return { manifest, entries, blobs, settings };
}
