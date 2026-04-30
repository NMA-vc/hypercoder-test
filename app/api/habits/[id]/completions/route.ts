import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getHabit, getHabitEntries, logHabitEntry } from '../../../../../lib/habits';
import { calculateStreak } from '../../../../../lib/streaks';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function validateAuth(request: NextRequest) {
  const token = cookies().get('auth-token')?.value;
  
  if (!token) {
    return { error: 'Unauthorized', status: 401 };
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { error: 'Unauthorized', status: 401 };
    }

    const userData = await response.json();
    return { user: userData.user, token };
  } catch (error) {
    return { error: 'Authentication failed', status: 401 };
  }
}

/**
 * Get habit completions/entries
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await validateAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const habit = await getHabit(params.id, auth.token);
    
    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // Check if user owns this habit
    if (habit.user_id !== `User:${auth.user.id}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Get habit entries
    const entries = await getHabitEntries(params.id, auth.token, limit + offset);
    
    // Filter by date range if provided
    let filteredEntries = entries;
    if (startDate || endDate) {
      filteredEntries = entries.filter(entry => {
        const entryDate = new Date(entry.date);
        if (startDate && entryDate < new Date(startDate)) return false;
        if (endDate && entryDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Apply pagination
    const paginatedEntries = filteredEntries.slice(offset, offset + limit);

    // Calculate completion stats
    const completions = filteredEntries.filter(entry => entry.value >= habit.target);
    const totalDays = filteredEntries.length;
    const completionRate = totalDays > 0 ? (completions.length / totalDays) * 100 : 0;

    // Get current streak data
    const streakData = await calculateStreak(params.id, auth.token);

    return NextResponse.json({
      habit_id: params.id,
      entries: paginatedEntries,
      stats: {
        total_entries: filteredEntries.length,
        completed_entries: completions.length,
        completion_rate: Math.round(completionRate * 100) / 100,
        current_streak: streakData.current,
        longest_streak: streakData.longest,
        total_completions: streakData.total_completions,
      },
      pagination: {
        limit,
        offset,
        has_more: (offset + limit) < filteredEntries.length,
      },
    });
  } catch (error) {
    console.error('Get habit completions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch habit completions' },
      { status: 500 }
    );
  }
}

/**
 * Log a habit completion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await validateAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const habit = await getHabit(params.id, auth.token);
    
    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // Check if user owns this habit
    if (habit.user_id !== `User:${auth.user.id}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { value, notes, date } = body;

    // Validate input
    if (value === undefined || value === null || value < 0) {
      return NextResponse.json(
        { error: 'Valid value is required (must be >= 0)' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const entryDate = date || today;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      return NextResponse.json(
        { error: 'Date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Check if entry for this date already exists
    const existingEntries = await getHabitEntries(params.id, auth.token, 100);
    const existingEntry = existingEntries.find(entry => entry.date === entryDate);
    
    if (existingEntry) {
      return NextResponse.json(
        { 
          error: 'Entry already exists for this date',
          existing_entry: existingEntry
        },
        { status: 409 }
      );
    }

    // Log the habit entry
    const entry = await logHabitEntry(params.id, auth.token, {
      value: Number(value),
      notes: notes || '',
      date: entryDate,
    });

    // Get updated habit and streak data
    const updatedHabit = await getHabit(params.id, auth.token);
    const streakData = await calculateStreak(params.id, auth.token);

    const isCompleted = Number(value) >= habit.target;

    return NextResponse.json({
      entry,
      completed: isCompleted,
      habit: updatedHabit,
      streak: {
        current: streakData.current,
        longest: streakData.longest,
        total_completions: streakData.total_completions,
      },
      message: isCompleted ? 'Habit completed!' : 'Progress logged',
    }, { status: 201 });
  } catch (error) {
    console.error('Log habit completion error:', error);
    return NextResponse.json(
      { error: 'Failed to log habit completion' },
      { status: 500 }
    );
  }
}

/**
 * Get completion summary for a specific date range
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await validateAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const habit = await getHabit(params.id, auth.token);
    
    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // Check if user owns this habit
    if (habit.user_id !== `User:${auth.user.id}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { start_date, end_date, group_by = 'day' } = body;

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    // Get all entries in the date range
    const allEntries = await getHabitEntries(params.id, auth.token, 1000);
    const filteredEntries = allEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= new Date(start_date) && entryDate <= new Date(end_date);
    });

    // Group entries by specified period
    const grouped: { [key: string]: { completed: number; total: number; entries: any[] } } = {};
    
    filteredEntries.forEach(entry => {
      let groupKey: string;
      const date = new Date(entry.date);
      
      switch (group_by) {
        case 'week':
          // Get week start date (Monday)
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay() + 1);
          groupKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          groupKey = date.getFullYear().toString();
          break;
        default: // day
          groupKey = entry.date;
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = { completed: 0, total: 0, entries: [] };
      }
      
      grouped[groupKey].total += 1;
      grouped[groupKey].entries.push(entry);
      
      if (entry.value >= habit.target) {
        grouped[groupKey].completed += 1;
      }
    });

    // Convert to array format with completion rates
    const summary = Object.entries(grouped).map(([period, data]) => ({
      period,
      completed: data.completed,
      total: data.total,
      completion_rate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
      entries: data.entries,
    })).sort((a, b) => a.period.localeCompare(b.period));

    // Calculate overall stats
    const totalEntries = filteredEntries.length;
    const totalCompleted = filteredEntries.filter(entry => entry.value >= habit.target).length;
    const overallRate = totalEntries > 0 ? (totalCompleted / totalEntries) * 100 : 0;

    return NextResponse.json({
      habit_id: params.id,
      period: { start_date, end_date },
      group_by,
      summary,
      overall: {
        total_entries: totalEntries,
        completed_entries: totalCompleted,
        completion_rate: Math.round(overallRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Get completion summary error:', error);
    return NextResponse.json(
      { error: 'Failed to get completion summary' },
      { status: 500 }
    );
  }
}

/**
 * Delete/remove a habit completion
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await validateAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const habit = await getHabit(params.id, auth.token);
    
    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    // Check if user owns this habit
    if (habit.user_id !== `User:${auth.user.id}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entry_id');
    const date = searchParams.get('date');

    if (!entryId && !date) {
      return NextResponse.json(
        { error: 'Either entry_id or date parameter is required' },
        { status: 400 }
      );
    }

    try {
      // Delete the habit entry item
      const deleteResponse = await fetch(`${API_URL}/api/items/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete habit entry');
      }

      // Recalculate streak data after deletion
      const streakData = await calculateStreak(params.id, auth.token);

      // Get updated habit
      const updatedHabit = await getHabit(params.id, auth.token);

      return NextResponse.json({
        success: true,
        message: 'Habit completion removed',
        habit: updatedHabit,
        streak: {
          current: streakData.current,
          longest: streakData.longest,
          total_completions: streakData.total_completions,
        },
      });
    } catch (error) {
      console.error('Delete entry error:', error);
      return NextResponse.json(
        { error: 'Failed to remove habit completion' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Delete habit completion error:', error);
    return NextResponse.json(
      { error: 'Failed to remove habit completion' },
      { status: 500 }
    );
  }
}