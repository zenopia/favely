import { AuthProviderConfig } from './types';

export const authConfig: AuthProviderConfig = {
  publicRoutes: [
    "/",
    "/sign-in",
    "/sign-up",
    "/search",
    "/lists/:path*",
    "/api/lists/:path*",
    "/api/users/:username", // Public user profile endpoint
    "/api/users/:username/follow/status", // Allow checking follow status
    "/api/webhooks/clerk",
    "/api/webhooks/user",
    "/manifest.json",
    "/api/health",
    "/:path/_rsc",
    "/profile/:username/_rsc",
    "/profile/:username/lists/:listId",
    "/sso-callback",
    "/sign-in/(.*)",
    "/sign-up/(.*)",
    "/profile/:username/following",
    "/profile/:username/followers",
    "/profile/:username",
    "/about",
    "/about/(.*)",
    "/feedback",
    "/feedback/(.*)",
    "/api/feedback"
  ],
  protectedRoutes: [
    "/profile/lists",
    "/profile/edit",
    "/profile/settings",
    "/create",
    "/lists/create",
    "/lists/edit/:listId",
    "/api/users/:username/follow" // Protect follow/unfollow endpoint
  ],
  apiConfig: {
    publicPaths: [
      "/api/health",
      "/api/webhooks/clerk",
      "/api/webhooks/user",
      "/api/lists/:listId", // Individual list endpoints
      "/api/users/:username", // Public user profile endpoints
      "/api/users/:username/follow/status", // Allow checking follow status
      "/api/search",
      "/api/feedback" // Add feedback endpoint to public API paths
    ],
    protectedPaths: [
      "/api/lists/create",
      "/api/lists/edit",
      "/api/lists/delete",
      "/api/profile",
      "/api/collaborations",
      "/api/users/:username/follow" // Protect follow/unfollow endpoint
    ]
  }
}; 