import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CallbackData {
  token?: string;
  user?: {
    id: string;
    email: string;
  };
  error?: string;
  redirect_url?: string;
}

/**
 * Handle OAuth callback or other authentication redirects
 * This route processes authentication tokens from external providers
 * or handles post-authentication redirects with tokens
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract parameters from callback URL
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const code = searchParams.get('code'); // OAuth authorization code
    const state = searchParams.get('state'); // OAuth state parameter
    const redirectUrl = searchParams.get('redirect') || '/dashboard';

    // Handle error cases
    if (error) {
      const errorUrl = new URL('/login', request.url);
      errorUrl.searchParams.set('error', error);
      return NextResponse.redirect(errorUrl);
    }

    // Case 1: Direct token provided (internal authentication flow)
    if (token) {
      try {
        // Validate the token with the backend
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Invalid token');
        }

        const userData = await response.json();
        
        // Set HTTP-only cookie for the token
        const redirectResponse = NextResponse.redirect(new URL(redirectUrl, request.url));
        redirectResponse.cookies.set({
          name: 'auth-token',
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60, // 7 days
          path: '/',
        });
        
        return redirectResponse;
      } catch (error) {
        console.error('Token validation error:', error);
        const errorUrl = new URL('/login', request.url);
        errorUrl.searchParams.set('error', 'Invalid authentication token');
        return NextResponse.redirect(errorUrl);
      }
    }

    // Case 2: OAuth authorization code provided
    if (code) {
      try {
        // Exchange authorization code for access token
        const tokenResponse = await fetch(`${API_URL}/api/auth/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            state,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({ error: 'OAuth exchange failed' }));
          throw new Error(errorData.error || 'Failed to exchange authorization code');
        }

        const tokenData = await tokenResponse.json();
        
        if (!tokenData.token) {
          throw new Error('No token received from OAuth exchange');
        }

        // Set HTTP-only cookie for the token
        const redirectResponse = NextResponse.redirect(new URL(redirectUrl, request.url));
        redirectResponse.cookies.set({
          name: 'auth-token',
          value: tokenData.token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60, // 7 days
          path: '/',
        });
        
        return redirectResponse;
      } catch (error) {
        console.error('OAuth token exchange error:', error);
        const errorUrl = new URL('/login', request.url);
        errorUrl.searchParams.set('error', error instanceof Error ? error.message : 'OAuth authentication failed');
        return NextResponse.redirect(errorUrl);
      }
    }

    // Case 3: No token or code provided - invalid callback
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'Invalid authentication callback');
    return NextResponse.redirect(errorUrl);

  } catch (error) {
    console.error('Auth callback error:', error);
    
    // Fallback error redirect
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'Authentication failed');
    return NextResponse.redirect(errorUrl);
  }
}

/**
 * Handle POST requests to the callback endpoint
 * This can be used for webhook-style authentication callbacks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CallbackData;
    
    if (body.error) {
      return NextResponse.json(
        { error: body.error },
        { status: 400 }
      );
    }

    if (!body.token) {
      return NextResponse.json(
        { error: 'No authentication token provided' },
        { status: 400 }
      );
    }

    try {
      // Validate the token with the backend
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${body.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      const userData = await response.json();
      
      // Set HTTP-only cookie for the token
      const successResponse = NextResponse.json({
        success: true,
        user: userData.user,
        redirect_url: body.redirect_url || '/dashboard',
      });
      
      successResponse.cookies.set({
        name: 'auth-token',
        value: body.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
      
      return successResponse;
    } catch (error) {
      console.error('Token validation error:', error);
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Auth callback POST error:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}