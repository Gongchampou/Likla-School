import React, { useState, useMemo, useEffect, useRef } from 'react';
import { downloadTableAsPdf } from '../utils/pdf';
import { Role, Teacher, FeaturePermissions } from '../types';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, FileDownIcon, WhatsAppIcon } from '../components/icons';
import VisibleSection from '../components/VisibleSection';
import { formatDisplayId } from '../utils/id';

// Mock Data
const initialTeachers: Teacher[] = [
    { id: 'teacher-1', name: 'John Doe', email: 'john.d@likla.edu', role: Role.TEACHER, whatsapp: '123-456-7890', salary: 50000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=john.d@likla.edu' },
    { id: 'teacher-2', name: 'Jane Smith', email: 'jane.s@likla.edu', role: Role.TEACHER, whatsapp: '098-765-4321', salary: 52000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=jane.s@likla.edu' },
    { id: 'teacher-3', name: 'Peter Jones', email: 'peter.j@likla.edu', role: Role.TEACHER, whatsapp: '555-555-5555', salary: 55000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=peter.j@likla.edu' },
];

interface TeachersProps {
    permissions?: Partial<FeaturePermissions>;
}

const Teachers: React.FC<TeachersProps> = ({ permissions = {} }) => {
    const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement | null>(null);
    const [salaryStatus, setSalaryStatus] = useState<Record<string, 'Paid' | 'Unpaid'>>(
        Object.fromEntries(initialTeachers.map((t, idx) => [t.id, idx % 2 === 0 ? 'Paid' : 'Unpaid']))
    );
    const role = ((): any => { try { return (JSON.parse(localStorage.getItem('currentUser') || '{}') || {}).role; } catch { return undefined; } })();

    const filteredTeachers = useMemo(() => {
        return teachers
            .filter(teacher =>
                teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [teachers, searchTerm]);

    const handleAddNewTeacher = () => {
        if (!permissions.create) return;
        setEditingTeacher(null);
        setIsModalOpen(true);
    };

    const handleEditTeacher = (teacher: Teacher) => {
        if (!permissions.edit) return;
        setEditingTeacher(teacher);
        setIsModalOpen(true);
    };
    
    const handleDeleteTeacher = (teacherId: string) => {
        if (!permissions.delete) return;
        if(window.confirm('Are you sure you want to delete this teacher?')) {
            setTeachers(teachers.filter(teacher => teacher.id !== teacherId));
        }
    };

    const getSchoolName = () => {
        try {
            const saved = localStorage.getItem('schoolSettings');
            if (saved) return (JSON.parse(saved) || {}).schoolName || 'LIKLA SCHOOL';
        } catch {}
        return 'LIKLA SCHOOL';
    };

    const handleSaveTeacher = (teacherData: Teacher, status: 'Paid' | 'Unpaid') => {
        if (editingTeacher) {
            if (!permissions.edit) return;
            // Update existing teacher and status
            setTeachers(prev => prev.map(t => t.id === teacherData.id ? teacherData : t));
            setSalaryStatus(prev => ({ ...prev, [teacherData.id]: status }));
        } else {
            if (!permissions.create) return;
            // Create new teacher with generated ids, then set status
            const newId = `teacher-${Date.now()}`;
            const schoolName = getSchoolName();
            const displayId = formatDisplayId({ user: { ...(teacherData as any), id: newId, role: Role.TEACHER }, schoolName, dobYear: (teacherData as any).dobYear });
            const newTeacher: Teacher = { ...teacherData, id: newId, role: Role.TEACHER, attendance: {}, displayId } as Teacher;
            setTeachers(prev => [...prev, newTeacher]);
            setSalaryStatus(prev => ({ ...prev, [newId]: status }));
        }
        setIsModalOpen(false);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }

    const handleExportBySalaryStatus = async (statusFilter: 'All' | 'Paid' | 'Unpaid') => {
        const tempId = `teachers-salary-${statusFilter}-${Date.now()}`;
        const container = document.createElement('div');
        container.id = tempId;
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';

        const rows = filteredTeachers.filter(t => statusFilter === 'All' ? true : salaryStatus[t.id] === statusFilter);
        let bodyRows = '';
        rows.forEach(t => {
            const status = salaryStatus[t.id] || 'Unpaid';
            bodyRows += `
              <tr>
                <td data-export="${t.name} (${t.email})">${t.name}</td>
                <td data-export="${t.whatsapp}">${t.whatsapp}</td>
                <td data-export="${String(t.salary)}">${t.salary}</td>
                <td data-export="${status}">${status}</td>
              </tr>`;
        });

        container.innerHTML = `
          <div>
            <h2>Teachers - ${statusFilter}</h2>
            <table>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Contact</th>
                  <th>Salary</th>
                  <th>Salary Status</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
            </table>
          </div>`;

        document.body.appendChild(container);
        try {
            await downloadTableAsPdf(tempId, `Teachers-${statusFilter}.pdf`);
        } finally {
            document.body.removeChild(container);
        }
    };

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!exportRef.current) return;
            if (!exportRef.current.contains(e.target as Node)) setIsExportOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Teachers</h2>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-2">
                    <VisibleSection role={role} sectionKey="teachers.export" storageKey="teachersControls">
                        <div className="relative" ref={exportRef}>
                            <button
                                type="button"
                                onClick={() => setIsExportOpen(v => !v)}
                                className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-accent dark:hover:bg-dark-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                aria-haspopup="menu"
                                aria-expanded={isExportOpen}
                            >
                                <FileDownIcon className="-ml-1 mr-2 h-5 w-5" />
                                Export <span className="ml-1">▼</span>
                            </button>
                            {isExportOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card shadow-lg ring-1 ring-black/5 z-10">
                                    <div className="py-1">
                                        <button onClick={() => { handleExportBySalaryStatus('All'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export All</button>
                                        <button onClick={() => { handleExportBySalaryStatus('Paid'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export Paid</button>
                                        <button onClick={() => { handleExportBySalaryStatus('Unpaid'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export Unpaid</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </VisibleSection>
                    <VisibleSection role={role} sectionKey="teachers.add" storageKey="teachersControls">
                        {permissions.create && (
                            <button
                                type="button"
                                onClick={handleAddNewTeacher}
                                className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                                Add Teacher
                            </button>
                        )}
                    </VisibleSection>
                </div>
            </div>

            <div className="mb-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>
            </div>

            <VisibleSection role={role} sectionKey="teachers.list" storageKey="teachersControls">
            <div id="teachersTableContainer" className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Teacher</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Contact</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Salary</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Salary Status</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {filteredTeachers.map((teacher) => (
                                <tr key={teacher.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={`${teacher.name} (${teacher.email})`}>
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <img className="h-10 w-10 rounded-full object-cover" src={teacher.profilePicture} alt={`${teacher.name}'s profile`} />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{teacher.name}</div>
                                                <div className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{teacher.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={teacher.whatsapp}>
                                        <div className="flex items-center gap-2">
                                            <WhatsAppIcon className="w-5 h-5 text-green-500" />
                                            <span>{teacher.whatsapp}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={String(teacher.salary)}>{formatCurrency(teacher.salary)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={salaryStatus[teacher.id]}>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${salaryStatus[teacher.id] === 'Paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                                            {salaryStatus[teacher.id]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <VisibleSection role={role} sectionKey="teachers.actions" storageKey="teachersControls">
                                                {permissions.edit && (
                                                    <button onClick={() => handleEditTeacher(teacher)} className="text-primary hover:text-primary-dark p-1"><EditIcon className="w-5 h-5"/></button>
                                                )}
                                                {permissions.delete && (
                                                    <button onClick={() => handleDeleteTeacher(teacher.id)} className="text-red-600 hover:text-red-800 p-1"><DeleteIcon className="w-5 h-5"/></button>
                                                )}
                                            </VisibleSection>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            </VisibleSection>
            {filteredTeachers.length === 0 && (
                <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No teachers found.</div>
            )}
            
            <VisibleSection role={role} sectionKey="teachers.modal" storageKey="teachersControls">
                {isModalOpen && (
                    <TeacherModal
                        teacher={editingTeacher}
                        currentStatus={editingTeacher ? (salaryStatus[editingTeacher.id] || 'Unpaid') : 'Unpaid'}
                        onSave={handleSaveTeacher}
                        onClose={() => setIsModalOpen(false)}
                    />
                )}
            </VisibleSection>
        </div>
    );
};

interface TeacherModalProps {
    teacher: Teacher | null;
    currentStatus: 'Paid' | 'Unpaid';
    onSave: (teacher: Teacher, status: 'Paid' | 'Unpaid') => void;
    onClose: () => void;
}

const TeacherModal: React.FC<TeacherModalProps> = ({ teacher, currentStatus, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<Teacher>>(teacher || { name: '', email: '', whatsapp: '', salary: 0, profilePicture: 'https://i.pravatar.cc/150', dobYear: '', dob: '' });
    const [status, setStatus] = useState<'Paid' | 'Unpaid'>(currentStatus);

    useEffect(() => {
        setFormData(teacher || { name: '', email: '', whatsapp: '', salary: 0, profilePicture: 'https://i.pravatar.cc/150', dobYear: '', dob: '' });
        setStatus(currentStatus);
    }, [teacher, currentStatus]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value; // YYYY-MM-DD
        const yr = v?.slice(0, 4) || '';
        setFormData(prev => ({ ...prev, dob: v, dobYear: yr }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Teacher, status);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 transition-opacity" aria-modal="true" role="dialog">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{teacher ? 'Edit Teacher' : 'Add New Teacher'}</h3>
                            <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Full Name</label>
                                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Email Address</label>
                                <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                             <div>
                                <label htmlFor="whatsapp" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">WhatsApp Number</label>
                                <input type="text" name="whatsapp" id="whatsapp" value={formData.whatsapp} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="salary" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Salary</label>
                                <input type="number" name="salary" id="salary" value={formData.salary} onChange={handleChange} min="0" className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="dob" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Date of Birth</label>
                                <input type="date" name="dob" id="dob" value={(formData as any).dob || ''} onChange={handleDobChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                                <p className="mt-1 text-xs text-muted-foreground dark:text-dark-muted-foreground">Year auto-fills for ID formatting.</p>
                            </div>
                            <div>
                                <label htmlFor="salaryStatus" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Salary Status</label>
                                <select id="salaryStatus" value={status} onChange={e => setStatus(e.target.value as 'Paid' | 'Unpaid')} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2">
                                    <option value="Paid">Paid</option>
                                    <option value="Unpaid">Unpaid</option>
                                </select>
                            </div>
                             {!teacher && (
                                <div>
                                    <label htmlFor="password"
                                           className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Password</label>
                                    <input type="password" name="password" id="password" required
                                           className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2"/>
                                    <p className="mt-1 text-xs text-muted-foreground dark:text-dark-muted-foreground">User will be prompted to change this on first login.</p>
                                </div>
                            )}
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

export default Teachers;