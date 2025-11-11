import PageHeader from '../PageHeader';
import { Router } from 'wouter';

export default function PageHeaderExample() {
  return (
    <Router>
      <PageHeader
        title="For Recruiters"
        description="Less noise. Faster shortlists."
        breadcrumb="Recruiters"
        gradientVariant="cyan"
      />
    </Router>
  );
}
