
import { createContext, useContext, useState, ReactNode } from "react";
import { UpgradeDialog } from "@/components/billing/UpgradeDialog";

interface UpgradePromptConfig {
  featureName: string;
  reason?: "QUOTA_EXCEEDED" | "FEATURE_NOT_FOUND" | "FEATURE_DISABLED";
  remaining?: number;
  product?: "individual" | "recruiter" | "corporate";
}

interface UpgradeContextType {
  showUpgradePrompt: (config: UpgradePromptConfig) => void;
}

const UpgradeContext = createContext<UpgradeContextType | undefined>(undefined);

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [config, setConfig] = useState<UpgradePromptConfig>({
    featureName: "",
  });

  const showUpgradePrompt = (newConfig: UpgradePromptConfig) => {
    setConfig(newConfig);
    setDialogOpen(true);
  };

  return (
    <UpgradeContext.Provider value={{ showUpgradePrompt }}>
      {children}
      <UpgradeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        featureName={config.featureName}
        reason={config.reason}
        remaining={config.remaining}
        product={config.product}
      />
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const context = useContext(UpgradeContext);
  if (!context) {
    throw new Error("useUpgrade must be used within UpgradeProvider");
  }
  return context;
}
