'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  FolderIcon, 
  WidgetIcon,
  CalendarIcon,
  SettingsIcon,
  MenuIcon,
  XIcon,
  UserIcon,
  LogOutIcon,
  PlusIcon
} from 'lucide-react';
import ThemeToggle from './theme-toggle';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Workspaces', href: '/workspaces', icon: FolderIcon },
  { name: 'Widgets', href: '/widgets', icon: WidgetIcon },
  { name: 'Summary', href: '/summary', icon: CalendarIcon },
];

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

function UserMenu({ isOpen, onClose }: UserMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white">John Doe</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">john@example.com</p>
      </div>
      
      <Link
        href="/profile"
        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={onClose}
      >
        <UserIcon className="w-4 h-4 mr-3" />
        Profile
      </Link>
      
      <Link
        href="/settings"
        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={onClose}
      >
        <SettingsIcon className="w-4 h-4 mr-3" />
        Settings
      </Link>
      
      <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
        <button
          className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          onClick={() => {
            // TODO: Implement logout functionality
            console.log('Logout clicked');
            onClose();
          }}
        >
          <LogOutIcon className="w-4 h-4 mr-3" />
          Sign out
        </button>
      </div>
    </div>
  );
}

interface QuickActionsProps {
  isOpen: boolean;
  onClose: () => void;
}

function QuickActions({ isOpen, onClose }: QuickActionsProps) {
  if (!isOpen) return null;

  const actions = [
    { name: 'New Workspace', href: '/workspaces/new', description: 'Create a new workspace' },
    { name: 'New Widget', href: '/widgets/new', description: 'Add a new widget' },
    { name: 'New Item', href: '/items/new', description: 'Create a new item' },
  ];

  return (
    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white">Quick Actions</p>
      </div>
      
      <div className="py-1">
        {actions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className="block px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={onClose}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {action.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {action.description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />
      
      <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="px-6 py-4">
          <div className="space-y-2">
            {navigation.map((item) => {
              const isActive = item.exact 
                ? pathname === item.href 
                : pathname?.startsWith(item.href);
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                  onClick={onClose}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  let [mobileMenuOpen, setMobileMenuOpen] = $state(false);
  let [userMenuOpen, setUserMenuOpen] = $state(false);
  let [quickActionsOpen, setQuickActionsOpen] = $state(false);

  // Close menus when pathname changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setQuickActionsOpen(false);
  }, [pathname]);

  // Close menus on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
        setQuickActionsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Desktop Navigation */}
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <MenuIcon className="w-6 h-6" />
              </button>
              
              {/* Logo */}
              <Link href="/" className="flex items-center ml-4 lg:ml-0">
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  Dashboard
                </div>
              </Link>
              
              {/* Desktop Navigation */}
              <div className="hidden lg:ml-10 lg:flex lg:space-x-8">
                {navigation.map((item) => {
                  const isActive = item.exact 
                    ? pathname === item.href 
                    : pathname?.startsWith(item.href);
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-b-2 border-blue-500 text-gray-900 dark:text-white'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* Quick Actions */}
              <div className="relative">
                <button
                  onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Quick Actions"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
                <QuickActions 
                  isOpen={quickActionsOpen} 
                  onClose={() => setQuickActionsOpen(false)} 
                />
              </div>
              
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">JD</span>
                  </div>
                </button>
                <UserMenu 
                  isOpen={userMenuOpen} 
                  onClose={() => setUserMenuOpen(false)} 
                />
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile Navigation */}
      <MobileNav 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />
    </>
  );
}