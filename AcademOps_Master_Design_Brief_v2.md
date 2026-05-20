# AcademOps — Master Styling Brief v2
### For Claude Design Session · Premium Visual Overhaul
### Stack: Next.js 16 · React 19 · Tailwind CSS v4 · Supabase · @dnd-kit/core · Mermaid.js

---

## PART 0 — THE INVIOLABLE LOGIC BOUNDARY

Before a single class changes, internalize this list. These are not preferences — they are structural contracts. Violating any of them breaks the application.

| What | Why it's protected |
|---|---|
| `HOUR_HEIGHT = 56` constant and all derived pixel math | Schedule block heights are mathematically derived from this; changing it de-syncs every block on the calendar |
| `z-0` / `z-10` layering of constraint overlays vs. slots | Constraint overlays must render beneath interactive drag targets |
| `pointer-events-none cursor-default` on constraint blocks | Constraints are non-interactive by design — they are ambient overlays, not clickable elements |
| Privacy title-stripping (cross-user blocks render `''`) | Household member privacy is enforced here — never add a label or tooltip to these blocks |
| `xl:grid-cols-[1fr_380px]` split layout | The 380px right column width is an intentional rigid spatial contract |
| Supabase Realtime channel subscriptions | These drive live state; restructuring the component tree around them breaks real-time sync |
| `handleToggleTask` optimistic snapshot/revert pattern | The rollback pattern protects data integrity on failed mutations |
| `lib/server/workspace.ts` ownership chain | Multi-tenant security boundary — `getUserWorkspaceId`, `taskBelongsToWorkspace`, etc. |
| `ChenERD.tsx` SVG coordinate system and entity positions | The hand-crafted SVG uses absolute coordinates; moving entities breaks the edge connections |
| All API route handlers | Data contracts — never touch |

You may only modify: Tailwind utility classes on JSX elements, CSS custom property values in `globals.css`, CSS `transition-*` / `transform` / `animation` utilities, and `mermaid.initialize()` theme config.

---

## PART 1 — THE DESIGN MANDATE

### What AcademOps Must Feel Like

AcademOps sits at the intersection of two identities. On the dashboard, it is a **fluid household operations console** — alive, immediate, and satisfying to use, like Linear or Vercel's dashboard. On the architecture page, it is an **academic-grade database visualization system** — authoritative, precise, and visually stunning enough to anchor a university Database Architecture submission.

The bar is not "clean and functional." The bar is breathtaking. Every surface should feel considered. Every transition should feel physical. Every state change should feel earned. This is a premium SaaS product that happens to live inside a household, and it should look like one.

### The Three Aesthetic Pillars

**1. Gravity and Depth.** Components should feel like they exist in three-dimensional space. Cards sit above backgrounds. Active elements lift above inactive ones. Overlays float above content. Achieve this with layered micro-shadows, subtle border opacity gradients, and glass-like surfaces on interactive elements. This is not about heavy drop shadows — it's about the lightest possible elevation that communicates architectural hierarchy.

**2. Kinetic Presence.** The UI must breathe. List items cascade onto the screen. Checkboxes resolve with physical weight. The progress ring charges. Hover states expand gently. Nothing snaps. Nothing flickers. Every motion uses sophisticated cubic-bezier easing that gives actions a sense of mass — they accelerate, they arrive, they settle. Use `cubic-bezier(0.4, 0, 0.2, 1)` as the global standard for state transitions (Material Motion's "standard curve" — fast departure, gentle arrival).

**3. Semantic Color Richness.** Strict semantic mapping (amber = constraints, red = missed, blue = pending, green = complete) does not mean flat. It means every semantic color is expressed as a full atmospheric system: a tint for the background, a richer tone for the border, full saturation for the icon, and a soft radial glow for the active/hover state. A missed task should feel alarming. A completed task should feel satisfying. The color system should make these emotions automatic.

---

## PART 2 — GLOBAL SURFACE LANGUAGE

### CSS Token Refinements (`app/globals.css`)

**Light mode surface stack (luminance steps):**
```css
/* Light mode — add these new variables */
--surface-0: oklch(1 0 0);        /* page background */
--surface-1: oklch(0.985 0 0);    /* default card */
--surface-2: oklch(0.970 0 0);    /* inset card / muted surface */
--surface-3: oklch(0.950 0 0);    /* sidebar, deeply inset */
```

**Dark mode surface stack:**
```css
/* Dark mode — replace existing values */
--background:  oklch(0.130 0 0);   /* page background — slightly darker than current */
--card:        oklch(0.158 0 0);   /* card surface — raised above background */
--sidebar:     oklch(0.172 0 0);   /* sidebar — distinctly lighter than background */
--muted:       oklch(0.200 0 0);   /* inset surface */
```

**Why these specific steps matter:** The current dark mode has `--background: oklch(0.145)` and `--card: oklch(0.205)` — a large jump that makes cards feel "floating". The revised stack creates a continuous depth progression that reads as proper surface elevation.

### Global Micro-Shadow System

Define three elevation levels as CSS variables and apply them semantically:

```css
/* Light mode shadows */
--shadow-sm:  0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03);
--shadow-md:  0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
--shadow-lg:  0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);

/* Dark mode shadows (lighter, since surfaces are already dark) */
.dark {
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.15);
  --shadow-md:  0 2px 8px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.20);
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.25);
}
```

Apply them:
- `--shadow-sm` → resting state of cards
- `--shadow-md` → hover state of interactive cards and goal cards
- `--shadow-lg` → active drag overlay on the schedule grid

Use `box-shadow: var(--shadow-sm)` in the `@layer base` on `.card-elevated` utility, then apply via `[style]` or a custom utility.

### Dot-Matrix Background Texture (Dark Mode + Architecture Page)

For the main dark-mode body background and the architecture page, overlay a subtle dot-matrix grid:

```css
.dark body, .architecture-console {
  background-image: radial-gradient(
    circle,
    oklch(0.25 0 0) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
  background-position: 0 0;
}
```

The dots should be near-invisible — `oklch(0.22 0 0)` against `oklch(0.130 0 0)` — a 9% luminance delta. The effect is felt as depth and texture rather than seen as a pattern.

### Typography Upgrades

Add to the global `body` style:
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'; /* Inter opticals */
  letter-spacing: -0.011em; /* Subtle tightening for premium feel */
}
```

`font-mono` targets: all `formatDuration()` outputs, all timestamp/time values, all row counts, all KPI numbers, all table-name labels on architecture page, hour-gutter labels on schedule grid.

---

## PART 3 — THE MOTION SYSTEM

### Standard Easing Curve

Define one canonical easing variable and use it everywhere:

```css
:root {
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   /* standard curve — snappy departure, organic arrival */
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);   /* elements entering the screen */
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);   /* elements leaving the screen */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* subtle overshoot for tactile interactions */
}
```

Apply as Tailwind custom utilities:
```css
.ease-standard   { transition-timing-function: var(--ease-standard); }
.ease-decelerate { transition-timing-function: var(--ease-decelerate); }
.ease-spring     { transition-timing-function: var(--ease-spring); }
```

### Staggered Entry Animation System

For list-based components (task rows, backlog groups, upcoming items, architecture entity cards), define a staggered cascade using CSS `animation-delay`:

```css
@keyframes slide-up-fade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stagger-item {
  animation: slide-up-fade 240ms var(--ease-decelerate) both;
}

