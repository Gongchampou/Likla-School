import { Assignment } from '../types';

export const ASSIGNMENTS_STORAGE_KEY = 'assignments';

export const DEFAULT_ASSIGNMENTS: Assignment[] = [
  { id: 'asg-1', title: 'Algebra Homework Chapter 5', classId: 'class-10a', teacherId: 'teacher-1', deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), description: 'Complete all odd-numbered questions from Chapter 5. Show all your work. Submission should be a single PDF file.', submissions: { 'student-1': true } },
  { id: 'asg-2', title: 'Essay on World War II', classId: 'class-10b', teacherId: 'teacher-2', deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), description: 'Write a 1000-word essay on the primary causes of World War II. Cite at least 3 academic sources.', submissions: {} },
  { id: 'asg-3', title: 'Physics Lab Report', classId: 'class-10a', teacherId: 'teacher-1', deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), description: 'Submit the lab report for the "Laws of Motion" experiment conducted last week.', submissions: { 'student-1': true, 'student-4': true } },
];

export function loadAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    if (!raw) return DEFAULT_ASSIGNMENTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Assignment[];
    return DEFAULT_ASSIGNMENTS;
  } catch {
    return DEFAULT_ASSIGNMENTS;
  }
}

export function saveAssignments(assignments: Assignment[]) {
  try {
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // ignore
  }
}
