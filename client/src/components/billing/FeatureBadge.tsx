import { Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FeatureEntitlement } from "@/hooks/use-entitlements";

interface FeatureBadgeProps {
  feature: FeatureEntitlement | undefined;
  showUsage?: boolean;
  className?: string;
}

export function FeatureBadge({ feature, showUsage = true, className }: FeatureBadgeProps) {
  if (!feature) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={className} data-testid="badge-feature-locked">
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>This feature is not available on your current plan</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (feature.featureKind === "TOGGLE") {
    if (feature.enabled) {
      return (
        <Badge variant="default" className={className} data-testid={`badge-feature-${feature.featureKey}-enabled`}>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Enabled
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className={className} data-testid={`badge-feature-${feature.featureKey}-disabled`}>
          <Lock className="h-3 w-3 mr-1" />
          Disabled
        </Badge>
      );
    }
  }

  if (feature.featureKind === "QUOTA" && showUsage) {
    const isNearLimit = feature.remaining < (feature.monthlyCap || 0) * 0.2;
    const isAtLimit = feature.remaining === 0;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isAtLimit ? "destructive" : isNearLimit ? "outline" : "secondary"}
            className={className}
            data-testid={`badge-feature-${feature.featureKey}-quota`}
          >
            {isAtLimit && <AlertCircle className="h-3 w-3 mr-1" />}
            {feature.used}/{feature.monthlyCap === null ? "∞" : feature.monthlyCap}
            {feature.unit && ` ${feature.unit}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {feature.remaining} {feature.unit || "uses"} remaining this month
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (feature.featureKind === "METERED") {
    return (
      <Badge variant="secondary" className={className} data-testid={`badge-feature-${feature.featureKey}-metered`}>
        Pay-as-you-go
      </Badge>
    );
  }

  return null;
}
