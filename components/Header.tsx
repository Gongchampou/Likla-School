import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeftIcon, MenuIcon, SunIcon, MoonIcon, SearchIcon, SettingsIcon, LogoutIcon, BellIcon } from './icons';
import { User, Role } from '../types';
import { loadNotices } from '../utils/notices';

interface HeaderProps {
  setSidebarOpen: (isOpen: boolean) => void;
  isSidebarOpen: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentUser: User;
  activePage: string;
  onOpenProfile: () => void;
  onOpenNotices: () => void;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen, isSidebarOpen, isDarkMode, toggleDarkMode, currentUser, activePage, onOpenProfile, onOpenNotices, onLogout }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const lastSeenKey = useMemo(() => `noticesLastSeen:${currentUser.id}`, [currentUser.id]);

  const recomputeUnread = () => {
    const notices = loadNotices();
    let lastSeenIso: string | null = null;
    try { lastSeenIso = localStorage.getItem(lastSeenKey); } catch {}
    const lastSeenTime = lastSeenIso ? Date.parse(lastSeenIso) : 0;
    const count = notices.filter(n => n.targetRoles.includes(currentUser.role as Role) && Date.parse(n.date) > lastSeenTime).length;
    setUnreadCount(count);
  };

  useEffect(() => {
    // On mount or when user changes, compute unread
    recomputeUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    // If user is viewing notices page, mark as read now
    if (activePage === 'Notice / Announcements') {
      try { localStorage.setItem(lastSeenKey, new Date().toISOString()); } catch {}
      setUnreadCount(0);
    }
  }, [activePage, lastSeenKey]);

  const handleOpenNotices = () => {
    try { localStorage.setItem(lastSeenKey, new Date().toISOString()); } catch {}
    setUnreadCount(0);
    onOpenNotices();
  };

  return (
    <header className="sticky top-0 z-20 bg-card/80 dark:bg-dark-card/80 backdrop-blur-lg border-b border-border dark:border-dark-border [padding-top:env(safe-area-inset-top)]">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          {/* Mobile menu button (opens) */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-muted-foreground dark:text-dark-muted-foreground">
            <MenuIcon />
          </button>
          {/* Universal chevron toggle with direction (visible on lg as well) */}
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="hidden lg:inline-flex p-2 -ml-1 text-muted-foreground dark:text-dark-muted-foreground" title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <ChevronLeftIcon className={`w-6 h-6 transition-transform ${isSidebarOpen ? '' : 'rotate-180'}`} />
          </button>
          <h1 className="text-xl font-semibold ml-2">{activePage}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative hidden md:block">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full md:w-64 lg:w-96 pl-10 pr-4 py-2 rounded-lg border bg-muted dark:bg-dark-muted border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-accent dark:hover:bg-dark-accent">
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Notification bell */}
          <button onClick={handleOpenNotices} className="relative p-2 rounded-full hover:bg-accent dark:hover:bg-dark-accent">
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button onClick={onOpenProfile} className="flex items-center space-x-2">
              <img
                src={currentUser.profilePicture}
                alt="User profile"
                className="w-10 h-10 rounded-full object-cover border-2 border-primary"
              />
              <div className="hidden sm:block text-left">
                <p className="font-semibold text-sm">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground">{currentUser.role}</p>
              </div>
            </button>
          </div>
          {onLogout && (
            <button onClick={onLogout} className="p-2 rounded-full hover:bg-accent dark:hover:bg-dark-accent" title="Logout">
              <LogoutIcon />
            </button>
          )}
        </div>
      </div>

    </header>
  );
};

export default Header;