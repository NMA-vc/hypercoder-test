import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getHabit, logHabitEntry } from '../../../../../lib/habits';
import { updateStreak, resetStreak } from '../../../../../lib/streaks';

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
    const { completed = true, value, notes, date } = body;
    
    const today = new Date().toISOString().split('T')[0];
    const entryDate = date || today;
    const entryValue = completed ? (value || habit.target) : 0;

    // Log the habit entry
    const entry = await logHabitEntry(params.id, auth.token, {
      value: entryValue,
      notes: notes || (completed ? 'Completed' : 'Skipped'),
      date: entryDate,
    });

    // Get updated habit to return current streak info
    const updatedHabit = await getHabit(params.id, auth.token);

    return NextResponse.json({ 
      entry,
      habit: updatedHabit,
      completed,
      streak: {
        current: updatedHabit?.current_streak || 0,
        longest: updatedHabit?.longest_streak || 0,
      }
    });
  } catch (error) {
    console.error('Toggle habit error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle habit' },
      { status: 500 }
    );
  }
}