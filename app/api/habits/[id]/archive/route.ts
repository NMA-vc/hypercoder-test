import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getHabit, updateHabit } from '../../../../../lib/habits';

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
 * Archive a habit (mark as completed/archived)
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

    // Archive the habit by setting status to completed
    const updatedHabit = await updateHabit(params.id, auth.token, {
      status: 'completed',
    });

    if (!updatedHabit) {
      return NextResponse.json({ error: 'Failed to archive habit' }, { status: 500 });
    }

    return NextResponse.json({ 
      habit: updatedHabit,
      message: 'Habit archived successfully'
    });
  } catch (error) {
    console.error('Archive habit error:', error);
    return NextResponse.json(
      { error: 'Failed to archive habit' },
      { status: 500 }
    );
  }
}

/**
 * Unarchive a habit (reactivate it)
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

    // Unarchive the habit by setting status back to active
    const updatedHabit = await updateHabit(params.id, auth.token, {
      status: 'active',
    });

    if (!updatedHabit) {
      return NextResponse.json({ error: 'Failed to unarchive habit' }, { status: 500 });
    }

    return NextResponse.json({ 
      habit: updatedHabit,
      message: 'Habit unarchived successfully'
    });
  } catch (error) {
    console.error('Unarchive habit error:', error);
    return NextResponse.json(
      { error: 'Failed to unarchive habit' },
      { status: 500 }
    );
  }
}

/**
 * Get archive status of a habit
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

    return NextResponse.json({ 
      habit_id: params.id,
      archived: habit.status === 'completed',
      status: habit.status,
      archived_date: habit.status === 'completed' ? habit.updated_at : null
    });
  } catch (error) {
    console.error('Get archive status error:', error);
    return NextResponse.json(
      { error: 'Failed to get archive status' },
      { status: 500 }
    );
  }
}