import { filesystem as fs } from "../filesystem/service";
import { HOME } from "../filesystem/types";
export async function resolveVirtual(path: string, cwd = HOME) {
  let entry = await fs.getEntry(path.startsWith("/") ? HOME : cwd);
  const parts = path.split("/").filter(Boolean);
  if (path.startsWith("/") && parts[0]?.toLowerCase() === "home") parts.shift();
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      entry = await fs.getEntry(entry.parentId ?? HOME);
      continue;
    }
    const next = (await fs.listDirectory(entry.id)).find(
      (e) => e.name === part,
    );
    if (!next) throw Error(`Path not found: ${path}`);
    entry = next;
  }
  if (entry.trashed) throw Error("This location is in Trash.");
  return entry;
}
export async function destination(path: string, cwd = HOME) {
  const slash = path.lastIndexOf("/");
  return {
    parent: await resolveVirtual(
      slash < 0 ? "." : path.slice(0, slash) || "/",
      cwd,
    ),
    name: path.slice(slash + 1),
  };
}
