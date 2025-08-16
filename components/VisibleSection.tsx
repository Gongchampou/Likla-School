import React from 'react';
import { Role } from '../types';
import { isSettingsSectionVisible, isDashboardPanelVisible, isRoleToggleEnabled } from '../utils/visibility';

interface VisibleSectionProps {
  role: Role | string;
  sectionKey: string;
  type?: 'settings' | 'dashboard';
  parentMap?: Record<string, string | undefined>;
  storageKey?: string; // custom localStorage key for non-built-in pages
  defaultVisible?: boolean; // reserved for future use
  children: React.ReactNode;
}

const VisibleSection: React.FC<VisibleSectionProps> = ({
  role,
  sectionKey,
  type = 'settings',
  parentMap,
  storageKey,
  children,
}) => {
  let visible: boolean;
  if (type === 'dashboard') {
    visible = isDashboardPanelVisible(role, sectionKey, parentMap);
  } else if (type === 'settings') {
    visible = isSettingsSectionVisible(role, sectionKey);
  } else if (storageKey) {
    visible = isRoleToggleEnabled(storageKey, role, sectionKey);
  } else {
    // Default to visible if no type/storageKey specified
    visible = true;
  }

  if (!visible) return null;
  return <>{children}</>;
};

export default VisibleSection;
