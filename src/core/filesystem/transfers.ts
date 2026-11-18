import { filesystem } from "./service";
import { formatBytes, HOME } from "./types";
export const MAX_BATCH = 200 * 1024 * 1024;
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportFiles(
  ids: string[],
  progress: (n: number) => void = () => {},
) {
  const all = await filesystem.all();
  const selected = all.filter((e) => ids.includes(e.id));
  if (!selected.length) throw Error("Select files to export.");
  const covered = new Set<string>();
  const collect = (id: string) => {
    if (covered.has(id)) return;
    covered.add(id);
    all
      .filter((e) => e.parentId === id && !e.trashed)
      .forEach((e) => collect(e.id));
  };
  selected.forEach((e) => collect(e.id));
  if (
    all.filter((e) => covered.has(e.id)).reduce((n, e) => n + e.size, 0) >
    MAX_BATCH
  )
    throw Error(`Export smaller batches below ${formatBytes(MAX_BATCH)}.`);
  if (selected.length === 1 && selected[0].kind === "file") {
    download(await filesystem.getFileContent(selected[0].id), selected[0].name);
    progress(100);
    return;
  }
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const add = async (id: string, path: string) => {
    const e = await filesystem.getEntry(id);
    if (e.kind === "file")
      zip.file(path, await (await filesystem.getFileContent(id)).arrayBuffer());
    else {
      zip.folder(path);
      for (const child of all.filter((c) => c.parentId === id && !c.trashed))
        await add(child.id, `${path}/${child.name}`);
    }
  };
  for (const e of selected) {
    const path = await filesystem.getEntryPath(e.id);
    if (path.slice(0, -1).some((p) => ids.includes(p.id))) continue;
    await add(e.id, e.name);
  }
  download(
    await zip.generateAsync({ type: "blob", compression: "DEFLATE" }, (m) =>
      progress(m.percent),
    ),
    "DeskOS-files.zip",
  );
}
export async function importFiles(
  parent: string,
  files: File[],
  progress: (n: number) => void = () => {},
) {
  const size = files.reduce((n, f) => n + f.size, 0);
  if (size > MAX_BATCH)
    throw Error(
      `Import batches below ${formatBytes(MAX_BATCH)} to keep the browser responsive.`,
    );
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota && size > estimate.quota - (estimate.usage ?? 0))
    throw Error("There is not enough browser storage for this import.");
  let count = 0;
  const paths = new Map<string, string>([["", parent || HOME]]);
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split("/");
    parts.pop();
    let path = "";
    let dest = parent;
    for (const part of parts) {
      const next = path ? `${path}/${part}` : part;
      if (!paths.has(next)) {
        const folder = await filesystem
          .createDirectory(dest, part)
          .catch(async (e) => {
            const existing = (await filesystem.listDirectory(dest)).find(
              (e) => e.kind === "directory" && e.name === part,
            );
            if (!existing) throw e;
            return existing;
          });
        paths.set(next, folder.id);
      }
      dest = paths.get(next)!;
      path = next;
    }
    await filesystem.importFile(dest, file);
    progress((++count / files.length) * 100);
  }
}
