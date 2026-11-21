import { appById } from "../core/registry";
import type { AppId } from "../core/registry";
export function AppIcon({ id, size = 24 }: { id: AppId; size?: number }) {
  const app = appById(id);
  if (app?.manifest)
    return (
      <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden="true">
        {app.manifest.icon}
      </span>
    );
  const Icon = app.icon;
  return <Icon size={size} strokeWidth={1.7} />;
}
