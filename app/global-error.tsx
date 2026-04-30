'use client';

import { useEffect } from 'react';
import { 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ShieldExclamationIcon
} from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the critical error to an error reporting service
    console.error('Critical application error:', error);
    
    // In a real application, you would send this to your error tracking service
    // Example: Sentry.captureException(error);
  }, [error]);

  const handleReset = () => {
    try {
      // Clear all localStorage and sessionStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear any cached service worker data
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations()
            .then(registrations => {
              registrations.forEach(registration => {
                registration.unregister();
              });
            })
            .catch(console.warn);
        }
        
        // Clear any cached data
        if ('caches' in window) {
          caches.keys()
            .then(names => {
              names.forEach(name => {
                caches.delete(name);
              });
            })
            .catch(console.warn);
        }
      }
      
      // Attempt to reset the application
      reset();
    } catch (resetError) {
      console.error('Error during reset:', resetError);
      // If reset fails, force a full page reload
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <html>
      <body>
        <div className="min-h-screen bg-red-50 dark:bg-red-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center">
              {/* Critical Error Icon */}
              <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
                <ShieldExclamationIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              
              {/* Error Title */}
              <h1 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-4">
                Critical Application Error
              </h1>
              
              {/* Error Message */}
              <p className="text-red-700 dark:text-red-300 mb-6 leading-relaxed">
                A critical error has occurred that prevented the application from loading properly. 
                This is usually caused by a JavaScript error or corrupted application state.
              </p>

              {/* Error Details for Development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-6 text-left">
                  <details className="bg-red-100 dark:bg-red-900/50 rounded-lg p-4">
                    <summary className="cursor-pointer text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      Error Details
                    </summary>
                    <div className="text-xs text-red-700 dark:text-red-300 font-mono bg-white dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                      <p className="mb-2"><strong>Error:</strong> {error.message}</p>
                      {error.digest && (
                        <p className="mb-2"><strong>Digest:</strong> {error.digest}</p>
                      )}
                      {error.stack && (
                        <div>
                          <strong>Stack:</strong>
                          <pre className="mt-1 text-xs whitespace-pre-wrap max-h-32 overflow-auto">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleReset}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <ArrowPathIcon className="w-5 h-5 mr-2" />
                  Reset Application
                </button>
                
                <button
                  onClick={handleReload}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-red-300 dark:border-red-700 text-base font-medium rounded-lg text-red-700 dark:text-red-300 bg-white dark:bg-red-950 hover:bg-red-50 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Reload Page
                </button>
                
                <button
                  onClick={handleGoHome}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-red-300 dark:border-red-700 text-base font-medium rounded-lg text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Go to Homepage
                </button>
              </div>

              {/* Help Information */}
              <div className="mt-8 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  What you can do:
                </h3>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 text-left">
                  <li>• Try the "Reset Application" button above</li>
                  <li>• Refresh your browser completely</li>
                  <li>• Clear your browser cache and cookies</li>
                  <li>• Disable browser extensions temporarily</li>
                  <li>• Try using an incognito/private browsing window</li>
                  <li>• Contact support if the problem persists</li>
                </ul>
              </div>

              {/* Error Reference */}
              {error.digest && (
                <div className="mt-6 text-center">
                  <p className="text-xs text-red-500 dark:text-red-400">
                    Error Reference: 
                    <code className="bg-red-200 dark:bg-red-800 px-2 py-1 rounded ml-1">
                      {error.digest}
                    </code>
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Include this reference when reporting the issue
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inline Styles for Global Error */}
        <style jsx global>{`
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          }
          
          .dark {
            color-scheme: dark;
          }
          
          details summary {
            outline: none;
          }
          
          details summary:focus {
            outline: 2px solid #dc2626;
            outline-offset: 2px;
            border-radius: 4px;
          }
          
          @media (prefers-color-scheme: dark) {
            body {
              background-color: #7f1d1d;
              color: #fef2f2;
            }
          }
        `}</style>

        {/* Emergency Debug Information */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            backgroundColor: '#000',
            color: '#fff',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            maxWidth: '300px',
            wordBreak: 'break-all',
            opacity: 0.8,
            zIndex: 9999
          }}>
            <div>Build: {process.env.NODE_ENV}</div>
            <div>Error: {error.name}</div>
            <div>Time: {new Date().toISOString()}</div>
            {error.digest && <div>ID: {error.digest.slice(0, 8)}</div>}
          </div>
        )}
      </body>
    </html>
  );
}