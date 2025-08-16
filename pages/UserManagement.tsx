import React, { useState, useMemo, useEffect } from 'react';
import { Role, AnyUser, FeaturePermissions } from '../types';
import { loadUsers, saveUsers, loadDeletedUsers, saveDeletedUsers, DeletedUserSnapshot } from '../utils/users';
import { loadClasses, saveClasses } from '../utils/classes';
import { loadAssignments, saveAssignments } from '../utils/assignments';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, BinIcon } from '../components/icons';
import { setUserPassword } from '../utils/auth';
import { uploadUserAvatar } from '../utils/storage';

// Users are loaded and saved via localStorage so all pages share the same data

const RoleBadge = ({ role }: { role: Role }) => {
    const roleColors: { [key in Role]: string } = {
        [Role.SUPER_ADMIN]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        [Role.ADMIN]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        [Role.TEACHER]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [Role.STUDENT]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        [Role.STAFF]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        [Role.LIBRARIAN]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        [Role.PARENT]: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    };
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleColors[role]}`}>
            {role}
        </span>
    );
};

interface UserManagementProps {
    permissions: Partial<FeaturePermissions>;
}

const UserManagement: React.FC<UserManagementProps> = ({ permissions = {} }) => {
    const [users, setUsers] = useState<AnyUser[]>([]);
    const [deletedUsers, setDeletedUsers] = useState<DeletedUserSnapshot[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AnyUser | null>(null);
    const [passwordUser, setPasswordUser] = useState<AnyUser | null>(null);
    const [showBin, setShowBin] = useState(false);
    const [binSearchTerm, setBinSearchTerm] = useState('');
    const [binRoleFilter, setBinRoleFilter] = useState<Role | 'All'>('All');

    const filteredActiveUsers = useMemo(() => {
        return users
            .filter(user => roleFilter === 'All' || user.role === roleFilter)
            .filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [users, searchTerm, roleFilter]);

    const filteredBinUsers = useMemo(() => {
        return deletedUsers
            .filter(snap => binRoleFilter === 'All' || snap.user.role === binRoleFilter)
            .filter(snap =>
                snap.user.name.toLowerCase().includes(binSearchTerm.toLowerCase()) ||
                snap.user.email.toLowerCase().includes(binSearchTerm.toLowerCase())
            );
    }, [deletedUsers, binSearchTerm, binRoleFilter]);

    const handleAddNewUser = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user: AnyUser) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };
    
    const handleDeleteUser = async (userId: string) => {
        if (!permissions.delete) return;
        const user = users.find(u => u.id === userId);
        if (!user) return;
        if(window.confirm('Move this user to Bin and remove related links? You can restore later.')) {
            // Capture originals for snapshot
            const classes = loadClasses();
            const assignments = loadAssignments();
            let affectedClasses = [] as typeof classes;
            let affectedAssignments = [] as typeof assignments;

            if (user.role === Role.STUDENT) {
                affectedClasses = classes.filter(c => c.studentIds.includes(user.id));
                affectedAssignments = assignments.filter(a => a.submissions && Object.prototype.hasOwnProperty.call(a.submissions, user.id));
                // mutate copies
                const updatedClasses = classes.map(c => c.studentIds.includes(user.id) ? { ...c, studentIds: c.studentIds.filter(id => id !== user.id) } : c);
                const updatedAssignments = assignments.map(a => {
                    if (a.submissions && Object.prototype.hasOwnProperty.call(a.submissions, user.id)) {
                        const { [user.id]: _, ...rest } = a.submissions;
                        return { ...a, submissions: rest };
                    }
                    return a;
                });
                saveClasses(updatedClasses);
                saveAssignments(updatedAssignments);
            } else if (user.role === Role.TEACHER) {
                affectedClasses = classes.filter(c => c.teacherId === user.id);
                affectedAssignments = assignments.filter(a => a.teacherId === user.id);
                const updatedClasses = classes.map(c => c.teacherId === user.id ? { ...c, teacherId: '' } : c);
                const updatedAssignments = assignments.map(a => a.teacherId === user.id ? { ...a, teacherId: '' } : a);
                saveClasses(updatedClasses);
                saveAssignments(updatedAssignments);
            } else {
                // Other roles: currently nothing to cascade, but keep empty arrays
            }

            const snapshot: DeletedUserSnapshot = {
                user,
                affectedClasses,
                affectedAssignments,
                deletedAt: new Date().toISOString(),
            };

            const nextUsers = users.filter(u => u.id !== userId);
            const nextBin = [snapshot, ...deletedUsers];
            setUsers(nextUsers);
            setDeletedUsers(nextBin);
            await saveUsers(nextUsers);
            await saveDeletedUsers(nextBin);
        }
    };

    const handleRestoreUser = async (userId: string) => {
        if (!permissions.delete) return;
        const snap = deletedUsers.find(s => s.user.id === userId);
        if (!snap) return;
        // Restore related entities first
        const classes = loadClasses();
        const assignments = loadAssignments();
        // Overwrite affected classes/assignments back to originals by id
        const restoredClasses = classes.map(c => {
            const orig = snap.affectedClasses.find(ac => ac.id === c.id);
            return orig ? orig : c;
        });
        const restoredAssignments = assignments.map(a => {
            const orig = snap.affectedAssignments.find(aa => aa.id === a.id);
            return orig ? orig : a;
        });
        saveClasses(restoredClasses);
        saveAssignments(restoredAssignments);

        const nextBin = deletedUsers.filter(s => s.user.id !== userId);
        const nextUsers = [snap.user, ...users];
        setDeletedUsers(nextBin);
        setUsers(nextUsers);
        await saveDeletedUsers(nextBin);
        await saveUsers(nextUsers);
    };

    const handlePermanentDelete = async (userId: string) => {
        if (!permissions.delete) return;
        if (window.confirm('Permanently delete this user from Bin? This cannot be undone.')) {
            const nextBin = deletedUsers.filter(s => s.user.id !== userId);
            setDeletedUsers(nextBin);
            await saveDeletedUsers(nextBin);
        }
    };

    const handleSaveUser = async (userData: AnyUser) => {
        if (editingUser) {
            const next = users.map(u => u.id === (userData.id || editingUser.id) ? { ...u, ...userData } as AnyUser : u);
            setUsers(next);
            await saveUsers(next);
        } else {
            const id = userData.id || `user-${Date.now()}`;
            const next = [...users, { ...userData, id } as AnyUser];
            setUsers(next);
            await saveUsers(next);
        }
        setIsModalOpen(false);
    };

    // Initial async load from Supabase for users and deleted snapshots
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setError(null);
                setLoading(true);
                const [u, bin] = await Promise.all([loadUsers(), loadDeletedUsers()]);
                if (!alive) return;
                setUsers(u);
                setDeletedUsers(bin);
            } catch (err) {
                console.error('Failed to load users/bin', err);
                if (alive) setError('Failed to load users from database. Check Supabase settings/RLS.');
            }
            finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {loading && (
                <div className="mb-4 text-sm text-muted-foreground dark:text-dark-muted-foreground">Loading users…</div>
            )}
            {error && (
                <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>
            )}
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-2">
                    {permissions.delete && (
                        <button
                            type="button"
                            onClick={() => setShowBin(v => !v)}
                            className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${showBin ? 'bg-red-600 text-white border-transparent' : 'bg-card dark:bg-dark-card border-border dark:border-dark-border text-gray-900 dark:text-white'}`}
                            title="Open Bin"
                        >
                            <BinIcon className="-ml-1 mr-2 h-5 w-5" />
                            {showBin ? 'Close Bin' : 'Open Bin'}
                            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted dark:bg-dark-muted px-2 py-0.5 text-xs">{deletedUsers.length}</span>
                        </button>
                    )}
                    {permissions.create && (
                        <button
                            type="button"
                            onClick={handleAddNewUser}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                            Add User
                        </button>
                    )}
                </div>
            </div>

            {!showBin && (
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
                <select
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value as Role | 'All')}
                    className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
                >
                    <option value="All">All Roles</option>
                    {Object.values(Role).map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
            </div>
            )}

            {showBin && (
            <div className="mb-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search deleted users..."
                        value={binSearchTerm}
                        onChange={e => setBinSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>
                <select
                    value={binRoleFilter}
                    onChange={e => setBinRoleFilter(e.target.value as Role | 'All')}
                    className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
                >
                    <option value="All">All Roles</option>
                    {Object.values(Role).map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
            </div>
            )}

            <div className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-muted dark:bg-dark-muted">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">User</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Role</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {(showBin ? filteredBinUsers : filteredActiveUsers).map((row) => {
                                const user = showBin ? row.user : row;
                                return (
                                <tr key={user.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <img className="h-10 w-10 rounded-full object-cover" src={user.profilePicture} alt={`${user.name}'s profile`} />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                <div className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">
                                        <RoleBadge role={user.role} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            {!showBin && (
                                                <>
                                                    {permissions.edit && (
                                                        <button onClick={() => handleEditUser(user)} className="text-primary hover:text-primary-dark p-1"><EditIcon className="w-5 h-5"/></button>
                                                    )}
                                                    {permissions.edit && (
                    									<button onClick={() => setPasswordUser(user)} className="p-1 rounded text-indigo-600 hover:text-indigo-800">Set Password</button>
                                                    )}
                                                    {permissions.delete && (
                                                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-800 p-1" title="Move to Bin"><DeleteIcon className="w-5 h-5"/></button>
                                                    )}
                                                </>
                                            )}
                                            {showBin && permissions.delete && (
                                                <>
                                                    <button onClick={() => handleRestoreUser(user.id)} className="px-2 py-1 rounded border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Restore</button>
                                                    <button onClick={() => handlePermanentDelete(user.id)} className="px-2 py-1 rounded text-white bg-red-600 hover:bg-red-700">Delete Permanently</button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>
            </div>
            {(!showBin && filteredActiveUsers.length === 0) && (
                <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No users found.</div>
            )}
            {(showBin && filteredBinUsers.length === 0) && (
                <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">Bin is empty.</div>
            )}

            {isModalOpen && (
                <UserModal
                    user={editingUser}
                    onSave={handleSaveUser}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
            {passwordUser && (
                <PasswordModal
                    user={passwordUser}
                    onClose={() => setPasswordUser(null)}
                    onSaved={() => setPasswordUser(null)}
                />
            )}
        </div>
    );
};

interface UserModalProps {
    user: AnyUser | null;
    onSave: (user: AnyUser) => void;
    onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<AnyUser>>(user || { name: '', email: '', role: Role.STAFF, profilePicture: 'https://i.pravatar.cc/150' });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        setFormData(user || { name: '', email: '', role: Role.STAFF, profilePicture: 'https://i.pravatar.cc/150' });
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as AnyUser);
    };

    const onPickAvatar: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const ownerId = user?.id || 'new';
            const { url } = await uploadUserAvatar(file, ownerId);
            setFormData(prev => ({ ...prev, profilePicture: url }));
        } catch (err) {
            alert('Failed to upload avatar. Please try again.');
        } finally {
            setUploading(false);
            e.currentTarget.value = '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 transition-opacity" aria-modal="true" role="dialog">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{user ? 'Edit User' : 'Add New User'}</h3>
                            <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Full Name</label>
                                <input type="text" name="name" id="name" value={(formData as any).name || ''} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Email Address</label>
                                <input type="email" name="email" id="email" value={(formData as any).email || ''} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Role</label>
                                <select id="role" name="role" value={(formData as any).role as string} onChange={handleChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2">
                                    {Object.values(Role).map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="profilePicture" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Profile Picture URL</label>
                                <input type="text" name="profilePicture" id="profilePicture" value={(formData as any).profilePicture || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                                <div className="mt-2 flex items-center gap-3">
                                    <input type="file" accept="image/*" onChange={onPickAvatar} disabled={uploading} className="text-sm" />
                                    {uploading && <span className="text-xs text-muted-foreground dark:text-dark-muted-foreground">Uploading...</span>}
                                    {(formData as any).profilePicture && (
                                        <img src={(formData as any).profilePicture} alt="preview" className="h-10 w-10 rounded-full object-cover border border-border dark:border-dark-border" />
                                    )}
                                </div>
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

interface PasswordModalProps {
    user: AnyUser;
    onClose: () => void;
    onSaved: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ user, onClose, onSaved }) => {
    const [pw1, setPw1] = useState('');
    const [pw2, setPw2] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (pw1.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (pw1 !== pw2) { setError('Passwords do not match.'); return; }
        setSaving(true);
        try {
            await setUserPassword(user.id, pw1);
            onSaved();
            alert('Password updated for ' + user.email);
        } catch {
            setError('Failed to set password');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSave}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Set Password</h3>
                            <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="text-sm mb-4">User: <strong>{user.name}</strong> ({user.email})</p>
                        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium">New Password</label>
                                <input type="password" value={pw1} onChange={e=>setPw1(e.target.value)} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Confirm Password</label>
                                <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" required />
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-3 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserManagement;