# Technical decisions

- Preserve the existing React/Vite/TypeScript/Tailwind configuration. Extend package scripts and add only dependencies needed by Phase 1.
- Use Zustand for the window manager and shared services. All window operations go through one API; applications never implement their own chrome.
- Use react-rnd for mature mouse/touch dragging and resizing. Keep resize handles outside the clipped rounded content. Animate opacity, because transform animation conflicts with react-rnd positioning.
- Keep icons and lazy component definitions in the same registry as dimensions and launch metadata. Lazy imports avoid a registry/application initialization cycle.
- Use localStorage only for small preferences, layouts and temporary scratchpad notes. Use a versioned key namespace and validate decoded data. Surface quota failures rather than promising successful persistence.
- Use original CSS wallpapers and Lucide icons; no remote media, paid assets or proprietary OS artwork.
- Use plain text Notes in Phase 1. Preserve IDs and content for migration to the future shared filesystem; Markdown rendering is optional and not included.
- Use a safe recursive descent calculator supporting precedence, parentheses and unary signs. Do not execute user input as JavaScript.
- Use custom in-app notifications. Do not request browser notification permissions or show fabricated device status.
- Add Vitest for service/state tests and Playwright for real browser integration tests. Tests use installed Chrome; no separate browser download is required here. Prettier keeps application code readable.
- Keep all future phases explicitly unimplemented until requested.
