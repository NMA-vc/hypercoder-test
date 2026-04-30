'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon, 
  CalendarIcon, 
  ClockIcon, 
  TargetIcon,
  BellIcon,
  RepeatIcon,
  CheckCircleIcon,
  XCircleIcon
} from 'lucide-react';

interface HabitFormData {
  title: string;
  description: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  target: number;
  unit: string;
  reminderEnabled: boolean;
  reminderTime: string;
  color: string;
  icon: string;
}

const HABIT_CATEGORIES = [
  'Health & Fitness',
  'Learning',
  'Productivity',
  'Mindfulness',
  'Social',
  'Creative',
  'Financial',
  'Other'
];

const HABIT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#EC4899', // pink
  '#6B7280', // gray
];

const HABIT_ICONS = [
  'target',
  'heart',
  'book',
  'brain',
  'dumbbell',
  'coffee',
  'moon',
  'sun',
  'users',
  'music',
  'pen-tool',
  'dollar-sign',
  'clock',
  'star'
];

export default function NewHabitPage() {
  const router = useRouter();
  let [formData, setFormData] = $state<HabitFormData>({
    title: '',
    description: '',
    category: '',
    frequency: 'daily',
    target: 1,
    unit: 'times',
    reminderEnabled: false,
    reminderTime: '09:00',
    color: HABIT_COLORS[0],
    icon: HABIT_ICONS[0]
  });
  let [isSubmitting, setIsSubmitting] = $state(false);
  let [errors, setErrors] = $state<Record<string, string>>({});
  let [showSuccessMessage, setShowSuccessMessage] = $state(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.target <= 0) {
      newErrors.target = 'Target must be greater than 0';
    } else if (formData.target > 1000) {
      newErrors.target = 'Target must be less than 1000';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Unit is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create habit as an item in the backend
      const habitItem = {
        title: formData.title,
        content: formData.description,
        item_type: 'habit',
        workspace_id: 'default-workspace', // TODO: Get from user's default workspace
        metadata: {
          category: formData.category,
          frequency: formData.frequency,
          target: formData.target,
          unit: formData.unit,
          reminderEnabled: formData.reminderEnabled,
          reminderTime: formData.reminderTime,
          color: formData.color,
          icon: formData.icon,
          streak: 0,
          lastCompleted: null,
          completions: []
        },
        tags: ['habit', formData.category.toLowerCase().replace(/\s+/g, '-')],
        status: 'active'
      };

      const response = await fetch('http://localhost:3001/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authorization header when auth is implemented
        },
        body: JSON.stringify(habitItem),
      });

      if (!response.ok) {
        throw new Error('Failed to create habit');
      }

      setShowSuccessMessage(true);
      
      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push('/habits');
      }, 1500);
      
    } catch (error) {
      console.error('Error creating habit:', error);
      setErrors({ general: 'Failed to create habit. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: keyof HabitFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
    // Clear field error when user starts typing
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  if (showSuccessMessage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Habit Created Successfully!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your new habit "{formData.title}" has been created.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            Redirecting to habits page...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/habits"
          className="inline-flex items-center text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back to Habits
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Create New Habit
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Build a new positive habit to track and improve your daily routine.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* General Error */}
        {errors.general && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <XCircleIcon className="w-5 h-5 text-red-500 mr-3" />
              <p className="text-red-700 dark:text-red-300">{errors.general}</p>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Basic Information
          </h3>
          
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Habit Name *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                placeholder="e.g., Morning meditation, Daily reading, Drink water"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 ${
                  errors.title ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Optional description of your habit and why it's important to you..."
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 ${
                  errors.description ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">{errors.description}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category *
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => updateFormData('category', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white ${
                  errors.category ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="">Select a category</option>
                {HABIT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-red-500 text-sm mt-1">{errors.category}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tracking Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TargetIcon className="w-5 h-5 mr-2" />
            Tracking Settings
          </h3>
          
          <div className="space-y-4">
            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Frequency
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => updateFormData('frequency', freq)}
                    className={`p-3 rounded-lg border-2 transition-colors capitalize ${
                      formData.frequency === freq
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                    }`}
                  >
                    <RepeatIcon className="w-5 h-5 mx-auto mb-1" />
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            {/* Target & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="target" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target *
                </label>
                <input
                  type="number"
                  id="target"
                  min="1"
                  max="1000"
                  value={formData.target}
                  onChange={(e) => updateFormData('target', parseInt(e.target.value) || 1)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white ${
                    errors.target ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.target && (
                  <p className="text-red-500 text-sm mt-1">{errors.target}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit *
                </label>
                <select
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => updateFormData('unit', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white ${
                    errors.unit ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="times">times</option>
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="pages">pages</option>
                  <option value="glasses">glasses</option>
                  <option value="steps">steps</option>
                  <option value="reps">reps</option>
                  <option value="sessions">sessions</option>
                </select>
                {errors.unit && (
                  <p className="text-red-500 text-sm mt-1">{errors.unit}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reminder Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BellIcon className="w-5 h-5 mr-2" />
            Reminder Settings
          </h3>
          
          <div className="space-y-4">
            {/* Enable Reminders */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="reminderEnabled"
                checked={formData.reminderEnabled}
                onChange={(e) => updateFormData('reminderEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="reminderEnabled" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable daily reminders
              </label>
            </div>

            {/* Reminder Time */}
            {formData.reminderEnabled && (
              <div>
                <label htmlFor="reminderTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reminder Time
                </label>
                <div className="flex items-center space-x-2">
                  <ClockIcon className="w-5 h-5 text-gray-400" />
                  <input
                    type="time"
                    id="reminderTime"
                    value={formData.reminderTime}
                    onChange={(e) => updateFormData('reminderTime', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Appearance
          </h3>
          
          <div className="space-y-4">
            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {HABIT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateFormData('color', color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      formData.color === color ? 'border-gray-900 dark:border-white' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icon
              </label>
              <div className="grid grid-cols-7 gap-2">
                {HABIT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => updateFormData('icon', icon)}
                    className={`p-2 rounded-lg border transition-colors ${
                      formData.icon === icon
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                    }`}
                  >
                    {/* Icon placeholder - in a real app, you'd render actual icons */}
                    <div className="w-5 h-5 mx-auto text-xs font-mono capitalize text-gray-600 dark:text-gray-400">
                      {icon.charAt(0)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Link
            href="/habits"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              'Create Habit'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}