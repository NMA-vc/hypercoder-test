'use client';

import { 
  BarChart3Icon, 
  TrendingUpIcon, 
  UsersIcon,
  FolderIcon,
  WidgetIcon,
  CalendarIcon,
  ClockIcon,
  ActivityIcon,
  PieChartIcon,
  LineChartIcon
} from 'lucide-react';

function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="animate-pulse">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="ml-4 flex-1">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCardSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded mx-auto mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-24 mx-auto mb-1"></div>
            <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-16 mx-auto"></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    </div>
  );
}

function RecentItemsSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
        
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-4 p-3 border border-gray-100 dark:border-gray-700 rounded-lg">
              <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1"></div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActionsSkeleton() {
  const actions = [
    { icon: FolderIcon, name: 'New Workspace' },
    { icon: WidgetIcon, name: 'Add Widget' },
    { icon: CalendarIcon, name: 'Schedule Task' },
    { icon: ActivityIcon, name: 'View Analytics' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
        
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <div key={index} className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg">
              <div className="flex flex-col items-center text-center">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2 flex items-center justify-center">
                  <action.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityTimelineSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-36 mb-6"></div>
        
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative">
              <div className="flex items-start space-x-4">
                <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full mt-1 flex-shrink-0 relative z-10"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-1"></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              </div>
              {i < 3 && (
                <div className="absolute left-1.5 top-4 w-px h-6 bg-gray-200 dark:bg-gray-700"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-blue-200 dark:bg-blue-700 rounded-lg"></div>
          <div className="w-4 h-4 bg-blue-200 dark:bg-blue-700 rounded"></div>
        </div>
        <div className="h-8 bg-blue-200 dark:bg-blue-700 rounded mb-2"></div>
        <div className="h-3 bg-blue-200 dark:bg-blue-700 rounded w-24 mb-4"></div>
        <div className="h-2 bg-blue-200 dark:bg-blue-700 rounded-full mb-2"></div>
        <div className="h-2 bg-blue-200 dark:bg-blue-700 rounded w-16"></div>
      </div>
    </div>
  );
}

function LoadingHeader() {
  return (
    <div className="mb-8">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-3"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <LoadingHeader />
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Primary Chart */}
        <div className="lg:col-span-8">
          <ChartCardSkeleton title="Activity Overview" />
        </div>
        
        {/* Quick Actions */}
        <div className="lg:col-span-4">
          <QuickActionsSkeleton />
        </div>
      </div>
      
      {/* Secondary Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Recent Items */}
        <div className="lg:col-span-7">
          <RecentItemsSkeleton />
        </div>
        
        {/* Activity Timeline */}
        <div className="lg:col-span-5">
          <ActivityTimelineSkeleton />
        </div>
      </div>
      
      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ChartCardSkeleton title="Performance" />
        <ChartCardSkeleton title="Progress" />
        <MetricCardSkeleton />
      </div>
      
      {/* Loading Indicator */}
      <div className="fixed bottom-6 right-6 z-40">
        <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
      
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-blue-50 dark:bg-blue-900/10 rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-purple-50 dark:bg-purple-900/10 rounded-full opacity-30 animate-pulse [animation-delay:1s]"></div>
        <div className="absolute top-2/3 left-1/4 w-48 h-48 bg-green-50 dark:bg-green-900/10 rounded-full opacity-30 animate-pulse [animation-delay:2s]"></div>
      </div>
    </div>
  );
}