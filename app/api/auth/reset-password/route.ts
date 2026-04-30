import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ResetPasswordRequest {
  token: string;
  new_password: string;
  confirm_password?: string;
}

interface RequestPasswordResetRequest {
  email: string;
}

/**
 * Handle password reset confirmation with token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ResetPasswordRequest;
    const { token, new_password, confirm_password } = body;

    // Validate input
    if (!token || !new_password) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (new_password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check password confirmation if provided
    if (confirm_password && new_password !== confirm_password) {
      return NextResponse.json(
        { error: 'Password confirmation does not match' },
        { status: 400 }
      );
    }

    // Call backend to reset password
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        new_password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: 'Password reset failed' 
      }));
      
      // Handle specific error cases
      if (response.status === 400) {
        return NextResponse.json(
          { error: errorData.error || 'Invalid or expired reset token' },
          { status: 400 }
        );
      }
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reset token not found or expired' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: errorData.error || 'Password reset failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // If the backend returns a new auth token (auto-login after reset)
    if (data.token) {
      const successResponse = NextResponse.json({
        success: true,
        message: 'Password reset successfully',
        auto_login: true,
        user: data.user,
      });

      // Set HTTP-only cookie for automatic login
      successResponse.cookies.set({
        name: 'auth-token',
        value: data.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });

      return successResponse;
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Request password reset (send reset email)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as RequestPasswordResetRequest;
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Call backend to request password reset
    const response = await fetch(`${API_URL}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: 'Password reset request failed' 
      }));
      
      // For security, don't reveal if email exists or not
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent.',
        });
      }

      return NextResponse.json(
        { error: errorData.error || 'Password reset request failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: data.message || 'If an account with this email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate password reset token without resetting password
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      );
    }

    // Call backend to validate reset token
    const response = await fetch(`${API_URL}/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: 'Token validation failed' 
      }));
      
      if (response.status === 400 || response.status === 404) {
        return NextResponse.json(
          { 
            valid: false, 
            error: 'Invalid or expired reset token' 
          },
          { status: 200 } // Return 200 for client to handle gracefully
        );
      }

      return NextResponse.json(
        { error: errorData.error || 'Token validation failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      valid: true,
      email: data.email, // Optionally return email for display
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}