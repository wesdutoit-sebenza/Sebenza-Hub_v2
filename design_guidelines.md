# Design Guidelines: Sebenza Hub - South African Recruiting Platform

## Design Approach
**Warm & Professional**: Earthy brown palette with Montserrat typography creates a sophisticated, grounded aesthetic that reflects South African professionalism. Minimal layout with generous whitespace and warm accent tones.

## Brand Identity

### Color Palette
**Base Colors:**
- Background: `#e1dacc` (warm beige) - hsl(40, 30%, 84%)
- Foreground: `#3d3132` (dark brown-gray) - hsl(355, 11%, 22%)

**Accent Colors:**
- Primary (buttons/icons): `#79583a` (rich brown) - hsl(29, 35%, 35%)
- Primary Foreground: White `#ffffff` - hsl(0, 0%, 100%)
- Secondary: `#aa9a86` (light taupe) - hsl(33, 19%, 60%)
- Card Background: `#f1ebe9` (soft cream) - hsl(15, 24%, 93%)

**Dark Mode Colors:**
- Background: Dark brown-gray - hsl(355, 11%, 12%)
- Foreground: Warm beige - hsl(40, 30%, 84%)
- Primary: Medium brown - hsl(29, 35%, 52%)

**Accessibility:**
- All color combinations meet WCAG AA standards (4.5:1 minimum contrast)
- Light mode: Background/foreground 8.8:1, Primary/background 4.64:1, Button text 6.42:1
- Dark mode: Background/foreground 11.7:1, Primary/background 4.53:1, Button text 6.42:1

**Usage Strategy:**
- Use base colors for 85% of the design (dark brown-gray on warm beige)
- Rich brown primary for CTAs, icons, and interactive elements with white text
- Light taupe and cream for supporting elements and elevated surfaces
- Borders: subtle brown tones at reduced opacity

### Typography
**Font (Google Fonts CDN):**
- All text: Montserrat (weights: 400, 500, 600, 700)

**Hierarchy:**
- H1: Montserrat 700, 3.5rem (mobile: 2.5rem)
- H2: Montserrat 700, 2.5rem (mobile: 2rem)
- H3: Montserrat 600, 1.5rem
- Body: Montserrat 400, 1rem
- Small: Montserrat 400, 0.875rem

### Layout System
**Spacing Primitives:** Use Tailwind units 2, 4, 6, 8, 12, 16, 20, 24, 32
- Consistent section padding: py-20 (desktop), py-12 (mobile)
- Card padding: p-8 (desktop), p-6 (mobile)
- Component gaps: gap-8 (desktop), gap-6 (mobile)

**Container Strategy:**
- Full-width sections with inner `max-w-7xl mx-auto px-6`
- Content sections: `max-w-6xl`
- Text-heavy content: `max-w-prose`

## Component Library

### Navigation
- Sticky header with wordmark left, nav links center, CTA button right
- Active link: underline with primary brown accent (2px thick, offset-4)
- Keyboard focus: 2px primary ring with offset
- Skip-to-content link for accessibility

