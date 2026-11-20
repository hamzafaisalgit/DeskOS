import "fake-indexeddb/auto";
import { beforeEach, afterAll, it, expect, vi } from "vitest";
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
vi.stubGlobal("navigator", {
  storage: { estimate: async () => ({ quota: 1e9, usage: 0 }) },
});
const { db } = await import("../src/core/filesystem/database");
const { filesystem: fs } = await import("../src/core/filesystem/service");
const { exportCapsule, inspectCapsule } =
  await import("../src/core/backup/capsule");
const { planRestore, executeRestore } =
  await import("../src/core/backup/restore");
const { restoreVersion, createPoint } =
  await import("../src/core/history/service");
const { setPersistencePaused } = await import("../src/core/storage");
beforeEach(async () => {
  setPersistencePaused(false);
  (await import("../src/core/filesystem/service")).setRecoveryWriteLock(false);
  memory.clear();
  await db.transaction(
    "rw",
    [db.entries, db.contents, db.versions, db.points, db.journals],
    async () => {
      await db.entries.clear();
      await db.contents.clear();
      await db.versions.clear();
      await db.points.clear();
      await db.journals.clear();
    },
  );
  await fs.initialize();
});
afterAll(async () => {
  await db.delete();
});
it("round trips text, binary, preferences and a verified restore point", async () => {
  const file = await fs.createFile(
    "system-documents",
    "saved.md",
    new Blob(["# Saved"]),
  );
  const binary = await fs.createFile(
    "system-pictures",
    "image.png",
    new Blob([new Uint8Array([0, 1, 255, 42])], { type: "image/png" }),
  );
  memory.set(
    "deskos.v1.preferences",
    JSON.stringify({ theme: "light", wallpaper: 2 }),
  );
  const archive = await exportCapsule(["files", "preferences"]);
  const inspected = await inspectCapsule(archive);
  expect(await inspected.blobs.get(file.id)!.text()).toBe("# Saved");
  expect([
    ...new Uint8Array(await inspected.blobs.get(binary.id)!.arrayBuffer()),
  ]).toEqual([0, 1, 255, 42]);
  const point = await createPoint("Recovery", "Actual content", ["files"]);
  expect(point.categories).toEqual(["files"]);
  expect((await inspectCapsule(point.archive)).manifest.fileCount).toBe(2);
  await fs.updateFileContent(file.id, new Blob(["changed"]));
  const plan = await planRestore(inspected, "replace", [
    "files",
    "preferences",
  ]);
  await executeRestore(inspected, plan);
  expect(await (await fs.getFileContent(file.id)).text()).toBe("# Saved");
  expect(JSON.parse(memory.get("deskos.v1.preferences")!).theme).toBe("light");
  expect(await db.points.count()).toBeGreaterThan(1);
});
it("rejects corrupt inventory without changing existing data", async () => {
  const file = await fs.createFile(
    "system-documents",
    "safe.txt",
    new Blob(["safe"]),
  );
  const blob = await exportCapsule(["files"]);
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  zip.file("filesystem/blobs/" + file.id, "corrupt");
  await expect(
    inspectCapsule(await zip.generateAsync({ type: "blob" })),
  ).rejects.toThrow();
  expect(await (await fs.getFileContent(file.id)).text()).toBe("safe");
});
it("merges collisions without overwriting and restores versions with a recoverable prior save", async () => {
  const file = await fs.createFile(
    "system-documents",
    "same.txt",
    new Blob(["first"]),
  );
  const archive = await inspectCapsule(await exportCapsule(["files"]));
  await fs.updateFileContent(file.id, new Blob(["second"]));
  const version = (await db.versions.toArray())[0];
  await restoreVersion(
    version.id,
    false,
    (await fs.getEntry(file.id)).revision,
  );
  expect(await (await fs.getFileContent(file.id)).text()).toBe("first");
  expect(
    await Promise.all((await db.versions.toArray()).map((v) => v.blob.text())),
  ).toContain("second");
  const plan = await planRestore(archive, "merge", ["files"]);
  await executeRestore(archive, plan);
  const items = await fs.listDirectory("system-documents");
  expect(items).toHaveLength(2);
  expect(items.some((e) => e.name.includes("Imported"))).toBe(true);
  expect(await (await fs.getFileContent(file.id)).text()).toBe("first");
});

it("compensates a settings write failure after filesystem replacement", async () => {
  const file = await fs.createFile(
    "system-documents",
    "rollback.txt",
    new Blob(["backup"]),
  );
  memory.set(
    "deskos.v1.preferences",
    JSON.stringify({ theme: "dark", wallpaper: 0 }),
  );
  const capsule = await inspectCapsule(
    await exportCapsule(["files", "preferences"]),
  );
  await fs.updateFileContent(file.id, new Blob(["current"]));
  memory.set(
    "deskos.v1.preferences",
    JSON.stringify({ theme: "light", wallpaper: 1 }),
  );
  const plan = await planRestore(capsule, "replace", ["files", "preferences"]);
  const original = localStorage.setItem;
  let fail = true;
  localStorage.setItem = (key, value) => {
    if (key === "deskos.v1.preferences" && fail) {
      fail = false;
      throw Error("Simulated quota failure");
    }
    original(key, value);
  };
  try {
    await expect(executeRestore(capsule, plan)).rejects.toThrow(
      "Original selected data was recovered",
    );
  } finally {
    localStorage.setItem = original;
  }
  expect(await (await fs.getFileContent(file.id)).text()).toBe("current");
  expect(JSON.parse(memory.get("deskos.v1.preferences")!).theme).toBe("light");
  expect((await db.journals.toArray())[0].state).toBe("failed");
});
