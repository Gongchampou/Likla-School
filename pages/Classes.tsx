import React, { useState, useMemo, useEffect } from 'react';
import { downloadTableAsPdf } from '../utils/pdf';
import { Role, Class, Teacher, Student, FeaturePermissions } from '../types';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, FileDownIcon, VideoIcon } from '../components/icons';

// Mock Data
const mockTeachers: Teacher[] = [
    { id: 'teacher-1', name: 'John Doe', email: 'john.d@likla.edu', role: Role.TEACHER, whatsapp: '123-456-7890', salary: 50000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=john.d@likla.edu' },
    { id: 'teacher-2', name: 'Jane Smith', email: 'jane.s@likla.edu', role: Role.TEACHER, whatsapp: '098-765-4321', salary: 52000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=jane.s@likla.edu' },
    { id: 'teacher-3', name: 'Peter Jones', email: 'peter.j@likla.edu', role: Role.TEACHER, whatsapp: '555-555-5555', salary: 55000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=peter.j@likla.edu' },
];

const mockStudents: Student[] = [
    { id: 'student-1', name: 'Alice Johnson', email: 'alice.j@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=alice.j@likla.edu' },
    { id: 'student-2', name: 'Bob Williams', email: 'bob.w@likla.edu', role: Role.STUDENT, classId: 'class-10b', attendance: {}, fees: [], discount: 10, profilePicture: 'https://i.pravatar.cc/150?u=bob.w@likla.edu' },
    { id: 'student-3', name: 'Charlie Brown', email: 'charlie.b@likla.edu', role: Role.STUDENT, classId: 'class-9a', attendance: {}, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=charlie.b@likla.edu' },
    { id: 'student-4', name: 'Diana Miller', email: 'diana.m@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [], discount: 5, profilePicture: 'https://i.pravatar.cc/150?u=diana.m@likla.edu' },
    { id: 'student-5', name: 'Ethan Hunt', email: 'ethan.h@likla.edu', role: Role.STUDENT, classId: '', attendance: {}, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=ethan.h@likla.edu' },
];

const initialClasses: Class[] = [
    { id: 'class-10a', name: 'Class 10-A', teacherId: 'teacher-1', studentIds: ['student-1', 'student-4'], liveClass: { link: 'https://zoom.us/j/1234567890', time: '2024-12-01T10:00' } },
    { id: 'class-10b', name: 'Class 10-B', teacherId: 'teacher-2', studentIds: ['student-2'] },
    { id: 'class-9a', name: 'Class 9-A', teacherId: 'teacher-1', studentIds: ['student-3'] },
    { id: 'class-9b', name: 'Class 9-B', teacherId: 'teacher-2', studentIds: [] },
];

interface ClassesProps {
    permissions?: Partial<FeaturePermissions>;
}

const Classes: React.FC<ClassesProps> = ({ permissions }) => {
    const [classes, setClasses] = useState<Class[]>(initialClasses);
    const [searchTerm, setSearchTerm] = useState('');
    const [teacherFilter, setTeacherFilter] = useState<string>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [isLiveClassModalOpen, setIsLiveClassModalOpen] = useState(false);
    const [liveClassTarget, setLiveClassTarget] = useState<Class | null>(null);

    const filteredClasses = useMemo(() => {
        return classes
            .filter(cls => teacherFilter === 'All' || cls.teacherId === teacherFilter)
            .filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [classes, searchTerm, teacherFilter]);

    // Derive capabilities from permissions
    const canCreate = !!permissions?.create || false;
    const canEdit = !!permissions?.edit || false;
    const canDelete = !!permissions?.delete || false;

    const handleAddNewClass = () => {
        if (!canCreate) return;
        setEditingClass(null);
        setIsModalOpen(true);
    };

    const handleEditClass = (cls: Class) => {
        if (!canEdit) return;
        setEditingClass(cls);
        setIsModalOpen(true);
    };

    const handleDeleteClass = (classId: string) => {
        if (!canDelete) return;
        if (window.confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
            setClasses(classes.filter(cls => cls.id !== classId));
        }
    };

    const handleSaveClass = (classData: Class) => {
        if (editingClass) {
            if (!canEdit) return;
            setClasses(classes.map(c => c.id === classData.id ? classData : c));
        } else {
            if (!canCreate) return;
            setClasses([...classes, { ...classData, id: `class-${Date.now()}` }]);
        }
        setIsModalOpen(false);
    };

    const handleSetLiveClass = (cls: Class) => {
        if (!canEdit) return;
        setLiveClassTarget(cls);
        setIsLiveClassModalOpen(true);
    };

    const handleSaveLiveClass = (link: string, time: string) => {
        if (!canEdit) return;
        if (liveClassTarget) {
            setClasses(classes.map(cls => cls.id === liveClassTarget.id ? { ...cls, liveClass: { link, time } } : cls));
        }
        setIsLiveClassModalOpen(false);
        setLiveClassTarget(null);
    };
    
    const formatDateTime = (dateTimeString?: string) => {
        if (!dateTimeString) return 'Not Set';
        try {
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(dateTimeString));
        } catch (e) {
            return 'Invalid Date';
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Classes</h2>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-2">
                    <button type="button" onClick={() => downloadTableAsPdf('classesTableContainer', 'Classes.pdf')} className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-accent dark:hover:bg-dark-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                        <FileDownIcon className="-ml-1 mr-2 h-5 w-5" />
                        Export PDF
                    </button>
                    {canCreate && (
                        <button type="button" onClick={handleAddNewClass} className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                            Add Class
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input type="text" placeholder="Search by class name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="All">All Teachers</option>
                    {mockTeachers.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
            </div>

            <div id="classesTableContainer" className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Class Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Teacher</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Students</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Live Class</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {filteredClasses.map((cls) => (
                                <tr key={cls.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white" data-export={cls.name}>{cls.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={mockTeachers.find(t => t.id === cls.teacherId)?.name || 'N/A'}>{mockTeachers.find(t => t.id === cls.teacherId)?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={String(cls.studentIds.length)}>{cls.studentIds.length}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={cls.liveClass?.link ? 'Set' : 'Not Set'}>
                                        {cls.liveClass?.link ? (
                                            <div className="flex flex-col">
                                                <a href={cls.liveClass.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    <VideoIcon className="w-4 h-4" /> Join Now
                                                </a>
                                                <span className="text-xs">{formatDateTime(cls.liveClass.time)}</span>
                                            </div>
                                        ) : (
                                            canEdit ? (
                                                <button onClick={() => handleSetLiveClass(cls)} className="text-xs text-primary hover:underline">Set Live Class</button>
                                            ) : (
                                                <span className="text-xs">Not Set</span>
                                            )
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-1">
                                            {cls.liveClass?.link && canEdit && <button onClick={() => handleSetLiveClass(cls)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit Live Class"><VideoIcon className="w-5 h-5" /></button>}
                                            {canEdit && <button onClick={() => handleEditClass(cls)} className="text-primary hover:text-primary-dark p-1"><EditIcon className="w-5 h-5"/></button>}
                                            {canDelete && <button onClick={() => handleDeleteClass(cls.id)} className="text-red-600 hover:text-red-800 p-1"><DeleteIcon className="w-5 h-5"/></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {filteredClasses.length === 0 && <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No classes found.</div>}
            
            {isModalOpen && <ClassModal classData={editingClass} onSave={handleSaveClass} onClose={() => setIsModalOpen(false)} allTeachers={mockTeachers} allStudents={mockStudents} />}
            {isLiveClassModalOpen && liveClassTarget && <LiveClassModal classData={liveClassTarget} onSave={handleSaveLiveClass} onClose={() => setIsLiveClassModalOpen(false)} />}
        </div>
    );
};

interface ClassModalProps { classData: Class | null; onSave: (data: Class) => void; onClose: () => void; allTeachers: Teacher[]; allStudents: Student[]; }
const ClassModal: React.FC<ClassModalProps> = ({ classData, onSave, onClose, allTeachers, allStudents }) => {
    const [name, setName] = useState(classData?.name || '');
    const [teacherId, setTeacherId] = useState(classData?.teacherId || allTeachers[0]?.id || '');
    const [studentIds, setStudentIds] = useState(classData?.studentIds || []);

    const handleStudentCheck = (studentId: string) => {
        setStudentIds(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: classData?.id || '', name, teacherId, studentIds });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 transition-opacity">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg max-h-full flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{classData ? 'Edit Class' : 'Add New Class'}</h3>
                            <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Class Name</label>
                                <input type="text" name="name" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="teacherId" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Assign Teacher</label>
                                <select id="teacherId" name="teacherId" value={teacherId} onChange={e => setTeacherId(e.target.value)} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2">
                                    {allTeachers.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 pb-4 flex-1 overflow-y-auto">
                        <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-2">Assign Students</label>
                        <div className="border border-border dark:border-dark-border rounded-md max-h-60 overflow-y-auto">
                           {allStudents.map(student => (
                               <div key={student.id} className="flex items-center p-2 border-b border-border dark:border-dark-border last:border-b-0">
                                   <input id={`student-${student.id}`} type="checkbox" checked={studentIds.includes(student.id)} onChange={() => handleStudentCheck(student.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                   <label htmlFor={`student-${student.id}`} className="ml-3 text-sm text-gray-700 dark:text-gray-300">{student.name}</label>
                               </div>
                           ))}
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-3 flex justify-end gap-3 mt-auto">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface LiveClassModalProps { classData: Class; onSave: (link: string, time: string) => void; onClose: () => void; }
const LiveClassModal: React.FC<LiveClassModalProps> = ({ classData, onSave, onClose }) => {
    const [link, setLink] = useState(classData.liveClass?.link || '');
    const [time, setTime] = useState(classData.liveClass?.time || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(link, time);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 transition-opacity">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Set Live Class for {classData.name}</h3>
                             <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="link" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Meeting Link (e.g., Zoom)</label>
                                <input type="url" name="link" id="link" value={link} onChange={e => setLink(e.target.value)} required placeholder="https://zoom.us/j/..." className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="time" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Meeting Time</label>
                                <input type="datetime-local" name="time" id="time" value={time} onChange={e => setTime(e.target.value)} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-3 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Classes;
