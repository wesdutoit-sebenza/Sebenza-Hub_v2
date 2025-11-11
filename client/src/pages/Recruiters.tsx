import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import Section from "@/components/Section";
import Stat from "@/components/Stat";
import FAQAccordion from "@/components/FAQAccordion";
import PricingTable from "@/components/PricingTable";
import {
  CheckCircle,
  FileText,
  Kanban,
  Download,
} from "lucide-react";
import { recruiterPricingPlans, corporatePricingPlans } from "@/data";

export default function Recruiters() {
  const [organizationType, setOrganizationType] = useState<
    "agency" | "corporate"
  >("agency");

  useEffect(() => {
    document.title = "For Recruiters | Reduce noise. Faster shortlists.";
  }, []);

  const agencyFeatures = [
    {
      icon: <CheckCircle className="text-amber" size={24} />,
      title: "Verify employers & ads",
      description:
        "All job posts verified. No more time wasted on fake listings.",
    },
    {
      icon: <FileText className="text-amber" size={24} />,
      title: "Required salary ranges",
      description:
        "Every job includes transparent salary info. Build trust, save time.",
    },
    {
      icon: <Download className="text-amber" size={24} />,
      title: "Export to Pnet/CJ/Adzuna",
      description:
        "One-click export to all major SA job boards. Post once, reach everywhere.",
    },
    {
      icon: <Kanban className="text-amber" size={24} />,
      title: "Pipeline Kanban",
      description:
        "Visual pipeline with drag-and-drop. Track every candidate at a glance.",
    },
  ];

  const corporateFeatures = [
    {
      icon: <CheckCircle className="text-amber" size={24} />,
      title: "Internal talent pool",
      description:
        "Build and maintain your company's talent database for future openings.",
    },
    {
      icon: <FileText className="text-amber" size={24} />,
      title: "EE/AA compliance",
      description:
        "Automated Employment Equity reporting and BBBEE scorecard tracking.",
    },
    {
      icon: <Download className="text-amber" size={24} />,
      title: "Department workflows",
      description:
        "Custom hiring workflows for each department with approval chains.",
    },
    {
      icon: <Kanban className="text-amber" size={24} />,
      title: "Multi-role tracking",
      description:
        "Manage multiple open positions across departments simultaneously.",
    },
  ];

  const features =
    organizationType === "agency" ? agencyFeatures : corporateFeatures;

  return (
    <main id="main-content">
      <PageHeader
        title="Less noise. Faster shortlists."
        description="Purpose-built tools for SA recruiters. Verify employers, require salary transparency, and export to all major job boards."
        breadcrumb="For Recruiters"
      />
      {/* Organization Type Toggle */}
      <Section className="py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center">
            <div className="inline-flex rounded-xl bg-card p-2 shadow-lg border-2 border-amber/20">
              <Button
                size="lg"
                variant={organizationType === "agency" ? "default" : "ghost"}
                className={`
                  px-8 py-6 text-lg font-semibold rounded-lg transition-all
                  ${
                    organizationType === "agency"
                      ? "bg-amber-gradient text-charcoal hover:opacity-90 shadow-md"
                      : "text-muted-foreground hover:text-foreground hover-elevate"
                  }
                `}
                onClick={() => setOrganizationType("agency")}
                data-testid="button-toggle-agency"
              >
                Recruiting Agencies
              </Button>
              <Button
                size="lg"
                variant={organizationType === "corporate" ? "default" : "ghost"}
                className={`
                  px-8 py-6 text-lg font-semibold rounded-lg transition-all
                  ${
                    organizationType === "corporate"
                      ? "bg-amber-gradient text-charcoal hover:opacity-90 shadow-md"
                      : "text-muted-foreground hover:text-foreground hover-elevate"
                  }
                `}
                onClick={() => setOrganizationType("corporate")}
                data-testid="button-toggle-corporate"
              >
                Corporate Company
              </Button>
            </div>
          </div>
        </div>
      </Section>
      {/* Pricing Section - Moved to Top */}
      <Section id="pricing">
        <h2
          className="text-3xl md:text-4xl font-serif font-semibold text-center mb-4 text-[#ffffff]"
          data-testid="text-pricing-title"
        >
          {organizationType === "agency"
            ? "Pricing for Recruiting Agencies"
            : "Pricing for Corporate Companies"}
        </h2>
        <p className="text-center mb-12 max-w-2xl mx-auto text-[#ffffff]">
          {organizationType === "agency"
            ? "Choose the plan that fits your recruitment needs. All plans include POPIA compliance and WhatsApp integration."
            : "Enterprise-grade hiring solutions with EE/AA compliance and multi-department support. All plans include POPIA compliance."}
        </p>
        <PricingTable
          plans={
            organizationType === "agency"
              ? recruiterPricingPlans
              : corporatePricingPlans
          }
        />
      </Section>
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2
              className="text-3xl font-serif font-semibold mb-6 text-white-brand"
              data-testid="text-section-title"
            >
              {organizationType === "agency"
                ? "Everything you need to recruit smarter"
                : "Enterprise hiring made simple"}
            </h2>
            <div className="space-y-6">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex gap-4"
                  data-testid={`feature-${idx}`}
                >
                  <div className="flex-shrink-0">{feature.icon}</div>
                  <div>
                    <h3
                      className="font-semibold mb-1 text-white-brand"
                      data-testid="text-feature-title"
                    >
                      {feature.title}
                    </h3>
                    <p
                      className="text-sm text-[#ffffff]"
                      data-testid="text-feature-description"
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Card className="p-8">
            <div className="aspect-video bg-gradient-to-br from-amber/10 to-transparent rounded-lg flex items-center justify-center border">
              <p className="text-slate" data-testid="text-mock-ui">
                {organizationType === "agency"
                  ? "[Kanban Pipeline Mock UI]"
                  : "[Department Workflow Mock UI]"}
              </p>
            </div>
          </Card>
        </div>

        <div className="bg-card rounded-2xl p-8 mb-16">
          <h3
            className="text-2xl font-serif font-semibold mb-8 text-center text-[#70787e]"
            data-testid="text-stats-title"
          >
            {organizationType === "agency"
              ? "Real results from SA recruiters"
              : "Real results from SA companies"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {organizationType === "agency" ? (
              <>
                <Stat
                  value="↓50%"
                  label="Time-to-shortlist"
                  trend="down"
                  color="amber"
                />
                <Stat
                  value="↓22%"
                  label="Cost-per-hire"
                  trend="down"
                  color="amber"
                />
              </>
            ) : (
              <>
                <Stat
                  value="↓45%"
                  label="Time-to-hire"
                  trend="down"
                  color="amber"
                />
                <Stat
                  value="↑30%"
                  label="EE/AA compliance"
                  trend="up"
                  color="amber"
                />
              </>
            )}
          </div>
        </div>
      </Section>
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <Card className="p-6">
            <div className="aspect-video bg-gradient-to-br from-violet/10 to-transparent rounded-lg flex items-center justify-center border mb-4">
              <p className="text-muted-foreground text-sm">
                [Salary Transparency Mock]
              </p>
            </div>
            <h3 className="font-semibold mb-2" data-testid="text-mock-title">
              Post with mandatory salary ranges
            </h3>
            <p className="text-sm text-muted-foreground">
              Build trust and reduce time-wasters with transparent salary info
              on every post.
            </p>
          </Card>
          <Card className="p-6">
            <div className="aspect-video bg-gradient-to-br from-green/10 to-transparent rounded-lg flex items-center justify-center border mb-4">
              <div className="text-center">
                <FileText size={48} className="text-green mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">CSV Export</p>
              </div>
            </div>
            <h3 className="font-semibold mb-2" data-testid="text-mock-title">
              EE Report Export
            </h3>
            <p className="text-sm text-muted-foreground">
              One-click Employment Equity reports ready for submission.
            </p>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-[#ae6d0f]"
            data-testid="button-workflow"
            onClick={() => console.log("See recruiter workflow clicked")}
          >
            See recruiter workflow
          </Button>
          <Button
            size="lg"
            variant="outline"
            data-testid="button-demo"
            onClick={() => console.log("Book a demo clicked")}
          >
            Book a demo
          </Button>
        </div>
      </Section>
      <Section className="bg-graphite" id="faq">
        <h2
          className="text-3xl font-serif font-semibold text-center mb-12 text-white-brand"
          data-testid="text-faq-title"
        >
          Recruiter FAQs
        </h2>
        <div className="max-w-3xl mx-auto">
          <FAQAccordion audience="recruiters" />
        </div>
      </Section>
    </main>
  );
}