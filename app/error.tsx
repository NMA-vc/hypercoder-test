'use client';

import { useEffect } from 'react';
import { 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon,
  BugAntIcon
} from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  const getErrorTitle = () => {
    if (error.message.includes('Network')) {
      return 'Network Connection Error';
    }
    if (error.message.includes('fetch')) {
      return 'Data Loading Error';
    }
    if (error.message.includes('Auth')) {
      return 'Authentication Error';
    }
    return 'Something went wrong';
  };

  const getErrorDescription = () => {
    if (error.message.includes('Network')) {
      return 'Unable to connect to our servers. Please check your internet connection and try again.';
    }
    if (error.message.includes('fetch')) {
      return 'We had trouble loading your data. This might be a temporary issue.';
    }
    if (error.message.includes('Auth')) {
      return 'There was a problem with your authentication. You may need to sign in again.';
    }
    return 'An unexpected error occurred. Our team has been notified and is working on a fix.';
  };

  const getErrorIcon = () => {
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return BugAntIcon;
    }
    return ExclamationTriangleIcon;
  };

  const ErrorIcon = getErrorIcon();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* Error Icon */}
          <div className="mx-auto w-24 h-24 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-8">
            <ErrorIcon className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
          
          {/* Error Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {getErrorTitle()}
          </h1>
          
          {/* Error Description */}
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
            {getErrorDescription()}
          </p>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-8">
              <details className="text-left bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-w-lg mx-auto">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Technical Details
                </summary>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-gray-900 p-3 rounded border">
                  <p className="mb-2"><strong>Error:</strong> {error.message}</p>
                  {error.digest && (
                    <p className="mb-2"><strong>Error ID:</strong> {error.digest}</p>
                  )}
                  {error.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="mt-1 text-xs whitespace-pre-wrap">
                        {error.stack.split('\n').slice(0, 10).join('\n')}
                        {error.stack.split('\n').length > 10 && '\n... (truncated)'}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <button
              onClick={() => {
                // Clear any cached data and reset
                if (typeof window !== 'undefined') {
                  // Clear localStorage items that might be causing issues
                  const keysToRemove = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.includes('cache') || key.includes('temp'))) {
                      keysToRemove.push(key);
                    }
                  }
                  keysToRemove.forEach(key => localStorage.removeItem(key));
                }
                reset();
              }}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-w-[140px]"
            >
              <ArrowPathIcon className="w-5 h-5 mr-2" />
              Try Again
            </button>
            
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-w-[140px]"
            >
              <HomeIcon className="w-5 h-5 mr-2" />
              Go Home
            </button>
          </div>

          {/* Additional Help */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-lg mx-auto">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
              Need Additional Help?
            </h3>
            <div className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <p>• Try refreshing the page</p>
              <p>• Check your internet connection</p>
              <p>• Clear your browser cache</p>
              <p>• Contact support if the problem persists</p>
            </div>
          </div>

          {/* Error ID for Support */}
          {error.digest && (
            <div className="mt-6">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Error Reference: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{error.digest}</code>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Please include this reference when contacting support
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <svg
          className="absolute left-[50%] top-0 h-[64rem] w-[128rem] -translate-x-1/2 stroke-red-200 dark:stroke-red-800/30 [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)] opacity-20"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="error-pattern"
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
            fill="url(#error-pattern)"
          />
        </svg>
      </div>
    </div>
  );
}