.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 30ms; }
.stagger-item:nth-child(3) { animation-delay: 60ms; }
.stagger-item:nth-child(4) { animation-delay: 90ms; }
.stagger-item:nth-child(5) { animation-delay: 120ms; }
.stagger-item:nth-child(6) { animation-delay: 150ms; }
/* Continue to n:th-child(12) at 30ms increments */
```

Apply `stagger-item` to:
- Each task row `<button>` inside `GoalCard`
- Each `<BacklogGroup>` in the Open Backlog
- Each upcoming item `<div>` in "Next Scheduled Work"
- Each entity count card in `LiveArchitectureDashboard`

When the `activeGoalId` filter changes, the filtered-in task rows should re-mount with fresh `animation-delay` cascade, giving the impression that the new view has "loaded in."

### Master Animation Reference Table

| Element | Property | Duration | Easing | Notes |
|---|---|---|---|---|
| Chevron expand/collapse | `transform: rotate(90deg)` | 180ms | `--ease-spring` | Slight overshoot gives it physicality |
| Task icon crossfade | `opacity` | 120ms | `--ease-standard` | Fast — checkbox resolution must feel instant |
| Task background settle | `background-color` | 220ms | `--ease-standard` | Slightly slower — the surface "absorbs" the state |
| Task text line-through | `text-decoration-color, color` | 320ms | `--ease-decelerate` | Slowest — the strikethrough "writes" itself |
| Task hover lift | `box-shadow, transform` | 120ms | `--ease-standard` | `translateY(-1px)` on hover |
| GoalCard allDone cascade | `background-color, border-color` | 300ms | `--ease-standard` | The whole card settles on completion |
| Progress bar fill width | `width` | 500ms | `--ease-decelerate` | Smooth charge |
| Progress bar fill color | `background-color` | 500ms | `--ease-standard` | Shifts to full-primary at 100% |
| Execution Health alarm | `background-color, border-color, color` | 280ms | `--ease-standard` | All three fire simultaneously |
| Effort bar fill width | `width` | 500ms | `--ease-decelerate` | Smooth |
| Weekly ring stroke | `stroke-dasharray` | 700ms | `--ease-decelerate` | Charges on mount |
| Active goal ring | `box-shadow, ring-offset` | 200ms | `--ease-spring` | Spring for tactile ring pop |
| Clear filter button | `opacity, transform` | 200ms | `--ease-decelerate` | Fades + slides in from right |
| Stagger list items | `opacity, transform` | 240ms | `--ease-decelerate` | Cascade at 30ms increments |
| Drag overlay lift | `box-shadow, opacity` | 80ms | `--ease-accelerate` | Fast grab |
| Nav link state | `color, background-color` | 120ms | `--ease-standard` | |
| Architecture count pulse | `transform: scale(1.08→1)` | 200ms | `--ease-spring` | Fires on Realtime update |
| Architecture 3-layer glow | `box-shadow` | 400ms | `--ease-decelerate` | Glows pulse on page mount |

---

## PART 4 — SIDEBAR (`components/Sidebar.tsx`)

### Surface Treatment

The sidebar (`<aside className="w-60 ...">`) receives:
- Background resolves from `--sidebar` (revised to `oklch(0.172 0 0)` in dark, `oklch(0.950 0 0)` in light)
- A right-side micro-shadow: `box-shadow: 1px 0 0 var(--border), 2px 0 12px rgba(0,0,0,0.04)` — a hairline border with a barely-visible depth bloom
- `backdrop-blur-none` on the sidebar itself (blur reserved for overlays); the sidebar is a solid surface

### Brand Header

The "Goal-to-Grid" `<p className="font-bold text-lg">` should be:
- `font-bold text-base tracking-tight` — tighter, more premium
- Paired with a 4×4 rounded square icon or dot to the left: a small `<span className="inline-block h-3 w-3 rounded-sm bg-sidebar-primary mr-2">` — a tiny brand mark that signals "you are inside the product"

The household name below it: `text-xs text-muted-foreground/70 truncate font-medium tracking-wide uppercase` — monospace-adjacent treatment that reads as a workspace identifier.

### Navigation Items

All nav `<Link>` elements:
- Resting: `text-sidebar-foreground/70` — slightly subdued, not full opacity
- Hover: `bg-sidebar-accent/60 text-sidebar-foreground` with `transition-all duration-120 ease-standard`
- Active: `bg-sidebar-primary text-sidebar-primary-foreground shadow-sm` — active items sit slightly elevated
- Add `font-medium` to all nav labels — slightly heavier than regular weight

**Architecture nav item special treatment:** The `/admin/architecture` link gets a micro-badge:
```jsx
<span className="ml-auto text-[9px] font-mono uppercase tracking-widest 
  text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded-sm">DB</span>
