import React, { useState, useMemo, useEffect } from 'react';
import { downloadTableAsPdf } from '../utils/pdf';
import { Role, Student, Class, Fee, FeaturePermissions, User } from '../types';
import { formatDisplayId } from '../utils/id';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, FileDownIcon } from '../components/icons';
import VisibleSection from '../components/VisibleSection';

// Mock Data
const mockClasses: Class[] = [
    { id: 'class-10a', name: 'Class 10-A', teacherId: 'teacher-1', studentIds: ['student-1'] },
    { id: 'class-10b', name: 'Class 10-B', teacherId: 'teacher-2', studentIds: ['student-2'] },
    { id: 'class-9a', name: 'Class 9-A', teacherId: 'teacher-1', studentIds: ['student-3'] },
    { id: 'class-9b', name: 'Class 9-B', teacherId: 'teacher-2', studentIds: [] },
];

const initialStudents: Student[] = [
    { id: 'student-1', name: 'Alice Johnson', email: 'alice.j@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [{id: 'fee-1', studentId: 'student-1', title: 'Monthly Tuition - Oct', amount: 500, status: 'Paid', dueDate: '2023-10-15'}], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=alice.j@likla.edu' },
    { id: 'student-2', name: 'Bob Williams', email: 'bob.w@likla.edu', role: Role.STUDENT, classId: 'class-10b', attendance: {}, fees: [{id: 'fee-2', studentId: 'student-2', title: 'Monthly Tuition - Oct', amount: 500, status: 'Unpaid', dueDate: '2023-10-15'}], discount: 10, profilePicture: 'https://i.pravatar.cc/150?u=bob.w@likla.edu' },
    { id: 'student-3', name: 'Charlie Brown', email: 'charlie.b@likla.edu', role: Role.STUDENT, classId: 'class-9a', attendance: {}, fees: [{id: 'fee-3', studentId: 'student-3', title: 'Monthly Tuition - Oct', amount: 500, status: 'Paid', dueDate: '2023-10-15'}], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=charlie.b@likla.edu' },
    { id: 'student-4', name: 'Diana Miller', email: 'diana.m@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [{id: 'fee-4', studentId: 'student-4', title: 'Monthly Tuition - Oct', amount: 500, status: 'Unpaid', dueDate: '2023-10-15'}], discount: 5, profilePicture: 'https://i.pravatar.cc/150?u=diana.m@likla.edu' },
];

const getFeeStatus = (fees: Fee[]): 'Paid' | 'Unpaid' => {
    if (fees.length === 0) return 'Paid'; // Or maybe 'N/A'
    return fees.every(f => f.status === 'Paid') ? 'Paid' : 'Unpaid';
};

const FeeStatusBadge = ({ status }: { status: 'Paid' | 'Unpaid' }) => {
    const statusColors = {
        Paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        Unpaid: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status]}`}>
            {status}
        </span>
    );
};


interface StudentsProps {
    permissions?: Partial<FeaturePermissions>;
    currentUser?: User | Student;
}

const Students: React.FC<StudentsProps> = ({ permissions = {}, currentUser }) => {
    const [students, setStudents] = useState<Student[]>(initialStudents);
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState<string>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const role = (currentUser?.role as any) || ((): any => { try { return (JSON.parse(localStorage.getItem('currentUser') || '{}') || {}).role; } catch { return undefined; } })();

    const filteredStudents = useMemo(() => {
        let base = students;
        // Role-based scoping
        if (currentUser?.role === Role.TEACHER) {
            const teacherClasses = mockClasses.filter(c => c.teacherId === currentUser.id).map(c => c.id);
            base = base.filter(s => teacherClasses.includes(s.classId));
        } else if (currentUser?.role === Role.STUDENT) {
            base = base.filter(s => s.id === currentUser.id);
        }
        return base
            .filter(student => classFilter === 'All' || student.classId === classFilter)
            .filter(student =>
                student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [students, searchTerm, classFilter, currentUser]);

    const handleAddNewStudent = () => {
        if (!permissions.create) return;
        setEditingStudent(null);
        setIsModalOpen(true);
    };

    const handleEditStudent = (student: Student) => {
        if (!permissions.edit) return;
        setEditingStudent(student);
        setIsModalOpen(true);
    };
    
    const handleDeleteStudent = (studentId: string) => {
        if (!permissions.delete) return;
        if(window.confirm('Are you sure you want to delete this student?')) {
            setStudents(students.filter(student => student.id !== studentId));
        }
    };

    const getSchoolName = () => {
        try {
            const saved = localStorage.getItem('schoolSettings');
            if (saved) return (JSON.parse(saved) || {}).schoolName || 'LIKLA SCHOOL';
        } catch {}
        return 'LIKLA SCHOOL';
    };

    const handleSaveStudent = (studentData: Student) => {
        if (editingStudent) {
            if (!permissions.edit) return;
            setStudents(students.map(s => s.id === studentData.id ? studentData : s));
        } else {
            if (!permissions.create) return;
            const newId = `student-${Date.now()}`;
            const schoolName = getSchoolName();
            const displayId = formatDisplayId({ user: { ...(studentData as any), id: newId, role: Role.STUDENT }, schoolName, dobYear: (studentData as any).dobYear });
            setStudents([...students, { ...studentData, id: newId, role: Role.STUDENT, fees: [], attendance: {}, displayId }]);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h2>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-2">
                    <VisibleSection role={role} sectionKey="students.export" storageKey="studentsControls">
                        <button
                            type="button"
                            onClick={() => downloadTableAsPdf('studentsTableContainer', 'Students.pdf')}
                            className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-accent dark:hover:bg-dark-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            <FileDownIcon className="-ml-1 mr-2 h-5 w-5" />
                            Export PDF
                        </button>
                    </VisibleSection>
                    <VisibleSection role={role} sectionKey="students.add" storageKey="studentsControls">
                        {permissions.create && (
                            <button
                                type="button"
                                onClick={handleAddNewStudent}
                                className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                                Add Student
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
                <VisibleSection role={role} sectionKey="students.filters" storageKey="studentsControls">
                    {currentUser?.role !== Role.TEACHER && currentUser?.role !== Role.STUDENT && (
                        <select
                            value={classFilter}
                            onChange={e => setClassFilter(e.target.value)}
                            className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                            <option value="All">All Classes</option>
                            {mockClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                </VisibleSection>
            </div>

            <VisibleSection role={role} sectionKey="students.list" storageKey="studentsControls">
            <div id="studentsTableContainer" className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Student</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Class</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Discount</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Fee Status</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={`${student.name} (${student.email})`}>
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <img className="h-10 w-10 rounded-full object-cover" src={student.profilePicture} alt={`${student.name}'s profile`} />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</div>
                                                <div className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{student.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={mockClasses.find(c => c.id === student.classId)?.name || 'N/A'}>
                                        {mockClasses.find(c => c.id === student.classId)?.name || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={`${student.discount}%`}>{student.discount}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={getFeeStatus(student.fees)}><FeeStatusBadge status={getFeeStatus(student.fees)} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <VisibleSection role={role} sectionKey="students.actions" storageKey="studentsControls">
                                                {permissions.edit && (
                                                    <button onClick={() => handleEditStudent(student)} className="text-primary hover:text-primary-dark p-1"><EditIcon className="w-5 h-5"/></button>
                                                )}
                                                {permissions.delete && (
                                                    <button onClick={() => handleDeleteStudent(student.id)} className="text-red-600 hover:text-red-800 p-1"><DeleteIcon className="w-5 h-5"/></button>
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
            {filteredStudents.length === 0 && (
                <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No students found.</div>
            )}
            
            <VisibleSection role={role} sectionKey="students.modal" storageKey="studentsControls">
                {isModalOpen && <StudentModal student={editingStudent} onSave={handleSaveStudent} onClose={() => setIsModalOpen(false)} classes={mockClasses}/>}
            </VisibleSection>
        </div>
    );
};

interface StudentModalProps {
    student: Student | null;
    onSave: (student: Student) => void;
    onClose: () => void;
    classes: Class[];
}

const StudentModal: React.FC<StudentModalProps> = ({ student, onSave, onClose, classes }) => {
    const [formData, setFormData] = useState<Partial<Student>>(student || { name: '', email: '', classId: classes[0]?.id || '', discount: 0, profilePicture: 'https://i.pravatar.cc/150', dobYear: '', dob: '' });

    useEffect(() => {
        setFormData(student || { name: '', email: '', classId: classes[0]?.id || '', discount: 0, profilePicture: 'https://i.pravatar.cc/150', dobYear: '', dob: '' });
    }, [student, classes]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        onSave(formData as Student);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 transition-opacity" aria-modal="true" role="dialog">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{student ? 'Edit Student' : 'Add New Student'}</h3>
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
                                <label htmlFor="classId" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Class</label>
                                <select id="classId" name="classId" value={formData.classId} onChange={handleChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2">
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="discount" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Discount (%)</label>
                                <input type="number" name="discount" id="discount" value={formData.discount} onChange={handleChange} min="0" max="100" className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="dob" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Date of Birth</label>
                                <input type="date" name="dob" id="dob" value={(formData as any).dob || ''} onChange={handleDobChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                                <p className="mt-1 text-xs text-muted-foreground dark:text-dark-muted-foreground">Year auto-fills for ID formatting.</p>
                            </div>
                             {!student && (
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

export default Students;