import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface UpgradeCTAProps {
  feature: string;
  message?: string;
  product?: "individual" | "recruiter" | "corporate";
  compact?: boolean;
}

export function UpgradeCTA({ 
  feature, 
  message, 
  product,
  compact = false 
}: UpgradeCTAProps) {
  const defaultMessage = `Upgrade to unlock ${feature}`;

  if (compact) {
    return (
      <Link href={product ? `/dashboard/${product}/billing` : "/pricing"}>
        <Button variant="default" size="sm" data-testid="button-upgrade-compact">
          <Sparkles className="h-4 w-4 mr-2" />
          Upgrade
        </Button>
      </Link>
    );
  }

  return (
    <Card data-testid="card-upgrade-cta">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Upgrade Required
        </CardTitle>
        <CardDescription>
          {message || defaultMessage}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={product ? `/dashboard/${product}/billing` : "/pricing"}>
          <Button className="w-full" data-testid="button-upgrade-full">
            View Plans
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
