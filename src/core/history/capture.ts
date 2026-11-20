import Dexie from "dexie";
import type { FileDatabase } from "../filesystem/database";
import type { Entry } from "../filesystem/types";
import { readStorage } from "../storage";
export async function capturePrevious(
  database: FileDatabase,
  e: Entry,
  next: Blob,
) {
  if (
    e.size > 2 * 1024 * 1024 ||
    !(
      /^(txt|md|markdown|json|html|css|js|jsx|ts|tsx|csv|xml|py|java|c|cpp|sh|yml|yaml|log|vtt)$/.test(
        e.extension,
      ) || e.mime.startsWith("text/")
    )
  )
    return;
  const old = await database.contents.get(e.id);
  if (
    !old ||
    (await Dexie.waitFor(old.blob.text())) ===
      (await Dexie.waitFor(next.text()))
  )
    return;
  const versions = await database.versions
    .where("fileId")
    .equals(e.id)
    .sortBy("created");
  const last = versions.at(-1);
  if (
    !last ||
    (await Dexie.waitFor(last.blob.text())) !==
      (await Dexie.waitFor(old.blob.text()))
  )
    await database.versions.add({
      id: crypto.randomUUID(),
      fileId: e.id,
      name: e.name,
      mime: e.mime,
      created: Date.now(),
      revision: e.revision ?? 0,
      size: old.blob.size,
      blob: old.blob,
    });
  const count = Number(readStorage("history-count"));
  const keep =
    Number.isInteger(count) && count >= 1 && count <= 30 ? count : 10;
  const all = await database.versions
    .where("fileId")
    .equals(e.id)
    .sortBy("created");
  await database.versions.bulkDelete(
    all.slice(0, Math.max(0, all.length - keep)).map((v) => v.id),
  );
  const total = await database.versions.orderBy("created").toArray();
  let bytes = total.reduce((n, v) => n + v.size, 0);
  for (const v of total) {
    if (bytes <= 50 * 1024 * 1024) break;
    await database.versions.delete(v.id);
    bytes -= v.size;
  }
}
