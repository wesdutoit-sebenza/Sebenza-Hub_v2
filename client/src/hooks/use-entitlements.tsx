import { useQuery } from "@tanstack/react-query";

export interface FeatureEntitlement {
  featureKey: string;
  featureName: string;
  featureKind: "TOGGLE" | "QUOTA" | "METERED";
  enabled: boolean;
  monthlyCap: number | null;
  used: number;
  remaining: number;
  unit: string | null;
}

export interface EntitlementsData {
  subscription: {
    id: string;
    planId: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  plan: {
    id: string;
    product: string;
    tier: string;
    interval: string;
    priceCents: number;
  } | null;
  entitlements: FeatureEntitlement[];
}

export function useEntitlements() {
  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    entitlements: EntitlementsData;
  }>({
    queryKey: ["/api/me/entitlements"],
    staleTime: 30000, // Cache for 30 seconds
  });

  const entitlements = data?.entitlements;

  // Helper to check if a feature is allowed
  const checkAllowed = (featureKey: string, increment = 1): {
    allowed: boolean;
    reason?: string;
    remaining?: number;
  } => {
    if (!entitlements || !entitlements.entitlements) {
      return { allowed: false, reason: "NO_ENTITLEMENTS" };
    }

    const feature = entitlements.entitlements.find(
      (e) => e.featureKey === featureKey
    );

    if (!feature) {
      return { allowed: false, reason: "FEATURE_NOT_FOUND" };
    }

    if (feature.featureKind === "TOGGLE") {
      return { allowed: feature.enabled };
    }

    if (feature.featureKind === "QUOTA") {
      const allowed = feature.used + increment <= (feature.monthlyCap || 0);
      return {
        allowed,
        reason: allowed ? undefined : "QUOTA_EXCEEDED",
        remaining: feature.remaining,
      };
    }

    // METERED - always allowed, billed later
    return { allowed: true };
  };

  // Helper to get feature details
  const getFeature = (featureKey: string) => {
    return entitlements?.entitlements.find((e) => e.featureKey === featureKey);
  };

  // Helper to check if user has a paid plan
  const hasPaidPlan = () => {
    return entitlements?.plan?.tier !== "free";
  };

  return {
    entitlements,
    isLoading,
    error,
    refetch,
    checkAllowed,
    getFeature,
    hasPaidPlan,
    plan: entitlements?.plan,
    subscription: entitlements?.subscription,
  };
}
