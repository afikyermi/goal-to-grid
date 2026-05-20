# AcademOps — Claude Design Opening Prompt
### Paste this in full as your first message at claude.ai/design

---

I want you to prototype a premium, high-fidelity web application called **AcademOps**. This is a household operations deck — a tool that transforms a structured hierarchy of life domains, goals, and daily tasks into a live, interactive weekly schedule. It is also the primary submission artifact for a university Database Architecture course, so one of its pages must feel like an authoritative, world-class engineering console.

The visual bar for this product is set at the absolute peak of modern SaaS design: think Linear, Vercel, Stripe — surfaces that feel considered, typography that feels precise, motion that feels organic. Every pixel must earn its place. The application should feel breathtaking to use.

---

## THE APPLICATION LANDSCAPE

The shell of the application is a fixed left navigation sidebar (narrow, approximately 240px) paired with a scrollable main workspace to its right. The sidebar contains five primary navigation items: Workspace, Plan, Schedule, Constraints, and Architecture. The "Architecture" link is the academic centerpiece and deserves a subtle visual distinction from the others — a soft accent mark, a micro-badge, or a faint glow that signals its special role.

There are six main surfaces to prototype. Please start with the **Workspace (Dashboard)** page, then move to **Architecture** when I ask.

---

## SURFACE 1: THE WORKSPACE DASHBOARD

This is the daily command center. It contains five distinct regions arranged in a premium layout.

### The KPI Strip (three metric cards across the top)

Three cards sit side by side at the top of the workspace. They are the executive summary of the entire household's operational state:

- **Weekly Completion:** A radial ring that charges from 0 to the current completion percentage. When no data exists yet for the week, it renders a clean em-dash sentinel — communicating "no data" with elegance, never a false zero. The ring should feel alive — it charges on mount with a smooth arc animation, like a progress indicator waking up.

- **Open Backlog:** A single large bold number showing how many tasks are still outstanding. This is the most urgently important KPI — give it maximum visual weight. The number should feel monospaced, stable, and authoritative.

- **Planned Effort:** Total time committed to open work, expressed as a formatted duration (e.g., "4h 30m"). Monospaced, so it never shifts layout as the number changes live.

These three cards should feel like a unified instrument panel — same height, consistent internal rhythm, slight elevation above the page surface through layered micro-shadows.

### The Active Goal Filter (below the KPI strip)

A full-width filter bar that acts as a "lens" for the entire workspace. When a specific goal is selected, the board below focuses on it. When no goal is selected, all content is visible.

This bar should feel like a premium glass control surface — slightly translucent, with a `backdrop-blur` quality that makes it feel like it's floating above the content beneath it. When a filter is active, a soft semantic ring or glow materializes around the container to signal that a lens is applied. A small "Clear" pill should slide in from the right side of the bar when the filter is active, and dissolve away when cleared.

### The Domain Board (main left column)

This is the heart of the application. It renders a nested three-tier visual hierarchy:

**Tier 1 — Domain (the outermost container):** A full-width bordered card that acts as a stable, architectural anchor for a life category (e.g., "Studies", "Career", "Family"). It never collapses. It has a subtle top-edge accent stripe — a structural marker that gives each domain its own spatial identity. Inside, a count badge shows how many active goals it contains.

**Tier 2 — Goal (nested milestone card):** Inside each domain, goal cards are inset with a slightly deeper surface tone. Each goal has:
- A name, a date range badge, and a priority indicator
- A thin linear progress bar that tracks how many of its child tasks are complete
- A chevron that rotates 90° when the goal is expanded, using a spring-easing motion that gives it physical weight — it doesn't snap, it swings open
- When all tasks under a goal are done, the card's entire surface shifts into a soft "complete" glow state — a barely-there primary tint that signals achievement

**Tier 3 — Task (the action row):** Inside each expanded goal, task rows are clean horizontal strips. Each row has:
- A checkbox on the far left
- A task name in the center
- A monospaced duration chip on the far right (e.g., "45m")

The **checkbox completion sequence** is the most important micro-interaction in the entire application. It must feel like a physical event, not a class swap:
1. As the user clicks, the empty circle shrinks and fades while a filled checkmark icon scales up from small to full size with a spring overshoot — a satisfying "pop"
2. Simultaneously, the row's background transitions from clean to a muted, settled tone
3. A moment after the icon resolves, a line-through decoration draws across the task name — as if the text is being crossed out by hand

This three-beat sequence should feel like the task is truly being "completed" — not toggled. It's the emotional core of the product.

When a user hovers over a pending task row, the row should lift very slightly — a `1–2px` vertical rise with a shadow bloom — communicating that it's interactive and responsive.

List items (task rows, goal cards) should **cascade onto the screen** when the view first loads or when a filter is applied — each item staggering in 30–40ms after the one above it, sliding up gently from a few pixels below its final position. The page should feel like it's assembling itself with intention, not rendering all at once.

### The Open Backlog (below the Domain Board, still left column)

