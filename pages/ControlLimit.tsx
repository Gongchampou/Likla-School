import React, { useEffect, useState } from 'react';
import { AppPermissions, FeaturePermissions, Role, User } from '../types';

interface ControlLimitProps {
  currentUser: User;
  allPermissions: AppPermissions;
  onSave: (perms: AppPermissions) => void;
}

const FEATURE_ORDER = [
  'Dashboard',
  'User Management',
  'Teacher',
  'Student',
  'Staff',
  'Librarian',
  'Class',
  'Timetable',
  'Attendance',
  'Assignment',
  'Library',
  'ID Card',
  'Notice / Announcements',
  'Fees',
  'Settings',
  'Control Limit',
  'Profile',
];

const ACTIONS: Array<keyof FeaturePermissions> = ['view', 'create', 'edit', 'delete'];

const ControlLimit: React.FC<ControlLimitProps> = ({ currentUser, allPermissions, onSave }) => {
  const [perms, setPerms] = useState<AppPermissions>({});
  const [initialPerms, setInitialPerms] = useState<AppPermissions>({});
  const [dashControls, setDashControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [initialDashControls, setInitialDashControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [settingsControls, setSettingsControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [initialSettingsControls, setInitialSettingsControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [studentsControls, setStudentsControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [initialStudentsControls, setInitialStudentsControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [teachersControls, setTeachersControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [initialTeachersControls, setInitialTeachersControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [assignmentsControls, setAssignmentsControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [initialAssignmentsControls, setInitialAssignmentsControls] = useState<Record<Role, Record<string, boolean>>>({} as any);
  const [selectedRole, setSelectedRole] = useState<Role>(Role.ADMIN);
  const canEdit = currentUser.role === Role.SUPER_ADMIN || currentUser.role === Role.ADMIN;
  const [editMode, setEditMode] = useState<boolean>(false);
  // Collapsible section toggles (default collapsed)
  const [dashOpen, setDashOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [studentsOpen, setStudentsOpen] = useState<boolean>(false);
  const [teachersOpen, setTeachersOpen] = useState<boolean>(false);
  const [assignmentsOpen, setAssignmentsOpen] = useState<boolean>(false);

  // Helpers: counts for header summaries per selected role
  const countEnabled = (
    config: Record<Role, Record<string, boolean>>,
    role: Role,
    keys: string[]
  ) => {
    const map = config[role] || {};
    let enabled = 0;
    keys.forEach(k => {
      if (map[k] !== false) enabled += 1; // default is true
    });
    return { enabled, total: keys.length };
  };

  // Dashboard panel definitions per role (granular per card)
  const PANEL_MAP: Record<Role, Array<{ key: string; label: string }>> = {
    [Role.SUPER_ADMIN]: [
      { key: 'totalStudents', label: 'Total Students' },
      { key: 'totalTeachers', label: 'Total Teachers' },
      { key: 'totalStaff', label: 'Total Staff' },
      { key: 'feesCollected', label: 'Fees Collected' },
      { key: 'totalClasses', label: 'Total Classes' },
      { key: 'totalAssignments', label: 'Total Assignments' },
      { key: 'totalNotices', label: 'Total Notices' },
      { key: 'totalBooks', label: 'Total Books' },
      { key: 'recentNotices', label: 'Recent Notices' },
      { key: 'upcomingAssignments', label: 'Upcoming Assignments' },
      { key: 'feesTracking', label: 'Fees Tracking Card' },
      { key: 'assignmentsTracking', label: 'Assignments Status Card' },
      { key: 'noticesTracking', label: 'Notices Published Card' },
    ],
    [Role.ADMIN]: [
      { key: 'totalStudents', label: 'Total Students' },
      { key: 'totalTeachers', label: 'Total Teachers' },
      { key: 'totalStaff', label: 'Total Staff' },
      { key: 'feesCollected', label: 'Fees Collected' },
      { key: 'totalClasses', label: 'Total Classes' },
      { key: 'totalAssignments', label: 'Total Assignments' },
      { key: 'totalNotices', label: 'Total Notices' },
      { key: 'totalBooks', label: 'Total Books' },
      { key: 'recentNotices', label: 'Recent Notices' },
      { key: 'upcomingAssignments', label: 'Upcoming Assignments' },
      { key: 'feesTracking', label: 'Fees Tracking Card' },
      { key: 'assignmentsTracking', label: 'Assignments Status Card' },
      { key: 'noticesTracking', label: 'Notices Published Card' },
    ],
    [Role.TEACHER]: [
      // Common admin-style panels
      { key: 'totalStudents', label: 'Total Students' },
      { key: 'totalTeachers', label: 'Total Teachers' },
      { key: 'totalStaff', label: 'Total Staff' },
      { key: 'feesCollected', label: 'Fees Collected' },
      { key: 'totalClasses', label: 'Total Classes' },
      { key: 'totalAssignments', label: 'Total Assignments' },
      { key: 'totalNotices', label: 'Total Notices' },
      { key: 'totalBooks', label: 'Total Books' },
      { key: 'recentNotices', label: 'Recent Notices' },
      { key: 'upcomingAssignments', label: 'Upcoming Assignments' },
      { key: 'feesTracking', label: 'Fees Tracking Card' },
      { key: 'assignmentsTracking', label: 'Assignments Status Card' },
      { key: 'noticesTracking', label: 'Notices Published Card' },
      // Teacher-specific panels
      { key: 'teacherMyClasses', label: 'My Classes' },
      { key: 'teacherMyAssignments', label: 'My Assignments' },
      { key: 'teacherStudentsTaught', label: 'Students Taught' },
      { key: 'teacherBooks', label: 'Library Books' },
      { key: 'teacherNotices', label: 'Notices for Teachers' },
      { key: 'teacherUpcoming', label: 'Upcoming Class Assignments' },
    ],
    [Role.STUDENT]: [
      // Common admin-style panels
      { key: 'totalStudents', label: 'Total Students' },
      { key: 'totalTeachers', label: 'Total Teachers' },
      { key: 'totalStaff', label: 'Total Staff' },
      { key: 'feesCollected', label: 'Fees Collected' },
      { key: 'totalClasses', label: 'Total Classes' },
      { key: 'totalAssignments', label: 'Total Assignments' },
      { key: 'totalNotices', label: 'Total Notices' },
      { key: 'totalBooks', label: 'Total Books' },
      { key: 'recentNotices', label: 'Recent Notices' },
      { key: 'upcomingAssignments', label: 'Upcoming Assignments' },
      { key: 'feesTracking', label: 'Fees Tracking Card' },
      { key: 'assignmentsTracking', label: 'Assignments Status Card' },
      { key: 'noticesTracking', label: 'Notices Published Card' },
      // Student-specific panels
      { key: 'studentMyClass', label: 'My Class' },
      { key: 'studentUpcomingCount', label: 'Upcoming Assignments Count' },
      { key: 'studentNoticesCount', label: 'Notices Count' },
      { key: 'studentBooks', label: 'Library Books' },
      { key: 'studentNotices', label: 'Notices for Students' },
      { key: 'studentUpcoming', label: 'My Upcoming Assignments' },
    ],
    [Role.STAFF]: [
      { key: 'totalStudents', label: 'Total Students' },
      { key: 'totalTeachers', label: 'Total Teachers' },
      { key: 'totalStaff', label: 'Total Staff' },
      { key: 'feesCollected', label: 'Fees Collected' },
      { key: 'totalClasses', label: 'Total Classes' },
      { key: 'totalAssignments', label: 'Total Assignments' },
      { key: 'totalNotices', label: 'Total Notices' },
      { key: 'totalBooks', label: 'Total Books' },
      { key: 'recentNotices', label: 'Recent Notices' },
      { key: 'upcomingAssignments', label: 'Upcoming Assignments' },
      { key: 'feesTracking', label: 'Fees Tracking Card' },
      { key: 'assignmentsTracking', label: 'Assignments Status Card' },
      { key: 'noticesTracking', label: 'Notices Published Card' },
      // Staff-specific panels
      { key: 'staffNotices', label: 'Notices for Staff' },
    ],
    [Role.LIBRARIAN]: [
      { key: 'totalStudents', label: 'Total Students' },
      { key: 'totalTeachers', label: 'Total Teachers' },
      { key: 'totalStaff', label: 'Total Staff' },
      { key: 'feesCollected', label: 'Fees Collected' },
      { key: 'totalClasses', label: 'Total Classes' },
      { key: 'totalAssignments', label: 'Total Assignments' },
      { key: 'totalNotices', label: 'Total Notices' },
      { key: 'totalBooks', label: 'Total Books' },
      { key: 'recentNotices', label: 'Recent Notices' },
      { key: 'upcomingAssignments', label: 'Upcoming Assignments' },
      { key: 'feesTracking', label: 'Fees Tracking Card' },
      { key: 'assignmentsTracking', label: 'Assignments Status Card' },
      { key: 'noticesTracking', label: 'Notices Published Card' },
      // Librarian-specific panels
      { key: 'librarianBooksTotal', label: 'Total Books (Librarian Section)' },
      { key: 'librarianNotices', label: 'Notices for Librarian' },
    ],
    [Role.PARENT]: [],
  };

  const setViewOnlyForRole = (role: Role) => {
    if (!canEdit || !editMode) return;
    setPerms(prev => {
      const next = { ...prev };
      const roleMap = { ...(next[role] || {}) } as { [feature: string]: Partial<FeaturePermissions> };
      FEATURE_ORDER.forEach(feature => {
        roleMap[feature] = { view: true, create: false, edit: false, delete: false };
      });
      next[role] = roleMap;
      return next;
    });
  };

  const DEFAULT_DASH_CONTROLS: Record<Role, Record<string, boolean>> = {
    [Role.SUPER_ADMIN]: {
      totalStudents: true, totalTeachers: true, totalStaff: true, feesCollected: true,
      totalClasses: true, totalAssignments: true, totalNotices: true, totalBooks: true,
      recentNotices: true, upcomingAssignments: true, feesTracking: true, assignmentsTracking: true, noticesTracking: true
    },
    [Role.ADMIN]: {
      totalStudents: true, totalTeachers: true, totalStaff: true, feesCollected: true,
      totalClasses: true, totalAssignments: true, totalNotices: true, totalBooks: true,
      recentNotices: true, upcomingAssignments: true, feesTracking: true, assignmentsTracking: true, noticesTracking: true
    },
    [Role.TEACHER]: {
      // Common admin-style defaults
      totalStudents: true, totalTeachers: true, totalStaff: true, feesCollected: true,
      totalClasses: true, totalAssignments: true, totalNotices: true, totalBooks: true,
      recentNotices: true, upcomingAssignments: true, feesTracking: true, assignmentsTracking: true, noticesTracking: true,
      // Teacher-specific defaults
      teacherMyClasses: true, teacherMyAssignments: true, teacherStudentsTaught: true, teacherBooks: true,
      teacherNotices: true, teacherUpcoming: true
    },
    [Role.STUDENT]: {
      // Common admin-style defaults
      totalStudents: true, totalTeachers: true, totalStaff: true, feesCollected: true,
      totalClasses: true, totalAssignments: true, totalNotices: true, totalBooks: true,
      recentNotices: true, upcomingAssignments: true, feesTracking: true, assignmentsTracking: true, noticesTracking: true,
      // Student-specific defaults
      studentMyClass: true, studentUpcomingCount: true, studentNoticesCount: true, studentBooks: true,
      studentNotices: true, studentUpcoming: true
    },
    [Role.STAFF]: {
      totalStudents: true, totalTeachers: true, totalStaff: true, feesCollected: true,
      totalClasses: true, totalAssignments: true, totalNotices: true, totalBooks: true,
      recentNotices: true, upcomingAssignments: true, feesTracking: true, assignmentsTracking: true, noticesTracking: true,
      // Staff-specific defaults
      staffNotices: true
    },
    [Role.LIBRARIAN]: {
      totalStudents: true, totalTeachers: true, totalStaff: true, feesCollected: true,
      totalClasses: true, totalAssignments: true, totalNotices: true, totalBooks: true,
      recentNotices: true, upcomingAssignments: true, feesTracking: true, assignmentsTracking: true, noticesTracking: true,
      // Librarian-specific defaults
      librarianBooksTotal: true, librarianNotices: true
    },
    [Role.PARENT]: {},
  } as any;

  // Settings page sections for show/hide per role
  const SETTINGS_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'general', label: 'General (Language, Date, Pagination)' },
    { key: 'schoolInfo', label: 'School Information (Name & Logo)' },
    { key: 'storage', label: 'Storage (Supabase/Firebase)' },
    { key: 'utilities', label: 'Utilities (Export/Import/Reset)' },
    { key: 'appearance', label: 'Appearance (Theme/Color/Font/Density)' },
  ];

  const DEFAULT_SETTINGS_CONTROLS: Record<Role, Record<string, boolean>> = {
    [Role.SUPER_ADMIN]: { general: true, schoolInfo: true, storage: true, utilities: true, appearance: true },
    [Role.ADMIN]: { general: true, schoolInfo: true, storage: true, utilities: true, appearance: true },
    [Role.TEACHER]: { general: true, schoolInfo: false, storage: false, utilities: false, appearance: true },
    [Role.STUDENT]: { general: true, schoolInfo: false, storage: false, utilities: false, appearance: true },
    [Role.STAFF]: { general: true, schoolInfo: false, storage: false, utilities: false, appearance: true },
    [Role.LIBRARIAN]: { general: true, schoolInfo: false, storage: false, utilities: false, appearance: true },
    [Role.PARENT]: { general: true, schoolInfo: false, storage: false, utilities: false, appearance: true },
  } as any;

  // Students/Teachers/Assignments page section definitions
  const STUDENTS_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'students.export', label: 'Export Button' },
    { key: 'students.add', label: 'Add Student Button' },
    { key: 'students.filters', label: 'Filters' },
    { key: 'students.list', label: 'Students List/Table' },
    { key: 'students.actions', label: 'Row Action Buttons' },
    { key: 'students.modal', label: 'Create/Edit Modal' },
  ];

  const DEFAULT_STUDENTS_CONTROLS: Record<Role, Record<string, boolean>> = {
    [Role.SUPER_ADMIN]: Object.fromEntries(STUDENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.ADMIN]: Object.fromEntries(STUDENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.TEACHER]: Object.fromEntries(STUDENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.STUDENT]: Object.fromEntries(STUDENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.STAFF]: Object.fromEntries(STUDENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.LIBRARIAN]: Object.fromEntries(STUDENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.PARENT]: Object.fromEntries(STUDENTS_SECTIONS.map(s => [s.key, true])) as any,
  } as any;

  const TEACHERS_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'teachers.export', label: 'Export Button' },
    { key: 'teachers.add', label: 'Add Teacher Button' },
    { key: 'teachers.list', label: 'Teachers List/Table' },
    { key: 'teachers.actions', label: 'Row Action Buttons' },
    { key: 'teachers.modal', label: 'Create/Edit Modal' },
  ];

  const DEFAULT_TEACHERS_CONTROLS: Record<Role, Record<string, boolean>> = {
    [Role.SUPER_ADMIN]: Object.fromEntries(TEACHERS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.ADMIN]: Object.fromEntries(TEACHERS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.TEACHER]: Object.fromEntries(TEACHERS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.STUDENT]: Object.fromEntries(TEACHERS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.STAFF]: Object.fromEntries(TEACHERS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.LIBRARIAN]: Object.fromEntries(TEACHERS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.PARENT]: Object.fromEntries(TEACHERS_SECTIONS.map(s => [s.key, true])) as any,
  } as any;

  const ASSIGNMENTS_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'assignments.create', label: 'Add Assignment Button' },
    { key: 'assignments.export', label: 'Export Button' },
    { key: 'assignments.filters', label: 'Filters' },
    { key: 'assignments.list', label: 'Assignments List/Table' },
    { key: 'assignments.actions', label: 'Row Action Buttons' },
    { key: 'assignments.modal.edit', label: 'Edit Modal' },
    { key: 'assignments.modal.detail', label: 'Detail Modal' },
  ];

  const DEFAULT_ASSIGNMENTS_CONTROLS: Record<Role, Record<string, boolean>> = {
    [Role.SUPER_ADMIN]: Object.fromEntries(ASSIGNMENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.ADMIN]: Object.fromEntries(ASSIGNMENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.TEACHER]: Object.fromEntries(ASSIGNMENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.STUDENT]: Object.fromEntries(ASSIGNMENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.STAFF]: Object.fromEntries(ASSIGNMENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.LIBRARIAN]: Object.fromEntries(ASSIGNMENTS_SECTIONS.map(s => [s.key, true])) as any,
    [Role.PARENT]: Object.fromEntries(ASSIGNMENTS_SECTIONS.map(s => [s.key, true])) as any,
  } as any;

  useEffect(() => {
    // Deep clone to allow local editing without mutating parent
    const clone: AppPermissions = {};
    (Object.values(Role) as Role[]).forEach(role => {
      if (allPermissions[role]) {
        clone[role] = JSON.parse(JSON.stringify(allPermissions[role]!));
      }
    });
    setPerms(clone);
    setInitialPerms(clone);
    // Load dashboard controls
    try {
      const saved = localStorage.getItem('dashboardControls');
      if (saved) {
        const parsed = JSON.parse(saved);
        // merge with defaults to ensure new keys appear
        const merged: any = { ...DEFAULT_DASH_CONTROLS };
        (Object.values(Role) as Role[]).forEach(r => {
          merged[r] = { ...(DEFAULT_DASH_CONTROLS as any)[r], ...(parsed?.[r] || {}) };
        });
        setDashControls(merged);
        setInitialDashControls(JSON.parse(JSON.stringify(merged)));
      } else {
        setDashControls(DEFAULT_DASH_CONTROLS);
        setInitialDashControls(JSON.parse(JSON.stringify(DEFAULT_DASH_CONTROLS as any)));
      }
    } catch {
      setDashControls(DEFAULT_DASH_CONTROLS);
      setInitialDashControls(JSON.parse(JSON.stringify(DEFAULT_DASH_CONTROLS as any)));
    }

    // Load settings sections controls
    try {
      const savedSettings = localStorage.getItem('settingsControls');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        const merged: any = { ...DEFAULT_SETTINGS_CONTROLS };
        (Object.values(Role) as Role[]).forEach(r => {
          merged[r] = { ...(DEFAULT_SETTINGS_CONTROLS as any)[r], ...(parsed?.[r] || {}) };
        });
        setSettingsControls(merged);
        setInitialSettingsControls(JSON.parse(JSON.stringify(merged)));
      } else {
        setSettingsControls(DEFAULT_SETTINGS_CONTROLS);
        setInitialSettingsControls(JSON.parse(JSON.stringify(DEFAULT_SETTINGS_CONTROLS as any)));
      }
    } catch {
      setSettingsControls(DEFAULT_SETTINGS_CONTROLS);
      setInitialSettingsControls(JSON.parse(JSON.stringify(DEFAULT_SETTINGS_CONTROLS as any)));
    }

    // Load students controls
    try {
      const savedStudents = localStorage.getItem('studentsControls');
      if (savedStudents) {
        const parsed = JSON.parse(savedStudents);
        const merged: any = { ...DEFAULT_STUDENTS_CONTROLS };
        (Object.values(Role) as Role[]).forEach(r => {
          merged[r] = { ...(DEFAULT_STUDENTS_CONTROLS as any)[r], ...(parsed?.[r] || {}) };
        });
        setStudentsControls(merged);
        setInitialStudentsControls(JSON.parse(JSON.stringify(merged)));
      } else {
        setStudentsControls(DEFAULT_STUDENTS_CONTROLS);
        setInitialStudentsControls(JSON.parse(JSON.stringify(DEFAULT_STUDENTS_CONTROLS as any)));
      }
    } catch {
      setStudentsControls(DEFAULT_STUDENTS_CONTROLS);
      setInitialStudentsControls(JSON.parse(JSON.stringify(DEFAULT_STUDENTS_CONTROLS as any)));
    }

    // Load teachers controls
    try {
      const savedTeachers = localStorage.getItem('teachersControls');
      if (savedTeachers) {
        const parsed = JSON.parse(savedTeachers);
        const merged: any = { ...DEFAULT_TEACHERS_CONTROLS };
        (Object.values(Role) as Role[]).forEach(r => {
          merged[r] = { ...(DEFAULT_TEACHERS_CONTROLS as any)[r], ...(parsed?.[r] || {}) };
        });
        setTeachersControls(merged);
        setInitialTeachersControls(JSON.parse(JSON.stringify(merged)));
      } else {
        setTeachersControls(DEFAULT_TEACHERS_CONTROLS);
        setInitialTeachersControls(JSON.parse(JSON.stringify(DEFAULT_TEACHERS_CONTROLS as any)));
      }
    } catch {
      setTeachersControls(DEFAULT_TEACHERS_CONTROLS);
      setInitialTeachersControls(JSON.parse(JSON.stringify(DEFAULT_TEACHERS_CONTROLS as any)));
    }

    // Load assignments controls
    try {
      const savedAssignments = localStorage.getItem('assignmentsControls');
      if (savedAssignments) {
        const parsed = JSON.parse(savedAssignments);
        const merged: any = { ...DEFAULT_ASSIGNMENTS_CONTROLS };
        (Object.values(Role) as Role[]).forEach(r => {
          merged[r] = { ...(DEFAULT_ASSIGNMENTS_CONTROLS as any)[r], ...(parsed?.[r] || {}) };
        });
        setAssignmentsControls(merged);
        setInitialAssignmentsControls(JSON.parse(JSON.stringify(merged)));
      } else {
        setAssignmentsControls(DEFAULT_ASSIGNMENTS_CONTROLS);
        setInitialAssignmentsControls(JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS_CONTROLS as any)));
      }
    } catch {
      setAssignmentsControls(DEFAULT_ASSIGNMENTS_CONTROLS);
      setInitialAssignmentsControls(JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS_CONTROLS as any)));
    }
  }, [allPermissions]);

  const toggle = (role: Role, feature: string, action: keyof FeaturePermissions) => {
    setPerms(prev => {
      const next = { ...prev };
      const roleMap = { ...(next[role] || {}) } as { [feature: string]: Partial<FeaturePermissions> };
      const f = { ...(roleMap[feature] || {}) } as Partial<FeaturePermissions>;
      (f as any)[action] = !(f as any)[action];
      roleMap[feature] = f;
      next[role] = roleMap;
      return next;
    });
  };

  const setAllForRole = (role: Role, value: boolean) => {
    setPerms(prev => {
      const next = { ...prev };
      const roleMap = { ...(next[role] || {}) } as { [feature: string]: Partial<FeaturePermissions> };
      FEATURE_ORDER.forEach(feature => {
        roleMap[feature] = { view: value, create: value, edit: value, delete: value };
      });
      next[role] = roleMap;
      return next;
    });
  };

  const handleSave = () => onSave(perms);
  const handleSaveAll = () => {
    if (!canEdit || !editMode) return;
    onSave(perms);
    try { localStorage.setItem('dashboardControls', JSON.stringify(dashControls)); } catch {}
    try { localStorage.setItem('settingsControls', JSON.stringify(settingsControls)); } catch {}
    try { localStorage.setItem('studentsControls', JSON.stringify(studentsControls)); } catch {}
    try { localStorage.setItem('teachersControls', JSON.stringify(teachersControls)); } catch {}
    try { localStorage.setItem('assignmentsControls', JSON.stringify(assignmentsControls)); } catch {}
    setEditMode(false);
    // After successful save, update initial snapshots so future cancels revert to this saved state
    setInitialPerms(JSON.parse(JSON.stringify(perms)));
    setInitialDashControls(JSON.parse(JSON.stringify(dashControls)));
    setInitialSettingsControls(JSON.parse(JSON.stringify(settingsControls)));
    setInitialStudentsControls(JSON.parse(JSON.stringify(studentsControls)));
    setInitialTeachersControls(JSON.parse(JSON.stringify(teachersControls)));
    setInitialAssignmentsControls(JSON.parse(JSON.stringify(assignmentsControls)));
  };

  const handleRestoreDefaultsForRole = (role: Role) => {
    if (!canEdit || !editMode) return;
    // Restore feature permissions for selected role to initially loaded values
    setPerms(prev => ({ ...prev, [role]: JSON.parse(JSON.stringify(initialPerms[role] || {})) }));
    // Restore dashboard panels to DEFAULT_DASH_CONTROLS for this role
    setDashControls(prev => ({ ...prev, [role]: { ...(DEFAULT_DASH_CONTROLS as any)[role] } }));
    // Restore settings sections to DEFAULT_SETTINGS_CONTROLS for this role
    setSettingsControls(prev => ({ ...prev, [role]: { ...(DEFAULT_SETTINGS_CONTROLS as any)[role] } }));
    // Restore students/teachers/assignments sections to defaults for this role
    setStudentsControls(prev => ({ ...prev, [role]: { ...(DEFAULT_STUDENTS_CONTROLS as any)[role] } }));
    setTeachersControls(prev => ({ ...prev, [role]: { ...(DEFAULT_TEACHERS_CONTROLS as any)[role] } }));
    setAssignmentsControls(prev => ({ ...prev, [role]: { ...(DEFAULT_ASSIGNMENTS_CONTROLS as any)[role] } }));
  };

  const handleCancel = () => {
    if (!canEdit || !editMode) return;
    // Revert all changes for all roles to initial snapshots
    setPerms(JSON.parse(JSON.stringify(initialPerms)));
    setDashControls(JSON.parse(JSON.stringify(initialDashControls)));
    setSettingsControls(JSON.parse(JSON.stringify(initialSettingsControls)));
    setStudentsControls(JSON.parse(JSON.stringify(initialStudentsControls)));
    setTeachersControls(JSON.parse(JSON.stringify(initialTeachersControls)));
    setAssignmentsControls(JSON.parse(JSON.stringify(initialAssignmentsControls)));
    setEditMode(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Control Limit</h2>
        <div className="flex gap-2">
          {canEdit && !editMode && (
            <button onClick={() => setEditMode(true)} className="px-4 py-2 rounded-md text-white bg-primary hover:bg-primary-dark">Edit</button>
          )}
          {canEdit && editMode && (
            <>
              <button onClick={() => handleRestoreDefaultsForRole(selectedRole)} className="px-4 py-2 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Restore Defaults</button>
              <button onClick={handleCancel} className="px-4 py-2 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
              <button onClick={handleSaveAll} className="px-4 py-2 rounded-md text-white bg-primary hover:bg-primary-dark">Save</button>
            </>
          )}
        </div>
      </div>

      {/* Role selector */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium">Select role</label>
        <select
          className="px-3 py-2 rounded-md border border-border dark:border-dark-border bg-background dark:bg-dark-background"
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value as Role)}
          disabled={!canEdit}
        >
          {(Object.values(Role) as Role[]).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => canEdit && editMode && setAllForRole(selectedRole, true)} disabled={!canEdit || !editMode} className="text-xs px-3 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent disabled:opacity-50 disabled:cursor-not-allowed">Allow all</button>
          <button onClick={() => canEdit && editMode && setAllForRole(selectedRole, false)} disabled={!canEdit || !editMode} className="text-xs px-3 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent disabled:opacity-50 disabled:cursor-not-allowed">Deny all</button>
          <button onClick={() => setViewOnlyForRole(selectedRole)} disabled={!canEdit || !editMode} className="text-xs px-3 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent disabled:opacity-50 disabled:cursor-not-allowed">View-only</button>
        </div>
      </div>

      {/* Permissions table for selected role */}
      <div className="mb-8 bg-card dark:bg-dark-card rounded-lg border border-border dark:border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2">Feature</th>
                {ACTIONS.map(a => (
                  <th key={a} className="px-4 py-2 capitalize">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-dark-border">
              {FEATURE_ORDER.map(feature => {
                const roleMap = perms[selectedRole] || {};
                const f = (roleMap[feature] || {}) as Partial<FeaturePermissions>;
                return (
                  <tr key={feature} className="hover:bg-accent/50 dark:hover:bg-dark-accent/60">
                    <td className="px-4 py-2 whitespace-nowrap">{feature}</td>
                    {ACTIONS.map(a => (
                      <td key={a} className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean((f as any)[a])}
                          onChange={() => toggle(selectedRole, feature, a)}
                          disabled={!canEdit || !editMode}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dashboard Controls for selected role */}
        {PANEL_MAP[selectedRole] && PANEL_MAP[selectedRole].length > 0 && (
          <div className="px-4 py-4 border-t border-border dark:border-dark-border bg-muted/50 dark:bg-dark-muted/40">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span>Dashboard Panels</span>
                <span className="text-xs text-muted-foreground">
                  {(() => {
                    const keys = PANEL_MAP[selectedRole].map(p => p.key);
                    const { enabled, total } = countEnabled(dashControls, selectedRole, keys);
                    return `${enabled}/${total} enabled for ${selectedRole}`;
                  })()}
                </span>
              </h4>
              <button onClick={() => setDashOpen(v => !v)} className="text-xs px-2 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">
                {dashOpen ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {dashOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PANEL_MAP[selectedRole].map(p => {
                  const rolePanels = dashControls[selectedRole] || {};
                  const checked = rolePanels[p.key] !== false; // default true
                  return (
                    <label key={p.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (!canEdit || !editMode) return;
                          setDashControls(prev => {
                            const next = { ...prev } as any;
                            const rp = { ...(next[selectedRole] || {}) };
                            rp[p.key] = !(rp[p.key] !== false);
                            next[selectedRole] = rp;
                            return next;
                          });
                        }}
                        disabled={!canEdit || !editMode}
                      />
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Settings Sections visibility for selected role */}
        <div className="px-4 py-4 border-t border-border dark:border-dark-border bg-muted/50 dark:bg-dark-muted/40">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span>Settings Sections</span>
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const keys = SETTINGS_SECTIONS.map(s => s.key);
                  const { enabled, total } = countEnabled(settingsControls, selectedRole, keys);
                  return `${enabled}/${total} enabled for ${selectedRole}`;
                })()}
              </span>
            </h4>
            <button onClick={() => setSettingsOpen(v => !v)} className="text-xs px-2 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">
              {settingsOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {settingsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SETTINGS_SECTIONS.map(section => {
                const roleSections = settingsControls[selectedRole] || {};
                const checked = roleSections[section.key] !== false; // default true
                return (
                  <label key={section.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (!canEdit || !editMode) return;
                        setSettingsControls(prev => {
                          const next = { ...prev } as any;
                          const rs = { ...(next[selectedRole] || {}) };
                          rs[section.key] = !(rs[section.key] !== false);
                          next[selectedRole] = rs;
                          return next;
                        });
                      }}
                      disabled={!canEdit || !editMode}
                    />
                    <span>{section.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Students Sections visibility for selected role */}
        <div className="px-4 py-4 border-t border-border dark:border-dark-border bg-muted/50 dark:bg-dark-muted/40">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span>Students Page Sections</span>
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const keys = STUDENTS_SECTIONS.map(s => s.key);
                  const { enabled, total } = countEnabled(studentsControls, selectedRole, keys);
                  return `${enabled}/${total} enabled for ${selectedRole}`;
                })()}
              </span>
            </h4>
            <button onClick={() => setStudentsOpen(v => !v)} className="text-xs px-2 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">
              {studentsOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {studentsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {STUDENTS_SECTIONS.map(section => {
                const roleSections = studentsControls[selectedRole] || {};
                const checked = roleSections[section.key] !== false; // default true
                return (
                  <label key={section.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (!canEdit || !editMode) return;
                        setStudentsControls(prev => {
                          const next = { ...prev } as any;
                          const rs = { ...(next[selectedRole] || {}) };
                          rs[section.key] = !(rs[section.key] !== false);
                          next[selectedRole] = rs;
                          return next;
                        });
                      }}
                      disabled={!canEdit || !editMode}
                    />
                    <span>{section.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Teachers Sections visibility for selected role */}
        <div className="px-4 py-4 border-t border-border dark:border-dark-border bg-muted/50 dark:bg-dark-muted/40">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span>Teachers Page Sections</span>
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const keys = TEACHERS_SECTIONS.map(s => s.key);
                  const { enabled, total } = countEnabled(teachersControls, selectedRole, keys);
                  return `${enabled}/${total} enabled for ${selectedRole}`;
                })()}
              </span>
            </h4>
            <button onClick={() => setTeachersOpen(v => !v)} className="text-xs px-2 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">
              {teachersOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {teachersOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEACHERS_SECTIONS.map(section => {
                const roleSections = teachersControls[selectedRole] || {};
                const checked = roleSections[section.key] !== false; // default true
                return (
                  <label key={section.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (!canEdit || !editMode) return;
                        setTeachersControls(prev => {
                          const next = { ...prev } as any;
                          const rs = { ...(next[selectedRole] || {}) };
                          rs[section.key] = !(rs[section.key] !== false);
                          next[selectedRole] = rs;
                          return next;
                        });
                      }}
                      disabled={!canEdit || !editMode}
                    />
                    <span>{section.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignments Sections visibility for selected role */}
        <div className="px-4 py-4 border-t border-border dark:border-dark-border bg-muted/50 dark:bg-dark-muted/40">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span>Assignments Page Sections</span>
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const keys = ASSIGNMENTS_SECTIONS.map(s => s.key);
                  const { enabled, total } = countEnabled(assignmentsControls, selectedRole, keys);
                  return `${enabled}/${total} enabled for ${selectedRole}`;
                })()}
              </span>
            </h4>
            <button onClick={() => setAssignmentsOpen(v => !v)} className="text-xs px-2 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">
              {assignmentsOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {assignmentsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ASSIGNMENTS_SECTIONS.map(section => {
                const roleSections = assignmentsControls[selectedRole] || {};
                const checked = roleSections[section.key] !== false; // default true
                return (
                  <label key={section.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (!canEdit || !editMode) return;
                        setAssignmentsControls(prev => {
                          const next = { ...prev } as any;
                          const rs = { ...(next[selectedRole] || {}) };
                          rs[section.key] = !(rs[section.key] !== false);
                          next[selectedRole] = rs;
                          return next;
                        });
                      }}
                      disabled={!canEdit || !editMode}
                    />
                    <span>{section.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlLimit;
