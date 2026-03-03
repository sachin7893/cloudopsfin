# Tech Stack

## Core Technologies

- **Framework**: React 18.3 with TypeScript 5.5
- **Build Tool**: Vite 5.4
- **Styling**: Tailwind CSS 3.4 with CSS variables for theming
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **Charts**: Recharts 2.12
- **Forms**: React Hook Form 7.53 with Zod validation
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)

## Project Configuration

- **Module System**: ES Modules (`"type": "module"`)
- **Path Aliases**: `@/*` maps to `./src/*`
- **TypeScript**: Project references with separate configs for app and node

## Common Commands

```bash
# Development server (runs on Vite default port 5173)
npm run dev

# Type checking (without emitting files)
npm run typecheck

# Linting
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

## Backend API

- Base URL: `https://0azsdk6qbb.execute-api.ap-south-1.amazonaws.com/prod`
- Integration: Supabase client configured (`@supabase/supabase-js`)
- API endpoints: `/finops`, `/top-increase`, `/chat`

## Development Notes

- Use `npm run dev` to start the development server (do not use `vite` directly)
- Always run `npm run typecheck` before committing to catch type errors
- The app uses CSS custom properties for theming (see `tailwind.config.js`)