A read-only reference deck that groups all incomplete tasks by goal, sorted by deadline (soonest first) then priority (highest first). It's a secondary operational surface — the "what's coming up" view.

Each goal group card has a priority-semantic left-edge accent border: a rich destructive red stripe for high-priority goals, a primary accent stripe for medium, a quiet muted stripe for low. These accents are atmospheric — they communicate urgency without being loud.

Inside each group, task rows are compact — smaller than the Domain Board rows — with a monospaced duration on the right. They don't have checkboxes because this is a reference view, not an interaction surface.

### The Right Context Panel (380px fixed-width column)

Three stacked cards that track execution quality:

**Execution Health:** This card has two states. In its calm state, it's neutral — an "all systems normal" reading. When missed items exist, the card transforms into an alarm: its border shifts to a rich destructive red, its surface takes on a faint red atmospheric wash, and the alert icon pulses slowly — a 2-second breathing pulse that communicates an active, unresolved condition. The transition between calm and alarm should feel like a system alert activating — not a toggle.

**Next Scheduled Work:** A vertical feed of upcoming scheduled tasks, showing the task name, a "Today/Tomorrow/date" label, and a time. Each entry in the feed should be a clean card with a slight hover-lift. The feed should cascade in with staggered entry.

**Effort by Domain:** A horizontal bar chart showing how much open work time is committed to each life domain. The leading bar (longest) should be the most visually prominent — fully saturated and emitting a soft glow. Subordinate bars are quieter. All bars animate their fill from zero on mount — they charge up like loading indicators. Duration labels on the right are monospaced.

---

## SURFACE 2: THE ARCHITECTURE PAGE — THE ACADEMIC MASTERPIECE

This page is categorically different from everything else in the application. It is the submission centerpiece for a university Database Architecture course, and it must command immediate academic authority. When you land on it, the visual register shifts completely — from household ops tool to engineering console.

**Force this page into a deep, permanent dark mode** regardless of any system preference. The background is not standard dark — it is a deep carbon: nearly black, somewhere between charcoal and void. Over this carbon surface, lay an ultra-subtle dot-matrix grid texture — a repeating field of tiny dots, barely perceptible, that gives the surface depth and makes it feel like a technical schematic substrate. The dots should be only slightly lighter than the background — felt as texture, not seen as pattern.

The page opens with a **terminal-style header**: the title "ARCHITECTURE VIEW" in a bold monospaced or geometric typeface, preceded by a faint terminal prompt character (like `~/architecture $`) and a blinking cursor. This single detail immediately establishes the engineering console register.

### The 3-Layer Security Isolation Flow (new section, prominent placement)

This is one of the most important visual elements on the page and it does not yet exist in the current UI. It must be designed as a beautiful, glowing flowchart.

The application uses a three-layer security isolation pattern to protect multi-tenant household data. These three layers must be rendered as a horizontal flow of three illuminated nodes connected by crisp arrows:

**Node 1 — AuthN (Authentication):** The entry gate. Glowing in **emerald green** — the color of verified identity, of a system saying "I know who you are." Label: `AUTH N`. Sublabel below: `Cookie Session · Supabase Auth`. The glow should be a soft radial bloom — not harsh, but luminous, as if the node is lit from within.

**Node 2 — AuthZ (Authorization):** The ownership checkpoint. Glowing in **amber** — the color of caution and careful verification. Label: `AUTH Z`. Sublabel: `Ownership Check · workspace.ts`. Same bloom treatment as above.

**Node 3 — DB Scope (Database Scope):** The final data boundary. Glowing in **electric blue** — the color of data, of structured precision. Label: `DB SCOPE`. Sublabel: `household_id · Row Partition`. Same bloom.

The three nodes are connected by fine glowing line connectors with arrowheads — the connectors should feel like circuit traces or schematic wiring, not UI arrows. The whole section is contained in a recessed console panel — a slightly darker card than the page background, with a fine-line border that feels like a PCB trace boundary.

On page mount, the three glows should activate sequentially — AuthN illuminates first, then AuthZ, then DB Scope — like a system initializing in sequence.

### The Concept Flow (Mermaid diagram)

A flowchart showing the data transformation pipeline: `Household → Domain → Goal → Task → Schedule Suggestion → Schedule Item → Google Calendar`. Render it inside a recessed terminal panel on the console surface. Monospaced labels, dark theme, connector lines that feel like schematic traces.

### The Entity Relationship Diagram (Mermaid ERD)

A full database ERD showing all eleven entities and their relationships. Same recessed terminal treatment. This should feel like a schema printout from an enterprise database tool.

### The Chen Notation ERD (the visual centerpiece)

This is a hand-crafted SVG diagram in Chen notation — the academic standard for database diagrams. It shows the full entity-relationship model of the system using:
- **Rectangles** for entities (rendered in rich blue)
- **Diamonds** for relationships (rendered in vibrant orange)
- **Ellipses** for attributes (rendered in emerald green)
- **Lines** connecting them all

