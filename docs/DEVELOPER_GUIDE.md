# DeskOS application development

SDK/package version 1 supports small, offline, classic HTML/CSS/JavaScript apps. Packages run inside opaque-origin iframes; built-in trusted React apps retain their existing architecture. No Node.js, npm, modules, clipboard API or remote update service is provided.

## Start in App Builder

Open App Builder from the launcher or Settings > Developer. Choose Hello DeskOS, Notes Utility or Personal Widget; enter a reverse-domain ID, name, description, category and one short icon glyph. Create the project, then edit manifest.json, index.html, styles.css and app.js with the same Monaco engine used by Code Studio.

Run sandboxed preview uses the same runtime as installed packages. Preview grants are window-only; preview data has a separate namespace. Save project creates four source files in Projects. Code Studio opens that folder; Reload saved project reads external edits. File revisions reject conflicting saves. Source saves commit files individually; if a later write fails, already saved files remain.

Export .deskapp creates a ZIP-compatible package. App Center inspects local packages before separate install confirmation. Builder can also install after confirmation. Setup fields apply to new projects; change the current manifest in the editor.

## Manifest

```json
{
  "format": "deskos-app",
  "packageVersion": 1,
  "id": "local.my-notes",
  "name": "My Notes",
  "version": "1.0.0",
  "description": "A note stored in this app's namespace.",
  "developer": "Your name",
  "category": "Productivity",
  "icon": "N",
  "entrypoint": "index.html",
  "sdk": 1,
  "capabilities": ["storage.read", "storage.write"],
  "fileTypes": [],
  "multiple": false,
  "keywords": ["notes"]
}
```

IDs use lowercase reverse-domain segments with letters, digits and hyphens. Versions are three integer components without prerelease labels. Manifest, SDK, capabilities, resources and sizes are checked before storing. Names/categories/descriptions are plain text. Icons are short glyphs, not executable SVG.

## Package structure and limits

Required: manifest.json, index.html, styles.css, app.js. Include a local stylesheet reference in HTML; only app.js is executed. Inline HTML scripts are removed. Raster assets may be PNG/JPEG/WebP under assets/ with simple alphanumeric/hyphen/underscore filenames, referenced by img src. Stylesheet-relative image URLs, fonts, modules, remote resources and extra executable files are unsupported. Inline HTML handlers still execute inside the sandbox.

Limits: 512 KiB package/expanded resources, 40 resources, 20 installed apps, 2 MiB total UTF-8 serialized platform storage and 64 KiB owned data per namespace. Base64 image overhead, prior packages and retained data count toward limits. Data uses existing versioned localStorage; a quota failure leaves prior platform state intact.

ZIP paths, resource names, schema, expanded output and CRC are validated. Inspection never runs code. Validation is not a developer endorsement or authenticity signature.

## SDK 1

The host injects global deskos before app.js. TypeScript interfaces are in src/core/platform/sdk.ts. All methods return Promises; catch denial, revocation, stale revisions, unavailable files and timeout.

| Method                                     | Capability    | Result                                                |
| ------------------------------------------ | ------------- | ----------------------------------------------------- |
| deskos.app.getInfo()                       | None          | id, name, version, sdk                                |
| deskos.theme.getCurrent()                  | None          | Effective theme and Space accent at request time      |
| deskos.window.setTitle(title)              | None          | Runtime instance title, up to 80 characters           |
| deskos.notifications.show({title,message}) | notifications | In-app notification; title 100/message 500 characters |
| deskos.storage.get(key)                    | storage.read  | JSON value or null in this app namespace              |
| deskos.storage.set(key,value)              | storage.write | Store JSON within 64 KiB total                        |
| deskos.files.pick()                        | files.pick    | Host picker returns id, name, mime                    |
| deskos.files.read(id)                      | files.read    | text, revision, name for a picked file                |
| deskos.files.write(id,text,revision)       | files.write   | New revision after a conflict-checked save            |

Storage keys use 1-80 alphanumeric/underscore/dot/hyphen characters; prototype keys are rejected. App identity is host-bound, never chosen by request parameters.

File methods support live text up to 128 KiB. Serialized requests also have a 128 KiB envelope limit, so escaped text/overhead can reduce effective write size. Open with does not grant the launch file automatically: use the host picker. Scopes expire on close/revocation/navigation. Read again before saving changed revisions. SDK saves use the filesystem service, history and live-query conflict notifications.

```js
document.querySelector("#save").onclick = async () => {
  try {
    await deskos.storage.set("note", document.querySelector("textarea").value);
    document.querySelector("#status").textContent = "Saved";
  } catch (error) {
    document.querySelector("#status").textContent = error.message;
  }
};
```

```js
const file = await deskos.files.pick();
const saved = await deskos.files.read(file.id);
await deskos.files.write(file.id, saved.text + " Another line", saved.revision);
```

Declare files.pick, files.read and files.write for the second example. The user still approves each capability and selects the file.

## Permissions and protocol

Prompts offer once, this window, or remember. Remember persists a capability, never a file scope; preview Remember is window-only. App Center shows grants/scoped IDs and revokes permissions. Revocation clears live scopes/grants and invalidates pending requests. File writes recheck authorization immediately before writing after asynchronous work.

Protocol requests contain protocol:1, token, id, method, params. Responses contain protocol:1, token, id, ok and result/error. The host checks exact iframe source, opaque origin, random token, ID, method, parameters, declarations, grants and scopes. Opaque-origin messaging requires targetOrigin "*", paired with source/session checks. SDK responses check parent source/token.

Maximum eight pending SDK promises, one active host operation, 120 requests/minute and 10,000 unique IDs per instance. SDK timeout: 90 seconds; host authorization expires after 85 seconds. Close removes listeners, denies pending prompts and invalidates work. Script errors are reported; reopen to restart.

## Lifecycle, updates and portability

Installed apps appear in launcher, search, desktop, dock, Open with and Spaces. Disable closes instances and clears grants. Enable requires review. Uninstall removes resources/permissions/windows/pins with an explicit data deletion choice. Retained data can be removed in App Center > Developer; shared files remain. Unsaved iframe state is not journaled.

Import a strictly higher semantic version to update. App data remains, grants reset and one prior package is retained. Rollback restores that package disabled with current data unchanged; developers handle data compatibility.

Capsule Applications exports package resources, prior package, owned data, events and grant metadata. Restore validates packages, disables apps and discards grants. Imported apps never auto-run. Older Capsules without this category remain supported. Metadata replacement requires reload. Time Machine application history records actual lifecycle events; package rollback is managed in App Center.

## Isolation and practical limitations

The sandbox allows scripts only: no same-origin, popups, downloads, forms, top-navigation or clipboard privileges. CSP restricts network/resource APIs and blocks child frames, objects and workers. The host exposes permission-checked RPC, not direct Zustand/IndexedDB/filesystem APIs.

This is iframe isolation, not a separate OS process or a complete network firewall. Browsers can allow iframe self-navigation despite restricted resource APIs. A later iframe load invalidates host access, but navigation may already have contacted a destination. Only grant sensitive files to code you trust. CPU/memory abuse and message flooding cannot be fully contained by a frontend. No broad network capability exists.

Themes are fetched on demand. Unsaved iframe state does not restore after reload. Multiple tabs are not synchronized for simultaneous package management. Built-ins cannot be uninstalled. Package handlers are Open with alternatives; built-in defaults remain.
