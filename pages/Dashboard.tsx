import React, { useEffect, useMemo, useState } from 'react';
import { UsersIcon, TeacherIcon, StudentIcon, FeesIcon, NoticeIcon, ClassIcon, AssignmentIcon, LibraryIcon } from '../components/icons';
import { Role, AnyUser, Student as StudentType, Class as ClassType, Assignment as AssignmentType, Notice as NoticeType, Book as BookType } from '../types';
import { isDashboardPanelVisible } from '../utils/visibility';
import { loadUsers } from '../utils/users';
import { loadClasses } from '../utils/classes';
import { loadAssignments } from '../utils/assignments';
import { loadNotices } from '../utils/notices';
import { loadBooks } from '../utils/books';

const StatCard = ({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) => (
    <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md flex items-center space-x-4 border border-border dark:border-dark-border">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    </div>
);

// Helpers
const formatNumber = (n: number) => n.toLocaleString();
const formatCurrencyCompact = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
}).format(n);

const Dashboard: React.FC<{ currentUser: AnyUser }> = ({ currentUser }) => {
    // Load users asynchronously from Supabase
    const [users, setUsers] = useState<AnyUser[]>([]);
    const [classes, setClasses] = useState<ClassType[]>(() => loadClasses());
    const [assignments, setAssignments] = useState<AssignmentType[]>(() => loadAssignments());
    const [notices, setNotices] = useState<NoticeType[]>(() => loadNotices());
    const [books, setBooks] = useState<BookType[]>(() => loadBooks());
    const [dateFilter, setDateFilter] = useState<string>('All'); // All | Yesterday | This Week | This Month
    const [dashControls, setDashControls] = useState<Record<string, any>>({});
    // load dashboardControls
    useEffect(() => {
        try {
            const saved = localStorage.getItem('dashboardControls');
            setDashControls(saved ? JSON.parse(saved) : {});
        } catch {
            setDashControls({});
        }
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'dashboardControls') {
                try { setDashControls(e.newValue ? JSON.parse(e.newValue) : {}); } catch {}
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            // users are now Supabase-backed and loaded async; no localStorage sync
            if (e.key === 'classes') setClasses(loadClasses());
            if (e.key === 'assignments') setAssignments(loadAssignments());
            if (e.key === 'notices') setNotices(loadNotices());
            if (e.key === 'books') setBooks(loadBooks());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Initial fetch of users from Supabase
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await loadUsers();
                if (alive) setUsers(data);
            } catch (err) {
                console.error('Failed to load users for Dashboard', err);
            }
        })();
        return () => { alive = false; };
    }, []);

    const { totalStudents, totalTeachers, totalStaff, feesCollected, feesTotal, feesDue, totalClasses, totalAssignments, totalNotices, totalBooks } = useMemo(() => {
        const students = users.filter(u => u.role === Role.STUDENT) as StudentType[];
        const teachers = users.filter(u => u.role === Role.TEACHER);
        const staff = users.filter(u => u.role === Role.STAFF);
        const feesPaid = students.reduce((sum, s) => sum + (s.fees || []).filter(f => f.status === 'Paid').reduce((a, f) => a + (f.amount || 0), 0), 0);
        const feesAll = students.reduce((sum, s) => sum + (s.fees || []).reduce((a, f) => a + (f.amount || 0), 0), 0);
        const feesUnpaid = Math.max(0, feesAll - feesPaid);
        return {
            totalStudents: students.length,
            totalTeachers: teachers.length,
            totalStaff: staff.length,
            feesCollected: feesPaid,
            feesTotal: feesAll,
            feesDue: feesUnpaid,
            totalClasses: classes.length,
            totalAssignments: assignments.length,
            totalNotices: notices.length,
            totalBooks: books.length,
        };
    }, [users, classes, assignments, notices, books]);

    // Derived lists for panels
    // Date helpers
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const startOfWeek = (d: Date) => {
        const day = d.getDay();
        const diffToMonday = (day + 6) % 7; // Mon=0
        const start = new Date(d);
        start.setDate(d.getDate() - diffToMonday);
        return startOfDay(start);
    };
    const endOfWeek = (d: Date) => {
        const start = startOfWeek(d);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return endOfDay(end);
    };
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = (d: Date) => endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));

    const inSelectedRange = (iso: string) => {
        if (dateFilter === 'All') return true;
        const now = new Date();
        const dt = new Date(iso);
        if (dateFilter === 'Yesterday') {
            const y = new Date(now);
            y.setDate(now.getDate() - 1);
            return dt >= startOfDay(y) && dt <= endOfDay(y);
        }
        if (dateFilter === 'This Week') {
            return dt >= startOfWeek(now) && dt <= endOfWeek(now);
        }
        if (dateFilter === 'This Month') {
            return dt >= startOfMonth(now) && dt <= endOfMonth(now);
        }
        return true;
    };

    // Previous period helpers for trends
    const getCurrentRange = (): [Date | null, Date | null] => {
        const now = new Date();
        if (dateFilter === 'All') return [null, null];
        if (dateFilter === 'Yesterday') {
            const y = new Date(now); y.setDate(now.getDate() - 1); return [startOfDay(y), endOfDay(y)];
        }
        if (dateFilter === 'This Week') return [startOfWeek(now), endOfWeek(now)];
        if (dateFilter === 'This Month') return [startOfMonth(now), endOfMonth(now)];
        return [null, null];
    };
    const getPrevRange = (): [Date | null, Date | null] => {
        const now = new Date();
        if (dateFilter === 'All') return [null, null];
        if (dateFilter === 'Yesterday') {
            const y = new Date(now); y.setDate(now.getDate() - 2); return [startOfDay(y), endOfDay(y)];
        }
        if (dateFilter === 'This Week') {
            const start = startOfWeek(now); const prevStart = new Date(start); prevStart.setDate(start.getDate() - 7);
            const prevEnd = new Date(prevStart); prevEnd.setDate(prevStart.getDate() + 6);
            return [startOfDay(prevStart), endOfDay(prevEnd)];
        }
        if (dateFilter === 'This Month') {
            const start = startOfMonth(now); const prevEnd = new Date(start); prevEnd.setDate(start.getDate() - 1);
            const prevStart = startOfMonth(prevEnd);
            return [startOfDay(prevStart), endOfDay(prevEnd)];
        }
        return [null, null];
    };

    const [rangeStart, rangeEnd] = getCurrentRange();
    const [prevStart, prevEnd] = getPrevRange();

    const inRange = (iso: string, s: Date | null, e: Date | null) => {
        if (!s || !e) return true;
        const dt = new Date(iso);
        return dt >= s && dt <= e;
    };

    const recentNotices = useMemo(() => {
        return [...notices]
            .filter(n => inSelectedRange(n.date))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 3);
    }, [notices, dateFilter]);

    const upcomingAssignments = useMemo(() => {
        const now = Date.now();
        return assignments
            .filter(a => new Date(a.deadline).getTime() >= now)
            .filter(a => inSelectedRange(a.deadline))
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .slice(0, 3);
    }, [assignments, dateFilter]);

    // Tracking metrics
    const noticesInRange = useMemo(() => notices.filter(n => inRange(n.date, rangeStart, rangeEnd)).length, [notices, rangeStart, rangeEnd]);
    const noticesPrevRange = useMemo(() => prevStart && prevEnd ? notices.filter(n => inRange(n.date, prevStart, prevEnd)).length : 0, [notices, prevStart, prevEnd]);
    const noticesDeltaPct = useMemo(() => {
        if (!prevStart || !prevEnd) return null;
        const prev = noticesPrevRange || 0;
        if (prev === 0) return noticesInRange > 0 ? 100 : 0;
        return Math.round(((noticesInRange - prev) / prev) * 100);
    }, [noticesInRange, noticesPrevRange, prevStart, prevEnd]);

    const nowTs = Date.now();
    const asgInRange = useMemo(() => assignments.filter(a => inRange(a.deadline, rangeStart, rangeEnd)), [assignments, rangeStart, rangeEnd]);
    const asgUpcomingCount = useMemo(() => asgInRange.filter(a => new Date(a.deadline).getTime() >= nowTs).length, [asgInRange, nowTs]);
    const asgOverdueCount = useMemo(() => asgInRange.filter(a => new Date(a.deadline).getTime() < nowTs).length, [asgInRange, nowTs]);
    const submissionProgress = useMemo(() => {
        // Expected submissions = sum of students in the class for each assignment
        let expected = 0; let submitted = 0;
        asgInRange.forEach(a => {
            const cls = classes.find(c => c.id === a.classId);
            const total = cls ? cls.studentIds.length : 0;
            expected += total;
            submitted += Object.keys(a.submissions || {}).length;
        });
        const pct = expected > 0 ? Math.round((submitted / expected) * 100) : 0;
        return { expected, submitted, pct };
    }, [asgInRange, classes]);

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

    const role = currentUser.role;
    const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
    const isTeacher = role === Role.TEACHER;
    const isStudent = role === Role.STUDENT;
    const isStaff = role === Role.STAFF;
    const isLibrarian = role === Role.LIBRARIAN;

    // helper to check if a panel is enabled for role; default true if undefined
    // backward compatible with older grouped keys
    const parentKeyMap: Record<string, string | undefined> = {
        // Admin/SuperAdmin totals groups
        totalStudents: 'totals1',
        totalTeachers: 'totals1',
        totalStaff: 'totals1',
        feesCollected: 'totals1',
        totalClasses: 'totals2',
        totalAssignments: 'totals2',
        totalNotices: 'totals2',
        totalBooks: 'totals2',
        // Teacher stat group
        teacherMyClasses: 'teacherStats',
        teacherMyAssignments: 'teacherStats',
        teacherStudentsTaught: 'teacherStats',
        teacherBooks: 'teacherStats',
        // Student stat group
        studentMyClass: 'studentStats',
        studentUpcomingCount: 'studentStats',
        studentNoticesCount: 'studentStats',
        studentBooks: 'studentStats',
    };
    const isPanelEnabled = (panelKey: string) => isDashboardPanelVisible(role, panelKey, parentKeyMap);

    // Teacher-specific data
    const myClasses = useMemo(() => classes.filter(c => c.teacherId === currentUser.id), [classes, currentUser.id]);
    const myAssignments = useMemo(() => assignments.filter(a => a.teacherId === currentUser.id), [assignments, currentUser.id]);
    const teacherUpcoming = useMemo(() => {
        const classIds = new Set(myClasses.map(c => c.id));
        return assignments
            .filter(a => classIds.has(a.classId))
            .filter(a => new Date(a.deadline).getTime() >= Date.now())
            .filter(a => inSelectedRange(a.deadline))
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .slice(0, 5);
    }, [assignments, myClasses, dateFilter]);
    const teacherNotices = useMemo(() => notices.filter(n => n.targetRoles.includes(Role.TEACHER)).filter(n => inSelectedRange(n.date)).slice(0, 5), [notices, dateFilter]);

    // Staff-specific data
    const staffNotices = useMemo(() => notices.filter(n => n.targetRoles.includes(Role.STAFF)).filter(n => inSelectedRange(n.date)).slice(0, 5), [notices, dateFilter]);

    // Librarian-specific data
    const librarianNotices = useMemo(() => notices.filter(n => n.targetRoles.includes(Role.LIBRARIAN)).filter(n => inSelectedRange(n.date)).slice(0, 5), [notices, dateFilter]);

    // Student-specific data
    const myClass = useMemo(() => isStudent ? classes.find(c => (currentUser as any).classId && c.id === (currentUser as any).classId) : null, [classes, isStudent, currentUser]);
    const studentUpcoming = useMemo(() => {
        const classId = (currentUser as any).classId;
        return assignments
            .filter(a => a.classId === classId)
            .filter(a => new Date(a.deadline).getTime() >= Date.now())
            .filter(a => inSelectedRange(a.deadline))
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .slice(0, 5);
    }, [assignments, currentUser, dateFilter]);
    const studentNotices = useMemo(() => notices.filter(n => n.targetRoles.includes(Role.STUDENT)).filter(n => inSelectedRange(n.date)).slice(0, 5), [notices, dateFilter]);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <h2 className="text-2xl font-bold">Welcome Back, {currentUser.name.split(' ')[0]}!</h2>
                <div className="no-print">
                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                        <option value="All">All Dates</option>
                        <option value="Yesterday">Yesterday</option>
                        <option value="This Week">This Week</option>
                        <option value="This Month">This Month</option>
                    </select>
                </div>
            </div>

            {/* Common dashboard panels for all roles */}
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {isPanelEnabled('totalStudents') && (
                            <StatCard title="Total Students" value={formatNumber(totalStudents)} icon={<StudentIcon className="w-6 h-6 text-white"/>} color="bg-blue-500" />
                        )}
                        {isPanelEnabled('totalTeachers') && (
                            <StatCard title="Total Teachers" value={formatNumber(totalTeachers)} icon={<TeacherIcon className="w-6 h-6 text-white"/>} color="bg-green-500" />
                        )}
                        {isPanelEnabled('totalStaff') && (
                            <StatCard title="Total Staff" value={formatNumber(totalStaff)} icon={<UsersIcon className="w-6 h-6 text-white"/>} color="bg-yellow-500" />
                        )}
                        {isPanelEnabled('feesCollected') && (
                            <StatCard title="Fees Collected" value={formatCurrencyCompact(feesCollected)} icon={<FeesIcon className="w-6 h-6 text-white"/>} color="bg-purple-500" />
                        )}
                    </div>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {isPanelEnabled('totalClasses') && (
                            <StatCard title="Total Classes" value={formatNumber(totalClasses)} icon={<ClassIcon className="w-6 h-6 text-white"/>} color="bg-indigo-500" />
                        )}
                        {isPanelEnabled('totalAssignments') && (
                            <StatCard title="Total Assignments" value={formatNumber(totalAssignments)} icon={<AssignmentIcon className="w-6 h-6 text-white"/>} color="bg-pink-500" />
                        )}
                        {isPanelEnabled('totalNotices') && (
                            <StatCard title="Total Notices" value={formatNumber(totalNotices)} icon={<NoticeIcon className="w-6 h-6 text-white"/>} color="bg-teal-500" />
                        )}
                        {isPanelEnabled('totalBooks') && (
                            <StatCard title="Total Books" value={formatNumber(totalBooks)} icon={<LibraryIcon className="w-6 h-6 text-white"/>} color="bg-red-500" />
                        )}
                    </div>

                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {isPanelEnabled('recentNotices') && (
                            <div className="lg:col-span-2 bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">Recent Notices</h3>
                                <ul className="space-y-4">
                                    {recentNotices.map(n => (
                                        <li key={n.id} className="flex items-start space-x-3">
                                            <div className="bg-primary/20 text-primary p-2 rounded-md h-fit"><NoticeIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="font-medium">{n.title}</p>
                                                <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{n.content}</p>
                                                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">{formatDate(n.date)}</p>
                                            </div>
                                        </li>
                                    ))}
                                    {recentNotices.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No notices found.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                        {isPanelEnabled('upcomingAssignments') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">Upcoming Assignments</h3>
                                <ul className="space-y-3">
                                    {upcomingAssignments.map(a => (
                                        <li key={a.id}>
                                            <p className="font-medium">{a.title}</p>
                                            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Due: {formatDate(a.deadline)}</p>
                                        </li>
                                    ))}
                                    {upcomingAssignments.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No upcoming assignments.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Tracking Section */}
                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Fees Tracking */}
                        {isPanelEnabled('feesTracking') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold">Fees Tracking</h3>
                                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">Finance</span>
                                </div>
                                <div className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Collected</div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-2xl font-bold">{formatCurrencyCompact(feesCollected)}</div>
                                    <div className="text-sm text-muted-foreground">/ {formatCurrencyCompact(feesTotal)}</div>
                                </div>
                                <div className="mt-3 h-2 w-full bg-muted dark:bg-dark-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500" style={{ width: `${feesTotal > 0 ? Math.min(100, Math.round((feesCollected / feesTotal) * 100)) : 0}%` }} />
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">Due: <span className="font-medium text-red-600">{formatCurrencyCompact(feesDue)}</span></div>
                            </div>
                        )}

                        {/* Assignments Tracking */}
                        {isPanelEnabled('assignmentsTracking') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold">Assignments Status</h3>
                                    <span className="text-xs px-2 py-1 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200">Academic</span>
                                </div>
                                <div className="flex gap-3 mb-3">
                                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">Upcoming: {asgUpcomingCount}</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">Overdue: {asgOverdueCount}</span>
                                </div>
                                <div className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Submissions</div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-2xl font-bold">{submissionProgress.pct}%</div>
                                    <div className="text-sm text-muted-foreground">{submissionProgress.submitted}/{submissionProgress.expected}</div>
                                </div>
                                <div className="mt-3 h-2 w-full bg-muted dark:bg-dark-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-pink-500" style={{ width: `${Math.min(100, submissionProgress.pct)}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Notices Tracking */}
                        {isPanelEnabled('noticesTracking') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold">Notices Published</h3>
                                    <span className="text-xs px-2 py-1 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200">Comms</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-2xl font-bold">{formatNumber(noticesInRange)}</div>
                                    {noticesDeltaPct !== null && (
                                        <span className={`text-xs px-2 py-1 rounded-full ${noticesDeltaPct >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'}`}>
                                            {noticesDeltaPct >= 0 ? '+' : ''}{noticesDeltaPct}% vs prev
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground dark:text-dark-muted-foreground mt-1">Selected period</div>
                            </div>
                        )}
                    </div>
                </>

            {/* Staff view */}
            {isStaff && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {isPanelEnabled('staffNotices') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">Notices for Staff</h3>
                                <ul className="space-y-4">
                                    {staffNotices.map(n => (
                                        <li key={n.id} className="flex items-start space-x-3">
                                            <div className="bg-primary/20 text-primary p-2 rounded-md h-fit"><NoticeIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="font-medium">{n.title}</p>
                                                <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{n.content}</p>
                                                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">{formatDate(n.date)}</p>
                                            </div>
                                        </li>
                                    ))}
                                    {staffNotices.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No notices found.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Librarian view */}
            {isLibrarian && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {isPanelEnabled('librarianBooksTotal') && (
                            <StatCard title="Total Books" value={formatNumber(books.length)} icon={<LibraryIcon className="w-6 h-6 text-white"/>} color="bg-red-500" />
                        )}
                    </div>
                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {isPanelEnabled('librarianNotices') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">Notices for Librarian</h3>
                                <ul className="space-y-4">
                                    {librarianNotices.map(n => (
                                        <li key={n.id} className="flex items-start space-x-3">
                                            <div className="bg-primary/20 text-primary p-2 rounded-md h-fit"><NoticeIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="font-medium">{n.title}</p>
                                                <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{n.content}</p>
                                                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">{formatDate(n.date)}</p>
                                            </div>
                                        </li>
                                    ))}
                                    {librarianNotices.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No notices found.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Teacher view */}
            {isTeacher && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {isPanelEnabled('teacherMyClasses') && (
                            <StatCard title="My Classes" value={formatNumber(myClasses.length)} icon={<ClassIcon className="w-6 h-6 text-white"/>} color="bg-indigo-500" />
                        )}
                        {isPanelEnabled('teacherMyAssignments') && (
                            <StatCard title="My Assignments" value={formatNumber(myAssignments.length)} icon={<AssignmentIcon className="w-6 h-6 text-white"/>} color="bg-pink-500" />
                        )}
                        {isPanelEnabled('teacherStudentsTaught') && (
                            <StatCard title="Students Taught" value={formatNumber(myClasses.reduce((s,c)=>s+c.studentIds.length,0))} icon={<StudentIcon className="w-6 h-6 text-white"/>} color="bg-blue-500" />
                        )}
                        {isPanelEnabled('teacherBooks') && (
                            <StatCard title="Library Books" value={formatNumber(books.length)} icon={<LibraryIcon className="w-6 h-6 text-white"/>} color="bg-red-500" />
                        )}
                    </div>
                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {isPanelEnabled('teacherNotices') && (
                            <div className="lg:col-span-2 bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">Notices for Teachers</h3>
                                <ul className="space-y-4">
                                    {teacherNotices.map(n => (
                                        <li key={n.id} className="flex items-start space-x-3">
                                            <div className="bg-primary/20 text-primary p-2 rounded-md h-fit"><NoticeIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="font-medium">{n.title}</p>
                                                <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{n.content}</p>
                                                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">{formatDate(n.date)}</p>
                                            </div>
                                        </li>
                                    ))}
                                    {teacherNotices.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No notices found.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                        {isPanelEnabled('teacherUpcoming') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">Upcoming Class Assignments</h3>
                                <ul className="space-y-3">
                                    {teacherUpcoming.map(a => (
                                        <li key={a.id}>
                                            <p className="font-medium">{a.title}</p>
                                            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Due: {formatDate(a.deadline)}</p>
                                        </li>
                                    ))}
                                    {teacherUpcoming.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No upcoming assignments.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Student view */}
            {isStudent && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {isPanelEnabled('studentMyClass') && (
                            <StatCard title="My Class" value={myClass ? myClass.name : '—'} icon={<ClassIcon className="w-6 h-6 text-white"/>} color="bg-indigo-500" />
                        )}
                        {isPanelEnabled('studentUpcomingCount') && (
                            <StatCard title="Upcoming Assignments" value={formatNumber(studentUpcoming.length)} icon={<AssignmentIcon className="w-6 h-6 text-white"/>} color="bg-pink-500" />
                        )}
                        {isPanelEnabled('studentNoticesCount') && (
                            <StatCard title="Notices" value={formatNumber(studentNotices.length)} icon={<NoticeIcon className="w-6 h-6 text-white"/>} color="bg-teal-500" />
                        )}
                        {isPanelEnabled('studentBooks') && (
                            <StatCard title="Library Books" value={formatNumber(books.length)} icon={<LibraryIcon className="w-6 h-6 text-white"/>} color="bg-red-500" />
                        )}
                    </div>
                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {isPanelEnabled('studentNotices') && (
                            <div className="lg:col-span-2 bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">Notices for Students</h3>
                                <ul className="space-y-4">
                                    {studentNotices.map(n => (
                                        <li key={n.id} className="flex items-start space-x-3">
                                            <div className="bg-primary/20 text-primary p-2 rounded-md h-fit"><NoticeIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="font-medium">{n.title}</p>
                                                <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{n.content}</p>
                                                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">{formatDate(n.date)}</p>
                                            </div>
                                        </li>
                                    ))}
                                    {studentNotices.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No notices found.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                        {isPanelEnabled('studentUpcoming') && (
                            <div className="bg-card dark:bg-dark-card p-6 rounded-lg shadow-md border border-border dark:border-dark-border">
                                <h3 className="text-lg font-semibold mb-4">My Upcoming Assignments</h3>
                                <ul className="space-y-3">
                                    {studentUpcoming.map(a => (
                                        <li key={a.id}>
                                            <p className="font-medium">{a.title}</p>
                                            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Due: {formatDate(a.deadline)}</p>
                                        </li>
                                    ))}
                                    {studentUpcoming.length === 0 && (
                                        <li className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No upcoming assignments.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}

        </div>
    );
};

export default Dashboard;