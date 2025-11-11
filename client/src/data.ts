export const testimonials = [
  {
    name: "Thandi Nkosi",
    title: "Talent Manager",
    company: "Cape Town Retail Co",
    quote: "Cut our time-to-hire by 50% and eliminated salary negotiation friction completely. Game-changer for SMEs."
  },
  {
    name: "David van der Merwe",
    title: "Recruitment Lead",
    company: "Joburg Tech Solutions",
    quote: "POPIA compliance was a nightmare before. Now it's automated, and clients trust us more."
  },
  {
    name: "Nomsa Khumalo",
    title: "HR Director",
    company: "Durban Logistics Group",
    quote: "WhatsApp-first hiring cut our no-show rate by 28%. Candidates actually respond now."
  }
];

export const faqs = [
  {
    q: "How does POPIA compliance work?",
    a: "All candidate consent is logged automatically, and we provide audit trails for every interaction. You can export compliance reports anytime.",
    audience: "all" as const
  },
  {
    q: "Can I export to Pnet and other job boards?",
    a: "Yes! One-click exports to Pnet, CareerJunction, and Adzuna. We handle the formatting for you.",
    audience: "recruiters" as const
  },
  {
    q: "Do I need technical skills to use the platform?",
    a: "Not at all. If you can use WhatsApp, you can use our platform. Setup takes under 10 minutes.",
    audience: "businesses" as const
  },
  {
    q: "What background checks do you support?",
    a: "We integrate with major SA background check providers. You can request criminal, credit, and qualification checks right from the platform.",
    audience: "businesses" as const
  },
  {
    q: "How do salary ranges work?",
    a: "All job posts must include a salary range. This builds trust and reduces wasted time for everyone.",
    audience: "all" as const
  },
  {
    q: "Is my data safe?",
    a: "Yes. We're POPIA-compliant, use bank-grade encryption, and host data in South Africa.",
    audience: "individuals" as const
  },
  {
    q: "Can I import my existing candidate database?",
    a: "Absolutely. We support CSV imports and can help migrate from most ATS systems.",
    audience: "recruiters" as const
  },
  {
    q: "What's included in the EE reporting?",
    a: "Full Employment Equity reports ready for submission, with demographic tracking and automated analytics.",
    audience: "recruiters" as const
  }
];

// Recruiter pricing plans (for agencies)
export const recruiterPricingPlans = [
  {
    name: "Recruiter Free",
    price: { monthly: 0, annual: 0 },
    description: "Get started with essential tools",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Get started",
    highlighted: false
  },
  {
    name: "Recruiter Standard",
    price: { monthly: 799, annual: 7190 },
    description: "For growing recruitment agencies",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Start free trial",
    highlighted: true
  },
  {
    name: "Recruiter Premium",
    price: { monthly: 1999, annual: 17990 },
    description: "Advanced features for professional recruiters",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Contact sales",
    highlighted: false
  }
];

// Corporate pricing plans (for in-house recruiters at companies)
export const corporatePricingPlans = [
  {
    name: "Corporate Free",
    price: { monthly: 0, annual: 0 },
    description: "Get started with essential tools",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Get started",
    highlighted: false
  },
  {
    name: "Corporate Standard",
    price: { monthly: 799, annual: 7190 },
    description: "For growing corporate recruitment teams",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Start free trial",
    highlighted: true
  },
  {
    name: "Corporate Premium",
    price: { monthly: 1999, annual: 17990 },
    description: "Enterprise-grade compliance and features",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Contact sales",
    highlighted: false
  }
];

// Business pricing plans
export const businessPricingPlans = [
  {
    name: "Business Free",
    price: { monthly: 0, annual: 0 },
    description: "Perfect for small businesses",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Get started",
    highlighted: false
  },
  {
    name: "Business Standard",
    price: { monthly: 799, annual: 7190 },
    description: "For SMEs with regular hiring needs",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Start free trial",
    highlighted: true
  },
  {
    name: "Business Premium",
    price: { monthly: 1999, annual: 17990 },
    description: "Enterprise-grade compliance and features",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Contact sales",
    highlighted: false
  }
];

// Individual pricing plans
export const individualPricingPlans = [
  {
    name: "Individual Free",
    price: { monthly: 0, annual: 0 },
    description: "Start your job search today",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Sign up free",
    highlighted: false
  },
  {
    name: "Individual Standard",
    price: { monthly: 99, annual: 890 },
    description: "Accelerate your job search",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Start free trial",
    highlighted: true
  },
  {
    name: "Individual Premium",
    price: { monthly: 299, annual: 2690 },
    description: "Premium career development tools",
    features: [
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed",
      "Feature to be confirmed"
    ],
    cta: "Upgrade now",
    highlighted: false
  }
];

export const tourSlides = [
  {
    title: "Post Once, Reach Everywhere",
    description: "Create a job post with mandatory salary ranges, then export to Pnet, CareerJunction, and Adzuna with one click.",
    bullets: [
      "Salary transparency builds trust",
      "One-click multi-board posting",
      "POPIA consent built-in"
    ]
  },
  {
    title: "WhatsApp-First Applications",
    description: "Candidates apply via WhatsApp. You get structured data in your pipeline. No more lost email threads.",
    bullets: [
      "QR code on job ads",
      "Auto-parsed responses",
      "28% lower no-show rates"
    ]
  },
  {
    title: "Compliance Made Simple",
    description: "EE reports, POPIA logs, and background checks—all in one place. Export what you need, when you need it.",
    bullets: [
      "One-click EE reports",
      "Audit-ready consent trails",
      "Integrated background checks"
    ]
  }
];

export const valueProps = [
  {
    title: "AI-Powered Hiring",
    description: "Instantly screen candidates, detect fraud, and generate competency tests — all automatically.",
    icon: "Sparkles"
  },
  {
    title: "WhatsApp First",
    description: "Candidates apply, chat, and interview directly through WhatsApp — where South Africans already are.",
    icon: "MessageCircle"
  },
  {
    title: "Built for South Africa",
    description: "POPIA compliant, BEE & EEA reporting ready, and adapted to local job markets.",
    icon: "MapPin"
  },
  {
    title: "End-to-End Automation",
    description: "From job posting to hiring, Sebenza Hub does the heavy lifting so you can focus on people.",
    icon: "Zap"
  }
];

export const aiAgents = [
  {
    title: "Candidate Screening Agent",
    description: "Automatically ranks and filters candidates for best fit.",
    icon: "UserCheck"
  },
  {
    title: "Job Description Agent",
    description: "Writes compelling job posts in seconds.",
    icon: "FileText"
  },
  {
    title: "Competency Test Agent",
    description: "Creates custom pre-interview tests per job.",
    icon: "ClipboardCheck"
  },
  {
    title: "Interview Scheduling Agent",
    description: "Coordinates meetings via Google & Outlook.",
    icon: "Calendar"
  },
  {
    title: "Fraud & Spam Detection Agent",
    description: "Flags fake or duplicate CVs instantly.",
    icon: "ShieldAlert"
  },
  {
    title: "AI Interview Coach",
    description: "Helps candidates prepare confidently for interviews.",
    icon: "GraduationCap"
  }
];
