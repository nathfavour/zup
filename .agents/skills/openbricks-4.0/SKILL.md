---
name: openbricks-4.0
description: Core OpenBricks 4.0 design system rules for Zup. Pitch black components (#000000), deep ash shells (#161412), pure white text, crisp borders, and desktop right sidebars.
---

# OpenBricks 4.0 Design System (Zup)

## Surfaces & Chrome
- **Opaque Surfaces Only**: Never use transparent washes or gratuitous backdrop-blur gradients on product chrome.
- **Color Invariants**:
  - Container / Page Shell Background: `#161412` (deep ash)
  - Interactive Cards / Components / Input Wells: `#000000` (strictly pitch black)
  - Component Outlines: `border-white/20` (crisp, high-contrast separation)
  - Text: `#FFFFFF` pure white only (`text-white`). Differentiate hierarchy using font-size, font-weight (`font-black` vs `font-bold` vs `font-medium`), and tracking—never muted gray or low-opacity text.
- **Layout Invariants**:
  - **Desktop**: Left navigation sidebar (`w-64` or `w-72`), main fluid feed canvas, and right sidebar for details/drawers (`md:w-[420px]`).
  - **Mobile**: Floating bottom navigation bar and bottom sheets / 100dvh drawers.

## Seamless Sudo Mode
- Sensitive operations prompt immediately for biometric/passkey or password without multi-step manual selection hoops.
- Once authenticated, transient session remains active in memory for 5 minutes.
