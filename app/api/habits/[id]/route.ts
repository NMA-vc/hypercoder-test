import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getHabit, updateHabit, deleteHabit, logHabitEntry } from '../../../../lib/habits';

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

    return NextResponse.json({ habit });
  } catch (error) {
    console.error('Get habit error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch habit' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await validateAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // First check if habit exists and user owns it
    const existingHabit = await getHabit(params.id, auth.token);
    if (!existingHabit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    if (existingHabit.user_id !== `User:${auth.user.id}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, frequency, target, status, tags, log_entry } = body;

    // Handle habit entry logging
    if (log_entry) {
      const entry = await logHabitEntry(params.id, auth.token, {
        value: log_entry.value,
        notes: log_entry.notes,
        date: log_entry.date,
      });
      return NextResponse.json({ entry });
    }

    // Handle habit updates
    const habit = await updateHabit(params.id, auth.token, {
      title,
      description,
      frequency,
      target,
      status,
      tags,
    });

    if (!habit) {
      return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 });
    }

    return NextResponse.json({ habit });
  } catch (error) {
    console.error('Update habit error:', error);
    return NextResponse.json(
      { error: 'Failed to update habit' },
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

    // First check if habit exists and user owns it
    const existingHabit = await getHabit(params.id, auth.token);
    if (!existingHabit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    if (existingHabit.user_id !== `User:${auth.user.id}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteHabit(params.id, auth.token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete habit error:', error);
    return NextResponse.json(
      { error: 'Failed to delete habit' },
      { status: 500 }
    );
  }
}