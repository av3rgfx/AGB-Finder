# Utensilferramenta — Design System

## Color Strategy: Full Palette (industrial B2B, needs clarity and hierarchy)

### Primary
- **Brand Orange** (inspired by industrial/ferramenta sector): `#E86824` — CTAs, active states, highlights
- **Brand Orange Dark**: `#C4551A` — hover states
- **Brand Orange Light**: `#FEF0E6` — backgrounds, tags

### Neutrals (tinted warm toward brand hue)
- **N900** (text-primary): `#1A1714` — warm black, not pure #000
- **N700** (text-secondary): `#4A4540`
- **N500** (text-tertiary): `#7A756E`
- **N300** (borders): `#D4CFC8`
- **N200** (dividers): `#E8E4DE`
- **N100** (bg-secondary): `#F5F3EF`
- **N50** (bg-primary): `#FAF9F7`

### Semantic
- **Success**: `#2D7A3A` — positive stock, confirmation
- **Warning**: `#B38600` — low stock, attention
- **Error**: `#B32424` — out of stock, validation errors
- **Info**: `#2468A8` — links, informational tags

### Surface
- Background primary: `#FAF9F7` (warm off-white)
- Background secondary: `#F5F3EF` (slightly darker for sections/cards)
- Card surface: `#FFFFFF` with subtle border `#E8E4DE`
- Dashboard sidebar: `#1A1714` (dark, for contrast and navigation anchoring)

## Typography

### Font Family
- **Primary**: `Inter` (clean, legible at small sizes, excellent for data-heavy interfaces)
- **Mono**: `JetBrains Mono` or `IBM Plex Mono` (for product codes, part numbers)

### Scale (using 1.25 ratio)
- **Display**: 48px / 700 — page titles
- **H1**: 38px / 600 — section headers
- **H2**: 30px / 600 — card titles
- **H3**: 24px / 600 — subsections
- **H4**: 20px / 600 — labels, group headers
- **Body**: 16px / 400 — main text
- **Body Small**: 14px / 400 — secondary text, descriptions
- **Caption**: 12px / 500 — tags, metadata, table cells
- **Code**: 14px / 400 mono — product codes, part numbers

## Spacing
- **Base unit**: 4px
- **XS**: 4px, **SM**: 8px, **MD**: 16px, **LG**: 24px, **XL**: 32px, **2XL**: 48px, **3XL**: 64px
- Content max-width: 1440px (dashboard), 1200px (public site)
- Dashboard sidebar width: 260px

## Elevation
- **Level 0**: No shadow (flat elements)
- **Level 1**: `0 1px 3px rgba(26,23,20,0.06)` — cards, inputs
- **Level 2**: `0 4px 12px rgba(26,23,20,0.08)` — dropdowns, popovers
- **Level 3**: `0 8px 24px rgba(26,23,20,0.12)` — modals

## Border Radius
- **Small**: 6px — buttons, tags, inputs
- **Medium**: 8px — cards, panels
- **Large**: 12px — modals, large containers

## Components

### Button
- **Primary**: Brand Orange bg, white text, 6px radius, padding 10px 20px, font 14px/500
- **Secondary**: White bg, N300 border, N900 text
- **Ghost**: Transparent bg, Brand Orange text (for sidebar)
- **Danger**: Error bg, white text

### Input
- Border: 1px N300, radius 6px, padding 10px 14px
- Focus: Brand Orange border, subtle orange glow
- Label: 14px/500 N700, margin-bottom 6px

### Card
- White bg, 1px N200 border, 8px radius, Level 1 shadow
- Padding: 20px
- No nested cards (absolute ban)

### Table
- Header: N100 bg, 12px/600 uppercase text, N500 color
- Row: White bg, bottom border N200
- Hover: N50 bg
- Code column: mono font, slightly larger (14px)

### Badge/Tag
- Small pill: 6px radius, 4px 10px padding, 12px/500
- Variants: brand (orange light), success (green light), warning (yellow light), error (red light)

### Chat Message
- Agent: White bg, left-aligned, N200 left border 3px
- AI: Brand Orange Light bg, left-aligned, Brand Orange left border 3px
- User: N100 bg, right-aligned
- Product code blocks: mono font, copy button, subtle bg

## Layout Patterns

### Dashboard
- Fixed dark sidebar (260px) with navigation
- Top bar: search, notifications, user menu
- Content area: fluid, max 1440px
- Chat interface: split pane (chat left 60%, product preview right 40%)

### Public Site
- Clean header with logo, navigation, login button
- Hero: value proposition, not generic "welcome"
- Product grid with filtering sidebar
- Footer: contact info, links

## Motion
- **Transitions**: 150ms ease-out-quart for all interactive elements
- **Chat messages**: subtle fade-in + slide-up (100ms)
- **Loading**: skeleton screens, not spinners
- **No bounce, no elastic, no layout animations**

## Theme: Light
B2B industrial tool used in well-lit offices and on tablets in workshops. Light theme maximizes readability for dense data (product codes, specs, tables). Dark sidebar provides navigation anchoring without dark-mode eye strain.
