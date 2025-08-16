import { Class } from '../types';

export const CLASSES_STORAGE_KEY = 'classes';

export const DEFAULT_CLASSES: Class[] = [
  { id: 'class-10a', name: 'Class 10-A', teacherId: 'teacher-1', studentIds: ['student-1', 'student-4'], liveClass: { link: 'https://zoom.us/j/1234567890', time: '2024-12-01T10:00' } },
  { id: 'class-10b', name: 'Class 10-B', teacherId: 'teacher-2', studentIds: ['student-2'] },
  { id: 'class-9a', name: 'Class 9-A', teacherId: 'teacher-1', studentIds: ['student-3'] },
  { id: 'class-9b', name: 'Class 9-B', teacherId: 'teacher-2', studentIds: [] },
];

export function loadClasses(): Class[] {
  try {
    const raw = localStorage.getItem(CLASSES_STORAGE_KEY);
    if (!raw) return DEFAULT_CLASSES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Class[];
    return DEFAULT_CLASSES;
  } catch {
    return DEFAULT_CLASSES;
  }
}

export function saveClasses(classes: Class[]) {
  try {
    localStorage.setItem(CLASSES_STORAGE_KEY, JSON.stringify(classes));
  } catch {
    // ignore
  }
}
