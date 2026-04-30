import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get current authenticated user information
 */
export async function GET(request: NextRequest) {
  try {
    const token = cookies().get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token provided' },
        { status: 401 }
      );
    }

    // Validate token with backend and get user info
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Token is invalid, clear it
      const errorResponse = NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
      
      errorResponse.cookies.set({
        name: 'auth-token',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
      
      return errorResponse;
    }

    const userData = await response.json();
    
    return NextResponse.json({
      user: userData.user,
      authenticated: true,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    
    // Clear potentially corrupted token
    const errorResponse = NextResponse.json(
      { error: 'Failed to authenticate user' },
      { status: 500 }
    );
    
    const token = cookies().get('auth-token')?.value;
    if (token) {
      errorResponse.cookies.set({
        name: 'auth-token',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
    }
    
    return errorResponse;
  }
}

/**
 * Update current user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = cookies().get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token provided' },
        { status: 401 }
      );
    }

    // Validate current authentication
    const authResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, current_password, new_password } = body;

    // Validate input
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    if (new_password && new_password.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    if (new_password && !current_password) {
      return NextResponse.json(
        { error: 'Current password is required to change password' },
        { status: 400 }
      );
    }

    // Update user profile via backend
    const updateResponse = await fetch(`${API_URL}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        current_password,
        new_password,
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({ 
        error: 'Profile update failed' 
      }));
      
      return NextResponse.json(
        { error: errorData.error || 'Failed to update profile' },
        { status: updateResponse.status }
      );
    }

    const updatedUser = await updateResponse.json();
    
    // If password was changed, the backend might return a new token
    if (updatedUser.token) {
      const response = NextResponse.json({
        user: updatedUser.user,
        message: 'Profile updated successfully',
      });
      
      // Update the auth cookie with new token
      response.cookies.set({
        name: 'auth-token',
        value: updatedUser.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
      
      return response;
    }

    return NextResponse.json({
      user: updatedUser.user,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Delete current user account
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = cookies().get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token provided' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { password, confirmation } = body;

    // Validate deletion confirmation
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to delete account' },
        { status: 400 }
      );
    }

    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return NextResponse.json(
        { error: 'Please type "DELETE_MY_ACCOUNT" to confirm account deletion' },
        { status: 400 }
      );
    }

    // Delete account via backend
    const deleteResponse = await fetch(`${API_URL}/api/auth/account`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json().catch(() => ({ 
        error: 'Account deletion failed' 
      }));
      
      return NextResponse.json(
        { error: errorData.error || 'Failed to delete account' },
        { status: deleteResponse.status }
      );
    }

    // Clear auth cookie after successful deletion
    const response = NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
    
    response.cookies.set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Delete user account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}