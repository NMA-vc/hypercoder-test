'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

interface AuthResponse {
  success: boolean;
  error?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
      return {
        success: false,
        error: errorData.error || 'Invalid credentials',
      };
    }

    const data = await response.json();
    
    // Set HTTP-only cookie for the token
    cookies().set({
      name: 'auth-token',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return {
      success: true,
      token: data.token,
      user: data.user,
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
      return {
        success: false,
        error: errorData.error || 'Registration failed',
      };
    }

    const data = await response.json();
    
    // Set HTTP-only cookie for the token
    cookies().set({
      name: 'auth-token',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return {
      success: true,
      token: data.token,
      user: data.user,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    const token = cookies().get('auth-token')?.value;
    
    if (token) {
      // Call backend logout endpoint
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {
        // Ignore errors from logout endpoint
      });
    }
    
    // Clear the auth cookie
    cookies().set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  redirect('/login');
}

export async function getCurrentUser(): Promise<{ user: any; token: string } | null> {
  try {
    const token = cookies().get('auth-token')?.value;
    
    if (!token) {
      return null;
    }

    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Token is invalid, clear it
      cookies().set({
        name: 'auth-token',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
      return null;
    }

    const userData = await response.json();
    return {
      user: userData.user,
      token,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function validateToken(): Promise<boolean> {
  const userSession = await getCurrentUser();
  return userSession !== null;
}