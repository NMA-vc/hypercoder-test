import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/workspaces',
  '/widgets',
  '/settings',
  '/api/protected',
];

// Routes that should redirect to dashboard if user is already authenticated
const authRoutes = ['/login', '/signup'];

// Public routes that don't require authentication
const publicRoutes = ['/', '/about', '/contact', '/api/health'];

async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth-token')?.value;

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith('/api/public'))) {
    return NextResponse.next();
  }

  // Handle static files and Next.js internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // This catches files with extensions
  ) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const isAuthenticated = token ? await validateToken(token) : false;

  // Redirect unauthenticated users from protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    
    // Clear invalid token
    const response = NextResponse.redirect(url);
    if (token) {
      response.cookies.set({
        name: 'auth-token',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
    }
    return response;
  }

  // Redirect authenticated users from auth routes to dashboard
  if (authRoutes.some(route => pathname.startsWith(route)) && isAuthenticated) {
    const redirectPath = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    url.searchParams.delete('redirect');
    return NextResponse.redirect(url);
  }

  // Redirect root path based on authentication status
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = isAuthenticated ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/public (public API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/public|_next/static|_next/image|favicon.ico|public/).*)',
  ],
};