# Next.js 14 Production Starter

A production-ready Next.js 14 application with TypeScript, Tailwind CSS, shadcn/ui, and comprehensive development tooling.

## 🚀 Features

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **ESLint** and **Prettier** for code quality
- **Husky** and **lint-staged** for pre-commit hooks
- **Jest** and **React Testing Library** for testing

## 📁 Folder Structure

```
.
├── app/                    # Next.js App Router pages and layouts
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── not-found.tsx      # 404 page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── hooks/            # Custom React hooks
├── lib/                   # Utility functions and shared code
├── db/                    # Database models and migrations (empty for now)
├── tests/                 # Test files
│   ├── api/              # API route tests
│   └── components/       # Component tests
├── .husky/               # Git hooks
└── public/               # Static assets
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 5000 |
| `npm run build` | Build for production |
| `npm start` | Start production server on port 5000 |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm test` | Run tests in watch mode |
| `npm run test:ci` | Run tests in CI mode |
| `npm run type-check` | Run TypeScript type checking |

## 🧪 Testing

This project uses Jest and React Testing Library for testing.

### Run Tests

```bash
# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm run test:ci

# Run tests with coverage
npm test -- --coverage
```

### Example Tests

- **API Route Test**: `tests/api/health.test.ts`
- **Component Test**: `tests/components/Button.test.tsx`

## 🎨 Styling

### Tailwind CSS

Tailwind is configured with custom design tokens in `app/globals.css`. The design system includes:

- Custom color palette (primary, secondary, accent, destructive)
- Typography scale
- Spacing utilities
- Custom shadows and effects

### shadcn/ui

UI components are located in `components/ui/`. To add more components:

```bash
npx shadcn-ui@latest add [component-name]
```

## 🔧 Code Quality

### ESLint

ESLint is configured with Next.js, React, and Prettier rules. Configuration in `.eslintrc.json`.

### Prettier

Prettier is configured with Tailwind CSS plugin for automatic class sorting. Configuration in `.prettierrc`.

### Pre-commit Hooks

Husky runs lint-staged before each commit to:
- Lint and fix JavaScript/TypeScript files
- Format all files with Prettier

## 🌐 Environment Variables

Create a `.env.local` file for environment variables:

```env
# Example
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## 📝 License

MIT
