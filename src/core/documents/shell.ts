import { filesystem as fs } from "../filesystem/service";
import { HOME } from "../filesystem/types";
import { resolveVirtual, destination } from "./paths";
import { apps } from "../registry";
import { useDesk } from "../store";
export function parseCommand(line: string) {
  const tokens: string[] = [];
  let token = "";
  let quote = "";
  let started = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && line[i + 1]) {
      token += line[++i];
      started = true;
    } else if (quote) {
      if (c === quote) quote = "";
      else token += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (c === ">") {
      if (started) {
        tokens.push(token);
        token = "";
        started = false;
      }
      tokens.push(line[i + 1] === ">" ? (i++, ">>") : ">");
    } else if (/\s/.test(c)) {
      if (started) {
        tokens.push(token);
        token = "";
        started = false;
      }
    } else {
      token += c;
      started = true;
    }
  }
  if (quote) throw Error("Unclosed quote.");
  if (started) tokens.push(token);
  return tokens;
}
export const commands = [
  "pwd",
  "ls",
  "cd",
  "tree",
  "mkdir",
  "touch",
  "cat",
  "cp",
  "mv",
  "rm",
  "rmdir",
  "echo",
  "head",
  "tail",
  "wc",
  "find",
  "grep",
  "help",
  "clear",
  "date",
  "whoami",
  "version",
  "apps",
  "open",
  "theme",
  "history",
];
export async function executeCommand(
  line: string,
  cwd: string,
  history: string[] = [],
): Promise<{ output: string; cwd: string; clear?: boolean }> {
  await fs.initialize();
  const tokens = parseCommand(line);
  const redirect = tokens.findIndex((t) => t === ">" || t === ">>");
  let outputPath = "";
  let append = false;
  if (redirect >= 0) {
    if (tokens.length !== redirect + 2)
      throw Error("Redirection requires one destination path.");
    outputPath = tokens[redirect + 1];
    append = tokens[redirect] === ">>";
    tokens.splice(redirect);
  }
  const [cmd, ...args] = tokens;
  if (!cmd) return { output: "", cwd };
  if (
    outputPath &&
    ![
      "echo",
      "cat",
      "head",
      "tail",
      "wc",
      "grep",
      "pwd",
      "ls",
      "tree",
      "date",
      "history",
      "find",
    ].includes(cmd)
  )
    throw Error("Redirection is only supported for text-producing commands.");
  const flags = args.filter((a) => a.startsWith("-"));
  const params = args.filter((a) => !a.startsWith("-"));
  const requireArg = (i = 0) => {
    if (!params[i]) throw Error(`${cmd}: missing argument`);
    return params[i];
  };
  const read = async (path: string) => {
    const e = await resolveVirtual(path, cwd);
    const { blob } = await fs.readDocument(e.id);
    return blob.text();
  };
  let output = "";
  switch (cmd) {
    case "help":
      output =
        commands.join(" · ") +
        "\nQuoted paths, . and .., > and >> are supported. No pipelines, host processes, npm, or network shell. rm moves to Trash; use Files for permanent deletion.";
      break;
    case "clear":
      return { output: "", cwd, clear: true };
    case "pwd":
      output = "/" + (await fs.getEntryPath(cwd)).map((e) => e.name).join("/");
      break;
    case "ls": {
      const e = await resolveVirtual(params[0] ?? ".", cwd);
      output = (await fs.listDirectory(e.id))
        .map((e) =>
          flags.some((f) => f.includes("l"))
            ? `${e.kind === "directory" ? "d" : "-"} ${String(e.size).padStart(8)} ${new Date(e.modified).toLocaleDateString()} ${e.name}`
            : e.name + (e.kind === "directory" ? "/" : ""),
        )
        .join("\n");
      break;
    }
    case "cd": {
      const e = await resolveVirtual(params[0] ?? "/Home", cwd);
      if (e.kind !== "directory") throw Error("cd: not a directory");
      cwd = e.id;
      break;
    }
    case "tree": {
      const root = await resolveVirtual(params[0] ?? ".", cwd);
      const all = await fs.all();
      const walk = (id: string, depth: number): string[] => {
        if (depth > 30) return ["…"];
        return all
          .filter((e) => e.parentId === id && !e.trashed)
          .flatMap((e) => [
            "  ".repeat(depth) + "└ " + e.name,
            ...(e.kind === "directory" ? walk(e.id, depth + 1) : []),
          ]);
      };
      output = [root.name, ...walk(root.id, 0)].join("\n");
      break;
    }
    case "mkdir":
    case "touch": {
      const d = await destination(requireArg(), cwd);
      if (cmd === "mkdir") await fs.createDirectory(d.parent.id, d.name);
      else {
        const existing = (await fs.listDirectory(d.parent.id)).find(
          (e) => e.name === d.name,
        );
        if (existing) await fs.touch(existing.id);
        else await fs.createFile(d.parent.id, d.name);
      }
      break;
    }
    case "cat":
      output = await read(requireArg());
      break;
    case "echo":
      output = args.join(" ");
      break;
    case "head":
    case "tail": {
      const countIndex = args.indexOf("-n");
      const n = countIndex >= 0 ? Number(args[countIndex + 1]) : 10;
      const path =
        countIndex >= 0
          ? args.filter((_, i) => i !== countIndex && i !== countIndex + 1)[0]
          : requireArg();
      if (!Number.isInteger(n) || n < 0)
        throw Error("Use a nonnegative line count.");
      const lines = (await read(path)).split("\n");
      output = (
        cmd === "head" ? lines.slice(0, n) : n ? lines.slice(-n) : []
      ).join("\n");
      break;
    }
    case "wc": {
      const text = await read(requireArg());
      output = `${text.split("\n").length} lines · ${text.trim().split(/\s+/).filter(Boolean).length} words · ${text.length} characters`;
      break;
    }
    case "grep": {
      const text = await read(requireArg(1));
      output = text
        .split("\n")
        .filter((l) =>
          flags.includes("-i")
            ? l.toLowerCase().includes(params[0].toLowerCase())
            : l.includes(params[0]),
        )
        .join("\n");
      break;
    }
    case "find": {
      const root = await resolveVirtual(args[0] ?? ".", cwd);
      const pattern = args.includes("-name")
        ? args[args.indexOf("-name") + 1]
        : "*";
      if (!pattern) throw Error("find: missing name pattern");
      const re = new RegExp(
        "^" +
          pattern
            .split("*")
            .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*") +
          "$",
      );
      const all = await fs.all();
      const base = (await fs.getEntryPath(root.id))
        .map((e) => e.name)
        .join("/");
      const matches = [];
      for (const e of all.filter((e) => !e.trashed && re.test(e.name))) {
        const path = (await fs.getEntryPath(e.id)).map((e) => e.name).join("/");
        if (path === base || path.startsWith(base + "/"))
          matches.push("/" + path);
      }
      output = matches.join("\n");
      break;
    }
    case "cp":
    case "mv": {
      const e = await resolveVirtual(requireArg(), cwd);
      const path = requireArg(1);
      let target;
      try {
        target = await resolveVirtual(path, cwd);
      } catch {
        /* A new destination name is allowed. */
      }
      if (target) {
        if (target.kind !== "directory")
          throw Error("Destination exists. Choose a new name or directory.");
        await fs.transfer([e.id], target.id, cmd === "cp");
      } else {
        const d = await destination(path, cwd);
        await fs.transferNamed(e.id, d.parent.id, d.name, cmd === "cp");
      }
      break;
    }
    case "rm":
    case "rmdir": {
      const e = await resolveVirtual(requireArg(), cwd);
      if (
        cmd === "rmdir" &&
        (e.kind !== "directory" || (await fs.listDirectory(e.id)).length)
      )
        throw Error("rmdir requires an empty directory.");
      if (
        cmd === "rm" &&
        e.kind === "directory" &&
        !flags.some((f) => f.includes("r"))
      )
        throw Error("Use rm -r for a folder. Items go to Trash.");
      await fs.deleteEntry(e.id);
      output = "Moved to Trash.";
      break;
    }
    case "date":
      output = new Date().toLocaleString();
      break;
    case "whoami":
      output = "local@deskos — virtual browser session";
      break;
    case "version":
      output = "DeskOS 0.3.0 · Core Integrated Applications";
      break;
    case "apps":
      output = apps.map((a) => `${a.id}\t${a.name}`).join("\n");
      break;
    case "open": {
      const id = requireArg();
      const app = apps.find((a) => a.id === id);
      if (app) useDesk.getState().open(app.id);
      else {
        const e = await resolveVirtual(id, cwd);
        useDesk
          .getState()
          .open(
            e.kind === "directory"
              ? "files"
              : /^(md|txt)$/.test(e.extension)
                ? "notes"
                : "code",
            e.id,
          );
      }
      break;
    }
    case "theme": {
      const theme = args[0];
      if (!theme) output = useDesk.getState().prefs.theme;
      else if (theme === "dark" || theme === "light" || theme === "system")
        useDesk.getState().setPrefs({ theme });
      else throw Error("theme: use dark, light or system");
      break;
    }
    case "history":
      output = history.map((h, i) => `${i + 1}  ${h}`).join("\n");
      break;
    default:
      throw Error(`Command not found: ${cmd}. Type help.`);
  }
  if (outputPath) {
    const d = await destination(outputPath, cwd);
    const e = (await fs.listDirectory(d.parent.id)).find(
      (e) => e.name === d.name,
    );
    if (e) {
      const snapshot = await fs.readDocument(e.id);
      const text = (append ? await snapshot.blob.text() : "") + output + "\n";
      await fs.saveDocument(e.id, text, snapshot.entry.revision ?? 0);
    } else
      await fs.createFile(
        d.parent.id,
        d.name,
        new Blob([output + "\n"], { type: "text/plain" }),
      );
    output = "";
  }
  return { output, cwd };
}
export async function completeCommand(input: string, cwd: string) {
  const parts = parseCommand(input);
  if (!input.includes(" ")) return commands.filter((c) => c.startsWith(input));
  const last = input.endsWith(" ") ? "" : (parts.at(-1) ?? "");
  const slash = last.lastIndexOf("/");
  const prefix = last.slice(0, slash + 1);
  const dir = await resolveVirtual(prefix || ".", cwd);
  return (await fs.listDirectory(dir.id))
    .filter((e) => e.name.startsWith(last.slice(slash + 1)))
    .map((e) => prefix + e.name + (e.kind === "directory" ? "/" : ""));
}
export { HOME };
