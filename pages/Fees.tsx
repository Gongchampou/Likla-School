import React, { useState, useMemo, useEffect, useRef } from 'react';
import { downloadTableAsPdf } from '../utils/pdf';
import { Role, Student, Class, Fee, FeaturePermissions } from '../types';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, FileDownIcon, WalletIcon } from '../components/icons';

// --- MOCK DATA ---
const mockClasses: Class[] = [
    { id: 'class-10a', name: 'Class 10-A', teacherId: 'teacher-1', studentIds: ['student-1', 'student-4'] },
    { id: 'class-10b', name: 'Class 10-B', teacherId: 'teacher-2', studentIds: ['student-2'] },
    { id: 'class-9a', name: 'Class 9-A', teacherId: 'teacher-1', studentIds: ['student-3'] },
    { id: 'class-9b', name: 'Class 9-B', teacherId: 'teacher-2', studentIds: [] },
];

const initialStudents: Student[] = [
    { id: 'student-1', name: 'Alice Johnson', email: 'alice.j@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [
        {id: 'fee-1a', studentId: 'student-1', title: 'Monthly Tuition - Oct', amount: 500, status: 'Paid', dueDate: '2023-10-15'},
        {id: 'fee-1b', studentId: 'student-1', title: 'Exam Fee', amount: 50, status: 'Paid', dueDate: '2023-10-10'}
    ], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=alice.j@likla.edu' },
    { id: 'student-2', name: 'Bob Williams', email: 'bob.w@likla.edu', role: Role.STUDENT, classId: 'class-10b', attendance: {}, fees: [
        {id: 'fee-2a', studentId: 'student-2', title: 'Monthly Tuition - Oct', amount: 500, status: 'Unpaid', dueDate: '2023-10-15'},
        {id: 'fee-2b', studentId: 'student-2', title: 'Library Fine', amount: 10, status: 'Unpaid', dueDate: '2023-10-05'}
    ], discount: 10, profilePicture: 'https://i.pravatar.cc/150?u=bob.w@likla.edu' },
    { id: 'student-3', name: 'Charlie Brown', email: 'charlie.b@likla.edu', role: Role.STUDENT, classId: 'class-9a', attendance: {}, fees: [
        {id: 'fee-3a', studentId: 'student-3', title: 'Monthly Tuition - Oct', amount: 450, status: 'Paid', dueDate: '2023-10-15'}
    ], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=charlie.b@likla.edu' },
    { id: 'student-4', name: 'Diana Miller', email: 'diana.m@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [
        {id: 'fee-4a', studentId: 'student-4', title: 'Monthly Tuition - Sep', amount: 500, status: 'Paid', dueDate: '2023-09-15'},
        {id: 'fee-4b', studentId: 'student-4', title: 'Monthly Tuition - Oct', amount: 500, status: 'Unpaid', dueDate: '2023-10-15'}
    ], discount: 5, profilePicture: 'https://i.pravatar.cc/150?u=diana.m@likla.edu' },
];
// --- END MOCK DATA ---

type FeeStatus = 'Paid' | 'Unpaid' | 'Partially Paid';
const getOverallFeeStatus = (fees: Fee[]): FeeStatus => {
    if (!fees || fees.length === 0) return 'Paid';
    const unpaidFees = fees.filter(f => f.status === 'Unpaid');
    if (unpaidFees.length === 0) return 'Paid';
    if (unpaidFees.length === fees.length) return 'Unpaid';
    return 'Partially Paid';
};

