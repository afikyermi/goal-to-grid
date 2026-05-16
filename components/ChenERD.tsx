'use client'

export interface AllEntityCounts {
  households: number
  profiles: number
  sectors: number
  user_constraints: number
  goals: number
  priority_levels: number
  tasks: number
  schedule_items: number
  calendar_connections: number
  external_calendar_events: number
  user_behavior_events: number
}

const C = {
  entity: '#2563EB',
  rel: '#F97316',
  attr: '#22C55E',
  attrPK: '#15803D',
  line: '#6B7280',
  text: '#FFFFFF',
  card: '#111827',
}

function Ent({ cx, cy, label, count, w = 190 }: { cx: number; cy: number; label: string; count: number; w?: number }) {
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 24} width={w} height={48} fill={C.entity} stroke="white" strokeWidth="2" rx="3" />
      <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill={C.text}>{label}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="rgba(255,255,255,0.85)">{count} rows</text>
    </g>
  )
}

function Rel({ cx, cy, label, hw = 54, hh = 28 }: { cx: number; cy: number; label: string; hw?: number; hh?: number }) {
  const d = `M${cx},${cy - hh} L${cx + hw},${cy} L${cx},${cy + hh} L${cx - hw},${cy} Z`
  return (
    <g>
      <path d={d} fill={C.rel} stroke="white" strokeWidth="1.5" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill={C.text}>{label}</text>
    </g>
  )
}

function Attr({ cx, cy, rx, label, isKey }: { cx: number; cy: number; rx: number; label: string; isKey?: boolean }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={18} fill={isKey ? C.attrPK : C.attr} stroke="white" strokeWidth="1.5" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={C.text} textDecoration={isKey ? 'underline' : undefined}>{label}</text>
    </g>
  )
}

function edge(x1: number, y1: number, x2: number, y2: number, key: string) {
  return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.line} strokeWidth="1.5" />
}

