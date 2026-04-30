'use client';

import { Inter } from 'next/font/google';
import Nav from '@/components/nav';
import { ThemeProvider } from '@/components/theme-provider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  let isAuthenticated = $state(false);
  let isLoading = $state(true);
  let user = $state<{ id: string; email: string } | null>(null);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          router.push('/auth/login');
          return;
        }

        // TODO: Validate token with backend when auth endpoints are ready
        // For now, we'll assume the token is valid if it exists
        // In a real implementation, you would:
        // 1. Send the token to the backend for validation
        // 2. Get user information from the response
        // 3. Handle token expiration
        
        // Mock user data - replace with actual API call
        user = {
          id: 'temp_user_123',
          email: 'user@example.com'
        };
        
        isAuthenticated = true;
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('auth_token');
        router.push('/auth/login');
      } finally {
        isLoading = false;
      }
    };

    checkAuth();
  }, [router]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <ThemeProvider>
        <div className={`${inter.className} min-h-screen bg-gray-50 dark:bg-gray-900`}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Show login redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <div className={`${inter.className} min-h-screen bg-gray-50 dark:bg-gray-900`}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className={`${inter.className} min-h-screen bg-gray-50 dark:bg-gray-900`}>
        <Nav />
        <main className="flex-1">
          {children}
        </main>
        
        {/* Global styles and utilities */}
        <style jsx global>{`
          .line-clamp-1 {
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 1;
          }
          
          .line-clamp-2 {
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }
          
          .line-clamp-3 {
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
          }
          
          /* Custom scrollbar styles */
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: rgb(156 163 175) transparent;
          }
          
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgb(156 163 175);
            border-radius: 3px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgb(107 114 128);
          }
          
          /* Dark mode scrollbar */
          .dark .custom-scrollbar {
            scrollbar-color: rgb(75 85 99) transparent;
          }
          
          .dark .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgb(75 85 99);
          }
          
          .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgb(107 114 128);
          }
        `}</style>
      </div>
    </ThemeProvider>
  );
}

// Error Boundary Component for handling runtime errors
export function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App layout error:', error);
  }, [error]);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Something went wrong!
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Try again
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Go home
            </button>
          </div>
          
          {error.digest && (
            <p className="text-xs text-gray-400 mt-4">
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}