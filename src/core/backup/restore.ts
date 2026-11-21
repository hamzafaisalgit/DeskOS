import { validatePlatform } from "../platform/package";
import { setRecoveryWriteLock } from "../filesystem/service";
import { db } from "../filesystem/database";
import { coverage } from "./coverage";
import { inspectCapsule } from "./capsule";
import { createPoint } from "../history/service";
import { HOME, folders, folderId } from "../filesystem/types";
import type { Entry } from "../filesystem/types";
import type { CapsuleData, RestoreMode, RestorePlan, Stage } from "./types";
import { hasDirtyWindows } from "../documents/guards";
import { persistencePaused, setPersistencePaused } from "../storage";
function stamp(entries: Entry[]) {
  return JSON.stringify(
    entries
      .map((e) => [e.id, e.parentId, e.name, e.revision, e.modified, e.trashed])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}
export async function planRestore(
  data: CapsuleData,
  mode: RestoreMode,
  categories: string[],
  fileIds?: string[],
  conflict: "copy" | "skip" = "copy",
): Promise<RestorePlan> {
  if (
    !categories.length ||
    categories.some((c) => !data.manifest.categories.includes(c))
  )
    throw Error("Choose categories present in the Capsule");
  if (
    mode === "merge" &&
    categories.some((c) => !coverage.find((x) => x.id === c)?.merge)
  )
    throw Error(
      "Application metadata/settings are replace-only. Restore them explicitly after file merge or use a complete replacement to preserve stable references.",
    );
  const current = await db.entries.toArray();
  const selected =
    fileIds ?? data.entries.filter((e) => e.kind === "file").map((e) => e.id);
  const estimate = await navigator.storage?.estimate?.();
  const size = data.entries
    .filter((e) => selected.includes(e.id))
    .reduce((n, e) => n + e.size, 0);
  if (estimate?.quota && size > (estimate.quota - (estimate.usage ?? 0)) / 2)
    throw Error("Insufficient estimated storage for restore plus rollback.");
  return {
    mode,
    categories,
    fileIds: selected,
    conflict,
    stamp: stamp(current),
    summary: [
      mode === "merge"
        ? "Import files using fresh IDs. Existing files remain unchanged. Collisions: " +
          conflict
        : "Replace selected categories. Files replacement replaces the entire filesystem, including Trash.",
      selected.length + " selected file records",
      ...coverage.filter((c) => categories.includes(c.id)).map((c) => c.name),
      mode === "replace"
        ? "A verified automatic recovery point is required before applying."
        : "Filesystem merge is one IndexedDB transaction.",
    ],
  };
}
async function applyFiles(data: CapsuleData, plan: RestorePlan) {
  const all = await db.entries.toArray();
  if (stamp(all) !== plan.stamp)
    throw Error("Files changed since preview. Generate a new restore plan.");
  if (!plan.categories.includes("files")) return;
  if (plan.mode === "replace") {
    // Ensure system folders exist even for subset exports; selected files cannot be used for full filesystem replacement.
    if (
      plan.fileIds.length !==
      data.entries.filter((e) => e.kind === "file").length
    )
      throw Error(
        "Use merge for selective files; replacement requires the entire archived filesystem.",
      );
    const incoming = data.entries.map((e) => ({
      ...e,
      revision:
        Math.max(
          e.revision ?? 0,
          all.find((x) => x.id === e.id)?.revision ?? 0,
        ) + 1,
    }));
    for (const name of folders)
      if (!incoming.some((e) => e.id === folderId(name))) {
        const old = all.find((e) => e.id === folderId(name));
        if (old) incoming.push({ ...old, revision: old.revision ?? 1 });
      }
    await db.contents.clear();
    await db.entries.clear();
    await db.entries.bulkPut(incoming);
    await db.contents.bulkPut(
      [...data.blobs].map(([id, blob]) => ({ id, blob })),
    );
    return;
  }
  const mapping = new Map<string, string>([[HOME, HOME]]),
    selected = new Set(plan.fileIds);
  const wanted = new Set<string>();
  for (const id of selected) {
    let e = data.entries.find((e) => e.id === id);
    while (e) {
      wanted.add(e.id);
      e = data.entries.find((p) => p.id === e!.parentId);
    }
  }
  const pending = data.entries.filter((e) => wanted.has(e.id) && e.id !== HOME);
  let iterations = 0;
  while (pending.length) {
    if (++iterations > data.entries.length + 1)
      throw Error("Unresolvable folder hierarchy");
    const index = pending.findIndex((e) => mapping.has(e.parentId!));
    if (index < 0) throw Error("Missing selected parent");
    const source = pending.splice(index, 1)[0],
      parent = mapping.get(source.parentId!)!;
    const siblings = await db.entries
      .where("parentId")
      .equals(parent)
      .filter((e) => !e.trashed)
      .toArray();
    const collision = siblings.find(
      (e) => e.name.toLowerCase() === source.name.toLowerCase(),
    );
    if (source.kind === "directory" && collision?.kind === "directory") {
      mapping.set(source.id, collision.id);
      continue;
    }
    if (source.kind === "file" && collision && plan.conflict === "skip") {
      mapping.set(source.id, collision.id);
      continue;
    }
    let name = source.name;
    if (collision) {
      let i = 1;
      const dot = name.lastIndexOf("."),
        base = dot > 0 ? name.slice(0, dot) : name,
        ext = dot > 0 ? name.slice(dot) : "";
      do {
        name = base.slice(0, 130) + " - Imported " + i++ + ext;
      } while (
        siblings.some((e) => e.name.toLowerCase() === name.toLowerCase())
      );
    }
    const id = crypto.randomUUID();
    mapping.set(source.id, id);
    const entry = {
      ...source,
      id,
      parentId: parent,
      name,
      protected: false,
      trashed: false,
      trashRoot: undefined,
      originalParent: undefined,
      revision: 1,
    };
    await db.entries.add(entry);
    if (source.kind === "file")
      await db.contents.add({ id, blob: data.blobs.get(source.id)! });
  }
}
function repairedSettings(
  data: CapsuleData,
  categories: string[],
  valid: Set<string>,
) {
  const result: Record<string, unknown> = {};
  let unresolved = 0;
  for (const c of coverage.filter((c) => categories.includes(c.id)))
    for (const key of c.keys)
      if (key in data.settings)
        result[key] = structuredClone(data.settings[key]);
  const filterReferences = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(filterReferences);
    if (!value || typeof value !== "object") return value;
    const obj = value as Record<string, unknown>;
    for (const [key, v] of Object.entries(obj)) {
      if (key === "entryId" && typeof v === "string" && !valid.has(v)) {
        delete obj[key];
        unresolved++;
      } else if (key === "files" && Array.isArray(v)) {
        obj[key] = v.filter((id) => valid.has(String(id)));
        unresolved += v.length - (obj[key] as unknown[]).length;
      } else if (
        ["progress", "bookmarks", "tracks"].includes(key) &&
        v &&
        typeof v === "object"
      ) {
        obj[key] = Object.fromEntries(
          Object.entries(v).filter(([id]) => valid.has(id)),
        );
      } else obj[key] = filterReferences(v);
    }
    return obj;
  };
  for (const key of ["media", "spaces.v1", "windows"])
    if (key in result) result[key] = filterReferences(result[key]);
  if ("music-tags" in result)
    result["music-tags"] = Object.fromEntries(
      Object.entries(result["music-tags"] as object).filter(([id]) =>
        valid.has(id),
      ),
    );
  if ("platform.v1" in result)
    result["platform.v1"] = validatePlatform(result["platform.v1"], true);
  return { result, unresolved };
}
export async function executeRestore(
  data: CapsuleData,
  plan: RestorePlan,
  stage: Stage = () => {},
) {
  if (persistencePaused)
    throw Error("Reload DeskOS before starting another restore.");
  if (hasDirtyWindows())
    throw Error(
      "Save or close every editor with unsaved changes before restoring. Your edits are still open.",
    );
  // Re-verify even local points before execution.
  const current = await db.entries.toArray();
  if (stamp(current) !== plan.stamp)
    throw Error("Files changed since planning. Preview again.");
  const before = new Map<string, string | null>();
  for (const c of coverage.filter((c) => plan.categories.includes(c.id)))
    for (const key of c.keys)
      before.set(key, localStorage.getItem("deskos.v1." + key));
  let checkpoint: string | undefined;
  if (plan.mode === "replace") {
    stage("Creating verified rollback point");
    const point = await createPoint(
      "Before Capsule restore",
      "Automatic safety checkpoint",
      coverage.map((c) => c.id),
      undefined,
      true,
      stage,
    );
    checkpoint = point.id;
  }
  const journal = {
    id: crypto.randomUUID(),
    created: Date.now(),
    state: "applying" as const,
    message: "Restore in progress",
    checkpoint,
  };
  await db.journals.add(journal);
  if (plan.mode === "merge") {
    setRecoveryWriteLock(true);
    stage("Applying file merge transaction");
    try {
      await db.transaction(
        "rw",
        db.entries,
        db.contents,
        db.journals,
        async () => {
          await applyFiles(data, plan);
          await db.journals.update(journal.id, {
            state: "complete",
            message: "File merge committed atomically.",
          });
        },
      );
    } catch (e) {
      await db.journals.update(journal.id, {
        state: "failed",
        message: "Merge transaction rolled back: " + String(e),
      });
      setRecoveryWriteLock(false);
      throw e;
    }
    setRecoveryWriteLock(false);
    stage("File merge committed. Existing files preserved.");
    return { reload: false };
  }
  let fsApplied = false;
  setRecoveryWriteLock(true);
  try {
    stage("Applying filesystem transaction");
    await db.transaction("rw", db.entries, db.contents, async () =>
      applyFiles(data, plan),
    );
    fsApplied = true;
    const valid = new Set((await db.entries.toArray()).map((e) => e.id)),
      { result, unresolved } = repairedSettings(data, plan.categories, valid);
    setPersistencePaused(true);
    stage("Applying persisted settings");
    for (const c of coverage.filter((c) => plan.categories.includes(c.id)))
      for (const key of c.keys) {
        const full = "deskos.v1." + key;
        if (key in result)
          localStorage.setItem(full, JSON.stringify(result[key]));
        else localStorage.removeItem(full);
      }
    await db.journals.update(journal.id, {
      state: "complete",
      message:
        unresolved + " unavailable file references removed. Reload required.",
    });
    const metadata = plan.categories.some((c) => c !== "files");
    if (!metadata) {
      setPersistencePaused(false);
      setRecoveryWriteLock(false);
    }
    stage(
      "Restore applied" +
        (unresolved ? "; " + unresolved + " missing references removed" : "") +
        (metadata
          ? ". Reload DeskOS to load restored settings."
          : ". Files updated."),
    );
    return { reload: metadata, checkpoint };
  } catch (error) {
    stage("Restore failed; attempting rollback");
    try {
      if (fsApplied && checkpoint) {
        const point = await db.points.get(checkpoint);
        if (!point) throw Error("Rollback point missing", { cause: error });
        const rollback = await inspectCapsule(point.archive);
        await db.transaction("rw", db.entries, db.contents, async () => {
          await db.contents.clear();
          await db.entries.clear();
          await db.entries.bulkPut(rollback.entries);
          await db.contents.bulkPut(
            [...rollback.blobs].map(([id, blob]) => ({ id, blob })),
          );
        });
      }
      for (const [key, value] of before) {
        if (value === null) localStorage.removeItem("deskos.v1." + key);
        else localStorage.setItem("deskos.v1." + key, value);
      }
      setPersistencePaused(false);
      setRecoveryWriteLock(false);
      await db.journals.update(journal.id, {
        state: "failed",
        message:
          "Restore failed; original selected data restored. " + String(error),
      });
    } catch (rollbackError) {
      await db.journals.update(journal.id, {
        state: "failed",
        message:
          "Recovery incomplete. Use the automatic checkpoint. " +
          String(rollbackError),
      });
      throw Error(
        "Restore and rollback failed. The automatic checkpoint is retained in Restore Points. " +
          String(error),
        { cause: rollbackError },
      );
    }
    throw Error(
      "Restore failed. Original selected data was recovered. " + String(error),
      { cause: error },
    );
  }
}
