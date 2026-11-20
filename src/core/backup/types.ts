import type { Entry } from "../filesystem/types";
export const MAX_CAPSULE = 100 * 1024 * 1024,
  MAX_ITEMS = 10000,
  MAX_JSON = 8 * 1024 * 1024;
export type Manifest = {
  format: "deskos-capsule";
  version: 1;
  appVersion: string;
  created: string;
  categories: string[];
  fileCount: number;
  logicalBytes: number;
  checksums: Record<string, { sha256: string; size: number }>;
};
export type CapsuleData = {
  manifest: Manifest;
  entries: Entry[];
  blobs: Map<string, Blob>;
  settings: Record<string, unknown>;
};
export type RestoreMode = "merge" | "replace";
export type RestorePlan = {
  mode: RestoreMode;
  categories: string[];
  fileIds: string[];
  conflict: "copy" | "skip";
  summary: string[];
  stamp: string;
};
export type Stage = (message: string) => void;
