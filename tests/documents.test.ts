import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { filesystem as fs } from "../src/core/filesystem/service";
import { db } from "../src/core/filesystem/database";
import { executeCommand, parseCommand } from "../src/core/documents/shell";
import { calculate } from "../src/core/calculator";
import { HOME } from "../src/core/filesystem/types";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await fs.initialize();
});
it("shared documents save and prevent stale overwrite by revision", async () => {
  const e = await fs.createFile(HOME, "shared.md", new Blob(["first"]));
  const snapshot = await fs.readDocument(e.id);
  await fs.saveDocument(e.id, "from Notes", snapshot.entry.revision ?? 0);
  expect(await (await fs.getFileContent(e.id)).text()).toBe("from Notes");
  await expect(
    fs.saveDocument(
      e.id,
      "stale Code Studio edit",
      snapshot.entry.revision ?? 0,
    ),
  ).rejects.toThrow("Conflict");
  expect(await (await fs.getFileContent(e.id)).text()).toBe("from Notes");
});
it("terminal quotes, redirection, copy rename and Trash use real storage", async () => {
  expect(parseCommand('echo "hello world" > "a b.txt"')).toEqual([
    "echo",
    "hello world",
    ">",
    "a b.txt",
  ]);
  await executeCommand('mkdir "My Project"', HOME);
  let cwd = (await executeCommand('cd "My Project"', HOME)).cwd;
  await executeCommand('echo "Hello DeskOS" > "note one.txt"', cwd);
  expect((await executeCommand('cat "note one.txt"', cwd)).output).toBe(
    "Hello DeskOS\n",
  );
  await executeCommand('cp "note one.txt" backup.txt', cwd);
  await executeCommand("mv backup.txt archive.txt", cwd);
  await executeCommand("rm archive.txt", cwd);
  expect((await fs.listDirectory(cwd)).map((e) => e.name)).toEqual([
    "note one.txt",
  ]);
  cwd = (await executeCommand("cd ..", cwd)).cwd;
  expect(cwd).toBe(HOME);
});
it("scientific parser handles precedence degrees constants and invalid domains", () => {
  expect(calculate("sin(30)", true)).toBe(0.5);
  expect(calculate("sqrt(81)+2^3+5!")).toBe(137);
  expect(calculate("log(100)+ln(e)")).toBe(3);
  expect(calculate("50%*200")).toBe(100);
  expect(calculate("-2^2")).toBe(-4);
  expect(() => calculate("sqrt(-1)")).toThrow();
  expect(() => calculate("171!")).toThrow();
  expect(() => calculate("tan(90)", true)).toThrow();
});
