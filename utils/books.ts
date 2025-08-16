import { Book, BookCategory } from '../types';

export const BOOKS_STORAGE_KEY = 'books';

export const DEFAULT_BOOKS: Book[] = [
  {
    id: 'book-1',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    description: 'A novel about the serious issues of rape and racial inequality.',
    category: BookCategory.NOVEL,
    coverImage: '',
  },
  {
    id: 'book-2',
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    description: 'From the Big Bang to black holes.',
    category: BookCategory.SCIENCE,
    coverImage: '',
  },
  {
    id: 'book-3',
    title: 'The Art Book',
    author: 'Phaidon Editors',
    description: 'A comprehensive guide to the world of art.',
    category: BookCategory.ART,
    coverImage: '',
  },
];

export function loadBooks(): Book[] {
  try {
    const raw = localStorage.getItem(BOOKS_STORAGE_KEY);
    if (!raw) return DEFAULT_BOOKS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Book[];
    return DEFAULT_BOOKS;
  } catch {
    return DEFAULT_BOOKS;
  }
}

export function saveBooks(books: Book[]) {
  try {
    localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(books));
  } catch {
    // ignore
  }
}
