'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRightIcon, 
  BarChartIcon,
  FolderIcon,
  WidgetIcon,
  CalendarIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  ShieldCheckIcon,
  ZapIcon
} from 'lucide-react';

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}

function FeatureCard({ icon: Icon, title, description, href }: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-blue-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 transition-colors group-hover:bg-blue-200 dark:bg-blue-900 dark:group-hover:bg-blue-800">
            <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors dark:text-white dark:group-hover:text-blue-400">
            {title}
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
        <ArrowRightIcon className="h-5 w-5 text-gray-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
      </div>
    </Link>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

function StatCard({ icon: Icon, value, label, change, changeType = 'neutral' }: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label}</p>
          {change && (
            <p className={`text-xs mt-1 ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          {/* Hero Section Skeleton */}
          <div className="text-center mb-16">
            <div className="h-12 bg-gray-200 rounded-lg mb-4 mx-auto max-w-2xl dark:bg-gray-700"></div>
            <div className="h-6 bg-gray-200 rounded-lg mb-8 mx-auto max-w-xl dark:bg-gray-700"></div>
            <div className="h-12 bg-gray-200 rounded-lg mx-auto w-48 dark:bg-gray-700"></div>
          </div>
          
          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <div className="h-6 bg-gray-200 rounded mb-2 dark:bg-gray-700"></div>
                <div className="h-8 bg-gray-200 rounded mb-2 dark:bg-gray-700"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 dark:bg-gray-700"></div>
              </div>
            ))}
          </div>
          
          {/* Features Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-start space-x-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg dark:bg-gray-700"></div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 rounded mb-2 dark:bg-gray-700"></div>
                    <div className="h-4 bg-gray-200 rounded mb-1 dark:bg-gray-700"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 dark:bg-gray-700"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  let isLoading = $state(true);
  let stats = $state({
    workspaces: 0,
    items: 0,
    widgets: 0,
    completionRate: 0
  });

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [workspacesRes, itemsRes, widgetsRes] = await Promise.allSettled([
          fetch('/api/workspaces').catch(() => ({ ok: false })),
          fetch('/api/items?limit=1000&offset=0').catch(() => ({ ok: false })),
          fetch('/api/widgets').catch(() => ({ ok: false }))
        ]);

        if (!mounted) return;

        // Handle workspaces
        let workspaceCount = 0;
        if (workspacesRes.status === 'fulfilled' && workspacesRes.value.ok) {
          try {
            const workspaces = await workspacesRes.value.json();
            workspaceCount = Array.isArray(workspaces) ? workspaces.length : 0;
          } catch {
            workspaceCount = 0;
          }
        }

        // Handle items
        let itemCount = 0;
        let completedItems = 0;
        if (itemsRes.status === 'fulfilled' && itemsRes.value.ok) {
          try {
            const items = await itemsRes.value.json();
            if (Array.isArray(items)) {
              itemCount = items.length;
              completedItems = items.filter(item => 
                item.status === 'completed' || item.status === 'done'
              ).length;
            }
          } catch {
            itemCount = 0;
            completedItems = 0;
          }
        }

        // Handle widgets
        let widgetCount = 0;
        if (widgetsRes.status === 'fulfilled' && widgetsRes.value.ok) {
          try {
            const widgetData = await widgetsRes.value.json();
            widgetCount = Array.isArray(widgetData) ? widgetData.length : 
                          (widgetData.widgets && Array.isArray(widgetData.widgets)) ? widgetData.widgets.length : 0;
          } catch {
            widgetCount = 0;
          }
        }

        const completionRate = itemCount > 0 ? Math.round((completedItems / itemCount) * 100) : 0;

        if (mounted) {
          stats = {
            workspaces: workspaceCount,
            items: itemCount,
            widgets: widgetCount,
            completionRate
          };
          isLoading = false;
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        if (mounted) {
          isLoading = false;
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const features = [
    {
      icon: FolderIcon,
      title: 'Workspaces',
      description: 'Organize your projects and ideas into dedicated workspaces for better focus.',
      href: '/workspaces'
    },
    {
      icon: WidgetIcon,
      title: 'Widgets',
      description: 'Create custom widgets to visualize your data and track important metrics.',
      href: '/widgets'
    },
    {
      icon: CalendarIcon,
      title: 'Weekly Summary',
      description: 'Get insights into your productivity with detailed weekly activity reports.',
      href: '/summary'
    },
    {
      icon: BarChartIcon,
      title: 'Dashboard',
      description: 'View all your key metrics and information in one centralized location.',
      href: '/dashboard'
    },
    {
      icon: SparklesIcon,
      title: 'Smart Analytics',
      description: 'AI-powered insights to help you understand your work patterns and optimize productivity.',
      href: '/analytics'
    },
    {
      icon: ZapIcon,
      title: 'Quick Actions',
      description: 'Streamlined workflows and shortcuts to help you get things done faster.',
      href: '/quick-actions'
    }
  ];

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl dark:text-white mb-6">
            Welcome to Your
            <span className="text-blue-600 dark:text-blue-400"> Dashboard</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-400 mb-8">
            Manage your workspaces, track your progress, and visualize your data all in one place. 
            Get started by exploring your features or diving into your analytics.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
            >
              Go to Dashboard
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </button>
            <button
              onClick={() => router.push('/workspaces')}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              Explore Workspaces
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <StatCard
            icon={FolderIcon}
            value={stats.workspaces.toString()}
            label="Active Workspaces"
            change="+2 this week"
            changeType="positive"
          />
          <StatCard
            icon={BarChartIcon}
            value={stats.items.toString()}
            label="Total Items"
            change="+12 this week"
            changeType="positive"
          />
          <StatCard
            icon={WidgetIcon}
            value={stats.widgets.toString()}
            label="Active Widgets"
            change="+1 this week"
            changeType="positive"
          />
          <StatCard
            icon={TrendingUpIcon}
            value={`${stats.completionRate}%`}
            label="Completion Rate"
            change={stats.completionRate > 75 ? "+5% this week" : "Needs improvement"}
            changeType={stats.completionRate > 75 ? "positive" : "neutral"}
          />
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Powerful Features
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              Discover all the tools and capabilities at your disposal to boost your productivity.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                href={feature.href}
              />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="rounded-2xl bg-blue-600 px-6 py-16 shadow-xl">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="mx-auto max-w-xl text-xl text-blue-100 mb-8">
              Create your first workspace and start organizing your projects today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => router.push('/workspaces/new')}
                className="inline-flex items-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
              >
                Create Workspace
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => router.push('/summary')}
                className="inline-flex items-center rounded-lg border border-white px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
              >
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}