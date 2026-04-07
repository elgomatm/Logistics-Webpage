# TEN Document Studio

The Exotics Network — Official document management platform.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Deployment:** Vercel

## Getting Started

### 1. Install dependencies

```bash
cd ten-document-studio
npm install
```

### 2. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

### Option B — GitHub + Vercel Dashboard

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the repo
4. Vercel auto-detects Next.js — hit Deploy

## Project Structure

```
ten-document-studio/
├── app/
│   ├── layout.tsx        # Root layout, fonts, metadata
│   ├── globals.css       # Global styles, glass effects, animations
│   └── page.tsx          # Main page — assembles all sections
├── components/
│   ├── Navbar.tsx        # Fixed navigation bar
│   ├── Hero.tsx          # Hero section with ambient glow
│   ├── SectionCard.tsx   # Reusable section card (Reports/Guides/Emails)
│   ├── Previews.tsx      # Placeholder preview UIs per section
│   └── Footer.tsx        # Footer
└── tailwind.config.ts    # Design tokens, fonts, animations
```

## Customization

- **Accent colors** — Each section has its own `accentColor` prop in `app/page.tsx`
- **Section content** — Edit `title`, `description`, `tags` per section in `app/page.tsx`
- **Global colors** — See `tailwind.config.ts` and `app/globals.css`
- **Fonts** — Loaded via `next/font/google` in `app/layout.tsx` (Bebas Neue + Inter)
