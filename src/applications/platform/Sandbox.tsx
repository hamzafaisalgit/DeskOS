import { useEffect, useRef, useState } from "react";
import { useLaunchData } from "../../core/launch";
import { useDesk } from "../../core/store";
import {
  usePlatform,
  grantCapability,
  appStorageSet,
  liveFileScopes,
} from "../../core/platform/state";
import {
  validateRequest,
  requiredCapability,
  requireFileScope,
} from "../../core/platform/protocol";
import { buildAppDocument } from "../../core/platform/document";
import type { AppPackage, Capability } from "../../core/platform/types";
import { filesystem as fs } from "../../core/filesystem/service";
import { useFilesystem } from "../../core/filesystem/hooks";
import { FocusPanel } from "../../components/Overlays";
import "./platform.css";
type Prompt =
  | {
      kind: "permission";
      cap: Capability;
      resolve: (value: "once" | "session" | "remember" | "deny") => void;
    }
  | { kind: "file"; resolve: (id: string | null) => void };
export default function InstalledSandbox() {
  const launch = useLaunchData(),
    installed = usePlatform((s) =>
      s.state.installed.find(
        (i) => "pkg:" + i.package.manifest.id === launch.appId,
      ),
    );
  return installed?.enabled ? (
    <SandboxRuntime
      key={installed.package.manifest.version}
      app={installed.package}
    />
  ) : (
    <div className="empty">
      <h2>Application unavailable</h2>
      <p>Enable or install this application in App Center.</p>
    </div>
  );
}
export function SandboxRuntime({
  app,
  preview = false,
}: {
  app: AppPackage;
  preview?: boolean;
}) {
  const iframe = useRef<HTMLIFrameElement>(null),
    { entries } = useFilesystem(),
    launch = useLaunchData();
  const [document, setDocument] = useState(""),
    [error, setError] = useState(""),
    [prompt, setPrompt] = useState<Prompt | null>(null),
    [selected, setSelected] = useState("");
  const promptRef = useRef<Prompt | null>(null);
  useEffect(() => {
    const token = crypto.randomUUID(),
      scopes = new Map<string, number>(),
      session = new Set<Capability>(),
      seen = new Set<string>();
    let alive = true,
      epoch = 0,
      inflight = false,
      loads = 0,
      requests = 0,
      bucket = Date.now();
    liveFileScopes.set(token, { appId: app.manifest.id, files: [] });
    const manifest = app.manifest,
      id = preview ? "preview:" + manifest.id : manifest.id;
    const installed = () =>
      preview ||
      usePlatform
        .getState()
        .state.installed.some(
          (i) =>
            i.enabled &&
            i.package.manifest.id === manifest.id &&
            i.package.manifest.version === manifest.version,
        );
    const assert = () => {
      if (!alive || !installed())
        throw Error("Application session is no longer active");
    };
    const ask = <T,>(value: Prompt) => {
      if (promptRef.current) throw Error("Another permission request is open");
      promptRef.current = value;
      setPrompt(value);
      return undefined as T;
    };
    const dismiss = () => {
      const p = promptRef.current;
      if (p?.kind === "permission") p.resolve("deny");
      else if (p) p.resolve(null);
      promptRef.current = null;
      setPrompt(null);
    };
    const revoke = (event: Event) => {
      if ((event as CustomEvent).detail !== manifest.id) return;
      epoch++;
      session.clear();
      scopes.clear();
      liveFileScopes.set(token, { appId: manifest.id, files: [] });
      dismiss();
    };
    window.addEventListener("deskos-permissions-revoked", revoke);
    const message = async (event: MessageEvent) => {
      if (
        event.source !== iframe.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      const value = event.data;
      if (!value || value.token !== token) return;
      let request: ReturnType<typeof validateRequest> | undefined;
      let ownsSlot = false;
      try {
        request = validateRequest(value, token, manifest);
        assert();
        if (Date.now() - bucket > 60000) {
          bucket = Date.now();
          requests = 0;
        }
        if (++requests > 120 || seen.has(request.id) || seen.size >= 10000)
          throw Error("Request limit exceeded");
        seen.add(request.id);
        if (inflight) throw Error("Wait for the current host operation.");
        inflight = true;
        ownsSlot = true;
        const deadline = Date.now() + 85000;
        const startEpoch = epoch,
          check = () => {
            assert();
            if (Date.now() > deadline) throw Error("SDK request expired");
            if (epoch !== startEpoch)
              throw Error("Permission revoked while request was pending");
          };
        const cap = requiredCapability(request.method);
        if (
          cap &&
          !session.has(cap) &&
          !(
            preview ? [] : usePlatform.getState().state.grants[id] || []
          ).includes(cap)
        ) {
          const answer = await new Promise<
            "once" | "session" | "remember" | "deny"
          >((resolve) => ask({ kind: "permission", cap, resolve }));
          check();
          if (answer === "deny") throw Error("Permission denied");
          if (answer === "session") session.add(cap);
          if (answer === "remember") {
            if (preview) session.add(cap);
            else grantCapability(id, cap);
          }
        }
        check();
        const p = request.params;
        let result: unknown;
        switch (request.method) {
          case "runtime.error":
            if (typeof p.message === "string")
              setError("Application script failed: " + p.message.slice(0, 500));
            break;
          case "app.info":
            result = {
              id: manifest.id,
              name: manifest.name,
              version: manifest.version,
              sdk: 1,
            };
            break;
          case "theme.current": {
            const prefs = useDesk.getState().prefs;
            const state = useDesk.getState(),
              space = state.spaces.find(
                (s) =>
                  s.id ===
                  state.windows.find((w) => w.id === launch.windowId)?.spaceId,
              );
            result = {
              theme:
                prefs.theme === "system"
                  ? matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light"
                  : prefs.theme,
              accent: space?.accent || prefs.accent,
            };
            break;
          }
          case "window.title": {
            if (typeof p.title !== "string" || p.title.length > 80)
              throw Error("Title must be at most 80 characters");
            if (launch.windowId && !preview)
              useDesk.setState((s) => ({
                windows: s.windows.map((w) =>
                  w.id === launch.windowId
                    ? { ...w, title: p.title as string }
                    : w,
                ),
              }));
            break;
          }
          case "notifications.show":
            if (
              typeof p.title !== "string" ||
              typeof p.message !== "string" ||
              p.title.length > 100 ||
              p.message.length > 500
            )
              throw Error("Invalid notification");
            useDesk
              .getState()
              .notify(manifest.name + ": " + p.title + " / " + p.message);
            break;
          case "storage.get":
            if (
              typeof p.key !== "string" ||
              !p.key.match(/^[a-zA-Z0-9_.-]{1,80}$/) ||
              ["__proto__", "constructor", "prototype"].includes(p.key)
            )
              throw Error("Invalid storage key");
            result = usePlatform.getState().state.data[id]?.[p.key] ?? null;
            break;
          case "storage.set":
            if (typeof p.key !== "string" || p.value === undefined)
              throw Error("Invalid storage parameters");
            check();
            appStorageSet(id, p.key, p.value);
            break;
          case "files.pick": {
            const fileId = await new Promise<string | null>((resolve) =>
              ask({ kind: "file", resolve }),
            );
            check();
            if (!fileId) throw Error("File selection canceled");
            const entry = await fs.getEntry(fileId);
            check();
            if (
              entry.trashed ||
              entry.kind !== "file" ||
              entry.size > 128 * 1024
            )
              throw Error("Choose a live text file below 128 KB");
            scopes.set(entry.id, entry.revision ?? 0);
            liveFileScopes.set(token, {
              appId: manifest.id,
              files: [...scopes.keys()],
            });
            result = { id: entry.id, name: entry.name, mime: entry.mime };
            break;
          }
          case "files.read": {
            const fileId = requireFileScope(p.id, scopes);
            const doc = await fs.readDocument(fileId, 128 * 1024);
            const text = await doc.blob.text();
            check();
            scopes.set(fileId, doc.entry.revision ?? 0);
            result = {
              text,
              revision: doc.entry.revision ?? 0,
              name: doc.entry.name,
            };
            break;
          }
          case "files.write": {
            const fileId = requireFileScope(p.id, scopes);
            if (
              typeof p.text !== "string" ||
              new TextEncoder().encode(p.text).length > 128 * 1024 ||
              !Number.isSafeInteger(p.revision) ||
              p.revision !== scopes.get(fileId)
            )
              throw Error(
                "Invalid write or stale file revision; read the selected file again",
              );
            check();
            const e = await fs.saveDocument(
              fileId,
              p.text,
              p.revision as number,
              check,
            );
            check();
            scopes.set(fileId, e.revision ?? 0);
            result = { revision: e.revision ?? 0 };
            break;
          }
        }
        check();
        iframe.current?.contentWindow?.postMessage(
          { protocol: 1, token, id: request.id, ok: true, result },
          "*",
        );
      } catch (e) {
        if (
          alive &&
          typeof value.id === "string" &&
          /^[0-9]{1,12}$/.test(value.id)
        )
          iframe.current?.contentWindow?.postMessage(
            { protocol: 1, token, id: value.id, ok: false, error: String(e) },
            "*",
          );
      } finally {
        if (ownsSlot) inflight = false;
      }
    };
    const load = () => {
      loads++;
      if (loads > 1) {
        epoch++;
        scopes.clear();
        session.clear();
        setError(
          "The app navigated away from its packaged document. Host access is stopped. Reopen to restart.",
        );
        alive = false;
        dismiss();
      }
    };
    const node = iframe.current;
    node?.addEventListener("load", load);
    window.addEventListener("message", message);
    try {
      setDocument(buildAppDocument(app, token));
    } catch (e) {
      setError(String(e));
    }
    return () => {
      alive = false;
      epoch++;
      dismiss();
      window.removeEventListener("message", message);
      window.removeEventListener("deskos-permissions-revoked", revoke);
      node?.removeEventListener("load", load);
      scopes.clear();
      liveFileScopes.delete(token);
    };
  }, [app.manifest.id, app.manifest.version, preview, launch.windowId, app]);
  const resolvePrompt = (answer: "once" | "session" | "remember" | "deny") => {
    const p = promptRef.current;
    promptRef.current = null;
    setPrompt(null);
    if (p?.kind === "permission") p.resolve(answer);
  };
  const resolveFile = (id: string | null) => {
    const p = promptRef.current;
    promptRef.current = null;
    setPrompt(null);
    if (p?.kind === "file") p.resolve(id);
  };
  return (
    <div className="sandbox-app">
      {error ? (
        <div className="empty" role="alert">
          <h2>Application stopped</h2>
          <p>{error}</p>
        </div>
      ) : (
        <iframe
          ref={iframe}
          title={app.manifest.name + " sandbox"}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={document || undefined}
          allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
        />
      )}
      {prompt?.kind === "permission" && (
        <FocusPanel
          className="app-permission"
          close={() => resolvePrompt("deny")}
        >
          <small>APP CAPABILITY REQUEST</small>
          <h2>{app.manifest.name}</h2>
          <p>
            Requests <strong>{prompt.cap}</strong>.
          </p>
          <p>
            {
              {
                "storage.read": "Read its own app-owned data only.",
                "storage.write": "Write up to 64 KB of its own app-owned data.",
                "files.pick":
                  "Ask you to select a text file. Each file must be explicitly picked in this window.",
                "files.read": "Read only files you selected in this window.",
                "files.write":
                  "Save new content to selected files using revision checks. Unsaved editors will detect external changes.",
                notifications: "Show notifications inside DeskOS.",
              }[prompt.cap]
            }
          </p>
          <p>
            Only approve apps you trust with this data. Iframe isolation is not
            a network firewall.
          </p>
          <div>
            <button onClick={() => resolvePrompt("deny")}>Deny</button>
            <button onClick={() => resolvePrompt("once")}>Allow once</button>
            <button onClick={() => resolvePrompt("session")}>
              This window
            </button>
            <button
              className="primary"
              onClick={() => resolvePrompt("remember")}
            >
              {preview ? "This preview" : "Remember"}
            </button>
          </div>
        </FocusPanel>
      )}
      {prompt?.kind === "file" && (
        <FocusPanel className="app-permission" close={() => resolveFile(null)}>
          <h2>Choose a file for {app.manifest.name}</h2>
          <p>
            Only this file is scoped to the requesting window. Access expires
            when closed or revoked.
          </p>
          <select
            aria-label="File to share"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a saved text file</option>
            {entries
              .filter(
                (e) =>
                  !e.trashed &&
                  e.kind === "file" &&
                  e.size <= 128 * 1024 &&
                  (e.mime.startsWith("text/") ||
                    /^(txt|md|json|html|css|js|ts|csv)$/.test(e.extension)),
              )
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} / {e.parentId}
                </option>
              ))}
          </select>
          <button onClick={() => resolveFile(null)}>Cancel</button>
          <button
            className="primary"
            disabled={!selected}
            onClick={() => resolveFile(selected)}
          >
            Share selected file
          </button>
        </FocusPanel>
      )}
    </div>
  );
}
