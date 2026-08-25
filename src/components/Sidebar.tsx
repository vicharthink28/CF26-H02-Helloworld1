import { useState } from 'react';
import type { Page, AuthUser } from '../types';

const navItems = [
  {
    id: 'dashboard' as Page,
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: 'resources' as Page,
    label: 'Resources',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'transactions' as Page,
    label: 'Transactions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

// Derive 1–2 letter initials from the user's display name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Role badge colour
const roleBadgeColor: Record<string, string> = {
  Doctor: 'text-teal-400',
  Nurse: 'text-blue-400',
  'Hospital Admin': 'text-purple-400',
};

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  activeTransactionCount: number;
  user: AuthUser;
  onLogout: () => void;
}

export function Sidebar({
  currentPage,
  onNavigate,
  activeTransactionCount,
  user,
  onLogout,
}: SidebarProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);

  function handleLogoutClick() {
    if (confirmLogout) {
      onLogout();
    } else {
      setConfirmLogout(true);
      // Auto-reset confirmation state after 3 s if user doesn't click again
      setTimeout(() => setConfirmLogout(false), 3000);
    }
  }

  const initials = getInitials(user.name);
  const roleColor = roleBadgeColor[user.role] ?? 'text-navy-400';

  return (
    <aside className="w-64 bg-navy-900 text-white flex flex-col h-screen absolute left-0 top-0 z-40">

      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-teal-400 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">PulseCare</h1>
        </div>
        <p className="text-navy-300 text-xs mt-2 ml-1">Clinical Resource Network</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 text-sm font-medium transition-all duration-150 ${currentPage === item.id
                ? 'bg-teal-500 text-navy-900 shadow-lg'
                : 'text-navy-200 hover:bg-navy-800 hover:text-white'
              }`}
          >
            {item.icon}
            {item.label}
            {item.id === 'transactions' && activeTransactionCount > 0 && (
              <span className="ml-auto bg-teal-400 text-navy-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {activeTransactionCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Profile + Logout */}
      <div className="p-4 border-t border-navy-700 space-y-2">

        {/* User card */}
        <div className="flex items-center gap-3 px-2 py-1">
          {/* Avatar */}
          <div className="w-9 h-9 bg-teal-500/20 border border-teal-500/40 rounded-full flex items-center justify-center text-xs font-bold text-teal-300 flex-shrink-0">
            {initials}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.name}</p>
            <p className={`text-xs font-medium truncate ${roleColor}`}>{user.role}</p>
          </div>
        </div>

        {/* Logout button — first click shows confirmation, second click logs out */}
        <button
          onClick={handleLogoutClick}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${confirmLogout
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'text-navy-300 hover:bg-navy-800 hover:text-white'
            }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {confirmLogout ? 'Tap again to confirm' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
