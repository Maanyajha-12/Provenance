# Dashboard UI components

Reusable components live in `components/ui`, addressed through `@/components/ui`.
`components.json`, `lib/utils.ts`, and the TypeScript alias provide the shadcn
structure. Tailwind v4 runs through PostCSS; utilities are available alongside
existing dashboard CSS without changing its base element styles.

`interactive-blur-reveal.tsx` adapts the user-provided Hyperiux Vault component
(https://vault.hyperiux.com). The supplied base JPEG and noise texture are stored
in `public/textures`; no third-party image request is required at runtime.
Noise source: https://cdn.21st.dev/assets/mirror/b0/b0c9e5f9939fe7fbfdf3b90b45e76d210540b6110efb988a9b15eda5930525c7.png

The effect is scoped to its container, preserves image aspect ratio, pauses when
hidden or offscreen, and uses a static image when reduced motion is requested or
WebGL2 is unavailable. Framer Motion animates dashboard entrances and allocation
changes while respecting reduced motion. No additional provider is required
outside the dashboard's MotionConfig.

After installing workspace dependencies, run `corepack pnpm dev` from the repo
root. Styles are in `app/globals.css`.
