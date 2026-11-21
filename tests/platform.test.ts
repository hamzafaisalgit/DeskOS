import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
const { catalog, starters } = await import("../src/core/platform/catalog");
const {
  validatePackage,
  validateManifest,
  packageApp,
  parseAppPackage,
  validatePlatform,
} = await import("../src/core/platform/package");
const {
  usePlatform,
  installPackage,
  appStorageSet,
  removePackage,
  grantCapability,
  revokePermissions,
} = await import("../src/core/platform/state");
const { apps } = await import("../src/core/registry");
const { validateRequest, requireFileScope } =
  await import("../src/core/platform/protocol");
beforeEach(() => {
  memory.clear();
  usePlatform.setState({
    state: {
      version: 1,
      installed: [],
      grants: {},
      data: {},
      events: [],
      externalPackages: true,
    },
    revision: 0,
  });
});
it("round trips package installation into the central registry and preserves data on updates", async () => {
  const first = validatePackage(catalog[2]);
  const archive = await packageApp(first);
  const parsed = await parseAppPackage(archive);
  installPackage(parsed);
  expect(apps.some((a) => a.id === "pkg:" + parsed.manifest.id)).toBe(true);
  appStorageSet(first.manifest.id, "color", "#ffffff");
  grantCapability(first.manifest.id, "storage.write");
  const updated = structuredClone(first);
  updated.manifest.version = "1.1.0";
  installPackage(updated);
  expect(usePlatform.getState().state.data[first.manifest.id].color).toBe(
    "#ffffff",
  );
  expect(usePlatform.getState().state.grants[first.manifest.id]).toEqual([]);
  expect(
    usePlatform.getState().state.installed[0].previous?.manifest.version,
  ).toBe("1.0.0");
  removePackage(first.manifest.id, false);
  expect(apps.some((a) => a.id === "pkg:" + first.manifest.id)).toBe(false);
  expect(usePlatform.getState().state.data[first.manifest.id].color).toBe(
    "#ffffff",
  );
});
it("rejects invalid manifests and undeclared methods or unscoped files", () => {
  expect(() =>
    validateManifest({ ...catalog[0].manifest, id: "../../system" }),
  ).toThrow();
  expect(() =>
    validateRequest(
      {
        protocol: 1,
        token: "t",
        id: "1",
        method: "files.read",
        params: { id: "home" },
      },
      "t",
      catalog[0].manifest,
    ),
  ).toThrow("Capability not declared");
  expect(() => requireFileScope("home", new Map())).toThrow("not granted");
  expect(() =>
    validateRequest(
      { protocol: 1, token: "wrong", id: "1", method: "app.info", params: {} },
      "t",
      catalog[0].manifest,
    ),
  ).toThrow();
});
it("revokes grants and disables imported packages while retaining owned data", async () => {
  installPackage(starters[1]);
  grantCapability(starters[1].manifest.id, "storage.read");
  revokePermissions(starters[1].manifest.id);
  expect(usePlatform.getState().state.grants[starters[1].manifest.id]).toEqual(
    [],
  );
  grantCapability(starters[1].manifest.id, "storage.write");
  appStorageSet(starters[1].manifest.id, "note", "Saved data");
  const restored = validatePlatform(usePlatform.getState().state, true);
  expect(restored.installed[0].enabled).toBe(false);
  expect(restored.grants).toEqual({});
  expect(restored.data[starters[1].manifest.id].note).toBe("Saved data");
  const { exportCapsule, inspectCapsule } =
    await import("../src/core/backup/capsule");
  const { planRestore, executeRestore } =
    await import("../src/core/backup/restore");
  const { db } = await import("../src/core/filesystem/database");
  const capsule = await inspectCapsule(await exportCapsule(["applications"]));
  const plan = await planRestore(capsule, "replace", ["applications"]);
  await executeRestore(capsule, plan);
  const persisted = JSON.parse(memory.get("deskos.v1.platform.v1")!);
  expect(persisted.installed[0].enabled).toBe(false);
  expect(persisted.grants).toEqual({});
  expect(persisted.data[starters[1].manifest.id].note).toBe("Saved data");
  const { setPersistencePaused } = await import("../src/core/storage");
  setPersistencePaused(false);
  const { setRecoveryWriteLock } =
    await import("../src/core/filesystem/service");
  setRecoveryWriteLock(false);
  await db.delete();
});