const FeeStatusBadge: React.FC<{ status: FeeStatus }> = ({ status }) => {
    const statusColors: { [key in FeeStatus]: string } = {
        Paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        Unpaid: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        'Partially Paid': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status]}`}>{status}</span>;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

interface FeesProps { permissions?: Partial<FeaturePermissions>; }

const Fees: React.FC<FeesProps> = ({ permissions = {} }) => {
    const [students, setStudents] = useState<Student[]>(initialStudents);
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState<string>('All');
    const [isFeesModalOpen, setIsFeesModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement | null>(null);

    const filteredStudents = useMemo(() => {
        return students
            .filter(student => classFilter === 'All' || student.classId === classFilter)
            .filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [students, searchTerm, classFilter]);

    const handleManageFees = (student: Student) => {
        setSelectedStudent(student);
        setIsFeesModalOpen(true);
    };

    const handleSaveStudentFees = (updatedStudent: Student) => {
        if (!permissions.edit) return;
        setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    };

    const calculateTotalDue = (student: Student): number => {
        const totalUnpaid = student.fees.reduce((acc, fee) => fee.status === 'Unpaid' ? acc + fee.amount : acc, 0);
        const discountAmount = totalUnpaid * (student.discount / 100);
        return totalUnpaid - discountAmount;
    };
    
    const handleExportFeesByStatus = async (statusFilter: 'All' | 'Paid' | 'Unpaid') => {
        // Build a temporary container with only the filtered rows
        const tempId = `fees-bulk-${statusFilter}-${Date.now()}`;
        const container = document.createElement('div');
        container.id = tempId;
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';

        const rows = filteredStudents.filter(s => {
            const st = getOverallFeeStatus(s.fees);
            if (statusFilter === 'All') return true;
            return st === statusFilter;
        });

        const title = `Fee Management - ${statusFilter}`;
        let bodyRows = '';
        rows.forEach(student => {
            const className = mockClasses.find(c => c.id === student.classId)?.name || 'N/A';
            const status = getOverallFeeStatus(student.fees);
            const totalDue = String(calculateTotalDue(student));
            const discount = `${student.discount}%`;
            bodyRows += `
              <tr>
                <td data-export="${student.name} (${student.email})">${student.name}</td>
                <td data-export="${className}">${className}</td>
                <td data-export="${status}">${status}</td>
                <td data-export="${totalDue}">${totalDue}</td>
                <td data-export="${discount}">${discount}</td>
              </tr>`;
        });

        container.innerHTML = `
          <div>
            <h2>${title}</h2>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Total Due</th>
                  <th>Discount</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
            </table>
          </div>`;

        document.body.appendChild(container);
        try {
            await downloadTableAsPdf(tempId, `Fees-${statusFilter}.pdf`);
        } finally {
            document.body.removeChild(container);
        }
    };

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!exportRef.current) return;
            if (!exportRef.current.contains(e.target as Node)) {
                setIsExportOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);
    
    const handleExportStudentFees = async (student: Student) => {
        const tempId = `fees-single-${student.id}-${Date.now()}`;
        const container = document.createElement('div');
        container.id = tempId;
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        // Build a minimal, clean table matching main columns for text-based export
        const className = mockClasses.find(c => c.id === student.classId)?.name || 'N/A';
        const status = getOverallFeeStatus(student.fees);
        const totalDue = String(calculateTotalDue(student));
        const discount = `${student.discount}%`;
        container.innerHTML = `
          <div>
            <h2>Fee Details - ${student.name}</h2>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Total Due</th>
                  <th>Discount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-export="${student.name} (${student.email})">${student.name}</td>
                  <td data-export="${className}">${className}</td>
                  <td data-export="${status}">${status}</td>
                  <td data-export="${totalDue}">${totalDue}</td>
                  <td data-export="${discount}">${discount}</td>
                </tr>
              </tbody>
            </table>
          </div>`;
        document.body.appendChild(container);
        try {
            await downloadTableAsPdf(tempId, `${student.name}-Fees.pdf`);
        } finally {
            document.body.removeChild(container);
        }
    };
    
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Management</h2>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none relative" ref={exportRef}>
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
                        <div className="absolute right-0 mt-2 w-44 rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card shadow-lg ring-1 ring-black/5 focus:outline-none z-10">
                            <div className="py-1">
                                <button onClick={() => { handleExportFeesByStatus('All'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export All</button>
                                <button onClick={() => { handleExportFeesByStatus('Paid'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export Paid</button>
                                <button onClick={() => { handleExportFeesByStatus('Unpaid'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export Unpaid</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input type="text" placeholder="Search by student name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="All">All Classes</option>
                    {mockClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div id="feesTableContainer" className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Student</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Class</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Total Due</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Discount</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={`${student.name} (${student.email})`}><div className="flex items-center"><div className="flex-shrink-0 h-10 w-10"><img className="h-10 w-10 rounded-full object-cover" src={student.profilePicture} alt="" /></div><div className="ml-4"><div className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</div><div className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{student.email}</div></div></div></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={mockClasses.find(c => c.id === student.classId)?.name || 'N/A'}>{mockClasses.find(c => c.id === student.classId)?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap" data-export={getOverallFeeStatus(student.fees)}><FeeStatusBadge status={getOverallFeeStatus(student.fees)} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-gray-200" data-export={String(calculateTotalDue(student))}>{formatCurrency(calculateTotalDue(student))}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={`${student.discount}%`}>{student.discount}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleExportStudentFees(student)}
                                                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent"
                                                title="Export this student's fees as PDF"
                                            >
                                                <FileDownIcon className="w-5 h-5" />
                                                Export
                                            </button>
                                            {permissions.edit && (
                                                <button onClick={() => handleManageFees(student)} className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-primary/20 dark:bg-primary-dark/20 dark:text-white dark:hover:bg-primary-dark/30">
                                                    <WalletIcon className="w-5 h-5"/> Manage Fees
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredStudents.length === 0 && (
                <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No students found.</div>
            )}

            {isFeesModalOpen && selectedStudent && (
                <StudentFeesModal
                    student={selectedStudent}
                    onSave={handleSaveStudentFees}
                    onClose={() => setIsFeesModalOpen(false)}
                    permissions={permissions}
                />
            )}
        </div>
    );
};
// --- MODAL COMPONENTS ---

interface StudentFeesModalProps { student: Student; onSave: (student: Student) => void; onClose: () => void; permissions?: Partial<FeaturePermissions>; }
const StudentFeesModal: React.FC<StudentFeesModalProps> = ({ student: initialStudent, onSave, onClose, permissions = {} }) => {
    const [student, setStudent] = useState<Student>(initialStudent);
    const [isEditFeeModalOpen, setIsEditFeeModalOpen] = useState(false);
    const [editingFee, setEditingFee] = useState<Fee | null>(null);

    const handleAddNewFee = () => {
        if (!permissions.create) return;
        setEditingFee(null);
        setIsEditFeeModalOpen(true);
    };

    const handleEditFee = (fee: Fee) => {
        if (!permissions.edit) return;
        setEditingFee(fee);
        setIsEditFeeModalOpen(true);
    };

    const handleDeleteFee = (feeId: string) => {
        if (!permissions.delete) return;
        if(window.confirm('Are you sure you want to delete this fee entry?')) {
            setStudent(prev => ({ ...prev, fees: prev.fees.filter(f => f.id !== feeId) }));
        }
    };
    
    const handleSaveFee = (fee: Fee) => {
        if (editingFee) { // Editing
            if (!permissions.edit) return;
            setStudent(prev => ({...prev, fees: prev.fees.map(f => f.id === fee.id ? fee : f)}));
        } else { // Adding
            if (!permissions.create) return;
            const newFee = {...fee, id: `fee-${Date.now()}`, studentId: student.id };
            setStudent(prev => ({...prev, fees: [...prev.fees, newFee]}));
        }
        setIsEditFeeModalOpen(false);
    };
    
    const handleSaveChanges = () => {
        if (!permissions.edit) return;
        onSave(student);
        onClose();
    };

    const { total, paid, balance, discountAmount } = useMemo(() => {
        const total = student.fees.reduce((acc, f) => acc + f.amount, 0);
        const paid = student.fees.reduce((acc, f) => f.status === 'Paid' ? acc + f.amount : acc, 0);
        const discountAmount = (total - paid) * (student.discount / 100);
        const balance = total - paid - discountAmount;
        return { total, paid, balance, discountAmount };
    }, [student]);

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-border dark:border-dark-border">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Manage Fees for {student.name}</h3>
                            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Class: {mockClasses.find(c => c.id === student.classId)?.name || 'N/A'} | Discount: {student.discount}%</p>
                        </div>
                        <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent"><XIcon className="w-6 h-6" /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex justify-end mb-4">
                        {permissions.create && (
                            <button onClick={handleAddNewFee} className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark"><PlusIcon className="-ml-1 mr-2 h-5 w-5" /> Add Fee Entry</button>
                        )}
                    </div>
                    <div className="border border-border dark:border-dark-border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                            <thead className="bg-muted dark:bg-dark-muted">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase">Title</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase">Amount</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase">Due Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase">Status</th>
                                    <th className="relative px-4 py-2"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border dark:divide-dark-border">
                                {student.fees.map(fee => (
                                    <tr key={fee.id}>
                                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{fee.title}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatCurrency(fee.amount)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{new Date(fee.dueDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-3"><FeeStatusBadge status={fee.status} /></td>
                                        <td className="px-4 py-3 text-right">
                                            {permissions.edit && (
                                                <button onClick={() => handleEditFee(fee)} className="p-1 text-primary hover:text-primary-dark"><EditIcon className="w-5 h-5"/></button>
                                            )}
                                            {permissions.delete && (
                                                <button onClick={() => handleDeleteFee(fee.id)} className="p-1 text-red-600 hover:text-red-800"><DeleteIcon className="w-5 h-5"/></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {student.fees.length === 0 && (<tr><td colSpan={5} className="text-center py-5 text-muted-foreground">No fee records found.</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-6 bg-muted dark:bg-dark-muted border-t border-border dark:border-dark-border space-y-2 text-right">
                    <p><strong>Total:</strong> {formatCurrency(total)}</p>
                    <p><strong>Paid:</strong> {formatCurrency(paid)}</p>
                    <p className="text-sm text-green-600"><strong>Discount Applied:</strong> -{formatCurrency(discountAmount)}</p>
                    <p className="text-lg font-bold"><strong>Balance Due:</strong> {formatCurrency(balance)}</p>
                </div>
                <div className="bg-card dark:bg-dark-card px-6 py-4 flex justify-end gap-3 border-t border-border dark:border-dark-border">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
                    <button type="button" onClick={handleSaveChanges} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark">Save Changes</button>
                </div>
            </div>
            {isEditFeeModalOpen && <FeeEditModal fee={editingFee} onSave={handleSaveFee} onClose={() => setIsEditFeeModalOpen(false)} />}
        </div>
    );
};


interface FeeEditModalProps { fee: Fee | null; onSave: (fee: Fee) => void; onClose: () => void; }
const FeeEditModal: React.FC<FeeEditModalProps> = ({ fee, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<Fee>>(fee || { title: '', amount: 0, status: 'Unpaid', dueDate: new Date().toISOString().split('T')[0] });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Fee);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-medium">{fee ? 'Edit Fee' : 'Add Fee'}</h3><button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-accent dark:hover:bg-dark-accent"><XIcon /></button></div>
                        <div className="space-y-4">
                            <div><label className="text-sm">Title</label><input name="title" value={formData.title} onChange={handleChange} required className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md border-border dark:border-dark-border"/></div>
                            <div><label className="text-sm">Amount</label><input type="number" name="amount" value={formData.amount} onChange={handleChange} required min="0" className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md border-border dark:border-dark-border"/></div>
                            <div><label className="text-sm">Due Date</label><input type="date" name="dueDate" value={formData.dueDate ? new Date(formData.dueDate).toISOString().split('T')[0] : ''} onChange={handleChange} required className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md border-border dark:border-dark-border"/></div>
                            <div><label className="text-sm">Status</label><select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md border-border dark:border-dark-border"><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option></select></div>
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-3 flex justify-end gap-3"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-md">Save</button></div>
                </form>
            </div>
        </div>
    );
};

export default Fees;