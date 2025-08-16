import React, { useState, useMemo, useEffect } from 'react';
import { Role, Book, BookCategory, FeaturePermissions } from '../types';
import { uploadBookCover, uploadBookFile, deleteByPath } from '../utils/storage';
import { loadBooks, saveBooks } from '../utils/books';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, XIcon, BookOpenIcon } from '../components/icons';

// Load initial from localStorage (falls back to DEFAULT_BOOKS inside util)
const initialBooks: Book[] = loadBooks();

const CategoryBadge: React.FC<{ category: BookCategory }> = ({ category }) => {
    const categoryColors: { [key in BookCategory]: string } = {
        [BookCategory.FICTION]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [BookCategory.NON_FICTION]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        [BookCategory.NOVEL]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        [BookCategory.SCIENCE]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        [BookCategory.ART]: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
        [BookCategory.HISTORY]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    };
    return <span className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${categoryColors[category]}`}>{category}</span>;
};

interface LibraryProps { permissions?: Partial<FeaturePermissions>; }

const Library: React.FC<LibraryProps> = ({ permissions }) => {
    const [books, setBooks] = useState<Book[]>(initialBooks);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<BookCategory | 'All'>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    // Permissions derived from Control Limit
    const canCreate = Boolean(permissions?.create);
    const canEdit = Boolean(permissions?.edit);
    const canDelete = Boolean(permissions?.delete);

    // Persist to localStorage whenever books change
    useEffect(() => {
        saveBooks(books);
    }, [books]);

    const filteredBooks = useMemo(() => {
        return books
            .filter(book => categoryFilter === 'All' || book.category === categoryFilter)
            .filter(book =>
                book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                book.author.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [books, searchTerm, categoryFilter]);

    const handleAddNewBook = () => {
        if (!canCreate) return;
        setEditingBook(null);
        setIsModalOpen(true);
    };

    const handleEditBook = (book: Book) => {
        if (!canEdit) return;
        setEditingBook(book);
        setIsModalOpen(true);
    };

    const handleDeleteBook = async (bookId: string) => {
        if (!canDelete) return;
        if (window.confirm('Are you sure you want to delete this book?')) {
            const toDelete = books.find(b => b.id === bookId);
            try {
                if (toDelete?.coverPath) { try { await deleteByPath(toDelete.coverPath); } catch {} }
                if (toDelete?.filePath) { try { await deleteByPath(toDelete.filePath); } catch {} }
            } finally {
                setBooks(books.filter(book => book.id !== bookId));
            }
        }
    };

    const handleSaveBook = (bookData: Book) => {
        if (editingBook) {
            if (!canEdit) return;
            setBooks(books.map(b => b.id === bookData.id ? bookData : b));
        } else {
            if (!canCreate) return;
            setBooks([...books, { ...bookData, id: `book-${Date.now()}` }]);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Library</h2>
                {canCreate && (
                    <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                        <button type="button" onClick={handleAddNewBook} className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                            Add Book
                        </button>
                    </div>
                )}
            </div>

            <div className="mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input type="text" placeholder="Search by title or author..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as BookCategory | 'All')} className="md:max-w-xs w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="All">All Categories</option>
                    {Object.values(BookCategory).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredBooks.map(book => (
                    <div key={book.id} className="bg-card dark:bg-dark-card rounded-lg shadow-md overflow-hidden border border-border dark:border-dark-border flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <div className="relative">
                            <img src={book.coverImage} alt={book.title} className="w-full h-64 object-cover" />
                             <CategoryBadge category={book.category} />
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{book.title}</h3>
                            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{book.author}</p>
                            <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mt-2 flex-grow">{book.description.substring(0, 50)}...</p>
                        </div>
                        <div className="p-2 bg-muted/50 dark:bg-dark-muted/50 flex items-center justify-end gap-1">
                             {book.fileUrl && (
                                <a href={book.fileUrl} target="_blank" rel="noopener noreferrer" title="Read Book" className="p-2 rounded-md text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50">
                                    <BookOpenIcon className="w-5 h-5" />
                                </a>
                            )}
                            {(canEdit || canDelete) && (
                                <>
                                    {canEdit && (
                                        <button onClick={() => handleEditBook(book)} className="p-2 rounded-md text-primary hover:bg-blue-100 dark:hover:bg-blue-900/50" title="Edit Book"><EditIcon className="w-5 h-5" /></button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => handleDeleteBook(book.id)} className="p-2 rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" title="Delete Book"><DeleteIcon className="w-5 h-5" /></button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {filteredBooks.length === 0 && <div className="text-center col-span-full py-10 text-muted-foreground dark:text-dark-muted-foreground">No books found matching your criteria.</div>}
            {isModalOpen && <BookModal book={editingBook} onSave={handleSaveBook} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

interface BookModalProps { book: Book | null; onSave: (book: Book) => void; onClose: () => void; }
const BookModal: React.FC<BookModalProps> = ({ book, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<Book>>(book || { title: '', author: '', description: '', category: BookCategory.FICTION, coverImage: '', fileUrl: '' });
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    useEffect(() => {
        setFormData(book || { title: '', author: '', description: '', category: BookCategory.FICTION, coverImage: '', fileUrl: '' });
    }, [book]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const onCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingCover(true);
        try {
            // delete old cover if exists
            if (formData.coverPath) { try { await deleteByPath(formData.coverPath); } catch {} }
            const { url, path } = await uploadBookCover(file, 'library');
            setFormData(prev => ({ ...prev, coverImage: url, coverPath: path }));
        } catch (err) {
            console.error('Cover upload failed', err);
        } finally {
            setUploadingCover(false);
            if (e.target) e.target.value = '';
        }
    };

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingFile(true);
        try {
            if (formData.filePath) { try { await deleteByPath(formData.filePath); } catch {} }
            const { url, path } = await uploadBookFile(file, 'library');
            setFormData(prev => ({ ...prev, fileUrl: url, filePath: path }));
        } catch (err) {
            console.error('Book file upload failed', err);
        } finally {
            setUploadingFile(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Book);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 transition-opacity">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{book ? 'Edit Book' : 'Add New Book'}</h3>
                            <button type="button" onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent dark:hover:bg-dark-accent"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Title</label>
                                <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                             <div>
                                <label htmlFor="author" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Author</label>
                                <input type="text" name="author" id="author" value={formData.author} onChange={handleChange} required className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Description</label>
                                <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Category</label>
                                <select id="category" name="category" value={formData.category} onChange={handleChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm bg-muted dark:bg-dark-muted p-2">
                                    {Object.values(BookCategory).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Cover Image</label>
                                <div className="mt-1 flex items-center gap-3">
                                    {formData.coverImage && <img src={formData.coverImage} className="w-16 h-16 object-cover rounded" alt="cover" />}
                                    <input type="file" accept="image/*" onChange={onCoverSelected} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                                </div>
                                {uploadingCover && <div className="text-xs mt-1 text-muted-foreground dark:text-dark-muted-foreground">Uploading cover…</div>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Book File (PDF, optional)</label>
                                <input type="file" accept="application/pdf" onChange={onFileSelected} className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                                {uploadingFile && <div className="text-xs mt-1 text-muted-foreground dark:text-dark-muted-foreground">Uploading file…</div>}
                                {formData.fileUrl && <a href={formData.fileUrl} target="_blank" rel="noopener" className="block text-primary text-xs mt-1">Current file</a>}
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted dark:bg-dark-muted px-6 py-3 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-border dark:border-dark-border hover:bg-accent dark:hover:bg-dark-accent">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark">Save Book</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Library;