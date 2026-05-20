# DESIGN.md — Arknights: Endfield Inspired UI

> Source: https://endfield.gryphline.com/ja-jp
> Extracted from official site HTML/CSS and asset references on 2026-05-19.
> This document adapts the official site's visual language for the local puzzle solver UI. It is not a pixel-perfect clone.

---

## 1. Visual Theme & Atmosphere

- **Design direction**: sci-fi industrial control panel, tactical game HUD, black/white surfaces with high-visibility yellow.
- **Mood keywords**: Endfield Industries, automation terminal, factory UI, segmented panels, scan lines, hazard stripe accents, large condensed English, functional Japanese UI.
- **Core feeling**:
  - UI should feel like an in-game operations console, not a corporate article page.
  - Prioritize dense but readable tool layout.
  - Use image preview and board editing as the visual center. Controls should support the workflow, not dominate it.
  - Avoid warm paper, serif typography, soft cards, and handcrafted atmosphere.

### Must-Have Signals

- Dark base with bright yellow active states.
- Thin industrial borders and square/near-square panels.
- Diagonal stripe textures or subtle repeating line patterns.
- Large English section labels can sit behind or beside Japanese labels.
- Step/status chips should look like operational states: `READY`, `SCAN`, `LOCK`, `VERIFY`, `SOLVE`.

---

## 2. Color Palette & Roles

Official CSS repeatedly uses these values:

### Brand / Accent

- **Endfield Yellow**: `#fffa00`
  - Primary action, active nav item, progress bar, selected state.
- **Yellow Deep**: `#eeea00`
  - Pressed/hover variant.
- **Amber UI**: `#ffcc1a`
  - Language dropdown active state and warm alert accent.

### Base

- **Near Black**: `#141414`
  - Page background and full-screen loading surface.
- **Panel Black**: `#191919`
  - Main dark panel, dark labels, media backplates.
- **Carbon**: `#282828`, `#383838`, `#424242`
  - Secondary panels, disabled controls, stripe fills.
- **White**: `#ffffff`
  - Text on dark surfaces and bright panel fills.
- **Light Panel**: `#f2f2f2`, `#fafafa`
  - Form fields, mobile menu items, bright data cards.
- **Divider Gray**: `#bfbfbf`, `#d9d9d9`, `#e6e6e6`
  - Hairlines, inactive separators, neutral cells.

### Supplemental Neon Strips

Use sparingly. Official decorative lines include:

- **Magenta**: `#ff00f0`
- **Mint**: `#00ffa2`
- **Electric Blue**: `#007aff`

For this solver, keep magenta/mint to tiny debug indicators or multi-color scan bars only.

### Semantic Mapping

- Success / completed: `#fffa00` when it means "active/locked"; `#00ffa2` only for tiny diagnostic lights.
- Warning: `#ffcc1a`
- Danger: `#ff1aac` or a muted red if text readability matters.
- Disabled: `#626262` text on `#282828`, or `#999` on light panels.

---

## 3. Typography

### Official Font Families Observed

The official CSS defines and uses:

- `SansRegular`, `SansMedium`, `SansBold`, `SansBlack`
- `Gilroy-Light`, `Gilroy-Medium`, `Gilroy-ExtraBold`
- `Novecentosanswide-Medium`, `Novecentosanswide-DemiBold`, `Novecentosanswide-Bold`
- `SpaceGrotesk`
- `Roboto-Regular`, `Roboto-Black`
- system fallback:
  `Segoe UI, Roboto, Helvetica Neue, Arial, PingFang SC, PingFang TC, Microsoft YaHei, Microsoft JhengHei, Hiragino Sans GB, Hiragino Kaku Gothic Pro, Yu Gothic UI, Meiryo, Apple SD Gothic Neo, Malgun Gothic, Leelawadee UI, Thonburi, Noto Sans, sans-serif`

### Local Implementation Fonts

Use this stack unless official font files are locally embedded:

```css
--font-ui: "Segoe UI", Roboto, "Helvetica Neue", Arial, "Yu Gothic UI", Meiryo, "Noto Sans JP", sans-serif;
--font-display: "Arial Narrow", "Roboto Condensed", "Segoe UI", sans-serif;
--font-mono: "Cascadia Mono", Consolas, monospace;
```

### Type Rules

- Japanese UI labels: bold gothic/sans, compact line-height.
- English display labels: uppercase, condensed, wide industrial rhythm.
- Large background display text: very large, tight line-height, slight negative tracking allowed only for decorative English.
- Body help text: `13px-14px`, line-height `1.55-1.7`, color `#bfbfbf` on dark.

### Suggested Scale

| Role | Size | Weight | Line Height | Use |
|---|---:|---:|---:|---|
| Page display | 56-96px | 800 | 0.95-1.0 | `PUZZLE SOLVER`, background label |
| Section English | 22-36px | 700 | 1.0 | `SCAN`, `VERIFY`, `SOLVE` |
| Japanese heading | 18-24px | 700 | 1.25 | panel titles |
| Control label | 12-13px | 600 | 1.2 | input labels, chips |
| Body/help | 13-14px | 400-500 | 1.6 | hints |
| Board numbers | 12-14px | 700 | 1 | row/column requirement chips |

---

## 4. Layout Principles

### Structure

- Use a dark full-page application shell.
- Main layout should feel like a control console:
  - Left: manual correction / status stack.
  - Center/top: screenshot reference and scan controls.
  - Center/right: board and solve console.
  - Bottom: piece verification.
