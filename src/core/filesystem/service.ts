import { db, FileDatabase } from "./database";
import { HOME, folders, folderId, validateName, mimeFor } from "./types";
import type { Entry } from "./types";
export class Filesystem {
  readonly database: FileDatabase;
  constructor(database: FileDatabase = db) {
    this.database = database;
  }
  private transaction<T>(run: () => Promise<T>) {
    return this.database.transaction(
      "rw",
      this.database.entries,
      this.database.contents,
      run,
    );
  }
  async initialize() {
    await this.transaction(async () => {
      if (await this.database.entries.get(HOME)) return;
      await this.database.entries.add(
        this.record(HOME, null, "Home", "directory", true),
      );
      for (const name of folders)
        await this.database.entries.add(
          this.record(folderId(name), HOME, name, "directory", true),
        );
    });
  }
  private record(
    id: string,
    parentId: string | null,
    name: string,
    kind: Entry["kind"],
    protectedEntry = false,
  ): Entry {
    return {
      id,
      revision: 1,
      parentId,
      name,
      kind,
      mime: kind === "file" ? mimeFor(name) : "",
      extension:
        kind === "file"
          ? (name.split(".").slice(1).at(-1)?.toLowerCase() ?? "")
          : "",
      size: 0,
      created: Date.now(),
      modified: Date.now(),
      trashed: false,
      favorite: false,
      protected: protectedEntry,
    };
  }
  async getEntry(id: string) {
    const e = await this.database.entries.get(id);
    if (
      !e ||
      !["file", "directory"].includes(e.kind) ||
      typeof e.name !== "string"
    )
      throw Error("This item is missing or its metadata is invalid.");
    return e;
  }
  async listDirectory(id: string) {
    const p = await this.getEntry(id);
    if (p.kind !== "directory" || p.trashed)
      throw Error("This folder is unavailable.");
    return this.database.entries
      .where("parentId")
      .equals(id)
      .filter((e) => !e.trashed)
      .toArray();
  }
  async all() {
    return this.database.entries.toArray();
  }
  private async destination(id: string) {
    const p = await this.getEntry(id);
    if (p.kind !== "directory" || p.trashed)
      throw Error("Choose an available destination folder.");
  }
  private async name(
    parentId: string,
    name: string,
    except?: string,
    collision = false,
  ) {
    validateName(name);
    const siblings = await this.listDirectory(parentId);
    const occupied = (n: string) =>
      siblings.some(
        (e) => e.id !== except && e.name.toLowerCase() === n.toLowerCase(),
      );
    if (!occupied(name)) return name;
    if (!collision)
      throw Error("An item with that name already exists in this folder.");
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let n = 1;
    while (occupied(`${base} - Copy${n === 1 ? "" : ` ${n}`}${ext}`)) n++;
    return validateName(`${base} - Copy${n === 1 ? "" : ` ${n}`}${ext}`);
  }
  async createDirectory(parentId: string, name: string) {
    return this.transaction(async () => {
      await this.destination(parentId);
      const e = this.record(
        crypto.randomUUID(),
        parentId,
        await this.name(parentId, name),
        "directory",
      );
      await this.database.entries.add(e);
      return e;
    });
  }
  async createFile(
    parentId: string,
    name: string,
    blob = new Blob([""], { type: "text/plain" }),
    collision = false,
  ) {
    return this.transaction(async () => {
      await this.destination(parentId);
      const e = this.record(
        crypto.randomUUID(),
        parentId,
        await this.name(parentId, name, undefined, collision),
        "file",
      );
      e.mime = blob.type || mimeFor(name);
      e.size = blob.size;
      e.accessed = Date.now();
      await this.database.entries.add(e);
      await this.database.contents.add({ id: e.id, blob });
      return e;
    });
  }
  async getFileContent(id: string) {
    const e = await this.getEntry(id);
    if (e.kind !== "file") throw Error("Select a file.");
    const c = await this.database.contents.get(id);
    if (!c) throw Error("File content is unavailable.");
    return c.blob;
  }
  async readDocument(id: string) {
    return this.database.transaction(
      "r",
      this.database.entries,
      this.database.contents,
      async () => {
        const entry = await this.getEntry(id);
        if (entry.trashed) throw Error("This document is in Trash.");
        const blob = await this.getFileContent(id);
        if (blob.size > 2 * 1024 * 1024)
          throw Error("Editors support files up to 2 MB.");
        return { entry, blob };
      },
    );
  }
  async saveDocument(id: string, text: string, revision: number) {
    return this.transaction(async () => {
      const e = await this.getEntry(id);
      if ((e.revision ?? 0) !== revision)
        throw Error(
          "Conflict: another application saved this file. Reload or Save As to keep both versions.",
        );
      await this.updateFileContent(id, new Blob([text], { type: e.mime }));
      return this.getEntry(id);
    });
  }
  async updateFileContent(id: string, blob: Blob, expectedModified?: number) {
    return this.transaction(async () => {
      const e = await this.getEntry(id);
      if (e.trashed || e.kind !== "file")
        throw Error("This file is unavailable.");
      if (expectedModified !== undefined && e.modified !== expectedModified)
        throw Error(
          "This file changed in another window. Reopen it before saving.",
        );
      await this.database.contents.put({ id, blob });
      await this.database.entries.update(id, {
        size: blob.size,
        revision: (e.revision ?? 0) + 1,
        modified: Math.max(Date.now(), e.modified + 1),
        accessed: Date.now(),
      });
    });
  }
  async renameEntry(id: string, name: string) {
    return this.transaction(async () => {
      const e = await this.getEntry(id);
      if (e.protected || e.trashed) throw Error("This item cannot be renamed.");
      await this.database.entries.update(id, {
        name: await this.name(e.parentId!, name, id),
        extension:
          e.kind === "file" ? (name.split(".").slice(1).at(-1) ?? "") : "",
        mime: e.kind === "file" ? mimeFor(name) : "",
        modified: Date.now(),
      });
    });
  }
  private descendants(entries: Entry[], id: string): Entry[] {
    const result: Entry[] = [];
    const seen = new Set([id]);
    const queue = [id];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const e of entries.filter((e) => e.parentId === parent)) {
        if (seen.has(e.id)) throw Error("Invalid directory cycle detected.");
        seen.add(e.id);
        result.push(e);
        queue.push(e.id);
      }
    }
    return result;
  }
  private roots(entries: Entry[], ids: string[]) {
    return entries.filter(
      (e) =>
        ids.includes(e.id) &&
        !entries.some(
          (p) =>
            ids.includes(p.id) &&
            this.descendants(entries, p.id).some((c) => c.id === e.id),
        ),
    );
  }
  async transfer(ids: string[], target: string, copy = false) {
    return this.transaction(async () => {
      await this.destination(target);
      const all = await this.all();
      const roots = this.roots(all, ids);
      if (roots.length === 0) throw Error("Select an existing item.");
      for (const root of roots) {
        if (root.trashed || (!copy && root.protected))
          throw Error("This item cannot be moved.");
        const children = this.descendants(all, root.id);
        if (target === root.id || children.some((e) => e.id === target))
          throw Error(
            "A folder cannot be placed inside itself or a descendant.",
          );
        if (!copy) {
          await this.database.entries.update(root.id, {
            parentId: target,
            name: await this.name(target, root.name, root.id),
            modified: Date.now(),
          });
          continue;
        }
        const mapping = new Map<string, string>();
        for (const e of [root, ...children]) {
          if (e.trashed) continue;
          const id = crypto.randomUUID();
          mapping.set(e.id, id);
          const parentId =
            e.id === root.id ? target : mapping.get(e.parentId!)!;
          if (!parentId) continue;
          const name =
            e.id === root.id
              ? await this.name(target, e.name, undefined, true)
              : e.name;
          await this.database.entries.add({
            ...e,
            id,
            parentId,
            name,
            protected: false,
            favorite: false,
            created: Date.now(),
            modified: Date.now(),
            position: undefined,
          });
          if (e.kind === "file")
            await this.database.contents.add({
              id,
              blob: await this.getFileContent(e.id),
            });
        }
      }
    });
  }
  async transferNamed(id: string, target: string, name: string, copy: boolean) {
    return this.transaction(async () => {
      await this.name(target, name);
      const before = new Set(
        (await this.listDirectory(target)).map((e) => e.id),
      );
      await this.transfer([id], target, copy);
      const result = copy
        ? (await this.listDirectory(target)).find((e) => !before.has(e.id))
        : await this.getEntry(id);
      if (!result) throw Error("Copy could not be located.");
      await this.renameEntry(result.id, name);
    });
  }
  moveEntry(id: string, target: string) {
    return this.transfer([id], target);
  }
  copyEntry(id: string, target: string) {
    return this.transfer([id], target, true);
  }
  async deleteEntries(ids: string[]) {
    return this.transaction(async () => {
      const all = await this.all();
      for (const root of this.roots(all, ids)) {
        if (root.protected) throw Error("System folders cannot be deleted.");
        for (const e of [root, ...this.descendants(all, root.id)].filter(
          (e) => !e.trashed,
        ))
          await this.database.entries.update(e.id, {
            trashed: true,
            trashRoot: root.id,
            originalParent: e.parentId,
            favorite: false,
          });
      }
    });
  }
  deleteEntry(id: string) {
    return this.deleteEntries([id]);
  }
  async restoreEntry(id: string) {
    return this.transaction(async () => {
      const e = await this.getEntry(id);
      if (!e.trashed) throw Error("This item is not in Trash.");
      if (e.trashRoot !== id)
        throw Error("Restore the containing folder first.");
      let parent = e.originalParent ?? HOME;
      const p = await this.database.entries.get(parent);
      if (!p || p.trashed) parent = HOME;
      const name = await this.name(parent, e.name, undefined, true);
      const group = (await this.all()).filter((c) => c.trashRoot === id);
      for (const c of group)
        await this.database.entries.update(c.id, {
          trashed: false,
          trashRoot: undefined,
          originalParent: undefined,
          ...(c.id === id ? { parentId: parent, name } : {}),
        });
    });
  }
  async permanentlyDeleteEntry(id: string) {
    return this.transaction(async () => {
      const e = await this.getEntry(id);
      if (!e.trashed || e.protected)
        throw Error("Only Trash items can be permanently deleted.");
      const ids = [
        id,
        ...this.descendants(await this.all(), id).map((e) => e.id),
      ];
      await this.database.contents.bulkDelete(ids);
      await this.database.entries.bulkDelete(ids);
    });
  }
  async emptyTrash() {
    return this.transaction(async () => {
      const ids = (await this.all())
        .filter((e) => e.trashed && !e.protected)
        .map((e) => e.id);
      await this.database.contents.bulkDelete(ids);
      await this.database.entries.bulkDelete(ids);
    });
  }
  async searchEntries(query: string) {
    return (await this.all()).filter(
      (e) => !e.trashed && e.name.toLowerCase().includes(query.toLowerCase()),
    );
  }
  async getEntryPath(id: string) {
    const all = await this.all();
    const path: Entry[] = [];
    const seen = new Set<string>();
    let e = all.find((e) => e.id === id);
    while (e) {
      if (seen.has(e.id)) throw Error("Invalid path.");
      seen.add(e.id);
      path.unshift(e);
      e = all.find((p) => p.id === e!.parentId);
    }
    return path;
  }
  async resolvePath(path: string) {
    const parts = path.split("/").filter(Boolean);
    if (parts[0]?.toLowerCase() === "home") parts.shift();
    let e = await this.getEntry(HOME);
    for (const part of parts) {
      const next = (await this.listDirectory(e.id)).find(
        (e) => e.name === part,
      );
      if (!next) throw Error("Path not found.");
      e = next;
    }
    return e;
  }
  async favorite(id: string, value: boolean) {
    await this.database.entries.update(id, { favorite: value });
  }
  async touch(id: string) {
    await this.database.entries.update(id, { accessed: Date.now() });
  }
  async position(id: string, position: { x: number; y: number }) {
    await this.database.entries.update(id, { position });
  }
  importFile(parent: string, file: File) {
    return this.createFile(parent, file.name, file, true);
  }
  async getStorageUsage() {
    const entries = await this.all();
    const files = entries.filter((e) => e.kind === "file");
    return {
      bytes: files.reduce((n, e) => n + e.size, 0),
      trashBytes: files
        .filter((e) => e.trashed)
        .reduce((n, e) => n + e.size, 0),
      files: files.length,
      folders: entries.filter((e) => e.kind === "directory").length,
    };
  }
}
export const filesystem = new Filesystem();
