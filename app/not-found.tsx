'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  HomeIcon, 
  ArrowLeftIcon,
  SearchIcon,
  ExclamationTriangleIcon
} from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  const suggestedPages = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      description: 'Go to your main dashboard',
      icon: HomeIcon
    },
    {
      name: 'Workspaces',
      href: '/workspaces',
      description: 'Browse your workspaces',
      icon: SearchIcon
    },
    {
      name: 'Widgets',
      href: '/widgets',
      description: 'Manage your widgets',
      icon: SearchIcon
    },
    {
      name: 'Habits',
      href: '/habits',
      description: 'Track your habits',
      icon: SearchIcon
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* 404 Icon */}
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-8">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          </div>
          
          {/* Error Code */}
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
            404
          </h1>
          
          {/* Error Message */}
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Page Not Found
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. The page might have been moved, deleted, or you may have entered an incorrect URL.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              Go Back
            </button>
            
            <Link
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <HomeIcon className="w-5 h-5 mr-2" />
              Go to Dashboard
            </Link>
          </div>

          {/* Suggested Pages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              Try these pages instead
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suggestedPages.map((page) => (
                <Link
                  key={page.name}
                  href={page.href}
                  className="group block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                        <page.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {page.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {page.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              If you believe this is an error, please{' '}
              <Link 
                href="/support" 
                className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                contact support
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <svg
          className="absolute left-[50%] top-0 h-[64rem] w-[128rem] -translate-x-1/2 stroke-gray-200 dark:stroke-gray-800 [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)]"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="e813992c-7d03-4cc4-a2bd-151760b470a0"
              width={200}
              height={200}
              x="50%"
              y={-1}
              patternUnits="userSpaceOnUse"
            >
              <path d="M100 200V.5M.5 .5H200" fill="none" />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            strokeWidth={0}
            fill="url(#e813992c-7d03-4cc4-a2bd-151760b470a0)"
          />
        </svg>
      </div>
    </div>
  );
}