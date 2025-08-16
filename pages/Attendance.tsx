import React, { useState, useMemo, useEffect } from 'react';
import { Role, Student, Class, AttendanceStatus, FeaturePermissions, User, Teacher } from '../types';
import { SaveIcon, CheckIcon, XIcon, ClockIcon, FileTextIcon, FileDownIcon } from '../components/icons';
import { downloadTableAsPdf } from '../utils/pdf';

// --- MOCK DATA ---
const mockClasses: Class[] = [
    { id: 'class-10a', name: 'Class 10-A', teacherId: 'teacher-1', studentIds: ['student-1', 'student-4'] },
    { id: 'class-10b', name: 'Class 10-B', teacherId: 'teacher-2', studentIds: ['student-2'] },
    { id: 'class-9a', name: 'Class 9-A', teacherId: 'teacher-3', studentIds: ['student-3'] },
];

const allMockStudents: Student[] = [
    { id: 'student-1', name: 'Alice Johnson', email: 'alice.j@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: { '2023-10-25': AttendanceStatus.PRESENT, '2023-10-26': AttendanceStatus.PRESENT }, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=alice.j@likla.edu' },
    { id: 'student-2', name: 'Bob Williams', email: 'bob.w@likla.edu', role: Role.STUDENT, classId: 'class-10b', attendance: { '2023-10-26': AttendanceStatus.LATE }, fees: [], discount: 10, profilePicture: 'https://i.pravatar.cc/150?u=bob.w@likla.edu' },
    { id: 'student-3', name: 'Charlie Brown', email: 'charlie.b@likla.edu', role: Role.STUDENT, classId: 'class-9a', attendance: { '2023-10-26': AttendanceStatus.ABSENT }, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=charlie.b@likla.edu' },
    { id: 'student-4', name: 'Diana Miller', email: 'diana.m@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: { '2023-10-26': AttendanceStatus.EXCUSED }, fees: [], discount: 5, profilePicture: 'https://i.pravatar.cc/150?u=diana.m@likla.edu' },
];
// --- END MOCK DATA ---

interface AttendanceProps {
    permissions?: Partial<FeaturePermissions>;
    currentUserRole?: Role;
    currentUser?: Student | Teacher | User;
}

const Attendance: React.FC<AttendanceProps> = ({ permissions = {}, currentUserRole, currentUser }) => {
    const [selectedClassId, setSelectedClassId] = useState<string>(mockClasses[0]?.id || '');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
    const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<{ [studentId: string]: AttendanceStatus }>({});
    // Local attendance history store for period calculations: date -> { studentId -> status }
    const [attendanceHistory, setAttendanceHistory] = useState<{ [date: string]: { [studentId: string]: AttendanceStatus } }>(() => {
        // Seed from mock students
        const seed: { [date: string]: { [studentId: string]: AttendanceStatus } } = {};
        allMockStudents.forEach(s => {
            Object.entries(s.attendance || {}).forEach(([date, status]) => {
                seed[date] = seed[date] || {};
                seed[date][s.id] = status;
            });
        });
        return seed;
    });
    // Lock map: date -> { studentId -> boolean }
    const [lockMap, setLockMap] = useState<{ [date: string]: { [studentId: string]: boolean } }>({});
    const [isDirty, setIsDirty] = useState(false);

    // If logged-in user is a student, force-select their class
    useEffect(() => {
        if (currentUserRole === Role.STUDENT && currentUser) {
            const cu = currentUser as Student;
            if (cu.classId && selectedClassId !== cu.classId) setSelectedClassId(cu.classId);
        }
    }, [currentUserRole, currentUser]);

    useEffect(() => {
        const classStudents = currentUserRole === Role.STUDENT && currentUser
            ? allMockStudents.filter(s => s.id === currentUser.id)
            : allMockStudents.filter(s => s.classId === selectedClassId);
        setStudentsInClass(classStudents);

        const records: { [studentId: string]: AttendanceStatus } = {};
        classStudents.forEach(student => {
            const fromHistory = attendanceHistory[selectedDate]?.[student.id];
            records[student.id] = fromHistory || student.attendance[selectedDate] || AttendanceStatus.ABSENT;
        });
        setAttendanceRecords(records);
        setIsDirty(false);
    }, [selectedClassId, selectedDate, attendanceHistory, currentUserRole, currentUser]);

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        if (!permissions.edit) return;
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
        // If marked present, lock this student's controls for the selected date
        if (status === AttendanceStatus.PRESENT) {
            setLockMap(prev => ({
                ...prev,
                [selectedDate]: { ...(prev[selectedDate] || {}), [studentId]: true }
            }));
        }
        // Optimistically persist to local history so other views (e.g., student) reflect immediately
        setAttendanceHistory(prev => ({
            ...prev,
            [selectedDate]: { ...(prev[selectedDate] || {}), [studentId]: status }
        }));
        setIsDirty(true);
    };

    const handleResetStudent = (studentId: string) => {
        if (!permissions.edit) return;
        setLockMap(prev => ({
            ...prev,
            [selectedDate]: { ...(prev[selectedDate] || {}), [studentId]: false }
        }));
        // Optional: revert to Absent to force explicit re-selection
        setAttendanceRecords(prev => ({ ...prev, [studentId]: AttendanceStatus.ABSENT }));
        // Update local history immediately
        setAttendanceHistory(prev => ({
            ...prev,
            [selectedDate]: { ...(prev[selectedDate] || {}), [studentId]: AttendanceStatus.ABSENT }
        }));
        setIsDirty(true);
    };

    const handleMarkAllPresent = () => {
        if (!permissions.edit) return;
        const newRecords: { [studentId: string]: AttendanceStatus } = {};
        studentsInClass.forEach(student => {
            newRecords[student.id] = AttendanceStatus.PRESENT;
        });
        setAttendanceRecords(newRecords);
        // Lock everyone for the date
        setLockMap(prev => ({
            ...prev,
            [selectedDate]: studentsInClass.reduce((acc, s) => ({ ...acc, [s.id]: true }), {})
        }));
        // Persist to local history immediately
        setAttendanceHistory(prev => ({
            ...prev,
            [selectedDate]: { ...(prev[selectedDate] || {}), ...newRecords }
        }));
        setIsDirty(true);
    };

    const handleSaveChanges = () => {
        if (!permissions.edit) return;
        // Here you would typically send the data to a backend API
        // For now, we'll just show an alert
        console.log("Saving attendance:", attendanceRecords);
        // Persist into local attendance history for selected date
        setAttendanceHistory(prev => ({ ...prev, [selectedDate]: { ...(prev[selectedDate] || {}), ...attendanceRecords } }));
        alert('Attendance records saved successfully!');
        setIsDirty(false);
        // To persist in mock data, you'd update `allMockStudents` array, but that's complex without a central state manager like Redux/Context
    };

    const stats = useMemo(() => {
        const values = Object.values(attendanceRecords);
        return {
            total: studentsInClass.length,
            present: values.filter(v => v === AttendanceStatus.PRESENT).length,
            absent: values.filter(v => v === AttendanceStatus.ABSENT).length,
            late: values.filter(v => v === AttendanceStatus.LATE).length,
            excused: values.filter(v => v === AttendanceStatus.EXCUSED).length,
        }
    }, [attendanceRecords, studentsInClass]);

    

    // Helpers to compute period range
    const getDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const formatISO = (d: Date) => d.toISOString().split('T')[0];
    const startOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay(); // 0=Sun..6=Sat
        const diff = (day === 0 ? -6 : 1) - day; // start Monday
        date.setDate(date.getDate() + diff);
        return getDateOnly(date);
    };
    const endOfWeek = (d: Date) => {
        const s = startOfWeek(d);
        const e = new Date(s);
        e.setDate(s.getDate() + 6);
        return e;
    };
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
    const endOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31);

    const periodRange = useMemo(() => {
        const anchor = new Date(selectedDate);
        if (period === 'day') {
            const day = getDateOnly(anchor);
            return { start: day, end: day };
        } else if (period === 'week') {
            return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
        } else if (period === 'month') {
            return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
        } else {
            return { start: startOfYear(anchor), end: endOfYear(anchor) };
        }
    }, [period, selectedDate]);

    // Student period stats: compute counts over selected period for the single current student
    const studentPeriodStats = useMemo(() => {
        if (currentUserRole !== Role.STUDENT || !currentUser) return null;
        const studentId = currentUser.id;
        const { start, end } = periodRange;
        let present = 0, absent = 0, late = 0, excused = 0, total = 0;
        const cursor = new Date(start);
        while (cursor <= end) {
            const iso = cursor.toISOString().split('T')[0];
            // prioritize current unsaved selection for the selected date
            const st = iso === selectedDate
                ? (attendanceRecords[studentId] || (attendanceHistory[iso] || {})[studentId])
                : (attendanceHistory[iso] || {})[studentId];
            if (st) {
                total += 1;
                if (st === AttendanceStatus.PRESENT) present += 1;
                else if (st === AttendanceStatus.ABSENT) absent += 1;
                else if (st === AttendanceStatus.LATE) late += 1;
                else if (st === AttendanceStatus.EXCUSED) excused += 1;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return { present, absent, late, excused, total };
    }, [currentUserRole, currentUser, periodRange, attendanceHistory, selectedDate, attendanceRecords]);

    const presentSerialList = useMemo(() => {
        const { start, end } = periodRange;
        const presentSet = new Set<string>();
        // Iterate through dates in attendanceHistory within range
        const cursor = new Date(start);
        while (cursor <= end) {
            const iso = formatISO(cursor);
            const dayRecords = attendanceHistory[iso] || {};
            studentsInClass.forEach(s => {
                if (dayRecords[s.id] === AttendanceStatus.PRESENT) {
                    presentSet.add(s.id);
                }
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        // For day period without saved history yet, also consider current unsaved records
        if (period === 'day') {
            studentsInClass.forEach(s => {
                if (attendanceRecords[s.id] === AttendanceStatus.PRESENT) presentSet.add(s.id);
            });
        }
        const list = studentsInClass.filter(s => presentSet.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }, [attendanceHistory, studentsInClass, periodRange, period, attendanceRecords]);

    // Period per-student dates of classes taken (filtered by status)
    const [periodStatusFilter, setPeriodStatusFilter] = useState<'All' | AttendanceStatus>('All');
    type DatesRow = { id: string; name: string; dates: string[] };
    const periodDatesSummary = useMemo<DatesRow[]>(() => {
        const { start, end } = periodRange;
        return studentsInClass.map(s => {
            const dates: string[] = [];
            const cursor = new Date(start);
            while (cursor <= end) {
                const iso = formatISO(cursor);
                const st = iso === selectedDate
                    ? (attendanceRecords[s.id] || (attendanceHistory[iso] || {})[s.id])
                    : (attendanceHistory[iso] || {})[s.id];
                if (st && (periodStatusFilter === 'All' || st === periodStatusFilter)) {
                    dates.push(iso);
                }
                cursor.setDate(cursor.getDate() + 1);
            }
            return { id: s.id, name: s.name, dates };
        }).filter(r => r.dates.length > 0 || periodStatusFilter === 'All')
          .sort((a, b) => a.name.localeCompare(b.name));
    }, [studentsInClass, attendanceHistory, attendanceRecords, periodRange, selectedDate, periodStatusFilter]);

    // Today mixed list with filter (All/Present/Absent/Late/Excused)
    const [todayFilter, setTodayFilter] = useState<'All' | AttendanceStatus>('All');
    const todayMixedList = useMemo(() => {
        const list = studentsInClass
            .filter(s => {
                const st = attendanceRecords[s.id];
                return todayFilter === 'All' || st === todayFilter;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }, [studentsInClass, attendanceRecords, todayFilter]);
    const statusStyles: Record<AttendanceStatus, string> = {
        [AttendanceStatus.PRESENT]: 'bg-green-600 text-white',
        [AttendanceStatus.ABSENT]: 'bg-red-600 text-white',
        [AttendanceStatus.LATE]: 'bg-amber-500 text-white',
        [AttendanceStatus.EXCUSED]: 'bg-blue-600 text-white',
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8" id="print-attendance">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h2>
                <div className="flex gap-2">
                    {isDirty && permissions.edit && (
                        <button onClick={handleSaveChanges} className="no-print inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark">
                            <SaveIcon className="-ml-1 mr-2 h-5 w-5" />
                            Save Changes
                        </button>
                    )}
                    <button onClick={() => downloadTableAsPdf('print-attendance', 'Attendance.pdf')} className="no-print inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                        <FileDownIcon className="-ml-1 mr-2 h-5 w-5" />
                        Export PDF
                    </button>
                </div>
            </div>
            
            <div className="mb-6 flex flex-col md:flex-row gap-4">
                {currentUserRole !== Role.STUDENT && (
                    <div className="flex-1">
                        <label htmlFor="class-filter" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Class</label>
                        <select id="class-filter" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="mt-1 w-full md:max-w-xs px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                            {mockClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="flex-1">
                     <label htmlFor="date-filter" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Date</label>
                    <input id="date-filter" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mt-1 w-full md:max-w-xs px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"/>
                </div>
                <div className="flex-1">
                    <label htmlFor="period-filter" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Period</label>
                    <select id="period-filter" value={period} onChange={e => setPeriod(e.target.value as any)} className="mt-1 w-full md:max-w-xs px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                    </select>
                </div>
            </div>

            {currentUserRole === Role.STUDENT && studentPeriodStats ? (
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg shadow-sm border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300">Present</p>
                        <p className="text-2xl font-bold text-green-800 dark:text-green-200">{studentPeriodStats.present}</p>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-700 dark:text-red-300">Absent</p>
                        <p className="text-2xl font-bold text-red-800 dark:text-red-200">{studentPeriodStats.absent}</p>
                    </div>
                    <div className="p-4 bg-card dark:bg-dark-card rounded-lg shadow-sm border border-border dark:border-dark-border">
                        <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Total Classes Taken</p>
                        <p className="text-2xl font-bold">{studentPeriodStats.total}</p>
                    </div>
                </div>
            ) : (
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-center">
                    <div className="p-4 bg-card dark:bg-dark-card rounded-lg shadow-sm border border-border dark:border-dark-border"><p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Total Students</p><p className="text-2xl font-bold">{stats.total}</p></div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg shadow-sm border border-green-200 dark:border-green-800"><p className="text-sm text-green-700 dark:text-green-300">Present</p><p className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.present}</p></div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm border border-red-200 dark:border-red-800"><p className="text-sm text-red-700 dark:text-red-300">Absent</p><p className="text-2xl font-bold text-red-800 dark:text-red-200">{stats.absent}</p></div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg shadow-sm border border-amber-200 dark:border-amber-800"><p className="text-sm text-amber-700 dark:text-amber-300">Late</p><p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{stats.late}</p></div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800"><p className="text-sm text-blue-700 dark:text-blue-300">Excused</p><p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{stats.excused}</p></div>
                </div>
            )}

            <div className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="p-4 border-b border-border dark:border-dark-border flex justify-end">
                     {permissions.edit && (
                         <button onClick={handleMarkAllPresent} className="no-print inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                             Mark All Present
                         </button>
                     )}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Student</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {studentsInClass.map((student) => (
                                <tr key={student.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={`${student.name} (${student.email})`}>
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10"><img className="h-10 w-10 rounded-full object-cover" src={student.profilePicture} alt="" /></div>
                                            <div className="ml-4"><div className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</div><div className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{student.email}</div></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={attendanceRecords[student.id]}>
                                        {lockMap[selectedDate]?.[student.id] && attendanceRecords[student.id] === AttendanceStatus.PRESENT ? (
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-green-600 text-white">Present</span>
                                                {permissions.edit && (
                                                    <button onClick={() => handleResetStudent(student.id)} className="text-xs px-2 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Reset</button>
                                                )}
                                            </div>
                                        ) : permissions.edit ? (
                                            <div className="flex items-center gap-2">
                                                <StatusButton icon={<CheckIcon className="w-4 h-4 mr-1"/>} label={AttendanceStatus.PRESENT} current={attendanceRecords[student.id]} onClick={handleStatusChange} studentId={student.id} color="green" />
                                                <StatusButton icon={<XIcon className="w-4 h-4 mr-1"/>} label={AttendanceStatus.ABSENT} current={attendanceRecords[student.id]} onClick={handleStatusChange} studentId={student.id} color="red" />
                                                <StatusButton icon={<ClockIcon className="w-4 h-4 mr-1"/>} label={AttendanceStatus.LATE} current={attendanceRecords[student.id]} onClick={handleStatusChange} studentId={student.id} color="amber" />
                                                <StatusButton icon={<FileTextIcon className="w-4 h-4 mr-1"/>} label={AttendanceStatus.EXCUSED} current={attendanceRecords[student.id]} onClick={handleStatusChange} studentId={student.id} color="blue" />
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-border dark:border-dark-border">
                                                {attendanceRecords[student.id]}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
             {studentsInClass.length === 0 && (
                <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No students found in this class.</div>
            )}

            {/* Period Dates Summary with filter */}
            <div className="mt-6 bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="p-4 border-b border-border dark:border-dark-border flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">Dates of Classes Taken ({period.charAt(0).toUpperCase() + period.slice(1)})</h3>
                    <div className="ml-auto flex items-center gap-2">
                        <label htmlFor="period-status-filter" className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Filter</label>
                        <select id="period-status-filter" value={periodStatusFilter} onChange={e => setPeriodStatusFilter(e.target.value as any)} className="px-3 py-1.5 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                            <option value="All">All</option>
                            <option value={AttendanceStatus.PRESENT}>Present</option>
                            <option value={AttendanceStatus.ABSENT}>Absent</option>
                            <option value={AttendanceStatus.LATE}>Late</option>
                            <option value={AttendanceStatus.EXCUSED}>Excused</option>
                        </select>
                        <span className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Total: {periodDatesSummary.length}</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">SL. No.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Dates</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {periodDatesSummary.map((r, idx) => (
                                <tr key={r.id}>
                                    <td className="px-6 py-3 text-sm">{idx + 1}</td>
                                    <td className="px-6 py-3 text-sm">{r.name}</td>
                                    <td className="px-6 py-3 text-sm">
                                        {r.dates.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {r.dates.map(d => (
                                                    <span key={d} className="inline-flex items-center px-2 py-1 text-xs rounded-md border border-border dark:border-dark-border bg-muted dark:bg-dark-muted">
                                                        {d}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground dark:text-dark-muted-foreground">No classes in this period</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {periodDatesSummary.length === 0 && (
                                <tr><td className="px-6 py-3 text-sm" colSpan={3}>No records match the selected filter for this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mixed Today Attendance list with filter (teachers/admins) */}
            {currentUserRole !== Role.STUDENT && (
                <div className="mt-6 bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                    <div className="p-4 border-b border-border dark:border-dark-border flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold">Today Attendance</h3>
                        <div className="ml-auto flex items-center gap-2">
                            <label htmlFor="today-filter" className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Filter</label>
                            <select id="today-filter" value={todayFilter} onChange={e => setTodayFilter(e.target.value as any)} className="px-3 py-1.5 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                                <option value="All">All</option>
                                <option value={AttendanceStatus.PRESENT}>Present</option>
                                <option value={AttendanceStatus.ABSENT}>Absent</option>
                                <option value={AttendanceStatus.LATE}>Late</option>
                                <option value={AttendanceStatus.EXCUSED}>Excused</option>
                            </select>
                            <span className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Total: {todayMixedList.length}</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                            <thead className="bg-muted dark:bg-dark-muted">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">SL. No.</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Student</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border dark:divide-dark-border">
                                {todayMixedList.map((s, idx) => (
                                    <tr key={s.id}>
                                        <td className="px-6 py-3 text-sm">{idx + 1}</td>
                                        <td className="px-6 py-3 text-sm">{s.name}</td>
                                        <td className="px-6 py-3 text-sm">
                                            <span className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full ${statusStyles[attendanceRecords[s.id]]}`}>
                                                {attendanceRecords[s.id]}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {todayMixedList.length === 0 && (
                                    <tr><td className="px-6 py-3 text-sm" colSpan={3}>No students match the selected filter.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};


interface StatusButtonProps {
    label: AttendanceStatus;
    current: AttendanceStatus;
    onClick: (studentId: string, status: AttendanceStatus) => void;
    studentId: string;
    color: 'green' | 'red' | 'amber' | 'blue';
    icon: React.ReactNode;
}

const StatusButton: React.FC<StatusButtonProps> = ({ label, current, onClick, studentId, color, icon }) => {
    const isActive = label === current;

    const baseClasses = "flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2";
    
    const colors = {
        green: {
            active: "bg-green-600 border-green-600 text-white focus:ring-green-500",
            inactive: "bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20"
        },
        red: {
            active: "bg-red-600 border-red-600 text-white focus:ring-red-500",
            inactive: "bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20"
        },
        amber: {
            active: "bg-amber-500 border-amber-500 text-white focus:ring-amber-500",
            inactive: "bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        },
        blue: {
            active: "bg-blue-600 border-blue-600 text-white focus:ring-blue-500",
            inactive: "bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        }
    }
    
    return (
        <button
            onClick={() => onClick(studentId, label)}
            className={`${baseClasses} ${isActive ? colors[color].active : colors[color].inactive}`}
        >
            {icon}
            {label}
        </button>
    );
};


export default Attendance;