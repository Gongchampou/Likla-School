import React, { useState, useMemo, useEffect } from 'react';
import { Role, Notice, Attachment, FeaturePermissions } from '../types';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, NoticeIcon } from '../components/icons';
import { loadNotices, saveNotices } from '../utils/notices';

// File helpers
const readFileAsDataURL = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const timeAgo = (date: string): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

// Linkify helper: turns URLs in plain text into clickable <a> elements
const linkify = (text: string): React.ReactNode[] => {
    const urlRegex = /((https?:\/\/|www\.)[^\s]+)/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(text)) !== null) {
        const [raw] = match;
        const start = match.index;
        const end = start + raw.length;
        if (start > lastIndex) parts.push(text.slice(lastIndex, start));
        const href = raw.startsWith('www.') ? `https://${raw}` : raw;
        parts.push(
            <a
                key={`${start}-${end}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline break-words"
            >
                {raw}
            </a>
        );
        lastIndex = end;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
};

const RoleBadge = ({ role }: { role: Role }) => {
    const roleColors: { [key in Role]: string } = {
        [Role.SUPER_ADMIN]: 'bg-red-100 text-red-800',
        [Role.ADMIN]: 'bg-purple-100 text-purple-800',
        [Role.TEACHER]: 'bg-blue-100 text-blue-800',
        [Role.STUDENT]: 'bg-green-100 text-green-800',
        [Role.STAFF]: 'bg-yellow-100 text-yellow-800',
        [Role.LIBRARIAN]: 'bg-indigo-100 text-indigo-800',
        [Role.PARENT]: 'bg-pink-100 text-pink-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${roleColors[role]}`}>{role}</span>;
};

interface NoticeBoardProps {
    permissions?: Partial<FeaturePermissions>; // view/create/edit/delete flags for this page
}

const NoticeBoard: React.FC<NoticeBoardProps> = ({ permissions }) => {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

    // Load from storage on mount
    useEffect(() => {
        setNotices(loadNotices());
    }, []);

    // Persist on change
    useEffect(() => {
        saveNotices(notices);
    }, [notices]);

    // Derive capabilities from Control Limit permissions
    const canCreate = !!permissions?.create || false;
    const canEdit = !!permissions?.edit || false;
    const canDelete = !!permissions?.delete || false;
    const canManage = canCreate || canEdit || canDelete;

    const filteredNotices = useMemo(() => {
        return notices
            .filter(notice => roleFilter === 'All' || notice.targetRoles.includes(roleFilter))
            .filter(notice => notice.title.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notices, searchTerm, roleFilter]);

    const handleAddNewNotice = () => {
        if (!canCreate) return;
        setEditingNotice(null);
        setIsModalOpen(true);
    };

    const handleEditNotice = (notice: Notice) => {
        if (!canEdit) return;
        setEditingNotice(notice);
        setIsModalOpen(true);
    };

    const handleDeleteNotice = (noticeId: string) => {
        if (!canDelete) return;
        if (window.confirm('Are you sure you want to delete this notice?')) {
            setNotices(notices.filter(notice => notice.id !== noticeId));
        }
    };

    const handleSaveNotice = (noticeData: Omit<Notice, 'id' | 'date'> & { id?: string }) => {
        const cleanedLinks = (noticeData.links || []).map(l => l.trim()).filter(Boolean);
        const payload = { ...noticeData, links: cleanedLinks } as Omit<Notice, 'id' | 'date'>;
        if (editingNotice) {
            if (!canEdit) return;
            setNotices(notices.map(n => n.id === editingNotice.id ? { ...editingNotice, ...payload, date: new Date().toISOString() } : n));
        } else {
            if (!canCreate) return;
            setNotices([{ ...payload, id: `notice-${Date.now()}`, date: new Date().toISOString() }, ...notices]);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notice Board</h2>
                {canCreate && (
                    <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                        <button type="button" onClick={handleAddNewNotice} className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                            Add Notice
                        </button>
                    </div>
                )}
            </div>

            <div className="mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input type="text" placeholder="Search by title..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as Role | 'All')} className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="All">All Roles</option>
                    {Object.values(Role).map(role => (<option key={role} value={role}>{role}</option>))}
                </select>
            </div>

            <div className="space-y-6">
                {filteredNotices.map(notice => (
                     <div key={notice.id} className="bg-card dark:bg-dark-card p-5 rounded-lg shadow-md border border-border dark:border-dark-border">
                        <div className="flex justify-between items-start">
                           <div className="flex-grow">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{notice.title}</h3>
                                <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mb-3">Posted {timeAgo(notice.date)}</p>
                            </div>
                            {(canEdit || canDelete) && (
                                <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                                    {canEdit && (
                                        <button onClick={() => handleEditNotice(notice)} className="p-1 text-primary hover:text-primary-dark"><EditIcon className="w-5 h-5" /></button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => handleDeleteNotice(notice.id)} className="p-1 text-red-600 hover:text-red-800"><DeleteIcon className="w-5 h-5" /></button>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">{linkify(notice.content)}</p>
                        <div className="flex flex-wrap gap-2">
                             <span className="text-sm font-medium mr-2">For:</span>
                             {notice.targetRoles.map(role => <RoleBadge key={role} role={role} />)}
                        </div>
                        {(notice.links?.length || 0) > 0 && (
                            <div className="mt-3 space-y-1">
                                <div className="text-sm font-medium">Links</div>
                                <ul className="list-disc list-inside text-sm text-primary">
                                    {notice.links!.map((l, idx) => (
                                        <li key={idx}><a href={l} target="_blank" rel="noopener noreferrer" className="hover:underline break-words">{l}</a></li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {(notice.attachments?.length || 0) > 0 && (
                            <div className="mt-3 space-y-1">
                                <div className="text-sm font-medium">Attachments</div>
                                <ul className="list-disc list-inside text-sm">
                                    {notice.attachments!.map((a, idx) => (
                                        <li key={idx} className="break-words">
                                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{a.name || `Attachment ${idx+1}`}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filteredNotices.length === 0 && <div className="text-center py-10 text-muted-foreground dark:text-dark-muted-foreground">No notices found.</div>}
            
            {isModalOpen && <NoticeModal notice={editingNotice} onSave={handleSaveNotice} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};


interface NoticeModalProps {
    notice: Notice | null;
    onSave: (data: Omit<Notice, 'id' | 'date'>) => void;
    onClose: () => void;
}

const NoticeModal: React.FC<NoticeModalProps> = ({ notice, onSave, onClose }) => {
    const [title, setTitle] = useState(notice?.title || '');
    const [content, setContent] = useState(notice?.content || '');
    const [targetRoles, setTargetRoles] = useState<Role[]>(notice?.targetRoles || []);
    const [links, setLinks] = useState<string[]>(notice?.links || ['']);
    const [attachments, setAttachments] = useState<Attachment[]>(notice?.attachments || []);

    const handleRoleToggle = (role: Role) => {
        setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (targetRoles.length === 0) {
            alert('Please select at least one target role.');
            return;
        }
        onSave({ title, content, targetRoles, links: links.map(l => l.trim()).filter(Boolean), attachments });
    };

    const addLink = () => setLinks(prev => [...prev, '']);
    const updateLink = (idx: number, value: string) => setLinks(prev => prev.map((l, i) => i === idx ? value : l));
    const removeLink = (idx: number) => setLinks(prev => prev.filter((_, i) => i !== idx));

    const handleFilesChange = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const newAttachments: Attachment[] = [];
        for (const file of Array.from(files)) {
            try {
                const url = await readFileAsDataURL(file);
                newAttachments.push({ name: file.name, url });
            } catch {}
        }
        setAttachments(prev => [...prev, ...newAttachments]);
    };
    const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
                    <div className="p-6 border-b border-border dark:border-dark-border sticky top-0 bg-card dark:bg-dark-card z-10">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{notice ? 'Edit Notice' : 'Add New Notice'}</h3>
                            <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-24 min-h-0">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Title</label>
                            <input type="text" name="title" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                        </div>
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Content</label>
                            <textarea name="content" id="content" value={content} onChange={e => setContent(e.target.value)} required rows={8} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Links</label>
                            <div className="mt-2 space-y-2">
                                {links.map((link, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input type="url" placeholder="https://example.com" value={link} onChange={e => updateLink(idx, e.target.value)} className="flex-1 rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                                        <button type="button" onClick={() => removeLink(idx)} className="px-3 py-2 text-sm rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Remove</button>
                                    </div>
                                ))}
                                <button type="button" onClick={addLink} className="px-3 py-2 text-sm rounded-md border border-dashed border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">+ Add Link</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Attachments</label>
                            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={e => handleFilesChange(e.target.files)} className="mt-2 block w-full text-sm" />
                            {attachments.length > 0 && (
                                <ul className="mt-2 space-y-1 text-sm">
                                    {attachments.map((a, idx) => (
                                        <li key={idx} className="flex items-center justify-between gap-2">
                                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words">{a.name}</a>
                                            <button type="button" onClick={() => removeAttachment(idx)} className="px-2 py-1 rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent text-xs">Remove</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Target Audience</label>
                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-md border border-border dark:border-dark-border">
                                {Object.values(Role).map(role => (
                                    <div key={role} className="flex items-center">
                                        <input id={`role-${role}`} name="targetRoles" type="checkbox" checked={targetRoles.includes(role)} onChange={() => handleRoleToggle(role)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                        <label htmlFor={`role-${role}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-200">{role}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-4 flex justify-end gap-3 border-t border-border dark:border-dark-border sticky bottom-0 z-10">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark">Save Notice</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NoticeBoard;