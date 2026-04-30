import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHabit, getUserHabits } from '../../../lib/habits';

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

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const habits = await getUserHabits(auth.user.id, auth.token, {
      workspaceId: workspaceId || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({ habits });
  } catch (error) {
    console.error('Get habits error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch habits' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { title, description, frequency, target, workspace_id, tags } = body;

    if (!title || !frequency || !target || !workspace_id) {
      return NextResponse.json(
        { error: 'Missing required fields: title, frequency, target, workspace_id' },
        { status: 400 }
      );
    }

    const habit = await createHabit(auth.user.id, auth.token, {
      title,
      description,
      frequency,
      target,
      workspace_id,
      tags: tags || [],
    });

    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    console.error('Create habit error:', error);
    return NextResponse.json(
      { error: 'Failed to create habit' },
      { status: 500 }
    );
  }
}