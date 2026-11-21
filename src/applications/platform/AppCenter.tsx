import { useRef, useState } from "react";
import {
  Store,
  Search,
  Package,
  ArrowLeft,
  ArrowRight,
  Download,
  Upload,
  ShieldCheck,
  Blocks,
  Trash2,
  Power,
  RotateCcw,
} from "lucide-react";
import { apps, builtInApps, appById } from "../../core/registry";
import { catalog } from "../../core/platform/catalog";
import {
  usePlatform,
  installPackage,
  enablePackage,
  removePackage,
  revokePermissions,
  rollbackPackage,
  commitPlatform,
  liveFileScopes,
  platformLoadError,
} from "../../core/platform/state";
import {
  parseAppPackage,
  packageApp,
  compareVersions,
} from "../../core/platform/package";
import type { AppPackage } from "../../core/platform/types";
import { useDesk } from "../../core/store";
import { download } from "../../core/filesystem/transfers";
import { OperationDialog } from "../files/OperationDialog";
import type { FileDialog } from "../files/OperationDialog";
import "./platform.css";
export default function AppCenter() {
  useDesk((s) => s.active);
  const state = usePlatform((s) => s.state),
    input = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("Discover"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [sort, setSort] = useState("name"),
    [detail, setDetail] = useState<AppPackage | null>(null),
    [builtin, setBuiltin] = useState(""),
    [pending, setPending] = useState<AppPackage | null>(null),
    [error, setError] = useState(platformLoadError),
    [busy, setBusy] = useState(false),
    [deleteData, setDeleteData] = useState(false),
    [dialog, setDialog] = useState<FileDialog | null>(null);
  const notify = useDesk.getState().notify;
  const installed = detail
    ? state.installed.find((i) => i.package.manifest.id === detail.manifest.id)
    : undefined;
  const all = [
    ...catalog,
    ...state.installed
      .map((i) => i.package)
      .filter((p) => !catalog.some((c) => c.manifest.id === p.manifest.id)),
  ];
  const show = (work: () => void) => {
    try {
      work();
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  const inspect = async (file: Blob) => {
    setBusy(true);
    setError("");
    try {
      if (!state.externalPackages)
        throw Error(
          "Enable external package inspection in Developer settings below first.",
        );
      const p = await parseAppPackage(file);
      setPending(p);
      setDetail(p);
      setBuiltin("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const confirmInstall = (p: AppPackage) => {
    const old = state.installed.find(
      (i) => i.package.manifest.id === p.manifest.id,
    );
    setDialog({
      title: old
        ? "Update " + p.manifest.name + "?"
        : "Install " + p.manifest.name + "?",
      confirm:
        (old
          ? "Update " +
            old.package.manifest.version +
            " to " +
            p.manifest.version +
            ". Running instances will close. App-owned data is preserved. The previous package is retained for rollback; data migrations are not performed. "
          : "") +
        "This package runs scripts in an isolated iframe. Declared capabilities: " +
        (p.manifest.capabilities.join(", ") || "none") +
        ". Permission requests are approved separately. Only install code you trust.",
      run: async () => {
        installPackage(p);
        setPending(null);
        notify(
          old ? "Application updated" : "Application installed",
          "success",
        );
      },
    });
  };
  const filtered = all
    .filter((p) => {
      const m = p.manifest,
        i = state.installed.find((i) => i.package.manifest.id === m.id);
      return (
        (tab !== "Installed" || !!i) &&
        (tab !== "Updates" ||
          (i && compareVersions(m.version, i.package.manifest.version) > 0)) &&
        (category === "All categories" || m.category === category) &&
        [m.name, m.description, m.developer, m.category, ...m.keywords]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "category"
        ? a.manifest.category.localeCompare(b.manifest.category)
        : sort === "installed"
          ? Number(
              state.installed.some(
                (i) => i.package.manifest.id === b.manifest.id,
              ),
            ) -
            Number(
              state.installed.some(
                (i) => i.package.manifest.id === a.manifest.id,
              ),
            )
          : sort === "recent"
            ? all.indexOf(b) - all.indexOf(a)
            : a.manifest.name.localeCompare(b.manifest.name),
    );
  return (
    <div className="platform-app">
      <aside className="platform-sidebar">
        <div className="platform-brand">
          <Store size={29} />
          <strong>App Center</strong>
          <small>A LITTLE MORE POSSIBILITY.</small>
        </div>
        {[
          "Discover",
          "Categories",
          "All Apps",
          "Installed",
          "Updates",
          "Developer",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => {
              setTab(t);
              setDetail(null);
              setBuiltin("");
              setPending(null);
            }}
          >
            {t}
          </button>
        ))}
        <button disabled={busy} onClick={() => input.current?.click()}>
          <Upload size={15} />
          Import .deskapp
        </button>
        <input
          hidden
          ref={input}
          type="file"
          accept=".deskapp"
          aria-label="Import app package"
          onChange={(e) => {
            if (e.target.files?.[0]) void inspect(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <p>
          Offline catalog.
          <br />
          Local packages. No ratings, telemetry or remote marketplace.
        </p>
      </aside>
      <main
        className="platform-main"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy && e.dataTransfer.files[0])
            void inspect(e.dataTransfer.files[0]);
        }}
      >
        {error && (
          <p className="platform-alert" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <p role="status">Reading and validating package resources...</p>
        )}
        {builtin ? (
          <>
            <button onClick={() => setBuiltin("")}>
              <ArrowLeft size={16} />
              Back
            </button>
            <div className="platform-detail">
              <div className="platform-icon">
                <Package size={40} />
              </div>
              <small>BUILT-IN / DESKOS</small>
              <h2>{appById(builtin as (typeof apps)[number]["id"]).name}</h2>
              <p>
                {appById(builtin as (typeof apps)[number]["id"]).description}
              </p>
              <p>
                Version 0.7.0 / trusted built-in component. Core apps cannot be
                uninstalled or sandbox permissions revoked.
              </p>
              <button
                className="primary"
                onClick={() =>
                  useDesk
                    .getState()
                    .open(builtin as (typeof apps)[number]["id"])
                }
              >
                Open
              </button>
            </div>
          </>
        ) : detail ? (
          <>
            <button
              onClick={() => {
                setDetail(null);
                setPending(null);
              }}
            >
              <ArrowLeft size={15} />
              Catalog
            </button>
            <div className="platform-detail">
              <div className="platform-icon">{detail.manifest.icon}</div>
              <small>
                {pending ? "VALIDATED LOCAL PACKAGE" : "DESKOS APP PACKAGE"}
              </small>
              <h2>{detail.manifest.name}</h2>
              <p>{detail.manifest.description}</p>
              <div className="platform-facts">
                <span>{detail.manifest.developer}</span>
                <span>{detail.manifest.category}</span>
                <span>Version {detail.manifest.version}</span>
                <span>SDK {detail.manifest.sdk}</span>
                <span>
                  {new TextEncoder()
                    .encode(JSON.stringify(detail))
                    .length.toLocaleString()}{" "}
                  package bytes
                </span>
              </div>
              <div className="platform-actions">
                {!installed || pending ? (
                  <button
                    className="primary"
                    onClick={() => confirmInstall(detail)}
                  >
                    {installed ? "Review update" : "Install"}
                  </button>
                ) : (
                  <>
                    <button
                      className="primary"
                      disabled={!installed.enabled}
                      onClick={() =>
                        useDesk.getState().open(`pkg:${detail.manifest.id}`)
                      }
                    >
                      Open
                    </button>
                    <button
                      onClick={() =>
                        setDialog({
                          title:
                            (installed.enabled ? "Disable " : "Enable ") +
                            detail.manifest.name +
                            "?",
                          confirm:
                            "Changing this state closes running instances and clears remembered permissions. Enable only after reviewing the package developer and capabilities.",
                          run: async () => {
                            enablePackage(
                              detail.manifest.id,
                              !installed.enabled,
                            );
                            notify(
                              "Application " +
                                (installed.enabled ? "disabled" : "enabled"),
                            );
                          },
                        })
                      }
                    >
                      <Power size={15} />
                      {installed.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() =>
                        void packageApp(installed.package)
                          .then((blob) =>
                            download(blob, detail.manifest.id + ".deskapp"),
                          )
                          .catch((e) => setError(String(e)))
                      }
                    >
                      <Download size={15} />
                      Export package
                    </button>
                  </>
                )}
              </div>
              <h3>Capabilities</h3>
              <p>
                {detail.manifest.capabilities.join(" / ") ||
                  "No privileged capabilities declared."}
              </p>
              <p className="platform-note">
                Untrusted code runs in an opaque-origin iframe. Resource/network
                APIs are restricted by CSP, but this is not a browser-wide
                network firewall. App self-navigation cannot be fully prevented.
                Never grant sensitive files to untrusted code.
              </p>
              {installed && (
                <>
                  <h3>Installed application</h3>
                  <p>
                    {installed.enabled
                      ? "Enabled"
                      : "Disabled / requires explicit trust"}{" "}
                    / installed version {installed.package.manifest.version}
                  </p>
                  <p>
                    App-owned data:{" "}
                    {
                      new TextEncoder().encode(
                        JSON.stringify(state.data[detail.manifest.id] || {}),
                      ).length
                    }{" "}
                    bytes (64 KB limit). Storage is scoped by application ID.
                  </p>
                  <p>
                    Remembered grants:{" "}
                    {(state.grants[detail.manifest.id] || []).join(" / ") ||
                      "none"}
                    . File scopes live only in each sandbox window and expire on
                    close or revocation.
                  </p>
                  <button
                    onClick={() =>
                      show(() => {
                        revokePermissions(detail.manifest.id);
                        notify("Permissions revoked");
                      })
                    }
                  >
                    <ShieldCheck size={15} />
                    Revoke all permissions
                  </button>
                  {installed.previous && (
                    <button
                      onClick={() =>
                        setDialog({
                          title: "Roll back package?",
                          confirm:
                            "Restore package " +
                            installed.previous!.manifest.version +
                            ". Current app-owned data is retained unchanged; compatibility is not guaranteed. The app will be disabled pending review.",
                          run: async () => {
                            rollbackPackage(detail.manifest.id);
                            setDetail(
                              usePlatform
                                .getState()
                                .state.installed.find(
                                  (i) =>
                                    i.package.manifest.id ===
                                    detail.manifest.id,
                                )!.package,
                            );
                            notify(
                              "Previous package restored; review before enabling",
                            );
                          },
                        })
                      }
                    >
                      <RotateCcw size={15} />
                      Previous package {installed.previous.manifest.version}
                    </button>
                  )}
                  <div className="platform-uninstall">
                    <label>
                      <input
                        type="checkbox"
                        checked={deleteData}
                        onChange={(e) => setDeleteData(e.target.checked)}
                      />
                      Delete app-owned data when uninstalling
                    </label>
                    <button
                      onClick={() =>
                        setDialog({
                          title: "Uninstall " + detail.manifest.name + "?",
                          confirm:
                            "Running windows, package resources, permissions and pins will be removed. " +
                            (deleteData
                              ? "App-owned data will also be permanently deleted."
                              : "App-owned data will be retained for reinstalling.") +
                            " Shared filesystem documents remain unchanged. Unsaved in-frame state will be lost.",
                          run: async () => {
                            removePackage(detail.manifest.id, deleteData);
                            setDetail(null);
                            notify("Application uninstalled");
                          },
                        })
                      }
                    >
                      <Trash2 size={15} />
                      Uninstall
                    </button>
                  </div>
                </>
              )}
              <h3>Current selected-file scopes</h3>
              <p>
                {[...liveFileScopes.values()]
                  .filter((scope) => scope.appId === detail.manifest.id)
                  .flatMap((scope) => scope.files)
                  .join(" / ") || "No files granted in active windows."}{" "}
                Revocation clears these scopes.
              </p>
              <h3>Supported files</h3>
              <p>
                {detail.manifest.fileTypes.join(", ") ||
                  "No declared file handlers."}{" "}
                Declared handlers appear under Explorer's Open with. Opening a
                file does not automatically grant access; the user must pick it
                in the host dialog.
              </p>
            </div>
          </>
        ) : tab === "Developer" ? (
          <>
            <header>
              <small>DEVELOPMENT / SDK 1</small>
              <h2>Make a small idea useful.</h2>
              <p>
                Create classic HTML, CSS and JavaScript applications. Build
                once, package locally, install in DeskOS.
              </p>
            </header>
            <div className="platform-hero">
              <Blocks size={54} />
              <div>
                <h3>Your workbench is ready.</h3>
                <p>
                  Three working starter templates. Shared Monaco editor. The
                  same sandbox and permissions as installed apps.
                </p>
                <button
                  className="primary"
                  onClick={() => useDesk.getState().open("app-builder")}
                >
                  Open App Builder <ArrowRight size={15} />
                </button>
              </div>
            </div>
            <label className="platform-setting">
              <input
                type="checkbox"
                checked={state.externalPackages}
                onChange={(e) =>
                  show(() =>
                    commitPlatform({
                      ...state,
                      externalPackages: e.target.checked,
                    }),
                  )
                }
              />
              Allow external .deskapp inspection and installation
            </label>
            <p>
              Bundled catalog installs stay available. Disabling external
              installation does not disable existing packages.
            </p>
            <h3>Retained app data</h3>
            {Object.entries(state.data)
              .filter(
                ([id]) =>
                  !state.installed.some((i) => i.package.manifest.id === id),
              )
              .map(([id, data]) => (
                <div className="platform-event" key={id}>
                  <strong>{id}</strong>
                  <span>
                    {new TextEncoder().encode(JSON.stringify(data)).length}{" "}
                    bytes
                  </span>
                  <button
                    onClick={() =>
                      setDialog({
                        title: "Delete retained application data?",
                        confirm:
                          "Permanently remove app-owned data for " +
                          id +
                          ". Shared files remain unchanged.",
                        run: async () => {
                          const current = usePlatform.getState().state,
                            data = { ...current.data };
                          delete data[id];
                          commitPlatform({ ...current, data });
                        },
                      })
                    }
                  >
                    Delete data
                  </button>
                </div>
              ))}
            <h3>App lifecycle history</h3>
            {[...state.events].reverse().map((e) => (
              <div key={e.id} className="platform-event">
                <strong>{e.appId}</strong>
                <span>
                  {e.action} {e.version}
                </span>
                <small>{new Date(e.time).toLocaleString()}</small>
              </div>
            ))}
            <p className="platform-note">
              A package rollback retains one previous package. It never promises
              rollback of changed application data.
            </p>
          </>
        ) : (
          <>
            <header>
              <small>DESKOS / LOCAL APPLICATIONS</small>
              <h2>{tab === "Discover" ? "A little more possibility." : tab}</h2>
              <p>
                {tab === "Updates"
                  ? "Updates arrive through imported packages or future bundled catalogs. There is no remote update service."
                  : "Purposeful tools. Installed locally. Yours to make room for."}
              </p>
            </header>
            {tab === "Discover" && (
              <div className="platform-hero">
                <div>
                  <small>FEATURED / TOOLS FOR THE EVERYDAY</small>
                  <h3>Find your focus.</h3>
                  <p>
                    A timer, a fresh palette, a place to test ideas. Six working
                    optional apps, ready when you are.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setDetail(catalog[0])}
                  >
                    Explore Focus Timer <ArrowRight size={16} />
                  </button>
                </div>
                <div className="hero-art">
                  <ClockFace />
                </div>
              </div>
            )}
            <div className="platform-toolbar">
              <Search size={17} />
              <input
                aria-label="Search App Center"
                placeholder="Search apps, developers and categories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="App category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>All categories</option>
                {[...new Set(all.map((p) => p.manifest.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Sort apps"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name">Alphabetical</option>
                <option value="category">Category</option>
                <option value="recent">Catalog order: newest</option>
                <option value="installed">Installed first</option>
              </select>
            </div>
            {tab === "Categories" && (
              <div className="platform-categories">
                {[...new Set(all.map((p) => p.manifest.category))].map((c) => (
                  <button key={c} onClick={() => setCategory(c)}>
                    {c}
                    <small>
                      {all.filter((p) => p.manifest.category === c).length} apps
                    </small>
                  </button>
                ))}
              </div>
            )}
            <div className="app-catalog">
              {filtered.map((p) => {
                const i = state.installed.find(
                  (i) => i.package.manifest.id === p.manifest.id,
                );
                return (
                  <button
                    className="catalog-app"
                    key={p.manifest.id}
                    onClick={() => {
                      setDetail(tab === "Updates" ? p : i?.package || p);
                      setPending(tab === "Updates" ? p : null);
                    }}
                  >
                    <span className="platform-icon">{p.manifest.icon}</span>
                    <span>
                      <strong>{p.manifest.name}</strong>
                      <small>
                        {p.manifest.category} / {p.manifest.developer}
                      </small>
                      <p>{p.manifest.description}</p>
                      <em>
                        {i
                          ? i.enabled
                            ? "Installed"
                            : "Disabled"
                          : "Optional / install"}{" "}
                        / {i?.package.manifest.version || p.manifest.version}
                      </em>
                    </span>
                  </button>
                );
              })}
            </div>
            {!filtered.length && (
              <div className="platform-empty">
                <Package size={40} />
                <h3>
                  {tab === "Updates"
                    ? "No newer bundled versions available."
                    : "No matching apps."}
                </h3>
                <p>
                  {tab === "Updates"
                    ? "Import a newer .deskapp to review an offline update."
                    : "Try another search or install a local package."}
                </p>
              </div>
            )}
            {tab !== "Updates" && (
              <>
                <h3>Built into your desktop</h3>
                <div className="builtin-list">
                  {builtInApps
                    .filter((a) =>
                      `${a.name} ${a.description} ${a.category}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((a) => (
                      <button key={a.id} onClick={() => setBuiltin(a.id)}>
                        <a.icon size={18} />
                        <span>
                          {a.name}
                          <small>Built-in / 0.7.0</small>
                        </span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
      {dialog && (
        <OperationDialog dialog={dialog} close={() => setDialog(null)} />
      )}
    </div>
  );
}
function ClockFace() {
  return (
    <div className="clock-face">
      <span>25</span>
      <small>MINUTES FOR YOURSELF</small>
    </div>
  );
}
