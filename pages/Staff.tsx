import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Staff as StaffType, Role, FeaturePermissions } from '../types';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, FileDownIcon } from '../components/icons';
import { downloadTableAsPdf } from '../utils/pdf';
import { formatDisplayId } from '../utils/id';
import { listStaff as sbListStaff, upsertStaff as sbUpsertStaff, deleteStaff as sbDeleteStaff } from '../utils/staff';
import { uploadUserAvatar } from '../utils/storage';

interface StaffProps {
  permissions?: Partial<FeaturePermissions>;
}

const initialStaff: StaffType[] = [
  { id: 'staff-1', name: 'Eve Davis', email: 'eve.d@likla.edu', role: Role.STAFF, profilePicture: 'https://i.pravatar.cc/150?u=eve.d@likla.edu' },
  { id: 'staff-2', name: 'Mike Carter', email: 'mike.c@likla.edu', role: Role.STAFF, profilePicture: 'https://i.pravatar.cc/150?u=mike.c@likla.edu' },
];

const Staff: React.FC<StaffProps> = ({ permissions = {} }) => {
  const [staff, setStaff] = useState<StaffType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffType | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [staffStatus, setStaffStatus] = useState<Record<string, 'Paid' | 'Unpaid'>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { staff: s, statusMap } = await sbListStaff();
        if (!mounted) return;
        setStaff(s.length ? s : initialStaff);
        setStaffStatus(statusMap);
      } catch (e: any) {
        setError(e?.message || 'Failed to load staff');
        // fallback to initial to keep UI usable
        setStaff(initialStaff);
        setStaffStatus(Object.fromEntries(initialStaff.map((st, idx) => [st.id, idx % 2 === 0 ? 'Paid' : 'Unpaid'])));
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return staff.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  const handleAdd = () => { if (!permissions.create) return; setEditing(null); setIsModalOpen(true); };
  const handleEdit = (s: StaffType) => { if (!permissions.edit) return; setEditing(s); setIsModalOpen(true); };
  const handleDelete = async (id: string) => {
    if (!permissions.delete) return;
    if (!window.confirm('Delete this staff member?')) return;
    const prev = staff;
    setStaff(prev.filter(s => s.id !== id));
    try {
      await sbDeleteStaff(id);
    } catch (e) {
      // rollback on failure
      setStaff(prev);
      alert('Failed to delete. Please try again.');
    }
  };

  const getSchoolName = () => {
    try {
      const saved = localStorage.getItem('schoolSettings');
      if (saved) return (JSON.parse(saved) || {}).schoolName || 'LIKLA SCHOOL';
    } catch {}
    return 'LIKLA SCHOOL';
  };

  const handleSave = async (data: StaffType, status: 'Paid' | 'Unpaid') => {
    if (editing) {
      if (!permissions.edit) return;
      const updated = data;
      const prev = staff;
      setStaff(prev.map(s => s.id === updated.id ? updated : s));
      setStaffStatus(prevMap => ({ ...prevMap, [updated.id]: status }));
      try {
        await sbUpsertStaff(updated, status);
      } catch (e) {
        setStaff(prev); // rollback
        alert('Failed to save changes.');
        return;
      }
    } else {
      if (!permissions.create) return;
      const newId = `staff-${Date.now()}`;
      const schoolName = getSchoolName();
      const displayId = formatDisplayId({ user: { ...(data as any), id: newId, role: Role.STAFF }, schoolName, dobYear: (data as any).dobYear });
      const newStaff: StaffType = { ...data, id: newId, role: Role.STAFF, displayId } as StaffType;
      setStaff(prev => [...prev, newStaff]);
      setStaffStatus(prev => ({ ...prev, [newId]: status }));
      try {
        await sbUpsertStaff(newStaff, status);
      } catch (e) {
        // remove optimistic item
        setStaff(prev => prev.filter(s => s.id !== newId));
        alert('Failed to create staff.');
        return;
      }
    }
    setIsModalOpen(false);
  };

  const handleExportByStatus = async (statusFilter: 'All' | 'Paid' | 'Unpaid') => {
    const tempId = `staff-${statusFilter}-${Date.now()}`;
    const container = document.createElement('div');
    container.id = tempId;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';

    const rows = filtered.filter(s => statusFilter === 'All' ? true : staffStatus[s.id] === statusFilter);
    let bodyRows = '';
    rows.forEach(s => {
      const st = staffStatus[s.id] || 'Unpaid';
      bodyRows += `
        <tr>
          <td data-export="${s.name} (${s.email})">${s.name}</td>
          <td data-export="${s.email}">${s.email}</td>
          <td data-export="${st}">${st}</td>
        </tr>`;
    });

    container.innerHTML = `
      <div>
        <h2>Staff - ${statusFilter}</h2>
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Email</th>
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
      await downloadTableAsPdf(tempId, `Staff-${statusFilter}.pdf`);
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
    <div className="p-4 sm:p-6 lg:p-8" id="print-staff">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Staff</h2>
        <div className="flex gap-2 no-print">
          {permissions.create && (
            <button onClick={handleAdd} className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" /> Add Staff
            </button>
          )}
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen(v => !v)}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              aria-haspopup="menu"
              aria-expanded={isExportOpen}
            >
              <FileDownIcon className="-ml-1 mr-2 h-5 w-5" />
              Export <span className="ml-1">▼</span>
            </button>
            {isExportOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card shadow-lg ring-1 ring-black/5 z-10">
                <div className="py-1">
                  <button onClick={() => { handleExportByStatus('All'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export All</button>
                  <button onClick={() => { handleExportByStatus('Paid'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export Paid</button>
                  <button onClick={() => { handleExportByStatus('Unpaid'); setIsExportOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-accent dark:hover:bg-dark-accent">Export Unpaid</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 relative no-print">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </div>

      <div className="bg-card dark:bg-dark-card shadow-md rounded-lg overflow-hidden border border-border dark:border-dark-border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border dark:divide-dark-border">
            <thead className="bg-muted dark:bg-dark-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Staff</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">Salary Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-dark-border">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-accent dark:hover:bg-dark-accent">
                  <td className="px-6 py-4 whitespace-nowrap" data-export={`${s.name} (${s.email})`}>
                    <div className="flex items-center">
                      <img className="h-10 w-10 rounded-full object-cover" src={s.profilePicture} alt={s.name} />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground">{s.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap" data-export={staffStatus[s.id]}>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${staffStatus[s.id] === 'Paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                      {staffStatus[s.id]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2 no-print">
                      {permissions.edit && (
                        <button onClick={() => handleEdit(s)} className="text-primary hover:text-primary-dark p-1"><EditIcon className="w-5 h-5"/></button>
                      )}
                      {permissions.delete && (
                        <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 p-1"><DeleteIcon className="w-5 h-5"/></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No staff found.</div>
      )}

      {isModalOpen && (
        <StaffModal
          staff={editing}
          currentStatus={editing ? (staffStatus[editing.id] || 'Unpaid') : 'Unpaid'}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

interface StaffModalProps {
  staff: StaffType | null;
  currentStatus: 'Paid' | 'Unpaid';
  onSave: (s: StaffType, status: 'Paid' | 'Unpaid') => void;
  onClose: () => void;
}

const StaffModal: React.FC<StaffModalProps> = ({ staff, currentStatus, onSave, onClose }) => {
  const [form, setForm] = useState<Partial<StaffType>>(staff || { name: '', email: '', role: Role.STAFF, profilePicture: 'https://i.pravatar.cc/150', dobYear: '', dob: '' });
  const [status, setStatus] = useState<'Paid' | 'Unpaid'>(currentStatus);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm(staff || { name: '', email: '', role: Role.STAFF, profilePicture: 'https://i.pravatar.cc/150', dobYear: '', dob: '' });
    setStatus(currentStatus);
  }, [staff, currentStatus]);

  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value }));
  };

  const changeDob = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; // YYYY-MM-DD
    const yr = v?.slice(0, 4) || '';
    setForm(prev => ({ ...prev, dob: v, dobYear: yr }));
  };

  const submit = (e: React.FormEvent) => { e.preventDefault(); onSave(form as StaffType, status); };

  const onPickAvatar: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ownerId = staff?.id || 'new';
      const { url } = await uploadUserAvatar(file, ownerId);
      setForm(prev => ({ ...prev, profilePicture: url }));
    } catch (err) {
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setUploading(false);
      // reset input so same file can be chosen again if desired
      e.currentTarget.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <form onSubmit={submit}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{staff ? 'Edit Staff' : 'Add Staff'}</h3>
              <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent"><XIcon className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input name="name" value={(form as any).name || ''} onChange={change} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input type="email" name="email" value={(form as any).email || ''} onChange={change} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium">Profile Picture URL</label>
                <input name="profilePicture" value={(form as any).profilePicture || ''} onChange={change} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                <div className="mt-2 flex items-center gap-3">
                  <input type="file" accept="image/*" onChange={onPickAvatar} disabled={uploading} className="text-sm" />
                  {uploading && <span className="text-xs text-muted-foreground dark:text-dark-muted-foreground">Uploading...</span>}
                  {(form as any).profilePicture && (
                    <img src={(form as any).profilePicture} alt="preview" className="h-10 w-10 rounded-full object-cover border border-border dark:border-dark-border" />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Date of Birth</label>
                <input type="date" name="dob" value={(form as any).dob || ''} onChange={changeDob} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                <p className="mt-1 text-xs text-muted-foreground dark:text-dark-muted-foreground">Year auto-fills for ID formatting.</p>
              </div>
              <div>
                <label className="block text-sm font-medium">Salary Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as 'Paid' | 'Unpaid')} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2">
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
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

export default Staff;
