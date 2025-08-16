import React, { useState, useMemo } from 'react';
import { Role, TimetableEntry, Class, Teacher, DayOfWeek, FeaturePermissions, User, Student } from '../types';
import { PlusIcon, EditIcon, DeleteIcon, XIcon } from '../components/icons';

// --- MOCK DATA ---
const mockTeachers: Teacher[] = [
    { id: 'teacher-1', name: 'John Doe', email: 'john.d@likla.edu', role: Role.TEACHER, whatsapp: '123-456-7890', salary: 50000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=john.d@likla.edu' },
    { id: 'teacher-2', name: 'Jane Smith', email: 'jane.s@likla.edu', role: Role.TEACHER, whatsapp: '098-765-4321', salary: 52000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=jane.s@likla.edu' },
    { id: 'teacher-3', name: 'Peter Jones', email: 'peter.j@likla.edu', role: Role.TEACHER, whatsapp: '555-555-5555', salary: 55000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=peter.j@likla.edu' },
];

const mockClasses: Class[] = [
    { id: 'class-10a', name: 'Class 10-A', teacherId: 'teacher-1', studentIds: [] },
    { id: 'class-10b', name: 'Class 10-B', teacherId: 'teacher-2', studentIds: [] },
    { id: 'class-9a', name: 'Class 9-A', teacherId: 'teacher-3', studentIds: [] },
];

const initialTimetable: TimetableEntry[] = [
    { id: 'tt-1', classId: 'class-10a', teacherId: 'teacher-1', subject: 'Mathematics', day: 'Monday', timeSlot: '09:00-10:00' },
    { id: 'tt-2', classId: 'class-10b', teacherId: 'teacher-2', subject: 'Physics', day: 'Monday', timeSlot: '09:00-10:00' },
    { id: 'tt-3', classId: 'class-9a', teacherId: 'teacher-3', subject: 'History', day: 'Monday', timeSlot: '10:00-11:00' },
    { id: 'tt-4', classId: 'class-10a', teacherId: 'teacher-2', subject: 'Physics', day: 'Tuesday', timeSlot: '11:00-12:00' },
    { id: 'tt-5', classId: 'class-10b', teacherId: 'teacher-1', subject: 'Mathematics', day: 'Wednesday', timeSlot: '14:00-15:00' },
    { id: 'tt-6', classId: 'class-10a', teacherId: 'teacher-3', subject: 'English', day: 'Friday', timeSlot: '09:00-10:00' },
];

const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00'];
// --- END MOCK DATA ---

const getSubjectColor = (subject: string) => {
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 90%)`;
};

const getSubjectColorDark = (subject: string) => {
     let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 40%, 20%)`;
}


interface TimetableProps { permissions?: Partial<FeaturePermissions>; currentUser?: User | Teacher | Student; }

const Timetable: React.FC<TimetableProps> = ({ permissions, currentUser }) => {
    const [timetable, setTimetable] = useState<TimetableEntry[]>(initialTimetable);
    const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
    const [filter, setFilter] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<{ entry: TimetableEntry | null, day: DayOfWeek, timeSlot: string }>({ entry: null, day: 'Monday', timeSlot: '09:00-10:00' });
    const canCreate = Boolean(permissions?.create);
    const canEdit = Boolean(permissions?.edit);
    const canDelete = Boolean(permissions?.delete);

    const filteredTimetable = useMemo(() => {
        let base = timetable;
        if (currentUser?.role === Role.TEACHER) {
            base = base.filter(e => e.teacherId === currentUser.id);
        } else if (currentUser?.role === Role.STUDENT) {
            const cu = currentUser as Student;
            base = base.filter(e => e.classId === cu.classId);
        } else {
            // Admin-like roles can use filters
            if (filter !== 'all') {
                if (viewMode === 'class') base = base.filter(entry => entry.classId === filter);
                if (viewMode === 'teacher') base = base.filter(entry => entry.teacherId === filter);
            }
        }
        return base;
    }, [timetable, viewMode, filter, currentUser]);

    const handleOpenModal = (entry: TimetableEntry | null, day: DayOfWeek, timeSlot: string) => {
        if (entry && !canEdit) return; // editing existing requires edit
        if (!entry && !canCreate) return; // creating new requires create
        setEditingEntry({ entry, day, timeSlot });
        setIsModalOpen(true);
    };

    const handleSaveEntry = (data: Omit<TimetableEntry, 'id'>) => {
        if (editingEntry.entry) { // Update
            if (!canEdit) return;
            setTimetable(prev => prev.map(e => e.id === editingEntry.entry!.id ? { ...editingEntry.entry!, ...data } : e));
        } else { // Create
            if (!canCreate) return;
            const newEntry: TimetableEntry = { ...data, id: `tt-${Date.now()}` };
            setTimetable(prev => [...prev, newEntry]);
        }
        setIsModalOpen(false);
    };

    const handleDeleteEntry = (id: string) => {
        if (!canDelete) return;
        if (window.confirm('Are you sure you want to delete this period?')) {
            setTimetable(prev => prev.filter(e => e.id !== id));
            setIsModalOpen(false);
        }
    };
    
    const findEntry = (day: DayOfWeek, timeSlot: string) => {
        return filteredTimetable.find(e => e.day === day && e.timeSlot === timeSlot);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Timetable</h2>
                {currentUser?.role !== Role.TEACHER && currentUser?.role !== Role.STUDENT && (
                    <div className="mt-4 sm:mt-0 flex gap-4">
                        <select value={viewMode} onChange={e => { setViewMode(e.target.value as any); setFilter('all'); }} className="w-full sm:w-auto px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                            <option value="class">View by Class</option>
                            <option value="teacher">View by Teacher</option>
                        </select>
                        <select value={filter} onChange={e => setFilter(e.target.value)} className="w-full sm:w-auto px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                            <option value="all">All {viewMode === 'class' ? 'Classes' : 'Teachers'}</option>
                            {(viewMode === 'class' ? mockClasses : mockTeachers).map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-x-auto border border-border dark:border-dark-border">
                <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                    <thead className="bg-muted dark:bg-dark-muted">
                        <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider w-32">Time</th>
                            {DAYS_OF_WEEK.map(day => (
                                <th key={day} className="px-3 py-3 text-center text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-dark-border">
                        {TIME_SLOTS.map(timeSlot => (
                            <tr key={timeSlot} className="divide-x divide-border dark:divide-dark-border">
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">{timeSlot}</td>
                                {DAYS_OF_WEEK.map(day => {
                                    const entry = findEntry(day, timeSlot);
                                    return (
                                        <td key={day} className="p-1 align-top h-28" onClick={() => handleOpenModal(entry || null, day, timeSlot)}>
                                            {entry ? (
                                                <div 
                                                    className="w-full h-full rounded-md p-2 flex flex-col justify-between text-left text-gray-800 dark:text-gray-100 transition-transform duration-200 hover:scale-105" 
                                                    style={{ backgroundColor: `var(--subject-bg, ${getSubjectColor(entry.subject)})`}}
                                                    onMouseOver={(e) => e.currentTarget.style.setProperty('--subject-bg', `var(--subject-bg-dark, ${getSubjectColorDark(entry.subject)})`)}
                                                    onMouseOut={(e) => e.currentTarget.style.setProperty('--subject-bg', getSubjectColor(entry.subject))}
                                                >
                                                    <div>
                                                        <p className="font-bold text-sm leading-tight">{entry.subject}</p>
                                                        <p className="text-xs">{mockClasses.find(c => c.id === entry.classId)?.name}</p>
                                                    </div>
                                                    <p className="text-xs text-right font-medium">{mockTeachers.find(t => t.id === entry.teacherId)?.name}</p>
                                                </div>
                                            ) : (
                                                canCreate && <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 hover:bg-accent dark:hover:bg-dark-accent rounded-md cursor-pointer"><PlusIcon className="w-6 h-6"/></div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {isModalOpen && (
                <TimetableEntryModal
                    data={editingEntry}
                    onSave={handleSaveEntry}
                    onDelete={handleDeleteEntry}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};


interface TimetableEntryModalProps {
    data: { entry: TimetableEntry | null, day: DayOfWeek, timeSlot: string };
    onSave: (data: Omit<TimetableEntry, 'id'>) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

const TimetableEntryModal: React.FC<TimetableEntryModalProps> = ({ data, onSave, onDelete, onClose }) => {
    const [formData, setFormData] = useState({
        classId: data.entry?.classId || mockClasses[0]?.id || '',
        teacherId: data.entry?.teacherId || mockTeachers[0]?.id || '',
        subject: data.entry?.subject || '',
        day: data.day,
        timeSlot: data.timeSlot,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-border dark:border-dark-border">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{data.entry ? 'Edit Period' : 'Add Period'}</h3>
                            <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent"><XIcon className="w-6 h-6" /></button>
                        </div>
                         <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mt-1">{data.day}, {data.timeSlot}</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="subject" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Subject</label>
                            <input type="text" name="subject" id="subject" value={formData.subject} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2" />
                        </div>
                        <div>
                            <label htmlFor="classId" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Class</label>
                            <select name="classId" id="classId" value={formData.classId} onChange={handleChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2">
                                {mockClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="teacherId" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Teacher</label>
                            <select name="teacherId" id="teacherId" value={formData.teacherId} onChange={handleChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2">
                                {mockTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-4 flex justify-between items-center">
                        {data.entry && (
                            <button type="button" onClick={() => onDelete(data.entry!.id)} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 flex items-center gap-2">
                                <DeleteIcon className="w-4 h-4"/> Delete
                            </button>
                        )}
                        <div className="flex gap-3 ml-auto">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark">Save</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Timetable;