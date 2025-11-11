
import { useEntitlements } from "./use-entitlements";
import { useToast } from "./use-toast";
import { useLocation } from "wouter";

interface FeatureGateOptions {
  showToast?: boolean;
  redirectToBilling?: boolean;
  product?: "individual" | "recruiter" | "corporate";
}

export function useFeatureGate() {
  const { checkAllowed, plan } = useEntitlements();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const checkFeature = (
    featureKey: string,
    featureName: string,
    options: FeatureGateOptions = {}
  ): boolean => {
    const { showToast = true, redirectToBilling = false, product } = options;
    const result = checkAllowed(featureKey);

    if (!result.allowed) {
      if (showToast) {
        const message =
          result.reason === "QUOTA_EXCEEDED"
            ? `You've reached your ${featureName} limit. Upgrade to continue.`
            : `${featureName} is not available on your current plan. Upgrade to unlock this feature.`;

        toast({
          title: "Upgrade Required",
          description: message,
          variant: "destructive",
          action: redirectToBilling
            ? {
                label: "View Plans",
                onClick: () => {
                  if (product) {
                    navigate(`/dashboard/${product}/billing`);
                  } else {
                    navigate("/pricing");
                  }
                },
              }
            : undefined,
        });
      }

      if (redirectToBilling && !showToast) {
        if (product) {
          navigate(`/dashboard/${product}/billing`);
        } else {
          navigate("/pricing");
        }
      }

      return false;
    }

    return true;
  };

  const withFeatureCheck = <T extends any[]>(
    featureKey: string,
    featureName: string,
    callback: (...args: T) => void | Promise<void>,
    options?: FeatureGateOptions
  ) => {
    return (...args: T) => {
      if (checkFeature(featureKey, featureName, options)) {
        return callback(...args);
      }
    };
  };

  return {
    checkFeature,
    withFeatureCheck,
    plan,
  };
}
