# Project Structure

## Directory Organization

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI primitives (shadcn/ui)
│   ├── FinOpsView.tsx  # FinOps dashboard with cost analysis
│   └── CloudOpsView.tsx # CloudOps resource management
├── lib/                # Utility functions and data
│   ├── utils.ts        # Helper functions (cn, etc.)
│   └── mockData.ts     # Mock data generators
├── types/              # TypeScript type definitions
│   └── index.ts        # Shared interfaces and types
├── hooks/              # Custom React hooks
│   └── use-toast.ts    # Toast notification hook
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles and CSS variables
```

## Component Conventions

- **View Components**: Top-level feature components (`FinOpsView`, `CloudOpsView`)
- **UI Components**: Located in `src/components/ui/`, follow shadcn/ui patterns
- **Imports**: Use `@/` path alias for all src imports (e.g., `@/components/ui/button`)

## State Management

- Local component state with `useState` and `useEffect`
- No global state management library (Redux, Zustand, etc.)
- Memory management in FinOpsView uses localStorage with TTL and server sync

## Type Definitions

All shared types are defined in `src/types/index.ts`:
- `CostData`, `EC2Instance`, `EKSCluster`, `ECSService`, `ChatMessage`
- Use these types consistently across components

## Styling Approach

- Tailwind utility classes for all styling
- CSS variables defined in `index.css` for theme colors
- Component variants use `class-variance-authority` (cva)
- Utility function `cn()` from `lib/utils.ts` for conditional classes

## API Integration Pattern

- Fetch calls in `useEffect` hooks
- API base URL stored as constant: `API_BASE`
- Error handling with try-catch and console warnings
- Toast notifications for user feedback on actions