export default function ChenERD({ counts }: { counts: AllEntityCounts }) {
  const E = {
    households: { cx: 760, cy: 70 },
    profiles: { cx: 260, cy: 250 },
    sectors: { cx: 760, cy: 250 },
    constraints: { cx: 260, cy: 450 },
    goals: { cx: 760, cy: 450 },
    tasks: { cx: 760, cy: 650 },
    schedule: { cx: 760, cy: 850 },
    calendar: { cx: 1210, cy: 850 },
    external: { cx: 1210, cy: 650 },
    behavior: { cx: 260, cy: 850 },
    priority: { cx: 1210, cy: 450 },
  }

  return (
    <svg viewBox="0 0 1480 960" className="w-full h-auto rounded-lg border bg-white dark:bg-zinc-950" style={{ minHeight: 500 }}>
      <rect x="20" y="20" width="260" height="82" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="1.5" />
      <rect x="34" y="34" width="22" height="16" rx="2" fill={C.entity} />
      <text x="63" y="42" fontSize="10" fill="#374151" dominantBaseline="middle">Entity with live row count</text>
      <path d="M34,67 L45,58 L56,67 L45,76 Z" fill={C.rel} />
      <text x="63" y="67" fontSize="10" fill="#374151" dominantBaseline="middle">Relationship</text>
      <ellipse cx="45" cy="90" rx="20" ry="12" fill={C.attr} />
      <text x="63" y="90" fontSize="10" fill="#374151" dominantBaseline="middle">Attribute</text>

      {edge(E.households.cx, E.households.cy, 510, 160, 'h1')}
      {edge(510, 160, E.profiles.cx, E.profiles.cy, 'h2')}
      {edge(E.households.cx, E.households.cy, 760, 160, 'h3')}
      {edge(760, 160, E.sectors.cx, E.sectors.cy, 'h4')}
      {edge(E.sectors.cx, E.sectors.cy, 760, 350, 's1')}
      {edge(760, 350, E.goals.cx, E.goals.cy, 's2')}
      {edge(E.goals.cx, E.goals.cy, 760, 550, 'g1')}
      {edge(760, 550, E.tasks.cx, E.tasks.cy, 'g2')}
      {edge(E.tasks.cx, E.tasks.cy, 760, 750, 't1')}
      {edge(760, 750, E.schedule.cx, E.schedule.cy, 't2')}
      {edge(E.profiles.cx, E.profiles.cy, 260, 350, 'p1')}
      {edge(260, 350, E.constraints.cx, E.constraints.cy, 'p2')}
      {edge(E.profiles.cx, E.profiles.cy, 440, 550, 'p3')}
      {edge(440, 550, E.behavior.cx, E.behavior.cy, 'p4')}
      {edge(E.schedule.cx, E.schedule.cy, 510, 850, 'b1')}
      {edge(510, 850, E.behavior.cx, E.behavior.cy, 'b2')}
      {edge(E.priority.cx, E.priority.cy, 985, 450, 'pr1')}
      {edge(985, 450, E.goals.cx, E.goals.cy, 'pr2')}
      {edge(E.calendar.cx, E.calendar.cy, 1210, 750, 'c1')}
      {edge(1210, 750, E.external.cx, E.external.cy, 'c2')}

      <Rel cx={510} cy={160} label="has" />
      <Rel cx={760} cy={160} label="owns" />
      <Rel cx={760} cy={350} label="contains" />
      <Rel cx={760} cy={550} label="breaks into" hw={70} />
      <Rel cx={760} cy={750} label="scheduled as" hw={78} />
      <Rel cx={260} cy={350} label="defines" />
      <Rel cx={440} cy={550} label="generates" hw={68} />
      <Rel cx={510} cy={850} label="records" />
      <Rel cx={985} cy={450} label="classifies" hw={70} />
      <Rel cx={1210} cy={750} label="imports" />

      <Attr cx={760} cy={18} rx={20} label="id" isKey />
      <Attr cx={650} cy={42} rx={34} label="name" />
      <Attr cx={760} cy={202} rx={20} label="id" isKey />
      <Attr cx={880} cy={220} rx={34} label="name" />
      <Attr cx={640} cy={420} rx={52} label="start_date" />
      <Attr cx={880} cy={420} rx={48} label="end_date" />
      <Attr cx={900} cy={650} rx={60} label="duration_min" />
      <Attr cx={900} cy={850} rx={68} label="scheduled_start" />

      <Ent cx={E.households.cx} cy={E.households.cy} label="HOUSEHOLDS" count={counts.households} />
      <Ent cx={E.profiles.cx} cy={E.profiles.cy} label="PROFILES" count={counts.profiles} />
      <Ent cx={E.sectors.cx} cy={E.sectors.cy} label="SECTORS / DOMAINS" count={counts.sectors} w={220} />
      <Ent cx={E.constraints.cx} cy={E.constraints.cy} label="USER_CONSTRAINTS" count={counts.user_constraints} w={220} />
      <Ent cx={E.goals.cx} cy={E.goals.cy} label="GOALS" count={counts.goals} w={150} />
      <Ent cx={E.priority.cx} cy={E.priority.cy} label="PRIORITY_LEVELS" count={counts.priority_levels} w={220} />
      <Ent cx={E.tasks.cx} cy={E.tasks.cy} label="TASKS" count={counts.tasks} w={150} />
      <Ent cx={E.schedule.cx} cy={E.schedule.cy} label="SCHEDULE_ITEMS" count={counts.schedule_items} w={220} />
      <Ent cx={E.calendar.cx} cy={E.calendar.cy} label="CALENDAR_CONNECTIONS" count={counts.calendar_connections} w={250} />
      <Ent cx={E.external.cx} cy={E.external.cy} label="EXTERNAL_CALENDAR_EVENTS" count={counts.external_calendar_events} w={270} />
      <Ent cx={E.behavior.cx} cy={E.behavior.cy} label="USER_BEHAVIOR_EVENTS" count={counts.user_behavior_events} w={250} />
    </svg>
  )
}
