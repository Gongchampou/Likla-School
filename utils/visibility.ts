import { Role } from '../types';

// Safe JSON parse from localStorage
function getLocalJson<T = any>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function roleKey(role: Role | string): string {
  return typeof role === 'string' ? role : (role as string);
}

// Generic: checks a boolean map for a role, defaults to true when not configured
export function isRoleToggleEnabled(
  storageKey: string,
  role: Role | string,
  key: string,
  parentMap?: Record<string, string | undefined>,
  defaultVisible = true,
): boolean {
  const controls = getLocalJson<Record<string, Record<string, boolean>>>(storageKey, {});
  const r = roleKey(role);
  const roleCfg = controls?.[r] || {};
  if (key in roleCfg) return !!roleCfg[key];
  if (parentMap) {
    const parent = parentMap[key];
    if (parent && (parent in roleCfg)) return !!roleCfg[parent];
  }
  return defaultVisible;
}

// Settings sections
export function isSettingsSectionVisible(role: Role | string, sectionKey: string): boolean {
  // default visible when not configured
  return isRoleToggleEnabled('settingsControls', role, sectionKey, undefined, true);
}

// Dashboard panels
export function isDashboardPanelVisible(
  role: Role | string,
  panelKey: string,
  parentMap?: Record<string, string | undefined>,
): boolean {
  return isRoleToggleEnabled('dashboardControls', role, panelKey, parentMap, true);
}

export { getLocalJson };