```
This amber "DB" tag signals its role as the database architecture view — subtle, informative, and visually distinctive without breaking the nav layout.

### User Footer

The user footer area:
- `border-t border-sidebar-border/50` — hairline separator
- Display name: `text-sm font-semibold text-sidebar-foreground`
- Email: `text-xs text-muted-foreground/60 truncate`
- Admin badge: `font-mono text-[9px] tracking-widest uppercase bg-sidebar-primary/15 text-sidebar-primary px-1.5 py-0.5 rounded-sm border border-sidebar-primary/20`
- Sign-out: `text-muted-foreground/50 hover:text-destructive` with `transition-colors duration-150`

---

## PART 5 — DASHBOARD KPI STRIP (`components/LiveDashboard.tsx` — top 3 cards)

### Card Surface Treatment

Each of the three KPI cards receives:
- `shadow: var(--shadow-sm)` resting state, `shadow: var(--shadow-md)` on hover
- Slightly elevated border: `border-border/70` — not full opacity, slightly recessed
- `transition-shadow duration-200 ease-standard` on each card

### Weekly Completion Card

**RadialProgress ring:** Already has `transition-all duration-700`. Enhance:
- The track ring (`text-muted/30`): change to `text-muted/20 dark:text-muted/15` — even more recessed in dark mode to make the progress arc pop
- Progress arc (`text-primary`): in dark mode, shift to a vivid accent — the dark mode primary is near-white; the arc should read as `text-blue-400 dark:opacity-90` for visual vibrancy, while still resolving via `text-primary` in light mode
- On mount, the arc should animate from 0 to its final value — a "charging" effect using `animation: stroke-fill 700ms var(--ease-decelerate) forwards`

**The `—` sentinel** (`completionRate === null`): Render in `text-muted-foreground/60 font-mono text-2xl` — distinctly dimmer than a real percentage, communicating absence of data rather than a zero result.

**Completion fraction** (`weekDone/weekTotal`): Restyle to `font-mono text-2xl font-bold tabular-nums`. The `tabular-nums` OpenType feature ensures digits don't cause layout shifts under Realtime updates.

### Open Backlog Card

The count value: `font-mono text-4xl font-black tabular-nums leading-none` — maximum weight, maximum presence. This number is the most operationally important KPI on the dashboard.

Beneath it: `text-xs text-muted-foreground/70 font-medium uppercase tracking-widest` — "TASKS REMAINING" as a compact status label.

### Planned Effort Card

The `formatDuration()` output: `font-mono text-3xl font-bold tabular-nums` — should feel like reading a system metric. Add a secondary line `text-xs text-muted-foreground/60 font-mono uppercase tracking-widest` — "OPEN EFFORT".

---

## PART 6 — ACTIVE GOAL SELECTOR (`components/LiveDashboard.tsx`)

The filter row currently feels like a utility form field. It should feel like a premium filter lens — an interactive control with visual presence.

**Container treatment:**
```jsx
className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 
  backdrop-blur-sm px-4 py-2.5 shadow-sm 
  transition-all duration-200 ease-standard
  focus-within:border-primary/40 focus-within:shadow-md focus-within:ring-1 
  focus-within:ring-primary/20"
```

The `backdrop-blur-sm` gives the row a glassy quality — it reads as a floating filter control rather than a grounded form.

**When a goal is active:** The container gains a low-intensity semantic glow:
```jsx
className="... ring-1 ring-primary/20 border-primary/30 shadow-[0_0_12px_rgba(var(--primary),0.08)]"
```

**Select element styling:**
- `bg-transparent border-none outline-none text-sm font-medium cursor-pointer`
- The native select should be visually invisible — just the text and the OS-rendered dropdown arrow
- On focus: container ring handles the focus indicator

**Clear button** — the "Clear" button appears when `activeGoalId` is set. Instead of a plain ghost button, render it as a small pill:
```jsx
className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full 
  bg-muted/60 text-muted-foreground 
  hover:bg-destructive/10 hover:text-destructive 
  transition-all duration-200 ease-standard
  opacity-0 translate-x-2
  [data-visible=true]:opacity-100 [data-visible=true]:translate-x-0"
```
This makes the Clear button slide and fade in from the right as the filter activates — a directional entry that feels like a contextual response.

---

## PART 7 — DOMAIN BOARD (`components/DomainBoard.tsx`)

### Tier 1 — Sector Container

The outermost sector card (`rounded-lg border bg-background p-3`) becomes a premium domain surface:

```jsx
className="rounded-xl border border-border/60 bg-card p-3 
  shadow-sm hover:shadow-md 
  transition-shadow duration-200 ease-standard
  relative overflow-hidden"
```

Add a top-edge accent stripe — a 2px gradient line at the very top of the card:
```css
.sector-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, 
    oklch(0.556 0 0 / 0.4) 0%, 
    transparent 100%
  );
}
```
This left-to-right fade-out stripe gives each domain a subtle architectural cap without adding color.

Sector name: `text-sm font-semibold tracking-tight` with a small sector count chip: `text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 bg-muted/60 px-2 py-0.5 rounded-sm`.

### Tier 2 — GoalCard (milestone container)

GoalCard receives the most sophisticated treatment on the dashboard:

**Base surface:**
```jsx
className="rounded-lg border border-border/50 bg-muted/10 
  shadow-sm
  transition-all duration-220 ease-standard"