### Buttons
- **Solid Primary**: Primary brown (#8d6c4e), cream text, rounded-lg, px-6 py-3
- **Ghost**: Dark brown border (1px), dark brown text, rounded-lg, px-6 py-3
- **Outline on Images**: Semi-transparent cream background with backdrop blur, dark brown text

### Cards
- Border radius: rounded-2xl
- Shadow: subtle (shadow-sm on hover: shadow-md)
- Border: 1px using dark brown at 10% opacity
- Background: cream (#f1ebe9)
- Hover: lift effect (translate-y-[-4px] + shadow increase)

### Badges
- Small rounded-full pills
- Background: primary brown at 10% opacity
- Text: matching brown at full saturation
- Use for "New", "Popular", "SA Verified", "POPIA Compliant"

### Modals
- Backdrop: dark brown at 50% opacity with backdrop blur
- Container: cream, rounded-2xl, max-w-4xl
- Close button: top-right, dark brown color
- Keyboard trap and focus management

## Page-Specific Guidelines

### Home Page
**Hero Section (80vh):**
- Centered layout with subtle gradient background (warm beige variations)
- H1: "Hiring that actually moves."
- Subheading: max-w-2xl centered
- Two-button CTA (primary solid + ghost)
- No hero image; gradient background only

**Value Props (4 cards):**
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Each card: icon (primary brown), title, short description
- Icons from Lucide React

**Product Tour Modal:**
- Three slides with previous/next navigation
- Each slide: illustration placeholder + headline + bullet points
- Progress indicator (3 dots, current highlighted in primary brown)

**Pricing Table:**
- Three columns (Starter, Team, Business)
- Toggle switch (monthly/annual) with primary brown highlight
- Feature list with checkmarks (primary brown for included)
- CTA buttons use primary brown

**Teaser Cards (3):**
- Horizontal layout on desktop
- Each links to role-specific page
- Background: subtle brown gradient
- "Learn more" link with arrow

### Recruiters Page
**Hero:**
- H1 left-aligned, supporting text max-w-2xl
- Small gradient blob accent (primary brown)
- Two CTAs: "See recruiter workflow" (solid), "Book a demo" (ghost)

**Features:**
- Alternating image-text sections (mock UI screenshots)
- Stats row: 2-column grid with large numbers (primary brown), small label

**UI Mocks:**
- Show: job post form, Kanban pipeline, EE report export
- Use placeholder screenshots with subtle shadow

### Businesses Page
**Case Study Callout:**
- Bordered section with primary brown accent line (left border, 4px)
- Quote typography using Montserrat medium
- Company name and metric in bold

**Pricing Callout:**
- Highlight "Team" plan with primary brown badge
- Inline comparison of plans

### Individuals Page
**WhatsApp Integration:**
- QR code placeholder (300x300px, centered)
- Primary brown "Apply on WhatsApp" button
- Three-step visual flow (numbered circles with connecting lines)

**CV Builder:**
- Multi-step wizard with progress indicator
- Professional CV preview in cream card
- Primary brown accent for step indicators and CTAs

**Portfolio Cards:**
- Upload area with dashed border
- Skills assessment with progress indicators
- Verified badge (primary brown checkmark icon)

### Footer
- Three-column grid: Links, Contact, Legal
- South African flag emoji 🇿🇦 + "Built in SA"
- Email: hello@yourdomain.co.za
- Subtle top border (dark brown at 10%)

## Motion & Interactivity
**Animations:**
- Gentle scroll-reveal: fade-in + slide-up (20px) on IntersectionObserver
- Hover states: all interactive elements have subtle scale or shadow increase
- Transition duration: 200ms for UI, 300ms for sections
- No autoplay carousels; user-controlled only

**Scroll Behavior:**
- Smooth scroll for in-page anchors
- Reveal sections when 20% visible

## Accessibility Requirements
- Landmarks: header, nav, main, footer
- Alt text for all images/icons
- Color contrast: minimum 4.5:1 for text
- Keyboard navigation: focus rings (primary brown, 2px)
- ARIA labels for icon-only buttons
- Skip-to-content link

## SEO & Meta
**Per-Route Titles:**
- Home: "Sebenza Hub—SA Recruiting Platform with POPIA/EE Compliance"
- Recruiters: "Reduce Noise. Faster Shortlists."
- Businesses: "SME-Friendly Hiring with POPIA/EE Compliance"
- Individuals: "One Profile. Verified Skills. Transparent Pay."

**Open Graph:**
- Include og:title, og:description, og:image for all pages
- Schema.org: Organization + WebSite markup

## South African Context
- Reference cities: Johannesburg, Cape Town, Durban
- Compliance callouts: POPIA, EE (Employment Equity), BBBEE
- Currency: ZAR (R)
- Use local business scenarios in copy

## Image Strategy
**No large hero images.** Use gradient backgrounds with text-first approach. Include images only for:
- Mock UI screenshots (pipeline, forms, reports)
- WhatsApp QR code placeholder
- Testimonial avatars (small circular, 48px)
- Optional: tiny dummy chart for "SA Hiring Index"
