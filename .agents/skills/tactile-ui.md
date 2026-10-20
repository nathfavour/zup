# Skill: OpenBricks 4.0 Tactile Design System (`tactile-ui`)

This skill defines the UI styling, typography, component layout, and keyboard interaction standards for **zup**.

---

## 1. Color Palette & Inverted Surfaces
- **Dark Mode Only**: No light theme paths.
- **Outer Shell & Layout Backdrop**: Deep Ash `#161412`.
- **Cards, Input Wells, & Tiles**: Pitch Black `#000000`.
- **Borders & Outlines**: High-contrast solid 1px outlines (`border border-white/20`, hover `border-white/50`).
- **Semantic Active Highlights**:
  - Vault / Signer: Emerald `#10B981`
  - Feeds / Dispatches: Pink `#EC4899`
  - Relays / Pool: Amber `#F59E0B`
  - Sync / CLI: Indigo `#6366F1`

---

## 2. Typography Rules
- **Pure White Copy**: Copy and labels use `#FFFFFF` exclusively.
- **Hierarchy via Scale & Weight**: Establish hierarchy using font weight (800/900 bold vs 500/600 medium), monospace accents (`font-mono`), uppercase tracking (`tracking-wider`), and size — never washed-out low-contrast gray text.
- **No Unboxed Pill Badges**: All badges and tags must have explicit tactile border outlines.

---

## 3. Responsive Layout Architecture
- **Desktop**: Persistent Left Sidebar (`w-60` to `w-64`) with direct access to Feed, New Dispatch, Settings, and `@zup/cli Shell`, plus quick action dispatch button.
- **Mobile**: Tactile fixed **Bottom Navigation Bar** with key tabs and centralized highlighted `+` dispatch action button.
- **Drawers / Sidebars**: Cryptographic event inspector (`InspectRawSidebar`) and notifications open in dedicated right sidebar drawers keeping primary navigation accessible.

---

## 4. Keyboard Short-cuts & Ergonomics
- `Cmd+K` / `Ctrl+K`: Global Command Palette
- `1`: Switch to Feeds
- `2`: Switch to Vault & Identities / New
- `3`: Switch to Profile / Relays
- `4`: Switch to Settings
- `6`: Switch to `@zup/cli` Operator Terminal
- `L`: Lock Vault (Immediate RAM zeroing)
- `Esc`: Close active modal or drawer