```

**Hover state** (on the card itself, not just the button):
```jsx
className="hover:bg-muted/20 hover:border-border/80 hover:shadow-md 
  hover:-translate-y-0.5"
```
The `translate-y(-2px)` hover lift is subtle but physically meaningful — the card rises to meet the user's attention.

**allDone completed state:**
```jsx
className="border-primary/20 bg-primary/[0.04] 
  shadow-[0_0_0_1px_oklch(var(--primary)/0.15),var(--shadow-sm)]"
```
The ring shadow creates an ambient glow that communicates completion atmospherically.

**Active goal selected state** (`ring-2 ring-primary ring-offset-1`): Upgrade to:
```jsx
className="ring-1 ring-primary/60 ring-offset-2 ring-offset-background 
  shadow-[0_0_16px_oklch(var(--primary)/0.12)]
  transition-all duration-200 ease-spring"
```
The spring easing makes the ring "pop" onto the card when selected.

**Chevron animation:**
Replace the conditional `<ChevronDown>` / `<ChevronRight>` render with a single icon using:
```jsx
<ChevronRight className={cn(
  "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60",
  "transition-transform duration-180 ease-spring",
  expanded && "rotate-90 text-foreground/80"
)} />
```
The spring easing and the color shift from `text-muted-foreground/60` to `text-foreground/80` make the expand feel alive — the chevron brightens as it opens.

**Goal name on completion:**
```jsx
className={cn(
  "text-sm font-medium leading-snug",
  "transition-all duration-300 ease-standard",
  allDone && "text-muted-foreground/50 line-through decoration-muted-foreground/30"
)}
```
`decoration-muted-foreground/30` makes the strikethrough line itself appear faded, adding texture to the completion state rather than a hard slash.

**Progress bar — full premium treatment:**
```jsx
/* Track */
className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40"

/* Fill */
className={cn(
  "h-full rounded-full",
  "transition-all duration-500 ease-decelerate",
  progress === 100 
    ? "bg-primary shadow-[0_0_6px_oklch(var(--primary)/0.5)]"
    : "bg-primary/50"
)}
```
At 100%, the fill bar emits a soft primary glow — a micro-highlight that makes "all done" feel like an achievement.

### Tier 3 — Task Row (the most interactive element)

Task rows are the most frequently touched UI element in the entire application. They must feel extraordinarily responsive and satisfying.

**Base task row:**
```jsx
className={cn(
  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5",
  "text-left text-xs transition-all duration-220 ease-standard",
  "stagger-item", // cascade animation class
  task.is_completed
    ? "border-border/30 bg-muted/20 text-muted-foreground/60"
    : "border-border/50 bg-card hover:bg-muted/30 hover:border-border/80 hover:shadow-sm hover:-translate-y-px"
)}
```

**The tactile checkbox morphing sequence:**

The checkbox element should be a 16×16 `<span>` container (not the raw icon) that manages the transition:

```jsx
<span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
  {/* Empty circle — pending */}
  <Circle className={cn(
    "absolute h-4 w-4 text-muted-foreground/40",
    "transition-all duration-120 ease-standard",
    task.is_completed 
      ? "opacity-0 scale-75"  
      : "opacity-100 scale-100"
  )} />
  {/* Check icon — done */}
  <CheckCircle2 className={cn(
    "absolute h-4 w-4 text-primary",
    "transition-all duration-120 ease-spring",
    task.is_completed 
      ? "opacity-100 scale-100"
      : "opacity-0 scale-75"
  )} />
</span>
```

The `scale(0.75) → scale(1)` with spring easing on the CheckCircle2 makes the checkmark feel like it "pops" into existence with physical weight. The Circle simultaneously shrinks out. The net effect is a smooth morphing crossfade with a satisfying micro-pop.

**Task name:**
```jsx
className={cn(
  "flex-1 truncate font-medium",
  "transition-all duration-320 ease-decelerate",
  task.is_completed && "line-through text-muted-foreground/50 decoration-muted-foreground/25"
)}
```

**Duration chip** (right side):
```jsx
className="flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 
  font-mono text-[10px] text-muted-foreground/60
  bg-muted/40 border border-border/30"
```
A subtle chip container makes the duration feel like a data badge rather than raw text.

---

## PART 8 — OPEN BACKLOG (left column, bottom)

### Group Header Treatment

Each backlog goal group (`rounded-md border p-3`) becomes a premium card:

```jsx
className={cn(
  "rounded-xl border p-3 transition-all duration-200 ease-standard stagger-item",
  "hover:shadow-md",
  // Priority-semantic left border
  group.priority === 1 && "border-l-[3px] border-l-destructive/70 border-t-border/50 border-r-border/50 border-b-border/50",
  group.priority === 2 && "border-l-[3px] border-l-primary/50 border-t-border/50 border-r-border/50 border-b-border/50",
  group.priority === 3 && "border-l-[3px] border-l-muted-foreground/30 border-t-border/50 border-r-border/50 border-b-border/50",
)}
```

The three-sided border approach (full border with one side overridden) is the cleanest way to achieve the priority accent stripe without layout disruption.

### Goal Name Header:
- `font-semibold text-sm tracking-tight` for goal name
- Due date: `text-xs text-muted-foreground/60 font-mono` — monospace gives it a deadline timestamp feel

### Task Rows Inside Groups:
```jsx
className="flex items-center gap-2 rounded-lg border border-border/30 
  bg-muted/15 px-2.5 py-2 text-xs
  hover:bg-muted/30 hover:border-border/60 hover:shadow-sm hover:-translate-y-px
  transition-all duration-150 ease-standard"
