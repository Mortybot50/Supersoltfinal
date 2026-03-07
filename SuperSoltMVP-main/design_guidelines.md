# Design Guidelines for SuperSolt

## Design Approach

**Selected Framework**: Material Design + Modern SaaS Aesthetics (inspired by Linear, Stripe, Vercel)

Given the production-ready enterprise setup with comprehensive tooling, this project requires a professional, polished design system that balances sophistication with usability. Drawing inspiration from modern SaaS leaders known for clean interfaces and exceptional user experience.

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary)**
- Background Primary: 222 47% 11%
- Background Secondary: 217 33% 17%
- Background Accent: 217 33% 21%
- Text Primary: 213 31% 91%
- Text Secondary: 215 20% 65%
- Border: 217 33% 25%

**Brand Colors**
- Primary: 217 91% 60% (Vibrant blue for CTAs and key actions)
- Primary Hover: 217 91% 55%
- Accent: 142 76% 36% (Success/confirmation states)
- Warning: 38 92% 50%
- Error: 0 84% 60%

**Light Mode**
- Background: 0 0% 100%
- Foreground: 222 47% 11%
- Muted: 210 40% 96%
- Border: 214 32% 91%

### B. Typography

**Font Families**
- Primary: Inter (Google Fonts) - body text, UI elements
- Display: Cal Sans (or Clash Display) - headings, hero sections
- Monospace: JetBrains Mono - code, technical content

**Type Scale**
- Display (Hero): text-6xl (60px) md:text-7xl (72px) font-bold
- H1: text-4xl (36px) md:text-5xl (48px) font-bold
- H2: text-3xl (30px) md:text-4xl (36px) font-semibold
- H3: text-2xl (24px) font-semibold
- Body Large: text-lg (18px) leading-relaxed
- Body: text-base (16px) leading-relaxed
- Small: text-sm (14px)
- Caption: text-xs (12px) text-muted-foreground

### C. Layout System

**Spacing Units**: Use Tailwind units of 4, 6, 8, 12, 16, 20, 24 for consistent rhythm
- Component padding: p-4 to p-8
- Section spacing: py-16 to py-24 (desktop), py-12 (mobile)
- Card gaps: gap-6 to gap-8
- Container max-width: max-w-7xl with px-6

**Grid System**
- Desktop: 12-column grid (grid-cols-12)
- Tablet: 8-column grid (md:grid-cols-8)
- Mobile: 4-column grid (grid-cols-4)

### D. Component Library

**Navigation**
- Sticky header with backdrop-blur-xl and border-b
- Logo left, navigation center/right, CTA button right
- Mobile: Hamburger menu with slide-in drawer
- Height: h-16 with py-4

**Buttons**
- Primary: Solid background with primary color, rounded-lg
- Secondary: outline variant with border
- Ghost: Minimal, text-only for tertiary actions
- Icon Buttons: rounded-full with p-2
- Sizes: Small (h-9 px-4), Default (h-11 px-6), Large (h-12 px-8)

**Cards**
- Background: bg-card with border rounded-xl
- Padding: p-6 to p-8
- Hover state: Subtle elevation with shadow-lg transition
- Border: border border-border

**Forms**
- Input height: h-11
- Border radius: rounded-md
- Focus ring: ring-2 ring-primary
- Label: text-sm font-medium mb-2
- Error states: border-destructive with error text below

**Data Display**
- Tables: Alternating row backgrounds, sticky headers
- Stats Cards: Large numbers (text-4xl) with trend indicators
- Charts: Use shadcn/ui Recharts integration

**Overlays**
- Modals: Centered with backdrop-blur-sm overlay
- Dropdowns: shadow-xl with subtle animation
- Toasts: Bottom-right corner with slide-in animation

### E. Visual Effects

**Animations** (Minimal)
- Page transitions: Subtle fade-in (opacity 0 to 1, duration-300)
- Hover effects: scale-105 on cards, brightness-110 on buttons
- Loading states: Skeleton screens with pulse animation
- Scroll reveals: Intersection Observer with fade-up on first view only

**Shadows**
- Cards: shadow-sm default, shadow-lg on hover
- Modals: shadow-2xl
- Navigation: shadow-sm with backdrop-blur

## Images

**Hero Section Image**: Large, impactful hero image spanning full viewport width
- Placement: Background of hero section with overlay gradient (from-background/80 to transparent)
- Style: Modern, technology-focused imagery or abstract geometric patterns
- Dimensions: Minimum 1920x1080, optimized WebP format
- Treatment: Subtle blur on edges, 40% opacity overlay for text readability

**Supporting Images**
- Feature sections: Icon-style illustrations (SVG) paired with screenshots
- Team/About: Professional photography with rounded-xl borders
- Dashboard previews: Actual product screenshots with subtle shadow-2xl

## Page Structure Recommendations

**Landing Page Layout**
1. Hero: Full-width with background image, centered content, primary CTA (h-screen)
2. Social Proof: Logo cloud or stats bar (py-12)
3. Features: 3-column grid with icons and descriptions (py-24)
4. Product Showcase: Large screenshot with feature callouts (py-24)
5. Testimonials: 2-column cards with customer quotes (py-20)
6. Final CTA: Centered with secondary background color (py-24)
7. Footer: 4-column sitemap with newsletter signup (py-16)

**Dashboard Layout**
- Left sidebar navigation (w-64, fixed)
- Top bar with search and user menu (h-16, sticky)
- Main content area with breadcrumbs (p-8)
- Right sidebar for contextual actions (w-80, optional based on view)

## Accessibility Standards

- WCAG 2.1 Level AA compliance
- Minimum contrast ratio 4.5:1 for text
- Focus indicators on all interactive elements (ring-2 ring-primary)
- Semantic HTML with proper heading hierarchy
- ARIA labels for icon-only buttons
- Keyboard navigation support throughout

## Implementation Priorities

1. Establish dark mode as default with seamless theme switching
2. Mobile-first responsive design with breakpoints: sm(640px), md(768px), lg(1024px), xl(1280px)
3. Performance: Lazy load images, code-split routes, optimize bundle size
4. Consistent component patterns using shadcn/ui primitives
5. Design system documentation in Storybook (future enhancement)