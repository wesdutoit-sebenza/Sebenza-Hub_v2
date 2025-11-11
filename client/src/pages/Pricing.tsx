import { useLocation } from "wouter";
import { Users, Briefcase, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Pricing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="heading-pricing">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-muted-foreground">
              Choose the plan that's right for you. Start free, upgrade anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Categories Navigation */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Individual Pricing Card */}
          <Card className="hover-elevate cursor-pointer" onClick={() => navigate('/individuals')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Job Seekers</CardTitle>
              </div>
              <CardDescription className="text-base">
                For individuals building their careers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                <li>• Free plan available</li>
                <li>• CV builder & upload</li>
                <li>• Job matching & alerts</li>
                <li>• WhatsApp applications</li>
                <li>• AI interview coach</li>
              </ul>
              <Button 
                className="w-full" 
                variant="default"
                data-testid="button-view-individual-pricing"
              >
                View Individual Pricing
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Recruiter/Corporate Pricing Card */}
          <Card className="hover-elevate cursor-pointer" onClick={() => navigate('/recruiters')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Recruiters & Companies</CardTitle>
              </div>
              <CardDescription className="text-base">
                For recruiting agencies and businesses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                <li>• Free plan available</li>
                <li>• Job posting & management</li>
                <li>• ATS & candidate pipeline</li>
                <li>• Corporate client management</li>
                <li>• Interview scheduling</li>
              </ul>
              <Button 
                className="w-full" 
                variant="default"
                data-testid="button-view-recruiter-pricing"
              >
                View Recruiter Pricing
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-card border-t">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Can I switch plans anytime?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                and we'll prorate your billing.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards, debit cards, and instant EFT through Netcash, 
                a trusted South African payment gateway.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Is my data safe and POPIA compliant?</h3>
              <p className="text-muted-foreground">
                Absolutely. We're fully POPIA compliant and use bank-level encryption to protect your data. 
                All candidate information is stored securely in South Africa.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Can I cancel my subscription?</h3>
              <p className="text-muted-foreground">
                Yes, you can cancel anytime from your billing dashboard. You'll continue to have access 
                until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join hundreds of South African businesses already hiring smarter with Sebenza Hub.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/login')} data-testid="button-get-started-cta">
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/contact')} data-testid="button-contact-sales">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
