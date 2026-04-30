import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getHabit } from '../../../../../lib/habits';
import { calculateStreak, getStreakHistory, resetStreak } from '../../../../../lib/streaks';

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
    const days = parseInt(searchParams.get('days') || '30');
    const recalculate = searchParams.get('recalculate') === 'true';

    let streakData;
    
    if (recalculate) {
      // Recalculate streak from habit entries
      streakData = await calculateStreak(params.id, auth.token);
    } else {
      // Get current streak info from habit
      streakData = {
        current: habit.current_streak,
        longest: habit.longest_streak,
        total_completions: habit.total_completions,
      };
    }

    // Get streak history
    const history = await getStreakHistory(params.id, auth.token, days);

    return NextResponse.json({ 
      streak: streakData,
      history,
      habit_id: params.id,
    });
  } catch (error) {
    console.error('Get streak error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streak data' },
      { status: 500 }
    );
  }
}

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

    // Reset streak for the habit
    const updatedHabit = await resetStreak(params.id, auth.token);

    return NextResponse.json({ 
      success: true,
      habit: updatedHabit,
      message: 'Streak reset successfully'
    });
  } catch (error) {
    console.error('Reset streak error:', error);
    return NextResponse.json(
      { error: 'Failed to reset streak' },
      { status: 500 }
    );
  }
}