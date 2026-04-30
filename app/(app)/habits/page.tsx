'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  PlusIcon, 
  FilterIcon,
  SearchIcon,
  TrendingUpIcon,
  CalendarIcon,
  TargetIcon,
  FlameIcon,
  CheckCircle2Icon,
  CircleIcon,
  EditIcon,
  TrashIcon,
  MoreVerticalIcon,
  ArrowRightIcon
} from 'lucide-react';

interface Habit {
  id: string;
  title: string;
  description?: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  target: number;
  unit: string;
  streak: number;
  lastCompleted?: string;
  completions: string[];
  color: string;
  icon: string;
  reminderEnabled: boolean;
  reminderTime?: string;
  createdAt: string;
  status: 'active' | 'paused' | 'completed';
}

interface HabitStats {
  totalHabits: number;
  activeHabits: number;
  completedToday: number;
  averageStreak: number;
}

interface HabitCardProps {
  habit: Habit;
  onToggleComplete: (habitId: string) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
}

interface FilterState {
  category: string;
  status: string;
  frequency: string;
  search: string;
}

function getStreakIcon(streak: number) {
  if (streak >= 30) return '🔥';
  if (streak >= 14) return '⭐';
  if (streak >= 7) return '💪';
  if (streak >= 3) return '🌱';
  return '🎯';
}

function isCompletedToday(habit: Habit): boolean {
  const today = new Date().toISOString().split('T')[0];
  return habit.completions?.includes(today) || false;
}

