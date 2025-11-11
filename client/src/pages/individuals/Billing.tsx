import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, DollarSign } from "lucide-react";

export default function IndividualBilling() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-billing-title">
            Billing
          </h1>
          <p className="text-muted-foreground">Manage your subscription and payment methods</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2" data-testid="text-no-billing">No Billing Information</h3>
          <p className="text-muted-foreground mb-4">
            Your payment history and subscription management will appear here
          </p>
          <p className="text-sm text-muted-foreground">
            This feature is coming soon. You'll be able to manage your subscription tiers and view payment history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