```

### Empty "All caught up" State:
```jsx
className="rounded-xl border border-dashed border-primary/30 
  bg-gradient-to-br from-primary/[0.04] to-primary/[0.02]
  p-8 text-center"
```
A gradient wash on the empty state makes it feel like a positive, designed surface — not a placeholder gap.

---

## PART 9 — RIGHT CONTEXT COLUMN

### Execution Health Card — The Alarm System

This card is the most emotionally charged element on the dashboard. When missed items exist, it must feel genuinely alarming.

**Calm state (no missed items):**
```jsx
className="border-border/60 bg-card shadow-sm"
```

**Alarm state (missedCount > 0):**
```jsx
className="border-destructive/50 bg-destructive/[0.04] shadow-sm
  shadow-[0_0_20px_oklch(var(--destructive)/0.12)]
  transition-all duration-300 ease-standard"
```
The ambient destructive glow (a diffuse `box-shadow` using the destructive color) creates an alarm atmosphere that extends beyond the card border — the card bleeds urgency into the surrounding space.

`AlertCircle` icon in alarm state:
```jsx
className="h-5 w-5 text-destructive animate-[pulse_2s_ease-in-out_infinite]"
```
A slow 2-second pulse on the icon communicates an active, unresolved alert state.

Missed count: `font-mono text-2xl font-black text-destructive tabular-nums`

### Next Scheduled Work — Upcoming Items

Each upcoming item:
```jsx
className="rounded-xl border border-border/50 bg-card p-3 
  hover:border-border/80 hover:shadow-sm hover:-translate-y-px
  transition-all duration-150 ease-standard stagger-item"
```

Day/time label: `font-mono text-xs text-muted-foreground/70`

Task name: `text-sm font-semibold tracking-tight`

The priority badge should have a soft semantic glow on hover:
- High (destructive): `hover:shadow-[0_0_8px_oklch(var(--destructive)/0.3)]`
- Medium (default): `hover:shadow-[0_0_8px_oklch(var(--primary)/0.25)]`

### Effort by Domain Bars

**Bar track:** `h-2 rounded-full bg-muted/40` — lighter track than current

**Filled bar (top domain = 100% width):**
```jsx
className="h-full rounded-full bg-primary
  shadow-[0_0_8px_oklch(var(--primary)/0.4)]
  transition-all duration-500 ease-decelerate"
