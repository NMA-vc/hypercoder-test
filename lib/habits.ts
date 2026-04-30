const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  target: number;
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  status: 'active' | 'paused' | 'completed';
  workspace_id: string;
  user_id: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface HabitEntry {
  id: string;
  habit_id: string;
  value: number;
  date: string;
  notes?: string;
  created_at: string;
}

export interface CreateHabitData {
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  target: number;
  workspace_id: string;
  tags?: string[];
}

export interface UpdateHabitData {
  title?: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  target?: number;
  status?: 'active' | 'paused' | 'completed';
  tags?: string[];
}

export interface HabitEntryData {
  value: number;
  notes?: string;
  date?: string; // ISO date string, defaults to today
}

export interface GetHabitsOptions {
  workspaceId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function getUserHabits(
  userId: string,
  token: string,
  options: GetHabitsOptions = {}
): Promise<Habit[]> {
  try {
    const queryParams = new URLSearchParams();
    if (options.workspaceId) queryParams.append('workspace_id', options.workspaceId);
    if (options.status) queryParams.append('status', options.status);
    if (options.limit) queryParams.append('limit', options.limit.toString());
    if (options.offset) queryParams.append('offset', options.offset.toString());
    queryParams.append('item_type', 'habit');

    const response = await fetch(`${API_URL}/api/items?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch habits');
    }

    const data = await response.json();
    
    // Transform items to habits format
    return data.items.map((item: any) => ({
      id: item.id.split(':')[1] || item.id,
      title: item.title,
      description: item.content,
      frequency: item.metadata.frequency || 'daily',
      target: item.metadata.target || 1,
      current_streak: item.metadata.current_streak || 0,
      longest_streak: item.metadata.longest_streak || 0,
      total_completions: item.metadata.total_completions || 0,
      status: item.status,
      workspace_id: item.workspace_id.split(':')[1] || item.workspace_id,
      user_id: item.user_id,
      tags: item.tags,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  } catch (error) {
    console.error('Get user habits error:', error);
    throw error;
  }
}

export async function getHabit(id: string, token: string): Promise<Habit | null> {
  try {
    const response = await fetch(`${API_URL}/api/items/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch habit');
    }

    const data = await response.json();
    const item = data.item;
    
    // Check if it's a habit type
    if (item.item_type !== 'habit') {
      return null;
    }

    return {
      id: item.id.split(':')[1] || item.id,
      title: item.title,
      description: item.content,
      frequency: item.metadata.frequency || 'daily',
      target: item.metadata.target || 1,
      current_streak: item.metadata.current_streak || 0,
      longest_streak: item.metadata.longest_streak || 0,
      total_completions: item.metadata.total_completions || 0,
      status: item.status,
      workspace_id: item.workspace_id.split(':')[1] || item.workspace_id,
      user_id: item.user_id,
      tags: item.tags,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  } catch (error) {
    console.error('Get habit error:', error);
    throw error;
  }
}

export async function createHabit(
  userId: string,
  token: string,
  data: CreateHabitData
): Promise<Habit> {
  try {
    const response = await fetch(`${API_URL}/api/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: data.workspace_id,
        title: data.title,
        content: data.description,
        item_type: 'habit',
        metadata: {
          frequency: data.frequency,
          target: data.target,
          current_streak: 0,
          longest_streak: 0,
          total_completions: 0,
        },
        tags: data.tags || [],
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create habit');
    }

    const responseData = await response.json();
    const item = responseData.item;

    return {
      id: item.id.split(':')[1] || item.id,
      title: item.title,
      description: item.content,
      frequency: item.metadata.frequency,
      target: item.metadata.target,
      current_streak: item.metadata.current_streak,
      longest_streak: item.metadata.longest_streak,
      total_completions: item.metadata.total_completions,
      status: item.status,
      workspace_id: item.workspace_id.split(':')[1] || item.workspace_id,
      user_id: item.user_id,
      tags: item.tags,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  } catch (error) {
    console.error('Create habit error:', error);
    throw error;
  }
}

export async function updateHabit(
  id: string,
  token: string,
  data: UpdateHabitData
): Promise<Habit | null> {
  try {
    // First get current habit to merge metadata
    const currentHabit = await getHabit(id, token);
    if (!currentHabit) {
      throw new Error('Habit not found');
    }

    const metadata = {
      frequency: data.frequency || currentHabit.frequency,
      target: data.target || currentHabit.target,
      current_streak: currentHabit.current_streak,
      longest_streak: currentHabit.longest_streak,
      total_completions: currentHabit.total_completions,
    };

    const response = await fetch(`${API_URL}/api/items/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: data.title,
        content: data.description,
        item_type: 'habit',
        metadata,
        tags: data.tags,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update habit');
    }

    const responseData = await response.json();
    const item = responseData.item;

    if (!item) {
      return null;
    }

    return {
      id: item.id.split(':')[1] || item.id,
      title: item.title,
      description: item.content,
      frequency: item.metadata.frequency,
      target: item.metadata.target,
      current_streak: item.metadata.current_streak,
      longest_streak: item.metadata.longest_streak,
      total_completions: item.metadata.total_completions,
      status: item.status,
      workspace_id: item.workspace_id.split(':')[1] || item.workspace_id,
      user_id: item.user_id,
      tags: item.tags,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  } catch (error) {
    console.error('Update habit error:', error);
    throw error;
  }
}

export async function deleteHabit(id: string, token: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/items/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete habit');
    }
  } catch (error) {
    console.error('Delete habit error:', error);
    throw error;
  }
}

export async function logHabitEntry(
  habitId: string,
  token: string,
  entryData: HabitEntryData
): Promise<HabitEntry> {
  try {
    // First get current habit to update streaks and completions
    const currentHabit = await getHabit(habitId, token);
    if (!currentHabit) {
      throw new Error('Habit not found');
    }

    const date = entryData.date || new Date().toISOString().split('T')[0];
    const isToday = date === new Date().toISOString().split('T')[0];
    
    // Calculate new streak and completion values
    let newCurrentStreak = currentHabit.current_streak;
    let newTotalCompletions = currentHabit.total_completions;
    
    if (entryData.value >= currentHabit.target) {
      newTotalCompletions += 1;
      if (isToday) {
        newCurrentStreak += 1;
      }
    } else if (isToday) {
      newCurrentStreak = 0;
    }

    const newLongestStreak = Math.max(currentHabit.longest_streak, newCurrentStreak);

    // Update habit with new stats
    const updatedMetadata = {
      ...currentHabit,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      total_completions: newTotalCompletions,
    };

    // Create a habit entry as a separate item
    const response = await fetch(`${API_URL}/api/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: currentHabit.workspace_id,
        title: `${currentHabit.title} - ${date}`,
        content: entryData.notes || '',
        item_type: 'habit_entry',
        metadata: {
          habit_id: habitId,
          value: entryData.value,
          date: date,
          target: currentHabit.target,
        },
        tags: ['habit-entry', habitId],
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create habit entry');
    }

    // Update the habit with new stats
    await updateHabit(habitId, token, {
      ...updatedMetadata
    });

    const responseData = await response.json();
    const item = responseData.item;

    return {
      id: item.id.split(':')[1] || item.id,
      habit_id: habitId,
      value: item.metadata.value,
      date: item.metadata.date,
      notes: item.content,
      created_at: item.created_at,
    };
  } catch (error) {
    console.error('Log habit entry error:', error);
    throw error;
  }
}

export async function getHabitEntries(
  habitId: string,
  token: string,
  limit: number = 30
): Promise<HabitEntry[]> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('item_type', 'habit_entry');
    queryParams.append('tags', habitId);
    queryParams.append('limit', limit.toString());

    const response = await fetch(`${API_URL}/api/items?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch habit entries');
    }

    const data = await response.json();
    
    return data.items
      .filter((item: any) => item.metadata.habit_id === habitId)
      .map((item: any) => ({
        id: item.id.split(':')[1] || item.id,
        habit_id: habitId,
        value: item.metadata.value,
        date: item.metadata.date,
        notes: item.content,
        created_at: item.created_at,
      }))
      .sort((a: HabitEntry, b: HabitEntry) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  } catch (error) {
    console.error('Get habit entries error:', error);
    throw error;
  }
}