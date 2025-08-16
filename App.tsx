import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PlaceholderPage from './pages/PlaceholderPage';
import UserManagement from './pages/UserManagement';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Timetable from './pages/Timetable';
import Assignments from './pages/Assignments';
import Library from './pages/Library';
import IDCard from './pages/IDCard';
import NoticeBoard from './pages/NoticeBoard';
import Fees from './pages/Fees';
import Settings from './pages/Settings';
import Attendance from './pages/Attendance';
import ControlLimit from './pages/ControlLimit';
import Staff from './pages/Staff';
import Librarian from './pages/Librarian';
import { Role, User, SchoolSettings, AppPermissions } from './types';
import { resetSupabaseClient } from './utils/supabase';
import { I18nProvider } from './i18n';
import Login from './pages/Login.tsx';
import { loadUsers, saveUsers } from './utils/users';

// No auto-login. Users must authenticate on first load.

const defaultSettings: SchoolSettings = {
    schoolName: 'LIKLA SCHOOL',
    schoolLogo: 'https://i.imgur.com/Kdee1i8.png', // Placeholder logo
    theme: 'light',
    primaryColor: '#4F46E5', // Indigo
    fontSize: 'base',
    // New defaults
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    itemsPerPage: 25,
    sidebarCompact: false,
    sidebarCollapsedByDefault: false,
    animations: true,
    density: 'comfortable',
    academicYear: '2024-2025',
    notifyEmail: true,
    notifySms: false,
};

const navItemNames = ['Dashboard', 'User Management', 'Teacher', 'Student', 'Staff', 'Librarian', 'Class', 'Timetable', 'Attendance', 'Assignment', 'Library', 'ID Card', 'Notice / Announcements', 'Fees', 'Settings', 'Control Limit', 'Profile'];

const allFeaturesTrue = navItemNames.reduce((acc, name) => ({ ...acc, [name]: { view: true, create: true, edit: true, delete: true } }), {});

const defaultPermissions: AppPermissions = {
    [Role.SUPER_ADMIN]: allFeaturesTrue,
    [Role.ADMIN]: {
        'Dashboard': { view: true },
        'User Management': { view: true, create: true, edit: true, delete: false },
        'Teacher': { view: true, create: true, edit: true, delete: true },
        'Student': { view: true, create: true, edit: true, delete: true },
        'Staff': { view: true, create: true, edit: true, delete: true },
        'Librarian': { view: true, create: true, edit: true, delete: true },
        'Class': { view: true, create: true, edit: true, delete: true },
        'Timetable': { view: true, create: true, edit: true, delete: true },
        'Attendance': { view: true, create: true, edit: true, delete: true },
        'Assignment': { view: true, create: true, edit: true, delete: true },
        'Library': { view: true, create: true, edit: true, delete: true },
        'ID Card': { view: true },
        'Notice / Announcements': { view: true, create: true, edit: true, delete: true },
        'Fees': { view: true, create: true, edit: true, delete: true },
        'Settings': { view: true },
        'Profile': { view: true, edit: true },
    },
    [Role.TEACHER]: {
        'Dashboard': { view: true },
        'Class': { view: true, edit: true },
        'Timetable': { view: true },
        'Attendance': { view: true, create: true },
        'Assignment': { view: true, create: true, edit: true, delete: true },
        'Notice / Announcements': { view: true },
        'Profile': { view: true },
    },
    [Role.STUDENT]: {
        'Dashboard': { view: true },
        'Class': { view: true },
        'Timetable': { view: true },
        'Attendance': { view: true },
        'Assignment': { view: true },
        'Library': { view: true },
        'Notice / Announcements': { view: true },
        'Profile': { view: true },
    },
     [Role.STAFF]: {
        'Dashboard': { view: true },
        'Student': { view: true, create: true, edit: true },
        'Fees': { view: true, create: true, edit: true },
        'Notice / Announcements': { view: true },
        'Profile': { view: true },
    },
    [Role.LIBRARIAN]: {
        'Dashboard': { view: true },
        'Library': { view: true, create: true, edit: true, delete: true },
        'Notice / Announcements': { view: true },
        'Profile': { view: true },
    },
    [Role.PARENT]: {
        'Dashboard': { view: true },
        'Notice / Announcements': { view: true },
        'Profile': { view: true },
    }
};