This diagram should be presented like a **premium engineering blueprint** — the SVG canvas itself should have a deep, near-black background with a subtle inner border glow. The entire diagram should feel like it's sitting on a illuminated drafting table. Below each entity rectangle, a live row count should pulse gently whenever the underlying database updates — communicating that this is not a static diagram but a live database topology map.

### Live Database Metric Cards (5 entity hierarchy cards)

Five compact cards showing the live row count for the five core entities in the data hierarchy: `HOUSEHOLDS → SECTORS → GOALS → TASKS → SCHEDULE_ITEMS`. Each card is a dark console tile:
- Entity name in tiny, wide-tracked monospace uppercase — the way database table names look in a schema viewer
- A large bold monospace number for the live count
- A brief description line in very muted text

When a count changes (via live database updates), the number should flash with a brief pulse — a quick scale-up and color flash that communicates "this just updated." This is a live dashboard, not a static readout.

### Entity Breakdown and Normalization Notes

Two additional sections at the bottom of the page. Entity Breakdown: a grid of description cards for each entity in the system, with the entity name in monospace and a plain-text description. Normalization Notes: a data table proving each entity is in Third Normal Form (3NF), with table names in monospace, form notation highlighted in blue accent, and reasoning in muted text. These should feel like technical documentation printed to a console — precise, readable, authoritative.

---

## THE SEMANTIC COLOR PHILOSOPHY

Color in AcademOps is not decorative. It is a functional signal system. Every color maps to an execution state, and that mapping is inviolable:

- **Amber / Warm Orange** → Constraint overlays. Time that is blocked and unavailable. These are ambient background washes — they float beneath interactive content, never on top of it. Low opacity, left-accent border, no interactivity.
- **Destructive Red** → Missed tasks, alarm states, overdue conditions. When red appears, something needs attention. Red is the only color that should feel urgent.
- **Emerald / Green** → Completion. Done states, satisfied conditions, positive confirmations. Green is the reward color — it should feel satisfying, not just functional.
- **Blue** → Pending / scheduled / active. The neutral-active state. Most scheduled items live in this register.

But strict semantic mapping does not mean flat. Each color should be expressed as a **full atmospheric ecosystem**:
- A tinted surface wash for the background of state-carrying containers
- A richer, more saturated border or left-accent
- Full-saturation icons and indicators
- A soft radial glow or shadow that bleeds the color lightly into the surrounding space

A "Missed" task should feel genuinely alarming — a red that seeps into the air around it. A "Done" task should feel genuinely satisfying — an emerald that glows with quiet completeness. The colors should make the emotional meaning automatic and immediate.

---

## THE GLOBAL MOTION LANGUAGE

Every interaction in AcademOps must feel like it has physical weight and intention:

- **State transitions** use a standard organic easing — fast departure, gentle arrival. Nothing linear, nothing mechanical.
- **Tactile interactions** (checkboxes, buttons, day-selectors) use a spring easing with a subtle overshoot — they pop and settle rather than arriving flatly.
- **Elements entering the screen** decelerate into their final position — they slide in with gentle ease, not abrupt appearance.
- **List stagger** is universal: whenever a list of items loads or filters, each item cascades in 30–40ms after the one above, sliding up from a few pixels below. The page assembles itself, it doesn't snap into existence.
- **Nothing flickers.** No instant class swaps. No opacity jumping from 0 to 1 in a single frame. Every state change has a transition, however brief.

The result should feel like using a precision instrument that is also, somehow, alive. Responsive without being jittery. Smooth without being slow. Premium without being sterile.

---

## DEPTH AND SURFACE SYSTEM

The application uses a layered surface hierarchy to communicate architectural depth:

- The **page background** is the deepest layer — the base plane.
- **Cards and containers** sit above it — slightly elevated through micro-shadows so thin they barely register, but enough to create a sense of lift.
- **Interactive elements** (task rows on hover, active filter bars) lift further — a shadow bloom and a slight upward translate that communicates "this responds to you."
- **Overlays and drag ghosts** float at the highest elevation — full shadow, slight scale, opacity reduction to communicate they are temporarily lifted from the surface.

In dark mode, depth is expressed through luminance steps — each surface layer is fractionally lighter than the one below it, creating a stack that reads as physical depth without relying on harsh color contrast.

**Glassmorphism** is used sparingly and intentionally: the Active Goal Filter bar and certain floating overlay panels should use `backdrop-blur` with semi-transparent backgrounds — a glassy quality that communicates "this is a floating control surface, not a grounded card." Not everywhere — just where it adds architectural meaning.

---

## START HERE

Please prototype the **Workspace Dashboard** first. Show me the full layout: sidebar on the left, KPI strip at the top, Active Goal Filter below it, then the two-column split with Domain Board and Open Backlog on the left, and the three right-column cards (Execution Health, Next Scheduled Work, Effort by Domain) on the right. Use realistic placeholder data — a few domains, a few goals each, a mix of pending, done, and missed states — so I can see all semantic color states in action.

Make it breathtaking.