- Keep STEP 5 and STEP 6 close enough that the user can compare image, pieces, and board without hunting.

### Density

- Endfield is dense and cinematic; the solver should be dense but not cluttered.
- Prefer compact controls and strong grouping over generous editorial spacing.
- Use `gap: 10px-18px` for tool clusters, `24px-32px` for major panels.

### Responsive Behavior

- Desktop: multi-column operations board.
- Tablet/mobile: single-column panels, but keep board horizontally scrollable instead of shrinking cells too aggressively.
- Preserve touch targets at `44px` minimum.
- Mobile menu/step list can become full-width light rows with active yellow state.

---

## 5. Component Styling

### Panels

```css
background: #191919;
border: 1px solid #424242;
border-radius: 4px;
box-shadow: none;
```

- Use dark panels for main tool areas.
- Use light panels (`#f2f2f2`) only as data plates, menus, or image/board backing surfaces.
- Add diagonal stripe texture to headers or side rails, not every card.

### Buttons

Primary button:

```css
background: #fffa00;
color: #191919;
border: 0;
border-radius: 5px;
font-weight: 700;
text-transform: uppercase;
```

Secondary button:

```css
background: #383838;
color: #ffffff;
border: 1px solid #626262;
border-radius: 5px;
```

Danger/reset:

```css
background: transparent;
color: #ffcc1a;
border: 1px solid #ffcc1a;
```

Interaction:

- Hover: brighten dark button to `#626262`.
- Active: darken to `#282828`.
- Selected/locked: yellow fill.

### Inputs / Selects

```css
background: #f2f2f2;
color: #191919;
border: 1px solid #666;
border-radius: 4px;
```

- Inputs should look like embedded terminal fields.
- Number inputs can be narrow, with explicit labels.
- Focus ring: `2px solid #fffa00`.

### Step Flow

- Use rectangular status tiles.
- Inactive: `#282828` / `#bfbfbf`
- Current/important: `#fffa00` / `#191919`
- Completed: dark panel with yellow border or small yellow rail.

Recommended labels:

- `01 LOAD`
- `02 GRID`
- `03 SCAN`
- `04 VERIFY`
- `05 PIECES`
- `06 SOLVE`

### Board / Puzzle Grid

- Board cells should remain clear and functional.
- Recommended:
  - Empty cell: `#f2f2f2`
  - Blocked cell: dark diagonal stripe
  - Fixed marker: high contrast icon or yellow ring
  - Active/edit mode: yellow outline
- Keep color pieces saturated enough to distinguish from Endfield yellow.

### Recognition / Diagnostics

- Make diagnostic states feel like machine telemetry:
  - `READY`, `SCANNING`, `FOUND`, `MANUAL`, `WARN`
- Use small mono/condensed labels.
- Put confidence or source labels in compact chips.

---

## 6. Textures & Motifs

Use these motifs from the official CSS:

### Diagonal Stripe

```css
background-image:
  linear-gradient(
    -45deg,
    transparent,
    transparent 16%,
    #424242 0,
    #424242 34%,
    transparent 0,
    transparent 66%,
    #424242 0,
    #424242 84%,
    transparent 0,
    transparent
  );
background-size: 8px 8px;
```

### Yellow Rail

- A left or top rail of `#fffa00` works better than large yellow backgrounds everywhere.
- Use yellow blocks behind section headers or current workflow state.

### Technical Lines

- Thin 1px dividers.
- Small corner markers.
- Overlaid labels like `[ GRID ]`, `[ STATUS ]`, `[ OPERATOR ]`.

### Avoid

- Warm cream backgrounds.
- Serif body text.
- Soft shadows and rounded SaaS cards.
- Pastel palettes.
- Decorative gradients as the main background.

---

## 7. Application-Specific Direction

This project is a puzzle solver, not a marketing homepage. Apply the Endfield style as an operational interface:

- The screenshot/reference area should be the main "monitor".
- Board correction should feel like a calibration panel.
- Piece confirmation should feel like a parts inventory / candidate bay.
- Solve results should feel like an output console.
- The `解く` button should be the strongest CTA.
- Do not hide practical controls behind cinematic decoration.

### Priority For Next Implementation Pass

1. Replace current Bake-style cream UI with dark industrial shell.
2. Restore high-contrast tool readability.
3. Convert STEP cards into Endfield-style status tiles.
4. Make primary actions yellow.
5. Add subtle stripe/rail motifs.
6. Keep board, screenshot, and piece editing ergonomic.

---

## 8. Quick Reference

```css
:root {
  --bg: #141414;
  --panel: #191919;
  --panel-2: #282828;
  --line: #424242;
  --text: #ffffff;
  --muted: #bfbfbf;
  --accent: #fffa00;
  --accent-2: #ffcc1a;
  --cell-light: #f2f2f2;
  --cell-dark: #282828;
  --font-ui: "Segoe UI", Roboto, "Helvetica Neue", Arial, "Yu Gothic UI", Meiryo, "Noto Sans JP", sans-serif;
  --font-display: "Arial Narrow", "Roboto Condensed", "Segoe UI", sans-serif;
  --font-mono: "Cascadia Mono", Consolas, monospace;
}
```

Design phrase:

> Dark tactical factory console. Yellow means active, locked, or executable. White/light panels are data plates. Borders, stripes, and dense labels create the Endfield feeling; decoration must never get in the way of solving.
