import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // TODO: Replace with actual user authentication
    const userId = 'temp_user_123';
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Default to current week if no dates provided
    const now = new Date();
    const weekStart = startDate ? new Date(startDate) : getWeekStart(now);
    const weekEnd = endDate ? new Date(endDate) : getWeekEnd(weekStart);
    
    // Fetch items from the backend API
    const response = await fetch(`http://localhost:3001/api/items?limit=1000&offset=0`, {
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add authorization header when auth is implemented
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch items');
    }
    
    const items = await response.json();
    
    // Filter items by date range and group by day
    const weeklyData = generateWeeklyData(items, weekStart, weekEnd);
    
    return NextResponse.json({
      data: weeklyData,
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      total_items: weeklyData.reduce((sum, day) => sum + day.items.length, 0),
    });
    
  } catch (error) {
    console.error('Error fetching weekly summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly summary' },
      { status: 500 }
    );
  }
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  return new Date(d.setDate(d.getDate() + 6));
}

function generateWeeklyData(items: any[], weekStart: Date, weekEnd: Date) {
  const weekDays = [];
  
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(weekStart);
    currentDay.setDate(weekStart.getDate() + i);
    
    const dayItems = items.filter(item => {
      const itemDate = new Date(item.created_at);
      return isSameDay(itemDate, currentDay);
    });
    
    weekDays.push({
      date: currentDay.toISOString().split('T')[0],
      day_name: currentDay.toLocaleDateString('en-US', { weekday: 'long' }),
      items: dayItems,
      item_count: dayItems.length,
      completion_rate: calculateCompletionRate(dayItems),
    });
  }
  
  return weekDays;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

function calculateCompletionRate(items: any[]): number {
  if (items.length === 0) return 0;
  
  const completedItems = items.filter(item => 
    item.status === 'completed' || item.status === 'done'
  );
  
  return Math.round((completedItems.length / items.length) * 100);
}