```
The top domain's bar glows — a radiant bar that anchors the chart visually.

**Remaining bars (< 100%):** `bg-primary/50 transition-all duration-500 ease-decelerate` — no glow, clearly subordinate.

Domain name: `text-sm font-medium tracking-tight truncate`
Duration chip: `font-mono text-[10px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded-sm border border-border/20 shrink-0`

---

## PART 10 — SCHEDULE CALENDAR GRID (`app/(app)/schedule/page.tsx`)

The schedule is the most visually complex page. `HOUR_HEIGHT = 56` is sacred — every pixel calculation derives from it. Touch nothing about how block heights or positions are computed.

### Status-Semantic Block System (Dark Mode Upgraded)

The `STATUS_COLORS` map must work across both modes:

```js
const STATUS_COLORS = {
  Pending: `
    bg-blue-50/90 border-l-[3px] border-blue-400/80 text-blue-900
    dark:bg-blue-950/40 dark:border-blue-500/70 dark:text-blue-200
    shadow-sm hover:shadow-md hover:border-blue-400
    transition-all duration-150 ease-standard
  `,
  Done: `
    bg-emerald-50/80 border-l-[3px] border-emerald-400/80 text-emerald-900
    dark:bg-emerald-950/40 dark:border-emerald-500/70 dark:text-emerald-200
    shadow-sm
  `,
  Missed: `
    bg-red-50/90 border-l-[3px] border-red-400/80 text-red-900
    dark:bg-red-950/50 dark:border-red-500/80 dark:text-red-200
    shadow-sm shadow-red-500/5
    dark:shadow-[0_0_10px_rgba(239,68,68,0.08)]
  `,
}
```

All schedule blocks use `rounded-md` (not `rounded-lg`) — on a precise grid, softer corners feel wrong.

### Constraint Overlay Blocks (PRESERVED — ambient only)

Constraints remain at `z-0` with `pointer-events-none cursor-default`. Visual treatment:

```jsx
className="z-0 pointer-events-none cursor-default
  bg-amber-500/8 border-l-2 border-l-amber-400/40
  dark:bg-amber-500/6 dark:border-l-amber-500/30"
```

If a label is rendered at all, it must be: `text-[10px] font-medium text-amber-600/50 dark:text-amber-400/40 uppercase tracking-widest` — barely legible, clearly non-interactive.

### Privacy-Preserving Cross-User Blocks (PRESERVED — no labels)

Cross-user blocks (title stripped to `''`) receive a premium striped treatment:

```jsx
style={{
  backgroundImage: `repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 4px,
    oklch(0.50 0 0 / 0.07) 4px,
    oklch(0.50 0 0 / 0.07) 8px
  )`,
  borderLeft: '2px solid oklch(0.50 0 0 / 0.15)',
}}
className="rounded-md pointer-events-none cursor-not-allowed"
```

Zero labels. Zero tooltips. The hatched pattern communicates "occupied" without revealing whose.

### Drag Overlay (DragOverlay component)

```jsx
className="opacity-75 shadow-xl ring-1 ring-primary/40 
  shadow-primary/10 cursor-grabbing
  scale-[1.02] transition-all duration-80 ease-accelerate"
```

The subtle scale-up on drag lift creates the physical impression of picking something up.

### Time-Gutter Hour Labels

`font-mono text-[10px] text-muted-foreground/40 select-none` — they should be barely there, measuring the grid without competing with the content.

---

## PART 11 — CONSTRAINTS PAGE (`app/(app)/constraints/page.tsx`)

The constraints management page is a utility view. It should feel precise and system-oriented.

**Constraint table rows:** `hover:bg-muted/30 transition-colors duration-100 ease-standard`

**Time window column (`font-mono`):** Already styled — ensure `tabular-nums` and `text-muted-foreground` with a subtle `bg-muted/20 px-2 py-0.5 rounded-sm` chip container for the time range.

**Day selector pill buttons (in the Add/Edit dialog):**
- Inactive: `bg-muted/40 text-muted-foreground/70 border-border/50 hover:bg-muted/60`
- Active: `bg-primary text-primary-foreground border-primary/80 shadow-sm shadow-primary/20`
- Transition: `transition-all duration-120 ease-spring` — the spring gives day selection a satisfying click feel.

---

## PART 12 — THE ARCHITECTURE PAGE
### `/architecture` — Academic Masterpiece & System Console

This is the centerpiece. The brief for this page operates at a different magnitude than everything else. It must feel like a PhD student's dream dashboard — rigorous, beautiful, and unmistakably authoritative.

### Console Environment Wrapper

The entire page content is wrapped in a forced dark console context that is independent of system preference:

```jsx
// In ArchitecturePage — wrap all content:
<div className="dark min-h-full architecture-console">
  {/* all existing page content */}
</div>
```

```css
.architecture-console {
  background-color: oklch(0.09 0 0);       /* Deep carbon — darker than standard dark mode */
  background-image: 
    radial-gradient(circle, oklch(0.18 0 0) 1px, transparent 1px),
    linear-gradient(oklch(0.09 0 0) 50%, transparent 100%);
  background-size: 24px 24px, 100% 100%;
  color: oklch(0.92 0 0);
}
```

The dot-matrix grid on a carbon background is the signature surface of the architecture console. It reads as a precision engineering environment — a PCB schematic, a circuit layout, a database topology map.

### Page Header

```jsx
<div className="border-b border-zinc-800/80 pb-6 mb-8">
  <div className="flex items-center gap-3 mb-3">
    {/* Small terminal prompt indicator */}
    <span className="font-mono text-xs text-emerald-400/70 select-none">~/architecture $</span>
    <span className="font-mono text-xs text-zinc-600 animate-[blink_1s_step-end_infinite]">_</span>
  </div>
  <h1 className="font-mono text-3xl font-bold tracking-tight text-white">
    Architecture View
  </h1>
  <p className="mt-2 max-w-3xl text-sm text-zinc-400 font-light leading-relaxed">
    Live documentation for the current ERD and product model...
  </p>
</div>
```

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

The terminal prompt prefix and blinking cursor establish the console identity in one line. It's an academic database terminal, alive and running.

### 3-Layer Isolation Security Flow (ADD THIS SECTION — it does not yet exist)

Insert this as a new `<Card>` after the page header, before the Concept Flow card. It visualizes the actual 3-layer security pattern in `lib/server/workspace.ts` and the Supabase clients.

**Container:**
```jsx
<div className="rounded-xl border border-zinc-700/60 bg-zinc-900/80 
  p-6 mb-6
  shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
  backdrop-blur-sm">
```

**Section heading:**
```jsx
<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-5">
  ISOLATION ARCHITECTURE · 3-LAYER SECURITY PATTERN
</p>
```

**Three-node flow layout (flex row, centered, with connectors):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [ ◉ AuthN ]  ──────────→  [ ◈ AuthZ ]  ──────────→  [ ◆ DB Scope ]   │
│   Cookie                    Ownership                  household_id      │
│   Session                   Verification               Partition         │
│   Supabase Auth             workspace.ts               FK boundary       │
└─────────────────────────────────────────────────────────────────────────┘
```

Node styling:

**AuthN Node (emerald — identity verified):**
```jsx
<div className="rounded-lg border-2 border-emerald-500/50 bg-emerald-500/[0.07] px-5 py-4
  shadow-[0_0_20px_oklch(0.73_0.20_142/0.15)]
  transition-all duration-400 ease-decelerate
  [&:hover]:shadow-[0_0_30px_oklch(0.73_0.20_142/0.25)]">
  <p className="font-mono text-xs font-bold text-emerald-400 tracking-widest uppercase">AuthN</p>
  <p className="font-mono text-[10px] text-zinc-500 mt-1">Cookie Session</p>
  <p className="font-mono text-[10px] text-zinc-600 mt-0.5">Supabase Auth</p>
</div>
```

**AuthZ Node (amber — access control checkpoint):**
```jsx
<div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/[0.07] px-5 py-4
  shadow-[0_0_20px_oklch(0.77_0.18_84/0.15)]
  transition-all duration-400 ease-decelerate
  [&:hover]:shadow-[0_0_30px_oklch(0.77_0.18_84/0.25)]">
  <p className="font-mono text-xs font-bold text-amber-400 tracking-widest uppercase">AuthZ</p>
  <p className="font-mono text-[10px] text-zinc-500 mt-1">Ownership Check</p>
  <p className="font-mono text-[10px] text-zinc-600 mt-0.5">workspace.ts</p>
</div>
```

**DB Scope Node (blue — data boundary):**
```jsx
<div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/[0.07] px-5 py-4
  shadow-[0_0_20px_oklch(0.55_0.24_264/0.15)]
  transition-all duration-400 ease-decelerate
  [&:hover]:shadow-[0_0_30px_oklch(0.55_0.24_264/0.25)]">
  <p className="font-mono text-xs font-bold text-blue-400 tracking-widest uppercase">DB Scope</p>
  <p className="font-mono text-[10px] text-zinc-500 mt-1">household_id FK</p>
  <p className="font-mono text-[10px] text-zinc-600 mt-0.5">Row Partition</p>
</div>
```

**Arrow connectors between nodes:**
```jsx
<div className="flex items-center text-zinc-600 px-3">
  <div className="h-px w-8 bg-gradient-to-r from-zinc-700 to-zinc-600" />
  <svg width="8" height="8" viewBox="0 0 8 8" className="text-zinc-600">
    <path d="M0 4 L6 1 L6 7 Z" fill="currentColor" />
  </svg>
</div>
```

On page mount, the three glow shadows should animate in sequentially with a 200ms stagger — AuthN glows first, AuthZ second, DB Scope third — giving the flow a "system booting" feeling.

### Mermaid Diagrams (`components/MermaidDiagram.tsx`)

**Initialize with dark theme:**
```js
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#0d0d0d',
    primaryColor: '#1d4ed8',
    primaryTextColor: '#f4f4f5',
    primaryBorderColor: '#3f3f46',
    lineColor: '#52525b',
    secondaryColor: '#18181b',
    tertiaryColor: '#27272a',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '13px',
  }
})
```

**Diagram container:**
```jsx
className="overflow-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-6
  shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
```

The `inset` top highlight shadow gives the diagram container the look of a recessed panel — a technical schematic embedded in the console surface.

### ChenERD SVG (`components/ChenERD.tsx`)

The hand-crafted SVG at viewBox `0 0 1480 960` is the visual centerpiece of the page and the most academically significant visual element in the application. Treat it as a premium interactive schematic.

**SVG container:**
```jsx
className="w-full h-auto rounded-xl border border-zinc-700/60 
  bg-zinc-950
  shadow-[0_0_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]
  hover:shadow-[0_0_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]
  transition-shadow duration-400 ease-standard"
style={{ minHeight: 500 }}
```

The outer box-shadow on the SVG container creates an atmospheric depth bloom — the entire ERD diagram appears to float slightly off the console surface.

**Color constant updates in `ChenERD.tsx` (styling only — coordinates untouched):**
```js
const C = {
  entity:  '#3B82F6',   // blue-500 — slightly brighter for dark console
  rel:     '#F97316',   // orange-500 — unchanged, strong contrast
  attr:    '#10B981',   // emerald-500 — slightly richer green
  attrPK:  '#059669',   // emerald-600 — deeper green for PKs
  line:    '#52525B',   // zinc-600 — lighter for dark bg
  text:    '#F4F4F5',   // zinc-100 — clean white text on nodes
  card:    '#18181B',   // zinc-900 — legend background
}
```

**Entity rectangle styling (`Ent` component):** Add a subtle inner highlight stroke at the top of each rectangle by adding a second `<rect>` with `fill="rgba(255,255,255,0.06)" height="4"` — a micro-highlight that makes each entity node feel lit from above, like a physical component.

**Legend update:** The top-left legend `<rect>` background: `fill={C.card}` (already handled by the constant update). The legend border `<rect>`: `stroke="#3F3F46" fill="none"` (zinc-700).

**Viewing hint overlay:** At the bottom of the SVG, add a subtle label:
```jsx
<text x="740" y="948" textAnchor="middle" fontSize="9" fill="rgba(161,161,170,0.4)"
  fontFamily="ui-monospace, monospace" letterSpacing="0.15em">
  CHEN NOTATION ERD · ACADEM OPS · SUPABASE POSTGRES
</text>
```

### Live Entity Count Cards (in `LiveArchitectureDashboard.tsx`)

The 5 hierarchy metric cards become precision database metric panels:

```jsx
// Card surface
className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 
  shadow-[inset_0_1px_0_rgba(255,255,255,0.04),var(--shadow-sm)]
  hover:border-zinc-600/80 hover:bg-zinc-900/90
  transition-all duration-200 ease-standard
  stagger-item"
```

**Entity label (`CardTitle`):**
```jsx
className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500"
```

**Count value:**
```jsx
className="font-mono text-3xl font-black text-zinc-100 tabular-nums leading-none"
```

**Realtime pulse animation:** When a count updates via the Supabase Realtime subscription, the count `<p>` should flash with a brief CSS animation. Add a `key={count}` prop to the count element — React will remount it on value change. Then apply:
```css
@keyframes count-update {
  0%   { transform: scale(1);    color: oklch(0.92 0 0); }
  30%  { transform: scale(1.10); color: oklch(0.73 0.20 142); } /* emerald flash */
  100% { transform: scale(1);    color: oklch(0.92 0 0); }
}
.count-pulse { animation: count-update 300ms var(--ease-spring) forwards; }
```
Apply `key={value}` + `className="count-pulse"` to each count element. Every Realtime update causes React to remount → animation fires automatically.

**Note text beneath count:**
```jsx
className="mt-1.5 text-[10px] text-zinc-600 font-light font-mono"
```

### Operational Notes (3 cards)

```jsx
className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-4
  hover:border-zinc-600/60 hover:bg-zinc-900/70
  transition-all duration-200 ease-standard
  shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
```

Heading: `font-mono text-sm font-semibold text-zinc-200`
Body: `text-xs text-zinc-500 leading-relaxed mt-2 font-light`

### Entity Breakdown Cards (7 entities)

```jsx
className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 p-4
  hover:border-zinc-600/60 hover:bg-zinc-900/60 hover:shadow-sm
  transition-all duration-200 ease-standard stagger-item"
```

Entity name: `font-mono text-sm font-bold text-zinc-200 tracking-wide`

A semantic left accent: each entity card gets a 2px left border color mapped to its data layer:
- HOUSEHOLDS, PROFILES: `border-l-[2px] border-l-zinc-500/50` (neutral — root layer)
- SECTORS, GOALS, TASKS, SCHEDULE_ITEMS: `border-l-[2px] border-l-blue-500/40` (operational data)
- USER_CONSTRAINTS, USER_BEHAVIOR_EVENTS, CALENDAR_CONNECTIONS: `border-l-[2px] border-l-amber-500/40` (user-behavioral layer)

### Normalization Table

Full console data-table treatment:

```jsx
// Table container
className="overflow-hidden rounded-xl border border-zinc-700/60"

// Header row
className="border-b border-zinc-800/80 bg-zinc-900/80"

// TH cells
className="py-3 px-4 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500 text-left"

// Data rows
className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors duration-100"

// TD: table name
className="py-2.5 px-4 font-mono text-sm text-zinc-200 font-medium"

// TD: normal form
className="py-2.5 px-4 font-mono text-sm text-blue-400 font-medium"

// TD: reason
className="py-2.5 px-4 text-xs text-zinc-500 font-light leading-relaxed"
```

---

## PART 13 — SEMANTIC COLOR RICHNESS GUIDE

**Core principle:** Strict semantic mapping does NOT mean flat. Every semantic state is expressed as a layered atmospheric system. The grid below defines how each state should manifest across its UI surface, border, text, icon, and ambient glow.

| State | Background | Border | Text | Icon | Ambient Glow |
|---|---|---|---|---|---|
| **Pending** (schedule) | `bg-blue-50/90` dark:`bg-blue-950/40` | `border-l-blue-400/80` | `text-blue-900` dark:`text-blue-200` | `text-blue-500` | `shadow-[0_0_8px_rgba(59,130,246,0.08)]` |
| **Done** (schedule) | `bg-emerald-50/80` dark:`bg-emerald-950/40` | `border-l-emerald-400/80` | `text-emerald-900` dark:`text-emerald-200` | `text-emerald-500` | none |
| **Missed** (schedule) | `bg-red-50/90` dark:`bg-red-950/50` | `border-l-red-400/80` | `text-red-900` dark:`text-red-200` | `text-red-500` | `shadow-[0_0_10px_rgba(239,68,68,0.08)]` |
| **Constraint** (overlay) | `bg-amber-500/8` | `border-l-amber-400/40` | `text-amber-600/50` | — | none (overlay must not draw attention) |
| **High Priority** (badge) | `bg-destructive/10` | `border-destructive/30` | `text-destructive` | — | `hover:shadow-[0_0_8px_oklch(var(--destructive)/0.2)]` |
| **Completed goal** | `bg-primary/[0.04]` | `border-primary/20` | `text-muted-foreground/50` | `text-primary` | `shadow-[0_0_16px_oklch(var(--primary)/0.08)]` |
| **Alarm (health card)** | `bg-destructive/[0.04]` | `border-destructive/50` | `text-foreground` | `text-destructive animate-pulse` | `shadow-[0_0_20px_oklch(var(--destructive)/0.12)]` |
| **AuthN layer** | `bg-emerald-500/7` | `border-emerald-500/50` | `text-emerald-400` | — | `shadow-[0_0_20px_oklch(0.73_0.20_142/0.15)]` |
| **AuthZ layer** | `bg-amber-500/7` | `border-amber-500/50` | `text-amber-400` | — | `shadow-[0_0_20px_oklch(0.77_0.18_84/0.15)]` |
| **DB Scope layer** | `bg-blue-500/7` | `border-blue-500/50` | `text-blue-400` | — | `shadow-[0_0_20px_oklch(0.55_0.24_264/0.15)]` |

---

## PART 14 — GLASSMORPHISM USAGE GUIDE

Glassmorphism (`backdrop-blur` + translucent backgrounds) is permitted on these surfaces only:

| Surface | Treatment |
|---|---|
| Active Goal Selector (when filter is active) | `bg-card/80 backdrop-blur-sm` |
| DragOverlay on schedule grid | `backdrop-blur-[2px]` |
| Architecture 3-Layer flow container | `bg-zinc-900/80 backdrop-blur-sm` |
| Modal/Dialog overlays | `bg-background/80 backdrop-blur-md` |

Do NOT apply glassmorphism to:
- Sidebar (solid surface)
- KPI cards (solid surface)
- Task rows (solid surface — performance risk at 50+ rows)
- Any element inside a scrolling list of more than 10 items

Performance note: `backdrop-filter` on many elements in a single scroll container degrades rendering performance. Glassmorphism is a surface-level treatment for structural containers, not a general texture.

---

## PART 15 — WHAT COMMANDS THE OVERALL IMPRESSION

After all the specifics, the session should result in an interface where:

1. **Opening the dashboard** feels like stepping into a precision tool — the KPI strip loads with staggered entry, the radial ring charges, and the domain board cascades in.

2. **Checking off a task** feels physically satisfying — the checkbox pops, the background settles, the strikethrough writes itself.

3. **Filtering by goal** feels like focusing a lens — the goal selector glows, irrelevant content dims, the filtered list cascades into view.

4. **Opening the Architecture page** is a dramatic shift in register — the carbon console background, the dot-matrix grid, the blinking cursor, the glowing security flow, and the ChenERD schematic floating on a deep surface create the immediate impression of a system dashboard worthy of academic review.

5. **Everything in between** — hovering a card, selecting a day, switching nav items — has a response that is fast, smooth, and slightly physical. The app feels alive because it responds to every interaction with considered motion.

This is the standard. Every decision should be made in service of it.

---

*v2 — Elevated for premium SaaS design parity with Vercel / Linear aesthetic standards*
*Codebase: `C:\Users\Afik\Documents\goal-to-grid` · Live: `https://goal-to-grid.vercel.app`*
*All functional constraints from Part 0 remain absolute and inviolable.*
