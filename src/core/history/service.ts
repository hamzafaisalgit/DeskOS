import { db } from "../filesystem/database";
import { filesystem as fs } from "../filesystem/service";
import { folderId } from "../filesystem/types";
import { exportCapsule, inspectCapsule } from "../backup/capsule";
import type { Stage } from "../backup/types";
export async function createPoint(
  name: string,
  description: string,
  categories: string[],
  fileIds?: string[],
  automatic = false,
  stage: Stage = () => {},
) {
  if (!categories.length) throw Error("Choose a recoverable scope.");
  if (!name.trim()) throw Error("Enter a restore-point name");
  const archive = await exportCapsule(categories, fileIds, stage);
  await inspectCapsule(archive, stage);
  const points = await db.points.toArray();
  if (points.reduce((n, p) => n + p.size, 0) + archive.size > 250 * 1024 * 1024)
    throw Error(
      "Restore points exceed 250 MB. Export or remove an old point first.",
    );
  const point = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 100),
    description: description.slice(0, 1000),
    created: Date.now(),
    categories,
    size: archive.size,
    archive,
    automatic,
  };
  await db.points.add(point);
  return point;
}
export async function restoreVersion(
  id: string,
  asCopy: boolean,
  expectedRevision?: number,
) {
  const v = await db.versions.get(id);
  if (!v) throw Error("Version no longer available");
  const current = await db.entries.get(v.fileId);
  if (asCopy || !current || current.trashed) {
    return fs.createFile(
      current && !current.trashed ? current.parentId! : folderId("Documents"),
      "Recovered " + v.name.slice(0, 160),
      v.blob,
      true,
    );
  }
  if (expectedRevision === undefined)
    throw Error("Refresh the current version before restoring");
  return fs.saveDocument(current.id, await v.blob.text(), expectedRevision);
}
export async function historyUsage() {
  const [versions, points] = await Promise.all([
    db.versions.toArray(),
    db.points.toArray(),
  ]);
  return {
    versions,
    points,
    versionBytes: versions.reduce((n, v) => n + v.size, 0),
    pointBytes: points.reduce((n, p) => n + p.size, 0),
  };
}
