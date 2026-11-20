import type {
  FileVersion,
  RestorePoint,
  RecoveryJournal,
} from "../history/types";
import Dexie from "dexie";
import type { Table } from "dexie";
import type { Entry, Content } from "./types";
export class FileDatabase extends Dexie {
  versions!: Table<FileVersion, string>;
  points!: Table<RestorePoint, string>;
  journals!: Table<RecoveryJournal, string>;
  entries!: Table<Entry, string>;
  contents!: Table<Content, string>;
  constructor(name = "deskos-files-v1") {
    super(name);
    this.version(1).stores({
      entries: "id,parentId,name,kind,modified,accessed",
      contents: "id",
    });
    this.version(2).stores({
      entries: "id,parentId,name,kind,modified,accessed",
      contents: "id",
      versions: "id,fileId,created",
      points: "id,created",
      journals: "id,created",
    });
  }
}
export const db = new FileDatabase();
