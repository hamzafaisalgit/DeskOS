export const SDK_VERSION = 1;
export const capabilities = [
  "storage.read",
  "storage.write",
  "files.pick",
  "files.read",
  "files.write",
  "notifications",
] as const;
export type Capability = (typeof capabilities)[number];
export type AppManifest = {
  format: "deskos-app";
  packageVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  developer: string;
  category: string;
  icon: string;
  entrypoint: "index.html";
  sdk: 1;
  capabilities: Capability[];
  fileTypes: string[];
  multiple: boolean;
  keywords: string[];
};
export type AppPackage = {
  manifest: AppManifest;
  files: Record<string, string>;
};
export type InstalledApp = {
  package: AppPackage;
  enabled: boolean;
  installed: number;
  updated: number;
  previous?: AppPackage;
};
export type PlatformState = {
  version: 1;
  installed: InstalledApp[];
  grants: Record<string, Capability[]>;
  data: Record<string, Record<string, unknown>>;
  events: {
    id: string;
    appId: string;
    action: string;
    time: number;
    version: string;
  }[];
  externalPackages: boolean;
};
export type SDKRequest = {
  protocol: 1;
  token: string;
  id: string;
  method: string;
  params: Record<string, unknown>;
};
export type SDKResponse = {
  protocol: 1;
  token: string;
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};
export const packageKey = (id: string) => "pkg:" + id;
