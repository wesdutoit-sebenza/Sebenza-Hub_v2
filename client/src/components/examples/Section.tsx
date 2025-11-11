import Section from '../Section';

export default function SectionExample() {
  return (
    <Section className="bg-card">
      <h2 className="text-3xl font-serif font-semibold mb-4">Section Title</h2>
      <p className="text-muted-foreground">This is example content inside a section wrapper.</p>
    </Section>
  );
}
