import FAQAccordion from '../FAQAccordion';

export default function FAQAccordionExample() {
  return (
    <div className="p-8 max-w-3xl mx-auto bg-background">
      <h2 className="text-2xl font-serif font-semibold mb-6">Frequently Asked Questions</h2>
      <FAQAccordion audience="all" />
    </div>
  );
}
