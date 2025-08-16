export enum Role {
  SUPER_ADMIN = 'Super Admin',
  ADMIN = 'Admin',
  TEACHER = 'Teacher',
  STUDENT = 'Student',
  STAFF = 'Staff',
  LIBRARIAN = 'Librarian',
  PARENT = 'Parent',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  profilePicture: string;
  displayId?: string; // 10-char alphanumeric ID for cards
  dobYear?: string; // YYYY, used for formatted display ID on ID cards
  dob?: string; // YYYY-MM-DD, full date used for editing and display
  password?: string; // Should not be stored in frontend state long-term
  passwordHash?: string; // Local-only auth (hashed with SHA-256)
}

export enum AttendanceStatus {
  PRESENT = 'Present',
  ABSENT = 'Absent',
  LATE = 'Late',
  EXCUSED = 'Excused',
}


export interface Student extends User {
  role: Role.STUDENT;
  classId: string;
  attendance: { [date: string]: AttendanceStatus };
  fees: Fee[];
  discount: number; // Percentage
}

export interface Teacher extends User {
  role: Role.TEACHER;
  whatsapp: string;
  salary: number;
  attendance: { [date: string]: AttendanceStatus };
}

export interface Staff extends User {
  role: Role.STAFF;
}

export interface Librarian extends User {
  role: Role.LIBRARIAN;
}

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
  liveClass?: {
    link: string;
    time: string;
  };
}

export interface Assignment {
  id:string;
  title: string;
  classId: string;
  teacherId: string;
  deadline: string;
  description: string;
  submissions: { [studentId: string]: boolean };
  attachments?: Attachment[];
}

export interface Attachment {
  name: string;
  url: string; // blob/object URL or remote URL
  path?: string; // Firebase Storage path for cleanup
}

export enum BookCategory {
  FICTION = 'Fiction',
  NON_FICTION = 'Non-Fiction',
  NOVEL = 'Novel',
  SCIENCE = 'Science',
  ART = 'Art',
  HISTORY = 'History',
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  category: BookCategory;
  coverImage: string; // URL or base64
  fileUrl?: string;
  coverPath?: string; // Firebase Storage path for cover
  filePath?: string; // Firebase Storage path for file
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  targetRoles: Role[];
  links?: string[]; // optional list of external links
  attachments?: Attachment[]; // optional uploaded attachments (blob/object URLs or remote URLs)
}

export interface Fee {
  id:string;
  studentId: string;
  title: string;
  amount: number;
  status: 'Paid' | 'Unpaid';
  dueDate: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface TimetableEntry {
  id: string;
  classId: string;
  teacherId: string;
  subject: string;
  day: DayOfWeek;
  timeSlot: string; // e.g., "09:00-10:00"
}

export type AnyUser = User | Student | Teacher | Staff | Librarian;

export interface SchoolSettings {
  schoolName: string;
  schoolLogo: string;
  theme: 'light' | 'dark';
  primaryColor: string; // hex value
  fontSize: 'sm' | 'base' | 'lg';
  // New fields
  language?:
    | 'en' // English
    | 'fr' // French
    | 'hi' // Hindi
    | 'es' // Spanish
    | 'de' // German
    | 'ar' // Arabic
    | 'bn' // Bengali
    | 'ta' // Tamil
    | 'te' // Telugu
    | 'mr' // Marathi
    | 'gu' // Gujarati
    | 'pa' // Punjabi
    | 'ur' // Urdu
    | 'zh' // Chinese (Simplified)
    | 'ja' // Japanese
    | 'ru' // Russian
    | 'pt' // Portuguese
    | 'it' // Italian
    | 'mni'; // Manipuri (Meitei)
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timezone?: string;
  itemsPerPage?: 10 | 25 | 50 | 100;
  sidebarCompact?: boolean;
  sidebarCollapsedByDefault?: boolean; // if true, keep sidebar collapsed on desktop by default
  animations?: boolean;
  density?: 'comfortable' | 'compact';
  loginBackground?: string;
  faviconUrl?: string;
  academicYear?: string; // e.g., 2024-2025
  notifyEmail?: boolean;
  notifySms?: boolean;
  // Storage provider config
  storageProvider?: 'firebase' | 'supabase';
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseBucket?: string; // default 'public'
}

export interface FeaturePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type AppPermissions = {
  [key in Role]?: {
    [featureName: string]: Partial<FeaturePermissions>;
  };
};