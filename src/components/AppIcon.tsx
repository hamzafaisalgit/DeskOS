import { appById } from "../core/registry";
import type { AppId } from "../core/registry";
export function AppIcon({ id, size = 24 }: { id: AppId; size?: number }) {
  const Icon = appById(id).icon;
  return <Icon size={size} strokeWidth={1.7} />;
}
