'use client';

import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  canConfigureQuestionnaire,
  canExportData,
  canManageUsers,
} from '@/lib/utils';
import {
  Building2,
  ClipboardList,
  Download,
  LogOut,
  Map,
  Menu,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  permission?: (role: 'auditor' | 'admin' | 'super_admin') => boolean;
}

const navItems: NavItem[] = [
  {
    href: '/facilities',
    label: 'Facilities',
    icon: <Map className="h-5 w-5" />,
  },
  {
    href: '/questionnaire',
    label: 'Questionnaire',
    icon: <ClipboardList className="h-5 w-5" />,
    permission: canConfigureQuestionnaire,
  },
  {
    href: '/users',
    label: 'Users',
    icon: <Users className="h-5 w-5" />,
    permission: canManageUsers,
  },
  {
    href: '/import-export',
    label: 'Import/Export',
    icon: <Download className="h-5 w-5" />,
    permission: canExportData,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    if (!profile?.role) return false;
    return item.permission(profile.role);
  });

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
        <Building2 className="h-8 w-8 text-blue-600" />
        <span className="font-bold text-lg text-gray-900">Mirar</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-medium text-blue-700">
              {profile?.full_name?.[0] || profile?.email?.[0] || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate capitalize">
              {profile?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            <span className="font-bold text-lg text-gray-900">Mirar</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex flex-col h-full">
          <NavContent />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white">
        <NavContent />
      </aside>
    </>
  );
}
