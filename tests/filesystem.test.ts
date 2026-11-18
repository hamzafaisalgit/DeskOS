import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { FileDatabase } from "../src/core/filesystem/database";
import { Filesystem } from "../src/core/filesystem/service";
import { HOME, folderId } from "../src/core/filesystem/types";
let db: FileDatabase;
let fs: Filesystem;
beforeEach(async () => {
  db = new FileDatabase(`test-${crypto.randomUUID()}`);
  fs = new Filesystem(db);
  await fs.initialize();
});
afterEach(async () => {
  await db.delete();
});
it("creates, reads, edits and renames content atomically", async () => {
  const e = await fs.createFile(HOME, "hello.txt", new Blob(["hello"]));
  expect(await (await fs.getFileContent(e.id)).text()).toBe("hello");
  await fs.renameEntry(e.id, "world.txt");
  await fs.updateFileContent(
    e.id,
    new Blob(["world"]),
    (await fs.getEntry(e.id)).modified,
  );
  expect((await fs.getEntry(e.id)).name).toBe("world.txt");
  expect(await (await fs.getFileContent(e.id)).text()).toBe("world");
});
it("moves and independently copies trees while preventing cycles and protected deletion", async () => {
  const a = await fs.createDirectory(HOME, "A");
  const b = await fs.createDirectory(a.id, "B");
  const f = await fs.createFile(b.id, "same.txt", new Blob(["safe"]));
  await expect(fs.moveEntry(a.id, b.id)).rejects.toThrow("descendant");
  await fs.copyEntry(a.id, HOME);
  const copy = (await fs.listDirectory(HOME)).find(
    (e) => e.name === "A - Copy",
  )!;
  const child = (await fs.listDirectory(copy.id))[0];
  const copied = (await fs.listDirectory(child.id))[0];
  await fs.updateFileContent(copied.id, new Blob(["independent"]));
  expect(await (await fs.getFileContent(f.id)).text()).toBe("safe");
  await fs.moveEntry(f.id, HOME);
  expect((await fs.getEntry(f.id)).parentId).toBe(HOME);
  await expect(fs.deleteEntry(HOME)).rejects.toThrow("System");
});
it("persists across database close/reopen and initialization preserves content", async () => {
  const e = await fs.createFile(
    folderId("Documents"),
    "saved.txt",
    new Blob(["persistent"]),
  );
  db.close();
  await db.open();
  await fs.initialize();
  expect(await (await fs.getFileContent(e.id)).text()).toBe("persistent");
});
it("trashes and restores descendants, then permanently removes blobs", async () => {
  const dir = await fs.createDirectory(HOME, "Trash me");
  const file = await fs.createFile(dir.id, "child.txt", new Blob(["content"]));
  await fs.deleteEntry(dir.id);
  expect((await fs.getEntry(file.id)).trashed).toBe(true);
  expect(await fs.searchEntries("child")).toEqual([]);
  await fs.restoreEntry(dir.id);
  expect((await fs.getEntry(file.id)).trashed).toBe(false);
  await fs.deleteEntry(dir.id);
  await fs.permanentlyDeleteEntry(dir.id);
  expect(await db.contents.get(file.id)).toBeUndefined();
  await expect(fs.getEntry(file.id)).rejects.toThrow();
});
it("rejects invalid and duplicate names, resolves import collisions and concurrent writes", async () => {
  await expect(fs.createFile(HOME, "../bad")).rejects.toThrow();
  const results = await Promise.allSettled([
    fs.createFile(HOME, "same.txt"),
    fs.createFile(HOME, "SAME.txt"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const first = (await fs.listDirectory(HOME)).find((e) => e.kind === "file")!;
  const second = await fs.createFile(HOME, first.name, new Blob(), true);
  expect(second.name).toContain("Copy");
  const file = await fs.createFile(HOME, "edit.txt");
  await fs.updateFileContent(file.id, new Blob(["new"]), file.modified);
  await expect(
    fs.updateFileContent(file.id, new Blob(["stale"]), file.modified),
  ).rejects.toThrow("another window");
});
