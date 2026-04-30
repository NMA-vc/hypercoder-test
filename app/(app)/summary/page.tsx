import { Suspense } from 'react';
import { Metadata } from 'next';
import { CalendarIcon, TrendingUpIcon, CheckCircleIcon, ClockIcon } from 'lucide-react';
import WeeklyGrid from '@/components/weekly-grid';

export const metadata: Metadata = {
  title: 'Weekly Summary',
  description: 'View your weekly activity summary and insights',
};

interface SummaryStats {
  totalItems: number;
  completedItems: number;
  completionRate: number;
  activeWorkspaces: number;
}

interface WeeklySummaryData {
  data: Array<{
    date: string;
    day_name: string;
    items: any[];
    item_count: number;
    completion_rate: number;
  }>;
  week_start: string;
  week_end: string;
  total_items: number;
}

async function fetchWeeklySummary(): Promise<WeeklySummaryData> {
  const response = await fetch('http://localhost:3000/api/summary/weekly', {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch weekly summary');
  }
  
  return response.json();
}

async function fetchSummaryStats(): Promise<SummaryStats> {
  try {
    const [itemsResponse, workspacesResponse] = await Promise.all([
      fetch('http://localhost:3001/api/items?limit=1000&offset=0'),
      fetch('http://localhost:3001/api/workspaces'),
    ]);
    
    if (!itemsResponse.ok || !workspacesResponse.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const items = await itemsResponse.json();
    const workspaces = await workspacesResponse.json();
    
    const completedItems = items.filter((item: any) => 
      item.status === 'completed' || item.status === 'done'
    ).length;
    
    return {
      totalItems: items.length,
      completedItems,
      completionRate: items.length > 0 ? Math.round((completedItems / items.length) * 100) : 0,
      activeWorkspaces: workspaces.length,
    };
  } catch (error) {
    console.error('Error fetching summary stats:', error);
    return {
      totalItems: 0,
      completedItems: 0,
      completionRate: 0,
      activeWorkspaces: 0,
    };
  }
}

function StatCard({ icon: Icon, title, value, subtitle }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="h-6 w-6 text-blue-500" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm animate-pulse">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-gray-200 rounded"></div>
              <div className="ml-4 flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function SummaryPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Weekly Summary</h1>
        <p className="text-gray-600">
          Overview of your productivity and activity for this week
        </p>
      </div>
      
      <Suspense fallback={<LoadingSkeleton />}>
        <SummaryContent />
      </Suspense>
    </div>
  );
}

async function SummaryContent() {
  const [summaryData, stats] = await Promise.all([
    fetchWeeklySummary(),
    fetchSummaryStats(),
  ]);
  
  const weekStart = new Date(summaryData.week_start);
  const weekEnd = new Date(summaryData.week_end);
  
  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={CheckCircleIcon}
          title="Total Items"
          value={stats.totalItems}
          subtitle="Created this week"
        />
        <StatCard
          icon={TrendingUpIcon}
          title="Completed"
          value={stats.completedItems}
          subtitle={`${stats.completionRate}% completion rate`}
        />
        <StatCard
          icon={ClockIcon}
          title="Active Workspaces"
          value={stats.activeWorkspaces}
          subtitle="Currently in use"
        />
        <StatCard
          icon={CalendarIcon}
          title="This Week"
          value={summaryData.total_items}
          subtitle={`${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`}
        />
      </div>
      
      {/* Weekly Grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Weekly Activity</h2>
          <div className="text-sm text-gray-500">
            {weekStart.toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })} - {weekEnd.toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </div>
        </div>
        
        <WeeklyGrid data={summaryData.data} />
      </div>
    </div>
  );
}