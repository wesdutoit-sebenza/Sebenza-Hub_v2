import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface PricingPlan {
  name: string;
  price: { monthly: number; annual: number };
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

interface PricingTableProps {
  plans: PricingPlan[];
}

export default function PricingTable({ plans }: PricingTableProps) {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-4">
        <span className="text-sm font-semibold text-[#ffffff]">
          Monthly
        </span>
        <button
          data-testid="button-pricing-toggle"
          onClick={() => setIsAnnual(!isAnnual)}
          className={`relative w-14 h-8 rounded-full transition-colors ${
            isAnnual ? 'bg-green' : 'bg-muted'
          }`}
          role="switch"
          aria-checked={isAnnual}
          aria-label="Toggle annual pricing"
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 bg-background rounded-full transition-transform ${
              isAnnual ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm text-[#ffffff]">
          Annual
          {isAnnual && <Badge className="ml-2 bg-green/10 text-green border-0" data-testid="badge-save">Save 10%</Badge>}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, idx) => (
          <Card
            key={plan.name}
            className={`p-8 ${plan.highlighted ? 'border-primary border-2' : ''}`}
            data-testid={`card-pricing-${plan.name.toLowerCase()}`}
          >
            {plan.highlighted && (
              <Badge className="mb-4 bg-primary/10 text-primary border-0" data-testid="badge-popular">
                Most Popular
              </Badge>
            )}
            <h3 className="text-2xl font-serif font-semibold mb-2" data-testid="text-plan-name">
              {plan.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-6" data-testid="text-plan-description">
              {plan.description}
            </p>
            <div className="mb-6">
              <span className="text-4xl font-bold" data-testid="text-plan-price">
                R{isAnnual ? Math.floor(plan.price.annual / 12) : plan.price.monthly}
              </span>
              <span className="text-muted-foreground">/month</span>
              {isAnnual && (
                <p className="text-sm text-muted-foreground mt-1">
                  Billed annually at R{plan.price.annual}
                </p>
              )}
            </div>
            <Button
              data-testid={`button-plan-cta-${plan.name.toLowerCase()}`}
              variant={plan.highlighted ? "default" : "outline"}
              className="w-full mb-6"
              onClick={() => console.log(`${plan.name} plan selected`)}
            >
              {plan.cta}
            </Button>
            <ul className="space-y-3">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3" data-testid={`feature-${idx}-${i}`}>
                  <Check size={20} className="text-green flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
