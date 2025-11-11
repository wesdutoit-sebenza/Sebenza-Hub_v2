import { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export default function Section({ children, className = "", id }: SectionProps) {
  return (
    <section id={id} className="py-20 px-6 text-foreground bg-[#1a2328]">
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  );
}