function HabitCard({ habit, onToggleComplete, onEdit, onDelete }: HabitCardProps) {
  let [showMenu, setShowMenu] = $state(false);
  
  const completed = isCompletedToday(habit);
  const progressPercent = habit.frequency === 'daily' ? 
    (completed ? 100 : 0) : 
    Math.min((habit.completions?.length || 0) / habit.target * 100, 100);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: habit.color }}
          >
            {habit.icon.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {habit.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {habit.category} • {habit.frequency}
            </p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreVerticalIcon className="w-4 h-4 text-gray-500" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
              <button
                onClick={() => {
                  onEdit(habit);
                  setShowMenu(false);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <EditIcon className="w-4 h-4 mr-3" />
                Edit Habit
              </button>
              <button
                onClick={() => {
                  onDelete(habit.id);
                  setShowMenu(false);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <TrashIcon className="w-4 h-4 mr-3" />
                Delete Habit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {habit.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {habit.description}
        </p>
      )}

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ 
              backgroundColor: habit.color,
              width: `${progressPercent}%`
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1">
            <FlameIcon className="w-4 h-4 text-orange-500" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {habit.streak}
            </span>
            <span className="text-sm">{getStreakIcon(habit.streak)}</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Day Streak</p>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {habit.target} {habit.unit}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Target</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onToggleComplete(habit.id)}
        disabled={completed && habit.frequency === 'daily'}
        className={`w-full py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
          completed
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
        }`}
      >
        {completed ? (
          <>
            <CheckCircle2Icon className="w-5 h-5" />
            <span>Completed Today</span>
          </>
        ) : (
          <>
            <CircleIcon className="w-5 h-5" />
            <span>Mark Complete</span>
          </>
        )}
      </button>
    </div>
  );
}

function StatsCard({ icon: Icon, title, value, subtitle }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="h-6 w-6 text-blue-500" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="ml-4 flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Habits Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1 w-32"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
              </div>
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-full"></div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="text-center">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HabitsPage() {
  let [habits, setHabits] = $state<Habit[]>([]);
  let [stats, setStats] = $state<HabitStats>({
    totalHabits: 0,
    activeHabits: 0,
    completedToday: 0,
    averageStreak: 0
  });
  let [isLoading, setIsLoading] = $state(true);
  let [filters, setFilters] = $state<FilterState>({
    category: '',
    status: '',
    frequency: '',
    search: ''
  });
  let [showFilters, setShowFilters] = $state(false);

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      setIsLoading(true);
      
      // Fetch items with habit type
      const response = await fetch('http://localhost:3001/api/items?item_type=habit&limit=100&offset=0');
      
      if (response.ok) {
        const items = await response.json();
        
        // Transform items to habits
        const habitData: Habit[] = items.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.content,
          category: item.metadata?.category || 'Other',
          frequency: item.metadata?.frequency || 'daily',
          target: item.metadata?.target || 1,
          unit: item.metadata?.unit || 'times',
          streak: item.metadata?.streak || 0,
          lastCompleted: item.metadata?.lastCompleted,
          completions: item.metadata?.completions || [],
          color: item.metadata?.color || '#3B82F6',
          icon: item.metadata?.icon || 'target',
          reminderEnabled: item.metadata?.reminderEnabled || false,
          reminderTime: item.metadata?.reminderTime,
          createdAt: item.created_at,
          status: item.status === 'active' ? 'active' : 'paused'
        }));
        
        setHabits(habitData);
        
        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        const completedTodayCount = habitData.filter(habit => 
          habit.completions?.includes(today)
        ).length;
        
        const activeHabitsCount = habitData.filter(habit => 
          habit.status === 'active'
        ).length;
        
        const avgStreak = habitData.length > 0 
          ? Math.round(habitData.reduce((sum, habit) => sum + habit.streak, 0) / habitData.length)
          : 0;
        
        setStats({
          totalHabits: habitData.length,
          activeHabits: activeHabitsCount,
          completedToday: completedTodayCount,
          averageStreak: avgStreak
        });
      }
    } catch (error) {
      console.error('Error loading habits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const today = new Date().toISOString().split('T')[0];
    const isCompleted = habit.completions?.includes(today);
    
    try {
      // Update completion status
      let newCompletions = [...(habit.completions || [])];
      let newStreak = habit.streak;
      
      if (isCompleted) {
        // Remove completion
        newCompletions = newCompletions.filter(date => date !== today);
        newStreak = Math.max(0, newStreak - 1);
      } else {
        // Add completion
        newCompletions.push(today);
        newStreak += 1;
      }
      
      // Update the habit in backend
      const updatedMetadata = {
        ...habit,
        completions: newCompletions,
        streak: newStreak,
        lastCompleted: isCompleted ? habit.lastCompleted : today
      };
      
      const response = await fetch(`http://localhost:3001/api/items/${habitId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: updatedMetadata
        }),
      });
      
      if (response.ok) {
        // Update local state
        setHabits(habits.map(h => 
          h.id === habitId 
            ? { ...h, completions: newCompletions, streak: newStreak }
            : h
        ));
        
        // Update stats
        const completedTodayCount = habits.filter(h => {
          if (h.id === habitId) {
            return newCompletions.includes(today);
          }
          return h.completions?.includes(today);
        }).length;
        
        setStats(prev => ({
          ...prev,
          completedToday: completedTodayCount
        }));
      }
    } catch (error) {
      console.error('Error updating habit:', error);
    }
  };

  const handleEdit = (habit: Habit) => {
    // TODO: Implement habit editing
    console.log('Edit habit:', habit.id);
  };

  const handleDelete = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:3001/api/items/${habitId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setHabits(habits.filter(h => h.id !== habitId));
        // Recalculate stats
        const newHabits = habits.filter(h => h.id !== habitId);
        const today = new Date().toISOString().split('T')[0];
        const completedTodayCount = newHabits.filter(habit => 
          habit.completions?.includes(today)
        ).length;
        
        setStats({
          totalHabits: newHabits.length,
          activeHabits: newHabits.filter(h => h.status === 'active').length,
          completedToday: completedTodayCount,
          averageStreak: newHabits.length > 0 
            ? Math.round(newHabits.reduce((sum, habit) => sum + habit.streak, 0) / newHabits.length)
            : 0
        });
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  // Filter habits
  const filteredHabits = habits.filter(habit => {
    if (filters.category && habit.category !== filters.category) return false;
    if (filters.status && habit.status !== filters.status) return false;
    if (filters.frequency && habit.frequency !== filters.frequency) return false;
    if (filters.search && !habit.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const categories = Array.from(new Set(habits.map(h => h.category)));
  const frequencies = ['daily', 'weekly', 'monthly'];
  const statuses = ['active', 'paused', 'completed'];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-48 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Habit Tracker
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Build consistency and track your daily habits
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <FilterIcon className="w-4 h-4 mr-2" />
            Filters
          </button>
          
          <Link
            href="/habits/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            New Habit
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          icon={TargetIcon}
          title="Total Habits"
          value={stats.totalHabits}
          subtitle={`${stats.activeHabits} active`}
        />
        <StatsCard
          icon={CheckCircle2Icon}
          title="Completed Today"
          value={stats.completedToday}
          subtitle={`${Math.round((stats.completedToday / Math.max(stats.activeHabits, 1)) * 100)}% completion rate`}
        />
        <StatsCard
          icon={FlameIcon}
          title="Average Streak"
          value={stats.averageStreak}
          subtitle="days"
        />
        <StatsCard
          icon={TrendingUpIcon}
          title="This Week"
          value="85%"
          subtitle="completion rate"
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search habits..."
                  className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white"
              >
                <option value="">All categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
            {/* Frequency Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency
              </label>
              <select
                value={filters.frequency}
                onChange={(e) => setFilters({ ...filters, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white"
              >
                <option value="">All frequencies</option>
                {frequencies.map(frequency => (
                  <option key={frequency} value={frequency}>{frequency}</option>
                ))}
              </select>
            </div>
            
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white"
              >
                <option value="">All statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Clear Filters */}
          {(filters.search || filters.category || filters.frequency || filters.status) && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setFilters({ category: '', status: '', frequency: '', search: '' })}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Habits Grid */}
      {filteredHabits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onToggleComplete={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <TargetIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {habits.length === 0 ? 'No habits yet' : 'No habits match your filters'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {habits.length === 0 
              ? 'Start building better habits by creating your first habit tracker.'
              : 'Try adjusting your filters or search terms to see more habits.'
            }
          </p>
          {habits.length === 0 && (
            <Link
              href="/habits/new"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Your First Habit
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}