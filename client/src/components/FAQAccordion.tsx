import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/data";

interface FAQAccordionProps {
  audience?: "all" | "recruiters" | "businesses" | "individuals";
}

export default function FAQAccordion({ audience = "all" }: FAQAccordionProps) {
  const filteredFaqs = faqs.filter(
    (faq) => faq.audience === "all" || faq.audience === audience
  );

  return (
    <Accordion type="single" collapsible className="w-full">
      {filteredFaqs.map((faq, idx) => (
        <AccordionItem key={idx} value={`item-${idx}`} data-testid={`accordion-item-${idx}`}>
          <AccordionTrigger data-testid={`accordion-trigger-${idx}`} className="text-left text-[#ffffff]">
            {faq.q}
          </AccordionTrigger>
          <AccordionContent data-testid={`accordion-content-${idx}`} className="text-muted-foreground">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