const App: React.FC = () => {
    // State management
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024 && !defaultSettings.sidebarCollapsedByDefault);
    const [activePage, setActivePage] = useState('Dashboard');
    const [settings, setSettings] = useState<SchoolSettings>(defaultSettings);
    const [profileData, setProfileData] = useState<any | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const saved = localStorage.getItem('currentUser');
            return saved ? (JSON.parse(saved) as User) : null;
        } catch {
            return null;
        }
    });
    const [permissions, setPermissions] = useState<AppPermissions>(defaultPermissions);

    // Settings and Theme persistence
    useEffect(() => {
        const savedSettings = localStorage.getItem('schoolSettings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
        const savedPermissions = localStorage.getItem('schoolPermissions');
        if (savedPermissions) {
            setPermissions(JSON.parse(savedPermissions));
        }
    }, []);

    // Persist current user
    useEffect(() => {
        try {
            if (currentUser) {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            } else {
                localStorage.removeItem('currentUser');
            }
        } catch {}
    }, [currentUser]);

    const updateSettings = (newSettings: Partial<SchoolSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings } as SchoolSettings;
            // If Supabase credentials changed, reset the client
            const supaChanged = (
                updated.supabaseUrl !== prev.supabaseUrl ||
                updated.supabaseAnonKey !== prev.supabaseAnonKey
            );
            localStorage.setItem('schoolSettings', JSON.stringify(updated));
            if (supaChanged) {
                resetSupabaseClient();
            }
            return updated;
        });
    };

    const updatePermissions = (newPermissions: AppPermissions) => {
        setPermissions(newPermissions);
        localStorage.setItem('schoolPermissions', JSON.stringify(newPermissions));
    };
    
    // Effect to apply settings to the DOM
    useEffect(() => {
        // Font size
        document.body.classList.remove('text-sm', 'text-base', 'text-lg');
        document.body.classList.add(`text-${settings.fontSize}`);

        // Theme
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Primary Color
        function hexToRgb(hex: string): string | null {
            let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : null;
        }

        function darkenColor(hex: string, amount: number): string {
            let color = hex.startsWith('#') ? hex.substring(1) : hex;
            const f = parseInt(color, 16);
            const t = amount < 0 ? 0 : 255;
            const p = amount < 0 ? amount * -1 : amount;
            const R = f >> 16;
            const G = (f >> 8) & 0x00FF;
            const B = f & 0x0000FF;
            return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
        }

        const primaryRgb = hexToRgb(settings.primaryColor);
        if (primaryRgb) {
            const primaryDarkHex = darkenColor(settings.primaryColor, 0.2);
            const primaryDarkRgb = hexToRgb(primaryDarkHex);

            document.documentElement.style.setProperty('--color-primary', primaryRgb);
            if(primaryDarkRgb) {
                document.documentElement.style.setProperty('--color-primary-dark', primaryDarkRgb);
            }
        }

        // Sidebar compact class hook (for future CSS usage)
        if (settings.sidebarCompact) {
            document.documentElement.classList.add('sidebar-compact');
        } else {
            document.documentElement.classList.remove('sidebar-compact');
        }

        // Animations toggle (basic hook)
        if (settings.animations === false) {
            document.documentElement.classList.add('no-animations');
        } else {
            document.documentElement.classList.remove('no-animations');
        }
    }, [settings]);

    const toggleDarkMode = () => {
        updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' });
    };
    
    // Responsive sidebar
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 1024) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(!settings.sidebarCollapsedByDefault);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [settings.sidebarCollapsedByDefault]);

    // Apply setting on change (including initial load) for current viewport
    useEffect(() => {
        if (window.innerWidth <= 1024) {
            setSidebarOpen(false);
        } else {
            setSidebarOpen(!settings.sidebarCollapsedByDefault);
        }
    }, [settings.sidebarCollapsedByDefault]);

    // Hash-based QR profile handler
    function parseHashProfile(): any | null {
        const h = window.location.hash || '';
        const m = h.match(/#profile=([^&]+)/);
        if (!m) return null;
        try {
            const b64 = m[1];
            const json = decodeURIComponent(escape(atob(b64)));
            return JSON.parse(json);
        } catch {
            return null;
        }
    }

    useEffect(() => {
        const updateFromHash = () => setProfileData(parseHashProfile());
        updateFromHash();
        window.addEventListener('hashchange', updateFromHash);
        return () => window.removeEventListener('hashchange', updateFromHash);
    }, []);

    const closeProfile = () => {
        setProfileData(null);
        history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    const renderPage = () => {
        if (profileData) {
            const viewerUser: User = {
                id: profileData.id || 'qr-user',
                name: profileData.name || profileData.fullName || 'Profile',
                email: profileData.email || '',
                role: profileData.role || (currentUser?.role || Role.STAFF),
                profilePicture: profileData.profilePicture || profileData.photo || ''
            } as User;
            return (
                <Profile
                    currentUser={viewerUser}
                    onBack={closeProfile}
                    readOnly
                />
            );
        }
        if (!currentUser) return <PlaceholderPage pageName="Not Authenticated" />;
        const userPermissions = permissions[currentUser.role] || {};
        // Map the special internal page key to a feature name in permissions
        const featureKey = activePage === '__Profile' ? 'Profile' : activePage;
        const featurePerm = userPermissions[featureKey];
        const viewAllowed =
            featureKey === 'Profile'
                ? // Profile page is viewable by all by default if not explicitly set
                  (featurePerm?.view ?? true)
                : (featurePerm?.view ?? false);

        if (!viewAllowed && currentUser.role !== Role.SUPER_ADMIN) {
            return <PlaceholderPage pageName="Access Denied" />;
        }

        switch (activePage) {
            case '__Profile': {
                const profPerm = (permissions[currentUser.role] || {})['Profile'];
                const canEditProfile =
                    // If not configured yet, default: Admin and Super Admin can edit; others view-only
                    profPerm == null
                        ? (currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN)
                        : (!!(profPerm as any).edit || currentUser.role === Role.SUPER_ADMIN);
                return (
                    <Profile
                        currentUser={currentUser}
                        onUpdateCurrentUser={async (u: User) => {
                            setCurrentUser(u);
                            try {
                                const users = await loadUsers();
                                const idx = users.findIndex(x => x.id === u.id);
                                if (idx !== -1) {
                                    // Merge to preserve any fields not present in u
                                    (users as any)[idx] = { ...(users as any)[idx], ...u };
                                    await saveUsers(users as any);
                                }
                            } catch {}
                        }}
                        onBack={() => setActivePage('Dashboard')}
                        readOnly={!canEditProfile}
                    />
                );
            }
            case 'Dashboard':
                return <Dashboard currentUser={currentUser} />;
            case 'User Management':
                return <UserManagement permissions={userPermissions[activePage]} />;
            case 'Student':
                return <Students permissions={userPermissions[activePage]} currentUser={currentUser} />;
            case 'Teacher':
                return <Teachers permissions={userPermissions[activePage]} />;
            case 'Staff':
                return <Staff permissions={userPermissions[activePage]} />;
            case 'Librarian':
                return <Librarian permissions={userPermissions[activePage]} />;
            case 'Class':
                return <Classes permissions={userPermissions[activePage]} />;
            case 'Timetable':
                return <Timetable permissions={userPermissions[activePage]} currentUser={currentUser} />;
            case 'Attendance':
                return <Attendance permissions={userPermissions[activePage]} currentUser={currentUser} currentUserRole={currentUser.role} />;
            case 'Assignment':
                return <Assignments permissions={userPermissions[activePage]} currentUser={currentUser} />;
            case 'Library':
                return <Library permissions={userPermissions[activePage]} />;
            case 'ID Card':
                return <IDCard schoolName={settings.schoolName} />;
            case 'Notice / Announcements':
                return <NoticeBoard permissions={userPermissions[activePage]} />;
            case 'Fees':
                return <Fees permissions={userPermissions[activePage]} />;
            case 'Settings':
                return <Settings settings={settings} onSave={updateSettings} currentUser={currentUser} />;
            case 'Control Limit':
                return <ControlLimit currentUser={currentUser} allPermissions={permissions} onSave={updatePermissions} />;
            default:
                return <PlaceholderPage pageName={activePage} />;
        }
    };

    return (
        <I18nProvider lang={(settings.language as any) || 'en'}>
            {!currentUser ? (
                <Login onLogin={(u) => { setCurrentUser(u); setActivePage('Dashboard'); }} />
            ) : (
                <div className="flex min-h-dvh bg-muted dark:bg-dark-background">
                    <Sidebar 
                        isSidebarOpen={isSidebarOpen}
                        setSidebarOpen={setSidebarOpen}
                        activePage={activePage}
                        setActivePage={setActivePage}
                        schoolName={settings.schoolName}
                        schoolLogo={settings.schoolLogo}
                        userPermissions={permissions[currentUser.role]}
                    />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Header 
                            setSidebarOpen={setSidebarOpen}
                            isSidebarOpen={isSidebarOpen}
                            isDarkMode={settings.theme === 'dark'}
                            toggleDarkMode={toggleDarkMode}
                            currentUser={currentUser}
                            onOpenProfile={() => setActivePage('__Profile')}
                            onOpenNotices={() => setActivePage('Notice / Announcements')}
                            activePage={activePage}
                            onLogout={() => setCurrentUser(null)}
                        />
                        <main className="flex-1 overflow-y-auto">
                            {renderPage()}
                        </main>
                    </div>
                </div>
            )}
        </I18nProvider>
    );
};

export default App;