/**
 * Centralized list of South African skills organized by category.
 * Used throughout the application for:
 * - Individual job seeker profiles
 * - Recruiter job postings (must-have and nice-to-have skills)
 * - Business job postings
 * - ATS candidate screening
 */

export interface SkillCategory {
  category: string;
  skills: string[];
}

export const SKILLS_BY_CATEGORY: SkillCategory[] = [
  {
    category: "Agriculture & Environment",
    skills: [
      "Animal Care",
      "Crop Management",
      "Environmental Impact Assessment",
      "GIS Mapping",
      "Horticulture",
      "Irrigation Systems",
      "Land Rehabilitation",
      "Pest Control",
      "Soil Science",
      "Sustainability Practices",
    ],
  },
  {
    category: "Business & Management",
    skills: [
      "Administration",
      "Budgeting",
      "Business Development",
      "Client Relationship Management",
      "Contract Management",
      "Data Analysis",
      "Financial Management",
      "Human Resources",
      "Inventory Management",
      "Marketing Strategy",
      "Office Management",
      "Operations Management",
      "Procurement",
      "Project Management",
      "Reporting",
      "Sales Strategy",
      "Strategic Planning",
      "Supply Chain Management",
    ],
  },
  {
    category: "Digital & Technical",
    skills: [
      "Artificial Intelligence (AI)",
      "Automation Tools",
      "Big Data Analytics",
      "CRM Systems (Salesforce, HubSpot, Zoho)",
      "Cloud Computing",
      "Cybersecurity Awareness",
      "Data Entry",
      "Database Management (SQL, MySQL)",
      "Excel (Advanced)",
      "Google Workspace (Docs, Sheets, Slides)",
      "Information Technology Support",
      "Microsoft Office Suite",
      "Power BI",
      "Presentation Design",
      "QuickBooks / Sage Accounting",
      "Software Development",
      "Troubleshooting",
      "Web Development",
      "WordPress",
    ],
  },
  {
    category: "Education & Training",
    skills: [
      "Assessment Design",
      "Classroom Management",
      "Curriculum Development",
      "Educational Technology",
      "Instructional Design",
      "Learner Support",
      "Lesson Planning",
      "Mentorship",
      "Online Facilitation",
      "Teaching Methods",
      "eLearning Development (Articulate, Captivate)",
    ],
  },
  {
    category: "Engineering, Manufacturing & Technical Trades",
    skills: [
      "AutoCAD",
      "Blueprint Reading",
      "CNC Operation",
      "Electrical Systems",
      "Equipment Maintenance",
      "HVAC Systems",
      "Health & Safety Compliance",
      "Machine Operation",
      "Mechanical Design",
      "Quality Control",
      "Risk Assessment",
      "Technical Drawing",
      "Toolmaking",
      "Welding",
    ],
  },
  {
    category: "Finance, Accounting & Admin",
    skills: [
      "Account Reconciliation",
      "Accounts Payable / Receivable",
      "Auditing",
      "Bookkeeping",
      "Budget Control",
      "Cash Flow Management",
      "Cost Analysis",
      "Financial Reporting",
      "Payroll Administration",
      "Tax Compliance",
      "VAT Submissions",
    ],
  },
  {
    category: "General & Labour",
    skills: [
      "Cleaning & Sanitation",
      "Driving (Code 8 / Code 10 / PDP)",
      "Forklift Operation",
      "Hand Tools",
      "Inventory Handling",
      "Manual Labour",
      "Packaging",
      "Stock Control",
      "Timekeeping",
      "Vehicle Maintenance",
    ],
  },
  {
    category: "Healthcare & Social Services",
    skills: [
      "Basic Life Support (BLS)",
      "Case Management",
      "Clinical Procedures",
      "First Aid",
      "Health Promotion",
      "Infection Control",
      "Medication Administration",
      "Patient Care",
      "Record Keeping",
      "Social Work Case Files",
      "Triage",
    ],
  },
  {
    category: "Marketing, Sales & Customer-Facing",
    skills: [
      "Advertising Campaigns",
      "Brand Management",
      "Cold Calling",
      "Content Creation",
      "Copywriting",
      "Customer Retention",
      "Digital Marketing",
      "Email Marketing",
      "Market Research",
      "Presentation Skills",
      "Product Knowledge",
      "Public Relations",
      "SEO / SEM",
      "Social Media Management",
    ],
  },
  {
    category: "Public Works, Construction & Infrastructure",
    skills: [
      "Building Inspection",
      "Civil Engineering Design",
      "Construction Management",
      "Cost Estimation",
      "Drafting (AutoCAD)",
      "Land Surveying",
      "Occupational Safety",
      "Plumbing",
      "Project Scheduling",
      "Quantity Surveying",
      "Site Supervision",
    ],
  },
  {
    category: "Soft Skills",
    skills: [
      "Adaptability",
      "Attention to Detail",
      "Communication Skills",
      "Conflict Resolution",
      "Critical Thinking",
      "Customer Service",
      "Decision Making",
      "Emotional Intelligence",
      "Empathy",
      "Leadership",
      "Negotiation",
      "Organisation",
      "Problem Solving",
      "Reliability",
      "Teamwork",
      "Time Management",
      "Work Ethic",
    ],
  },
] as const;

// Flatten all skills for easy lookup
export const ALL_SKILLS = SKILLS_BY_CATEGORY.flatMap(cat => cat.skills);

// Get category for a skill
export function getCategoryForSkill(skill: string): string | undefined {
  for (const category of SKILLS_BY_CATEGORY) {
    if (category.skills.includes(skill)) {
      return category.category;
    }
  }
  return undefined;
}
