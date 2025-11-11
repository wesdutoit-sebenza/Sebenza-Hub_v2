
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles } from "lucide-react";
import { useLocation } from "wouter";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  reason?: "QUOTA_EXCEEDED" | "FEATURE_NOT_FOUND" | "FEATURE_DISABLED";
  remaining?: number;
  product?: "individual" | "recruiter" | "corporate";
}

export function UpgradeDialog({
  open,
  onOpenChange,
  featureName,
  reason,
  remaining,
  product,
}: UpgradeDialogProps) {
  const [, navigate] = useLocation();

  const getMessage = () => {
    if (reason === "QUOTA_EXCEEDED") {
      return `You've reached your ${featureName} limit${
        remaining !== undefined ? ` (${remaining} remaining)` : ""
      }. Upgrade to get more.`;
    }
    if (reason === "FEATURE_DISABLED" || reason === "FEATURE_NOT_FOUND") {
      return `${featureName} is not available on your current plan.`;
    }
    return `Upgrade to unlock ${featureName}.`;
  };

  const handleUpgrade = () => {
    if (product) {
      navigate(`/dashboard/${product}/billing`);
    } else {
      navigate("/pricing");
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle>Upgrade Required</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            {getMessage()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgrade}>
            View Plans
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
