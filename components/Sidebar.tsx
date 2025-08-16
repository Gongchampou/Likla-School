import React from 'react';
import { DashboardIcon, UsersIcon, TeacherIcon, StudentIcon, ClassIcon, TimetableIcon, AttendanceIcon, AssignmentIcon, LibraryIcon, IdCardIcon, NoticeIcon, FeesIcon, SettingsIcon, ControlLimitIcon, LogoutIcon } from './icons';
import { Role, AppPermissions } from '../types';
import { useI18n } from '../i18n';

interface SidebarProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  activePage: string;
  setActivePage: (page: string) => void;
  schoolName: string;
  schoolLogo: string;
  userPermissions: AppPermissions[Role];
}

const navItems = [
    { name: 'Dashboard', icon: DashboardIcon },
    { name: 'User Management', icon: UsersIcon },
    { name: 'Teacher', icon: TeacherIcon },
    { name: 'Student', icon: StudentIcon },
    { name: 'Staff', icon: UsersIcon },
    { name: 'Librarian', icon: UsersIcon },
    { name: 'Class', icon: ClassIcon },
    { name: 'Timetable', icon: TimetableIcon },
    { name: 'Attendance', icon: AttendanceIcon },
    { name: 'Assignment', icon: AssignmentIcon },
    { name: 'Library', icon: LibraryIcon },
    { name: 'ID Card', icon: IdCardIcon },
    { name: 'Notice / Announcements', icon: NoticeIcon },
    { name: 'Fees', icon: FeesIcon },
    { name: 'Settings', icon: SettingsIcon },
    { name: 'Control Limit', icon: ControlLimitIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setSidebarOpen, activePage, setActivePage, schoolName, schoolLogo, userPermissions }) => {
    const { t } = useI18n();
    
    const visibleNavItems = navItems.filter(item => userPermissions?.[item.name]?.view);

    return (
        <>
            <div className={`fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)}></div>
            <aside className={`fixed top-0 left-0 h-full bg-slate-800 text-slate-100 flex flex-col z-40 transition-all duration-300 ease-in-out w-64 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 ${isSidebarOpen ? 'lg:w-64' : 'lg:w-20'}`}>
                <div
                    className={`flex items-center h-16 border-b border-slate-700 px-4 shrink-0 ${isSidebarOpen ? 'justify-start' : 'justify-center'} lg:cursor-pointer`}
                    onClick={() => { if (window.innerWidth >= 1024) setSidebarOpen(!isSidebarOpen); }}
                    title="Toggle sidebar"
                >
                     <div className={`flex items-center overflow-hidden ${isSidebarOpen ? '' : 'w-auto'}`}>
                        <img src={schoolLogo} alt="School Logo" className={`h-8 w-8 shrink-0 transition-all duration-300 ${isSidebarOpen ? '' : 'h-9 w-9'}`} />
                        <h1 className={`text-xl font-bold text-white whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 ml-3' : 'opacity-0 w-0'}`}>{schoolName}</h1>
                     </div>
                </div>

                <nav className="flex-1 overflow-y-auto mt-4">
                    <ul>
                        {visibleNavItems.map((item) => (
                            <li key={item.name} className="px-4">
                                <button
                                    title={!isSidebarOpen ? t(`nav.${item.name}`) : undefined}
                                    aria-label={!isSidebarOpen ? t(`nav.${item.name}`) : undefined}
                                    onClick={() => { setActivePage(item.name); if (window.innerWidth <= 1024) setSidebarOpen(false); }}
                                    className={`w-full flex items-center h-12 rounded-lg text-left transition-colors duration-200 ${activePage === item.name ? 'bg-primary text-white' : 'hover:bg-slate-700'} ${isSidebarOpen ? 'px-4' : 'justify-center'}`}
                                >
                                    <item.icon className={`h-5 w-5 shrink-0 ${isSidebarOpen ? 'mr-3' : ''}`} />
                                    <span className={`whitespace-nowrap transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>{t(`nav.${item.name}`)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-2 border-t border-slate-700">
                    <p className="text-green-500">Jonah</p>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;