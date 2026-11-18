import Dexie from "dexie";
import type { Table } from "dexie";
import type { Entry, Content } from "./types";
export class FileDatabase extends Dexie {
  entries!: Table<Entry, string>;
  contents!: Table<Content, string>;
  constructor(name = "deskos-files-v1") {
    super(name);
    this.version(1).stores({
      entries: "id,parentId,name,kind,modified,accessed",
      contents: "id",
    });
  }
}
export const db = new FileDatabase();
