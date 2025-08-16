import React, { useState, useMemo, useEffect } from 'react';
import { Role, Assignment, Class, Teacher, Student, Attachment, FeaturePermissions, User } from '../types';
import { uploadAssignmentAttachment, deleteByPath } from '../utils/storage';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, FileDownIcon, EyeIcon, WhatsAppIcon } from '../components/icons';
import { downloadTableAsPdf } from '../utils/pdf';
import VisibleSection from '../components/VisibleSection';

// --- MOCK DATA ---
const mockTeachers: Teacher[] = [
    { id: 'teacher-1', name: 'John Doe', email: 'john.d@likla.edu', role: Role.TEACHER, whatsapp: '123-456-7890', salary: 50000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=john.d@likla.edu' },
    { id: 'teacher-2', name: 'Jane Smith', email: 'jane.s@likla.edu', role: Role.TEACHER, whatsapp: '098-765-4321', salary: 52000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=jane.s@likla.edu' },
];

const mockStudents: Student[] = [
    { id: 'student-1', name: 'Alice Johnson', email: 'alice.j@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=alice.j@likla.edu' },
    { id: 'student-2', name: 'Bob Williams', email: 'bob.w@likla.edu', role: Role.STUDENT, classId: 'class-10b', attendance: {}, fees: [], discount: 10, profilePicture: 'https://i.pravatar.cc/150?u=bob.w@likla.edu' },
    { id: 'student-4', name: 'Diana Miller', email: 'diana.m@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [], discount: 5, profilePicture: 'https://i.pravatar.cc/150?u=diana.m@likla.edu' },
];

const mockClasses: Class[] = [
    { id: 'class-10a', name: 'Class 10-A', teacherId: 'teacher-1', studentIds: ['student-1', 'student-4'] },
    { id: 'class-10b', name: 'Class 10-B', teacherId: 'teacher-2', studentIds: ['student-2'] },
];

const initialAssignments: Assignment[] = [
    { id: 'asg-1', title: 'Algebra Homework Chapter 5', classId: 'class-10a', teacherId: 'teacher-1', deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), description: 'Complete all odd-numbered questions from Chapter 5. Show all your work. Submission should be a single PDF file.', submissions: { 'student-1': true } },
    { id: 'asg-2', title: 'Essay on World War II', classId: 'class-10b', teacherId: 'teacher-2', deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), description: 'Write a 1000-word essay on the primary causes of World War II. Cite at least 3 academic sources.', submissions: {} },
    { id: 'asg-3', title: 'Physics Lab Report', classId: 'class-10a', teacherId: 'teacher-1', deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), description: 'Submit the lab report for the "Laws of Motion" experiment conducted last week.', submissions: { 'student-1': true, 'student-4': true } },
];
// --- END MOCK DATA ---

