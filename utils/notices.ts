import { Notice, Role } from '../types';

export const NOTICES_STORAGE_KEY = 'notices';

export const DEFAULT_NOTICES: Notice[] = [
  {
    id: 'notice-1',
    title: 'Annual Sports Day Announcement',
    content: 'The annual sports day will be held on December 15th. All students are requested to participate.',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    targetRoles: [Role.STUDENT, Role.TEACHER, Role.STAFF, Role.PARENT],
  },
  {
    id: 'notice-2',
    title: 'Parent-Teacher Meeting Schedule',
    content: 'The PTM for the final term is scheduled for November 30th. Please book your slots.',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    targetRoles: [Role.STUDENT, Role.TEACHER, Role.PARENT],
  },
  {
    id: 'notice-3',
    title: 'Library Closure for Maintenance',
    content: 'The school library will be closed for maintenance from Nov 20th to Nov 22nd.',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    targetRoles: [Role.STUDENT, Role.TEACHER, Role.STAFF, Role.LIBRARIAN],
  },
];

export function loadNotices(): Notice[] {
  try {
    const raw = localStorage.getItem(NOTICES_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTICES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Notice[];
    return DEFAULT_NOTICES;
  } catch {
    return DEFAULT_NOTICES;
  }
}

export function saveNotices(notices: Notice[]) {
  try {
    localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(notices));
  } catch {
    // ignore
  }
}
