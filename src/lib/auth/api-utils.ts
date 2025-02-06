import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { authConfig } from "./config";
import { AuthFactory } from "./factory";

type RouteHandler<TParams = Record<string, string>, TResponse = unknown> = (
  req: NextRequest,
  context: { params: TParams }
) => Promise<NextResponse<TResponse>>;

interface AuthErrorResponse {
  error: string;
  status: number;
}

/**
 * Middleware to protect API routes
 */
export async function withAuth<TParams = Record<string, string>, TResponse = unknown>(
  handler: RouteHandler<TParams, TResponse>,
  options: {
    requireAuth?: boolean;
  } = { requireAuth: true }
): Promise<RouteHandler<TParams, TResponse | AuthErrorResponse>> {
  return async (req: NextRequest, context: { params: TParams }) => {
    try {
      const auth = await AuthFactory.getProvider('clerk', authConfig);
      const authResult = await auth.handleApiAuth(req);

      if (options.requireAuth && !authResult.isAuthenticated) {
        return NextResponse.json<AuthErrorResponse>(
          { 
            error: authResult.error || 'Unauthorized',
            status: 401 
          },
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Add auth result to the request for use in the handler
      (req as any).auth = {
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        isAuthenticated: authResult.isAuthenticated
      };

      return handler(req, context);
    } catch (error) {
      console.error('API Auth Error:', error);
      return NextResponse.json<AuthErrorResponse>(
        { 
          error: 'Internal Server Error',
          status: 500 
        },
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Get the current user's ID from an authenticated request
 */
export function getUserId(req: NextRequest): string {
  const { userId } = auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  return userId;
}

/**
 * Get the current session ID from an authenticated request
 */
export function getSessionId(req: NextRequest): string {
  const { sessionId } = auth();
  
  if (!sessionId) {
    throw new Error('Session ID not found');
  }
  
  return sessionId;
} 