import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: string;
  gradientVariant?: "violet-cyan" | "cyan" | "green" | "amber";
}

export default function PageHeader({ title, description, breadcrumb, gradientVariant = "cyan" }: PageHeaderProps) {
  return (
    <div className="relative py-16 px-6 overflow-hidden border-b border-slate text-[#1a2328] bg-[#1a2328]">
      <div className="max-w-7xl mx-auto relative z-10">
        {breadcrumb && (
          <nav className="mb-4 flex items-center gap-2 text-sm text-slate" aria-label="Breadcrumb">
            <Link 
              href="/" 
              data-testid="link-breadcrumb-home" 
              className="hover:text-amber hover-elevate px-2 py-1 rounded-md"
            >
              Home
            </Link>
            <ChevronRight size={16} />
            <span data-testid="text-breadcrumb-current" className="text-white-brand">{breadcrumb}</span>
          </nav>
        )}
        <h1 className="text-4xl md:text-5xl font-serif font-semibold mb-4 text-white-brand" data-testid="text-page-title">
          {title}
        </h1>
        {description && (
          <p className="text-lg max-w-2xl text-[#ffffff]" data-testid="text-page-description">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
