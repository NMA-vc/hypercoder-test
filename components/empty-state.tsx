'use client';

import Link from 'next/link';
import { 
  PlusIcon, 
  SearchIcon,
  InboxIcon,
  FolderIcon,
  WidgetIcon,
  CalendarIcon,
  TargetIcon,
  ArrowRightIcon,
  RefreshCwIcon
} from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  illustration?: 'default' | 'search' | 'create' | 'error' | 'loading';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getIllustrationIcon(type: string) {
  switch (type) {
    case 'search':
      return SearchIcon;
    case 'create':
      return PlusIcon;
    case 'error':
      return RefreshCwIcon;
    case 'loading':
      return RefreshCwIcon;
    default:
      return InboxIcon;
  }
}

function getDefaultIcon(illustration: string) {
  switch (illustration) {
    case 'search':
      return SearchIcon;
    case 'create':
      return PlusIcon;
    case 'error':
      return RefreshCwIcon;
    case 'loading':
      return RefreshCwIcon;
    default:
      return InboxIcon;
  }
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  illustration = 'default',
  size = 'md',
  className = ''
}: EmptyStateProps) {
  const IconComponent = icon || getDefaultIcon(illustration);
  
  const sizeClasses = {
    sm: {
      container: 'py-8',
      icon: 'w-12 h-12',
      iconBg: 'w-16 h-16',
      title: 'text-lg',
      description: 'text-sm',
      spacing: 'space-y-3'
    },
    md: {
      container: 'py-12',
      icon: 'w-16 h-16',
      iconBg: 'w-24 h-24',
      title: 'text-xl',
      description: 'text-base',
      spacing: 'space-y-4'
    },
    lg: {
      container: 'py-16',
      icon: 'w-20 h-20',
      iconBg: 'w-32 h-32',
      title: 'text-2xl',
      description: 'text-lg',
      spacing: 'space-y-6'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={`text-center ${classes.container} ${className}`}>
      <div className={classes.spacing}>
        {/* Icon */}
        <div className="flex justify-center">
          <div className={`${classes.iconBg} bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center`}>
            <IconComponent className={`${classes.icon} text-gray-400 dark:text-gray-500`} />
          </div>
        </div>
        
        {/* Text */}
        <div className="max-w-md mx-auto">
          <h3 className={`font-semibold text-gray-900 dark:text-white ${classes.title} mb-2`}>
            {title}
          </h3>
          <p className={`text-gray-600 dark:text-gray-400 ${classes.description} leading-relaxed`}>
            {description}
          </p>
        </div>
        
        {/* Actions */}
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
            {action && (
              action.href ? (
                <Link
                  href={action.href}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                    action.variant === 'secondary'
                      ? 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      : 'text-white bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {action.label}
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Link>
              ) : (
                <button
                  onClick={action.onClick}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                    action.variant === 'secondary'
                      ? 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      : 'text-white bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {action.label}
                  {action.variant !== 'secondary' && <ArrowRightIcon className="w-4 h-4 ml-2" />}
                </button>
              )
            )}
            
            {secondaryAction && (
              secondaryAction.href ? (
                <Link
                  href={secondaryAction.href}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  {secondaryAction.label}
                </Link>
              ) : (
                <button
                  onClick={secondaryAction.onClick}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  {secondaryAction.label}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Predefined empty states for common use cases
export function WorkspacesEmptyState() {
  return (
    <EmptyState
      icon={FolderIcon}
      title="No workspaces yet"
      description="Organize your projects and ideas by creating your first workspace. Each workspace can contain multiple items and help you stay organized."
      action={{
        label: "Create Workspace",
        href: "/workspaces/new"
      }}
      secondaryAction={{
        label: "Learn More",
        href: "/help/workspaces"
      }}
    />
  );
}

export function WidgetsEmptyState() {
  return (
    <EmptyState
      icon={WidgetIcon}
      title="No widgets configured"
      description="Widgets help you visualize your data and track important metrics. Create your first widget to get started with your dashboard."
      action={{
        label: "Add Widget",
        href: "/widgets/new"
      }}
      secondaryAction={{
        label: "Browse Templates",
        href: "/widgets/templates"
      }}
    />
  );
}

export function HabitsEmptyState() {
  return (
    <EmptyState
      icon={TargetIcon}
      title="No habits yet"
      description="Start building better habits by creating your first habit tracker. Track your progress and build consistency in your daily routine."
      action={{
        label: "Create Habit",
        href: "/habits/new"
      }}
      secondaryAction={{
        label: "View Examples",
        href: "/habits/examples"
      }}
    />
  );
}

export function ItemsEmptyState() {
  return (
    <EmptyState
      icon={InboxIcon}
      title="No items in this workspace"
      description="Items are the building blocks of your workspace. Add tasks, notes, or other content to get started."
      action={{
        label: "Add Item",
        href: "/items/new"
      }}
    />
  );
}

export function SearchEmptyState({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={SearchIcon}
      title={query ? `No results for "${query}"` : "No search results"}
      description="Try adjusting your search terms or filters to find what you're looking for. You can search by title, content, or tags."
      action={{
        label: "Clear Filters",
        onClick: () => {
          // This would be implemented by the parent component
          console.log('Clear filters clicked');
        },
        variant: "secondary"
      }}
      illustration="search"
      size="sm"
    />
  );
}

export function ErrorEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      title="Failed to load data"
      description="We encountered an error while loading your data. This might be a temporary issue. Please try again."
      action={{
        label: "Try Again",
        onClick: onRetry || (() => window.location.reload()),
        variant: "secondary"
      }}
      illustration="error"
    />
  );
}

export function LoadingEmptyState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="text-center py-12">
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">{message}</p>
        </div>
      </div>
    </div>
  );
}