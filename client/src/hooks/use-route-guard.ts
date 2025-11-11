import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@shared/schema";

// Public routes that don't require authentication
const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/admin/setup",
  "/recruiters",
  "/individuals",
  "/contact",
  "/pricing",
]);

// Routes that are part of the onboarding flow
const ONBOARDING_ROUTES = new Set([
  "/onboarding",
  "/onboarding/individual",
  "/onboarding/business",
  "/onboarding/recruiter",
]);

/**
 * Check if a route is public (accessible without authentication)
 */
function isPublicRoute(path: string): boolean {
  // Exact match
  if (PUBLIC_ROUTES.has(path)) return true;
  
  // Job detail pages are public
  if (path.startsWith("/jobs/")) return true;
  
  // Test access pages are public
  if (path.startsWith("/test/")) return true;
  
  return false;
}

/**
 * Check if a route is part of onboarding flow
 */
function isOnboardingRoute(path: string): boolean {
  return ONBOARDING_ROUTES.has(path);
}

/**
 * Determine if a user needs to complete onboarding
 */
function needsOnboarding(user: User | null): boolean {
  if (!user) return false;
  
  // Admin users bypass onboarding
  if (user.role === 'admin' || user.role === 'administrator') return false;
  
  // User hasn't selected a role yet (shouldn't happen but handle it)
  if (!user.role) return true;
  
  // User hasn't completed onboarding
  if (user.onboardingComplete === 0) return true;
  
  return false;
}

/**
 * Route guard hook that redirects users to appropriate pages based on auth state
 */
export function useRouteGuard() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    const publicRoute = isPublicRoute(location);
    const onboardingRoute = isOnboardingRoute(location);
    const userNeedsOnboarding = needsOnboarding(user);

    // User needs onboarding and is trying to access a protected route
    if (user && userNeedsOnboarding && !onboardingRoute && !publicRoute) {
      console.log("[RouteGuard] Redirecting to onboarding:", {
        role: user.role,
        onboardingComplete: user.onboardingComplete,
        location
      });
      
      // Prevent infinite redirect loop
      if (location !== "/onboarding") {
        navigate("/onboarding");
      }
      return;
    }

    // User is authenticated, completed onboarding, but on the main onboarding page
    if (user && !userNeedsOnboarding && location === "/onboarding") {
      console.log("[RouteGuard] User already onboarded, redirecting to dashboard");
      
      // Redirect to appropriate dashboard
      if (user.role === 'individual') {
        navigate("/dashboard/individual");
      } else if (user.role === 'recruiter') {
        navigate("/dashboard/recruiter");
      } else if (user.role === 'admin' || user.role === 'administrator') {
        navigate("/admin");
      } else {
        // Default fallback
        navigate("/");
      }
      return;
    }

    // Not logged in and trying to access a protected route
    if (!user && !publicRoute && !onboardingRoute) {
      console.log("[RouteGuard] Not authenticated, redirecting to login");
      
      // Prevent infinite redirect loop
      if (location !== "/login") {
        navigate("/login");
      }
      return;
    }
  }, [user, loading, location, navigate]);
}
