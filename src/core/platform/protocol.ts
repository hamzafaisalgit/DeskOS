import type { AppManifest, Capability, SDKRequest } from "./types";
const methods: Record<string, Capability | undefined> = {
  "runtime.error": undefined,
  "app.info": undefined,
  "theme.current": undefined,
  "window.title": undefined,
  "storage.get": "storage.read",
  "storage.set": "storage.write",
  "files.pick": "files.pick",
  "files.read": "files.read",
  "files.write": "files.write",
  "notifications.show": "notifications",
};
export function validateRequest(
  value: unknown,
  token: string,
  manifest: AppManifest,
): SDKRequest {
  if (
    !value ||
    typeof value !== "object" ||
    JSON.stringify(value).length > 128 * 1024
  )
    throw Error("Invalid or oversized SDK request");
  const r = value as SDKRequest;
  if (
    r.protocol !== 1 ||
    r.token !== token ||
    typeof r.id !== "string" ||
    !/^[0-9]{1,12}$/.test(r.id) ||
    !Object.hasOwn(methods, r.method) ||
    !r.params ||
    typeof r.params !== "object" ||
    Array.isArray(r.params)
  )
    throw Error("Unsupported protocol, session or method");
  const cap = methods[r.method];
  if (cap && !manifest.capabilities.includes(cap))
    throw Error("Capability not declared: " + cap);
  return r;
}
export const requiredCapability = (method: string) => methods[method];
export function requireFileScope(id: unknown, scopes: Map<string, number>) {
  if (typeof id !== "string" || !scopes.has(id))
    throw Error(
      "File access is not granted in this window. Use deskos.files.pick().",
    );
  return id;
}
