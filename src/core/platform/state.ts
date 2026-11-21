import { create } from "zustand";
import { readStorage, writeStorage } from "../storage";
import {
  validatePlatform,
  validatePackage,
  compareVersions,
  DATA_LIMIT,
} from "./package";
import type { PlatformState, AppPackage, Capability } from "./types";
const empty: PlatformState = {
  version: 1,
  installed: [],
  grants: {},
  data: {},
  events: [],
  externalPackages: true,
};
export let platformLoadError = "";
let initial = empty;
try {
  const stored = readStorage("platform.v1");
  if (stored) initial = validatePlatform(stored);
} catch {
  platformLoadError =
    "Saved app platform data is malformed. Packages were not registered. The original record is retained until you explicitly install or change app data.";
  /* Corrupt platform data is not executed or overwritten until an explicit operation. */
}
export const usePlatform = create<{ state: PlatformState; revision: number }>(
  () => ({ state: initial, revision: 0 }),
);
export function commitPlatform(state: PlatformState) {
  const valid = validatePlatform(state);
  if (
    JSON.stringify(valid.installed) ===
    JSON.stringify(usePlatform.getState().state.installed)
  )
    valid.installed = usePlatform.getState().state.installed;
  if (!writeStorage("platform.v1", valid))
    throw Error(
      "App storage could not be saved. Free space or finish pending recovery.",
    );
  usePlatform.setState((s) => ({ state: valid, revision: s.revision + 1 }));
}
export function installPackage(input: AppPackage) {
  const p = validatePackage(input),
    s = usePlatform.getState().state,
    old = s.installed.find((i) => i.package.manifest.id === p.manifest.id);
  if (
    old &&
    compareVersions(p.manifest.version, old.package.manifest.version) <= 0
  )
    throw Error("Updates must have a higher semantic version.");
  const event = {
    id: crypto.randomUUID(),
    appId: p.manifest.id,
    action: old ? "Updated" : "Installed",
    version: p.manifest.version,
    time: Date.now(),
  };
  commitPlatform({
    ...s,
    installed: [
      ...s.installed.filter((i) => i.package.manifest.id !== p.manifest.id),
      {
        package: p,
        enabled: true,
        installed: old?.installed || Date.now(),
        updated: Date.now(),
        previous: old?.package,
      },
    ],
    grants: { ...s.grants, [p.manifest.id]: [] },
    events: [...s.events, event].slice(-100),
  });
}
export function enablePackage(id: string, enabled: boolean) {
  const s = usePlatform.getState().state;
  commitPlatform({
    ...s,
    installed: s.installed.map((i) =>
      i.package.manifest.id === id ? { ...i, enabled } : i,
    ),
    grants: { ...s.grants, [id]: [] },
  });
}
export function removePackage(id: string, deleteData: boolean) {
  const s = usePlatform.getState().state,
    data = { ...s.data },
    grants = { ...s.grants };
  if (deleteData) delete data[id];
  delete grants[id];
  commitPlatform({
    ...s,
    installed: s.installed.filter((i) => i.package.manifest.id !== id),
    grants,
    data,
    events: [
      ...s.events,
      {
        id: crypto.randomUUID(),
        appId: id,
        action: "Uninstalled" + (deleteData ? " with data" : "; data retained"),
        time: Date.now(),
        version: "",
      },
    ].slice(-100),
  });
}
export function rollbackPackage(id: string) {
  const s = usePlatform.getState().state;
  const app = s.installed.find((i) => i.package.manifest.id === id);
  if (!app?.previous) throw Error("No previous package retained");
  commitPlatform({
    ...s,
    installed: s.installed.map((i) =>
      i === app
        ? { ...i, package: app.previous!, previous: undefined, enabled: false }
        : i,
    ),
    grants: { ...s.grants, [id]: [] },
    events: [
      ...s.events,
      {
        id: crypto.randomUUID(),
        appId: id,
        action: "Rolled back package; data unchanged",
        time: Date.now(),
        version: app.previous.manifest.version,
      },
    ].slice(-100),
  });
}
export function grantCapability(id: string, capability: Capability) {
  const s = usePlatform.getState().state;
  commitPlatform({
    ...s,
    grants: {
      ...s.grants,
      [id]: [...new Set([...(s.grants[id] || []), capability])],
    },
  });
}
export function revokePermissions(id: string) {
  const s = usePlatform.getState().state;
  commitPlatform({ ...s, grants: { ...s.grants, [id]: [] } });
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("deskos-permissions-revoked", { detail: id }),
    );
}
export function appStorageSet(id: string, key: string, value: unknown) {
  if (
    !/^[a-zA-Z0-9_.-]{1,80}$/.test(key) ||
    ["__proto__", "constructor", "prototype"].includes(key)
  )
    throw Error("Invalid app data key");
  const s = usePlatform.getState().state,
    appData = { ...s.data[id], [key]: value };
  if (new TextEncoder().encode(JSON.stringify(appData)).length > DATA_LIMIT)
    throw Error("App storage exceeds 64 KB");
  commitPlatform({ ...s, data: { ...s.data, [id]: appData } });
}

export const liveFileScopes = new Map<
  string,
  { appId: string; files: string[] }
>();
