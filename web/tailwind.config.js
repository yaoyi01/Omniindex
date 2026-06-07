/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Layout
    'flex', 'grid', 'block', 'inline', 'inline-flex', 'inline-block',
    'flex-col', 'flex-row', 'flex-wrap', 'flex-1',
    'items-center', 'items-start', 'items-end', 'items-baseline',
    'justify-center', 'justify-between', 'justify-end', 'justify-start',
    // Spacing
    'p-1', 'p-2', 'p-3', 'p-4', 'p-6', 'p-8', 'px-1', 'px-2', 'px-3', 'px-4', 'px-6', 'px-8',
    'py-1', 'py-2', 'py-3', 'py-4', 'py-6', 'py-8', 'py-10', 'py-12',
    'm-1', 'm-2', 'm-4', 'mb-1', 'mb-2', 'mb-3', 'mb-4', 'mb-8', 'mb-16',
    'mt-1', 'mt-2', 'mt-3', 'mt-4', 'mt-8', 'ml-1', 'ml-2', 'mr-1', 'mr-2', 'mr-4',
    // Sizing
    'w-full', 'w-64', 'h-2', 'h-3', 'h-4', 'h-5', 'h-6', 'h-7', 'h-8', 'h-9', 'h-10', 'h-12', 'h-14', 'h-16',
    'max-w-2xl', 'max-w-3xl', 'max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-xl',
    'min-h-screen', 'min-h-[400px]',
    // Text
    'text-xs', 'text-sm', 'text-lg', 'text-xl', 'text-2xl', 'text-4xl', 'text-6xl',
    'font-medium', 'font-semibold', 'font-bold', 'font-extrabold',
    'text-left', 'text-center', 'text-right',
    'leading-none', 'leading-relaxed',
    'tracking-tight', 'tracking-wider',
    'truncate', 'line-clamp-2',
    // Backgrounds
    'bg-card', 'bg-muted', 'bg-accent',
    'bg-blue-500', 'bg-blue-600', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-300',
    // Borders
    'border', 'border-b', 'border-t',
    'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-full',
    // Effects
    'shadow-lg', 'shadow-md', 'shadow-xl',
    'opacity-60', 'opacity-70', 'opacity-100',
    'cursor-pointer', 'pointer-events-none',
    'transition-all', 'transition-colors', 'transition-opacity',
    // Specific
    'container', 'mx-auto', 'space-y-1', 'space-y-4', 'space-y-6',
    'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6',
    'shrink-0', 'relative', 'absolute', 'sticky', 'top-0',
    'overflow-auto', 'overflow-hidden', 'overflow-y-auto',
    'backdrop-blur-sm', 'backdrop-blur-xl',
    'whitespace-pre-wrap', 'break-all', 'select-all',
    'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5',
    'z-10', 'z-20',
    'bg-background', 'bg-card', 'bg-card/50',
    'hover:shadow-lg', 'hover:shadow-md', 'hover:bg-accent', 'hover:bg-accent/5', 'hover:bg-accent/20',
    'animate-ping', 'animate-spin', 'animate-in',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