const DeadlineStatusBadge: React.FC<{ deadline: string }> = ({ deadline }) => {
    const isPastDue = new Date(deadline) < new Date();
    const statusColors = isPastDue
        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors}`}>{isPastDue ? 'Past Due' : 'Active'}</span>;
};

interface AssignmentsProps {
    permissions?: Partial<FeaturePermissions>;
    currentUser?: User | Student | Teacher;
}

const Assignments: React.FC<AssignmentsProps> = ({ permissions, currentUser }) => {
    const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState<string>('All');
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const currentUserRole = currentUser?.role;
    const role = (currentUser?.role as any) || ((): any => { try { return (JSON.parse(localStorage.getItem('currentUser') || '{}') || {}).role; } catch { return undefined; } })();

    // Derive capabilities from Control Limit
    const canCreate = !!permissions?.create || false;
    const canEdit = !!permissions?.edit || false;
    const canDelete = !!permissions?.delete || false;

    const filteredAssignments = useMemo(() => {
        let base = assignments;
        if (currentUserRole === Role.TEACHER) {
            base = base.filter(a => a.teacherId === currentUser?.id);
        } else if (currentUserRole === Role.STUDENT) {
            const cu = currentUser as Student;
            base = base.filter(a => a.classId === cu.classId);
        }
        return base
            .filter(a => classFilter === 'All' || a.classId === classFilter)
            .filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [assignments, searchTerm, classFilter, currentUserRole, currentUser]);

    const handleAddNew = () => {
        if (!canCreate) return;
        setSelectedAssignment(null);
        setEditModalOpen(true);
    };

    const handleEdit = (assignment: Assignment) => {
        if (!canEdit) return;
        setSelectedAssignment(assignment);
        setEditModalOpen(true);
    };

    const handleViewDetails = (assignment: Assignment) => {
        setSelectedAssignment(assignment);
        setDetailModalOpen(true);
    };

    const handleDelete = async (assignmentId: string) => {
        if (!canDelete) return;
        if (window.confirm('Are you sure you want to delete this assignment?')) {
            // Cleanup storage for attachments
            try {
                const target = assignments.find(a => a.id === assignmentId);
                if (target?.attachments?.length) {
                    await Promise.all(
                        target.attachments.map(att => att.path ? deleteByPath(att.path).catch(() => {}) : Promise.resolve())
                    );
                }
            } finally {
                setAssignments(prev => prev.filter(a => a.id !== assignmentId));
            }
        }
    };

    const handleSave = (assignmentData: Assignment) => {
        if (assignmentData.id) {
            if (!canEdit) return;
            // Editing existing by id
            setAssignments(prev => prev.map(a => a.id === assignmentData.id ? { ...a, ...assignmentData } : a));
        } else {
            if (!canCreate) return;
            // Adding new
            setAssignments(prev => [...prev, { ...assignmentData, id: `asg-${Date.now()}`, submissions: {} }]);
        }
        setEditModalOpen(false);
    };

    const handleSubmission = (assignmentId: string) => {
        if (currentUserRole !== Role.STUDENT) return;
        const cu = currentUser as Student;
        setAssignments(prev => prev.map(a => {
            if (a.id === assignmentId) {
                const newSubmissions = { ...a.submissions, [cu.id]: true };
                return { ...a, submissions: newSubmissions };
            }
            return a;
        }));
        alert('Assignment submitted successfully!');
        setDetailModalOpen(false);
    };

    const getSubmissionStatus = (assignment: Assignment) => {
        const totalStudents = mockClasses.find(c => c.id === assignment.classId)?.studentIds.length || 0;
        const submittedCount = Object.keys(assignment.submissions).length;
        return `${submittedCount}/${totalStudents}`;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8" id="print-assignments">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Assignments</h2>
                    {currentUserRole && (
                        <div className="mt-2 text-sm text-muted-foreground dark:text-dark-muted-foreground">Viewing as: {currentUserRole}</div>
                    )}
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2 no-print">
                    <VisibleSection role={role} sectionKey="assignments.create" storageKey="assignmentsControls">
                        {canCreate && (
                            <button type="button" onClick={handleAddNew} className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                                Add Assignment
                            </button>
                        )}
                    </VisibleSection>
                    <VisibleSection role={role} sectionKey="assignments.export" storageKey="assignmentsControls">
                        <button type="button" onClick={() => downloadTableAsPdf('print-assignments', 'Assignments.pdf')} className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                            <FileDownIcon className="-ml-1 mr-2 h-5 w-5" /> Export PDF
                        </button>
                    </VisibleSection>
                </div>
            </div>

            <div className="mb-4 flex flex-col md:flex-row gap-4 no-print">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input type="text" placeholder="Search by title..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <VisibleSection role={role} sectionKey="assignments.filters" storageKey="assignmentsControls">
                    {currentUserRole !== Role.TEACHER && currentUserRole !== Role.STUDENT && (
                        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                            <option value="All">All Classes</option>
                            {mockClasses.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                    )}
                </VisibleSection>
            </div>

            <VisibleSection role={role} sectionKey="assignments.list" storageKey="assignmentsControls">
            <div className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Title</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Class</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Deadline</th>
                                {currentUserRole !== Role.STUDENT && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Submissions</th>}
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {filteredAssignments.map((assignment) => (
                                <tr key={assignment.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white" data-export={assignment.title}>{assignment.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={mockClasses.find(c => c.id === assignment.classId)?.name || 'N/A'}>{mockClasses.find(c => c.id === assignment.classId)?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground" data-export={new Date(assignment.deadline).toLocaleDateString()}>
                                        <div className="flex flex-col">
                                            <span>{new Date(assignment.deadline).toLocaleDateString()}</span>
                                            <DeadlineStatusBadge deadline={assignment.deadline} />
                                        </div>
                                    </td>
                                    {currentUserRole !== Role.STUDENT && <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">{getSubmissionStatus(assignment)}</td>}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2 no-print">
                                            <VisibleSection role={role} sectionKey="assignments.actions" storageKey="assignmentsControls">
                                                <button onClick={() => handleViewDetails(assignment)} className="text-blue-600 hover:text-blue-800 p-1" title="View Details"><EyeIcon className="w-5 h-5"/></button>
                                                {canEdit && <button onClick={() => handleEdit(assignment)} className="text-primary hover:text-primary-dark p-1" title="Edit"><EditIcon className="w-5 h-5"/></button>}
                                                {canDelete && <button onClick={() => handleDelete(assignment.id)} className="text-red-600 hover:text-red-800 p-1" title="Delete"><DeleteIcon className="w-5 h-5"/></button>}
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
            {filteredAssignments.length === 0 && <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No assignments found.</div>}
            
            <VisibleSection role={role} sectionKey="assignments.modal.edit" storageKey="assignmentsControls">
                {isEditModalOpen && <AssignmentEditModal assignment={selectedAssignment} onSave={handleSave} onClose={() => setEditModalOpen(false)} classes={mockClasses} />}
            </VisibleSection>
            <VisibleSection role={role} sectionKey="assignments.modal.detail" storageKey="assignmentsControls">
                {isDetailModalOpen && selectedAssignment && <AssignmentDetailModal assignment={selectedAssignment} onClose={() => setDetailModalOpen(false)} onSumbit={handleSubmission} currentUserRole={currentUserRole} currentUser={currentUser} />}
            </VisibleSection>
        </div>
    );
};

// --- MODAL COMPONENTS ---

interface AssignmentEditModalProps { assignment: Assignment | null; onSave: (data: Assignment) => void; onClose: () => void; classes: Class[]; }
const AssignmentEditModal: React.FC<AssignmentEditModalProps> = ({ assignment, onSave, onClose, classes }) => {
    const [formData, setFormData] = useState({ title: '', description: '', classId: classes[0]?.id || '', deadline: '' });
    const [attachments, setAttachments] = useState<Attachment[]>(assignment?.attachments || []);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (assignment) {
            setFormData({ title: assignment.title, description: assignment.description, classId: assignment.classId, deadline: assignment.deadline.split('T')[0] });
            setAttachments(assignment.attachments || []);
        } else {
            setAttachments([]);
        }
    }, [assignment]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        setUploading(true);
        try {
            const ownerId = 'teacher-1';
            const uploads = Array.from(files).map(async (file) => {
                const { url, path } = await uploadAssignmentAttachment(file, ownerId);
                const name = file.name;
                return { name, url, path } as Attachment;
            });
            const newAtts = await Promise.all(uploads);
            setAttachments(prev => [...prev, ...newAtts]);
        } catch (err) {
            console.error('Attachment upload failed', err);
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const removeAttachment = async (name: string) => {
        const target = attachments.find(a => a.name === name);
        if (target?.path) {
            try { await deleteByPath(target.path); } catch {}
        }
        setAttachments(prev => prev.filter(a => a.name !== name));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...assignment, ...formData, teacherId: 'teacher-1', attachments } as Assignment);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-medium">{assignment ? 'Edit' : 'Add'} Assignment</h3><button type="button" onClick={onClose}><XIcon /></button></div>
                        <div className="space-y-4">
                            <div><label>Title</label><input name="title" value={formData.title} onChange={handleChange} required className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md"/></div>
                            <div><label>Description</label><textarea name="description" value={formData.description} onChange={handleChange} required rows={4} className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md"/></div>
                            <div><label>Class</label><select name="classId" value={formData.classId} onChange={handleChange} className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div><label>Deadline</label><input type="date" name="deadline" value={formData.deadline} onChange={handleChange} required className="w-full mt-1 p-2 bg-muted dark:bg-dark-muted rounded-md"/></div>
                            <div>
                                <label className="block">Attachments (any file)</label>
                                <input type="file" multiple onChange={onFilesSelected} className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                                {uploading && <div className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">Uploading…</div>}
                                {attachments.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-sm">
                                        {attachments.map(att => (
                                            <li key={att.url} className="flex items-center justify-between bg-muted dark:bg-dark-muted rounded px-2 py-1">
                                                <a href={att.url} download={att.name} target="_blank" rel="noopener" className="text-primary hover:underline truncate" title={att.name}>{att.name}</a>
                                                <button type="button" onClick={() => removeAttachment(att.name)} className="text-red-600 hover:text-red-800 text-xs">Remove</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-3 flex justify-end gap-3"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-md">Save</button></div>
                </form>
            </div>
        </div>
    );
};

interface AssignmentDetailModalProps { assignment: Assignment; onClose: () => void; onSumbit: (id: string) => void; currentUserRole?: Role; currentUser?: User | Student | Teacher; }
const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({ assignment, onClose, onSumbit, currentUserRole, currentUser }) => {
    const teacher = mockTeachers.find(t => t.id === assignment.teacherId);
    const hasSubmitted = currentUserRole === Role.STUDENT && currentUser ? !!assignment.submissions[currentUser.id] : false;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                 <div className="p-6 flex items-center justify-between border-b border-border dark:border-dark-border">
                    <h3 className="text-lg font-medium">{assignment.title}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-accent dark:hover:bg-dark-accent"><XIcon /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <p className="text-muted-foreground dark:text-dark-muted-foreground whitespace-pre-wrap">{assignment.description}</p>
                    <hr className="border-border dark:border-dark-border"/>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><strong>Class:</strong> {mockClasses.find(c => c.id === assignment.classId)?.name}</div>
                        <div><strong>Deadline:</strong> {new Date(assignment.deadline).toLocaleString()}</div>
                        {teacher && <>
                            <div><strong>Teacher:</strong> {teacher.name}</div>
                            <div><strong>Email:</strong> <a href={`mailto:${teacher.email}`} className="text-primary">{teacher.email}</a></div>
                            <div><strong>Contact:</strong> <span className="flex items-center gap-1"><WhatsAppIcon className="text-green-500"/> {teacher.whatsapp}</span></div>
                        </>}
                    </div>
                    {assignment.attachments && assignment.attachments.length > 0 && (
                        <div className="pt-2">
                            <h4 className="font-semibold mb-2">Attachments</h4>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                {assignment.attachments.map(att => (
                                    <li key={att.url}>
                                        <a href={att.url} download={att.name} target="_blank" rel="noopener" className="text-primary hover:underline">{att.name}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {currentUserRole === Role.STUDENT && (
                        <div className="pt-4 border-t border-border dark:border-dark-border">
                            <h4 className="font-semibold mb-2">Submit Your Work</h4>
                            {hasSubmitted ? (
                                <p className="text-green-600 font-semibold">You have already submitted this assignment.</p>
                            ) : (
                                <div>
                                    <input type="file" className="mb-4 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                                    <button onClick={() => onSumbit(assignment.id)} className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">Submit Assignment</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="bg-muted dark:bg-dark-muted px-6 py-3 flex justify-end mt-auto">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Close</button>
                </div>
            </div>
        </div>
    );
};

export default Assignments;
