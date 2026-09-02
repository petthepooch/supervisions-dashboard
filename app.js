/* ---------------------------------------------------------------
   Supervisions dashboard prototype — application
   Hash routing, two-level nav, sticky section tabs with scroll-spy,
   right side panel (messages / person / notes), and every figure
   derived from data.js through derive().
   --------------------------------------------------------------- */

/* Utilities ------------------------------------------------------ */

const DAY = 86400000;
const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const fmt = (dt, opts = { day: 'numeric', month: 'short' }) => dt.toLocaleDateString('en-GB', opts);
const fmtLong = (dt) => dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (dt) => dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
const pct = (n) => `${Math.round(n * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const byId = (id) => TEAM.find((p) => p.id === id);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Quarters ------------------------------------------------------- */

function quarterOf(dt) {
  const q = POLICY.quarters.find((q) => q.months.includes(dt.getMonth()));
  const startMonth = q.months[0];
  const year = dt.getFullYear();
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { ...q, start, end, fy: fyLabel(dt) };
}
function fyLabel(dt) {
  const y = dt.getMonth() >= POLICY.fyStartMonth ? dt.getFullYear() : dt.getFullYear() - 1;
  return `FY ${y}/${String(y + 1).slice(2)}`;
}
/* The four quarters of the FY containing `dt`, in order. */
function fyQuarters(dt) {
  const y = dt.getMonth() >= POLICY.fyStartMonth ? dt.getFullYear() : dt.getFullYear() - 1;
  return POLICY.quarters.map((q, i) => {
    const year = q.months[0] >= POLICY.fyStartMonth ? y : y + 1;
    const start = new Date(year, q.months[0], 1);
    const end = new Date(year, q.months[0] + 3, 0);
    return { ...q, start, end, current: dt >= start && dt <= end, past: dt > end };
  });
}
const inRange = (dt, a, b) => dt >= a && dt <= b;

/* Derivation ----------------------------------------------------- */
/* One function produces every status and count. Pages only format. */

function derivePerson(p) {
  const q = quarterOf(TODAY);
  const signed = p.history.filter((h) => h.signedOff).map((h) => ({ ...h, at: d(h.signedOff) }));
  const last = signed.length ? signed[signed.length - 1] : null;
  const current = p.history[p.history.length - 1];
  const thisQuarterSigned = signed.find((h) => inRange(h.at, q.start, q.end));

  // Due = the earlier of quarter end and 12 weeks since last supervision.
  let due = q.end;
  if (last) { const byCycle = addDays(last.at, POLICY.cycleDays); if (byCycle < due) due = byCycle; }
  if (p.probation) { const byProb = addDays(d(p.started), 92); if (byProb < due) due = byProb; }

  // Complete for the quarter only if nothing else (the 12-week rule, a
  // probation review) makes another supervision due before quarter end.
  const completeForQuarter = !!thisQuarterSigned && due.getTime() === q.end.getTime();

  let status, tone, label;
  if (p.paused) {
    status = 'paused'; tone = 'muted'; label = p.paused.reason;
  } else if (completeForQuarter) {
    status = 'complete'; tone = 'good'; label = `Signed off ${fmt(thisQuarterSigned.at)}`;
  } else if (current && current.submitted && !current.signedOff) {
    status = 'review'; tone = 'info'; label = `Awaiting your sign off`;
  } else if (due < TODAY) {
    status = 'overdue'; tone = 'crit'; label = `${plural(daysBetween(due, TODAY), 'day')} overdue`;
  } else if (current && current.booked && !current.signedOff) {
    status = 'booked'; tone = 'info'; label = `Booked ${fmt(d(current.booked))}`;
  } else if (current && current.draft) {
    status = 'drafting'; tone = 'warn'; label = `Drafting, due ${fmt(due)}`;
  } else {
    status = 'not_booked'; tone = 'warn'; label = `Not booked, due ${fmt(due)}`;
  }
  const daysToDue = daysBetween(TODAY, due);
  const atRisk = !p.paused && status !== 'complete' && status !== 'overdue' && status !== 'review' && daysToDue <= POLICY.atRiskDays;
  const compliant = !p.paused && (status === 'complete' || (status !== 'overdue' && status !== 'review'));
  const type = current ? current.type : 'Quarterly supervision';
  return { ...p, initials: initials(p.name), status, tone, label, due, daysToDue, atRisk, compliant, last, current, type, thisQuarterSigned };
}

function derive() {
  const people = TEAM.map(derivePerson);
  const active = people.filter((p) => !p.paused);
  const count = (s) => people.filter((p) => p.status === s).length;
  const compliant = active.filter((p) => p.compliant).length;
  const overdue = people.filter((p) => p.status === 'overdue');
  const review = people.filter((p) => p.status === 'review');
  const atRisk = people.filter((p) => p.atRisk);
  const paused = people.filter((p) => p.paused);
  const openFlags = SAFEGUARDING.filter((f) => f.status === 'open');
  const decisions = paused.filter((p) => p.paused.decisionDue && d(p.paused.decisionDue) >= addDays(TODAY, -30));
  const unread = MESSAGES.filter((m) => m.unread).length;
  const q = quarterOf(TODAY);
  return {
    people, active, paused, q,
    compliance: active.length ? compliant / active.length : 1,
    compliantCount: compliant,
    signedOff: count('complete'), booked: count('booked'), drafting: count('drafting'), notBooked: count('not_booked'),
    overdue, review, atRisk, openFlags, decisions, unread,
    openActions: overdue.length + review.length + openFlags.length + decisions.length,
    gap: overdue.length + review.length,
  };
}

/* State ---------------------------------------------------------- */

const state = {
  route: '',
  navRail: false,
  panelOpen: false,
  panelMode: 'messages',   // messages | thread | person | notes
  panelArg: null,
  msgFilter: 'all',
  cycleFilter: 'all',
  cycleSearch: '',
  leagueSort: { key: 'compliance', dir: 'desc' },
  calMonth: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1),
  announceIdx: 0,
  announceHidden: false,
  openGroup: null,
};

/* Navigation model ----------------------------------------------- */

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', route: '/dashboard' },
  {
    id: 'supervisions', label: 'Supervisions', icon: 'clipboard', badge: (s) => s.overdue.length + s.review.length,
    children: [
      { label: 'Team supervisions', route: '/supervisions/team' },
      { label: 'Supervision cycle', route: '/supervisions/cycle' },
      { label: 'Allocation', route: '/supervisions/allocation' },
      { label: 'New supervision', route: '/supervisions/new' },
    ],
  },
  {
    id: 'development', label: 'Development', icon: 'target',
    children: [
      { label: 'Team PDPs', route: '/development/pdps' },
      { label: 'Probation reviews', route: '/development/probation' },
    ],
  },
  {
    id: 'safeguarding', label: 'Safeguarding', icon: 'shield', badge: (s) => s.openFlags.length,
    children: [
      { label: 'Triage', route: '/safeguarding/triage' },
      { label: 'Concerns log', route: '/safeguarding/log' },
    ],
  },
  {
    id: 'reports', label: 'Reports', icon: 'chart',
    children: [
      { label: 'Compliance', route: '/reports/compliance' },
      { label: 'League table', route: '/reports/league' },
      { label: 'Reporting suite', route: '/reports/suite' },
    ],
  },
];

const ICONS = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 11h6M9 15h4"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9.5C7.2 20 4 16.5 4 12V6l8-3z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20h16M7 16v-5M12 16V7M17 16v-3"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-5 4v-4H6.5A2.5 2.5 0 014 13.5v-8z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 20a2 2 0 004 0"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l2 2 3-3M4 17l2 2 3-3M12 7h8M12 17h8"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M8 15l4 4 4-4"/></svg>',
  sortUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M8 9l4-4 4 4"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};
const ico = (n) => ICONS[n] || '';

/* Rendering: shell ----------------------------------------------- */

function renderNav(s) {
  const groups = NAV.map((g) => {
    if (!g.children) {
      const active = state.route === g.route;
      return `<li><a class="nav-item ${active ? 'active' : ''}" href="#${g.route}" data-nav>
        ${ico(g.icon).replace('<svg ', '<svg class="ico" ')}<span class="label">${g.label}</span></a></li>`;
    }
    const hasActive = g.children.some((c) => state.route === c.route || state.route.startsWith(c.route + '/'));
    const open = state.openGroup === g.id;
    const badge = g.badge ? g.badge(s) : 0;
    return `<li class="nav-group ${open ? 'open' : ''} ${hasActive ? 'has-active' : ''}">
      <button class="nav-parent" data-group="${g.id}" aria-expanded="${open}" aria-controls="grp-${g.id}">
        ${ico(g.icon).replace('<svg ', '<svg class="ico" ')}
        <span class="label">${g.label}</span>
        ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
        ${ico('chev')}
      </button>
      <div class="nav-children" id="grp-${g.id}"><ul>
        ${g.children.map((c) => `<li><a class="nav-item ${state.route === c.route ? 'active' : ''}" href="#${c.route}" data-nav><span class="label">${c.label}</span></a></li>`).join('')}
      </ul></div>
    </li>`;
  }).join('');
  $('#nav-list').innerHTML = groups;
}

function renderTopbar(s) {
  $('#btn-chat').classList.toggle('active', state.panelOpen && (state.panelMode === 'messages' || state.panelMode === 'thread'));
  $('#btn-notes').classList.toggle('active', state.panelOpen && state.panelMode === 'notes');
  $('#chat-dot').textContent = s.unread;
  $('#chat-dot').hidden = !s.unread;
  const a = $('#announce');
  a.hidden = state.announceHidden;
  const item = ANNOUNCEMENTS[state.announceIdx];
  $('#announce-text').innerHTML = `${esc(item.text)}<a href="#/reports/suite" data-nav>${esc(item.more)}</a>`;
  $('#announce-count').textContent = `${state.announceIdx + 1} of ${ANNOUNCEMENTS.length}`;
}

/* Rendering: shared components ----------------------------------- */

const avatar = (p, cls = '') => `<span class="avatar ${cls}" style="--h:${p.hue}">${p.initials || initials(p.name)}</span>`;
const personBtn = (p, extra = '') => `<button data-person="${p.id}">${esc(p.name)}</button>${extra}`;
const statusPill = (p) => `<span class="pill ${p.tone}">${esc(p.label)}</span>`;

function sectionTabs(tabs) {
  return `<nav class="section-tabs" aria-label="Sections"><ul>
    ${tabs.map((t) => `<li><button data-scroll="${t.id}">${t.label}${t.count != null ? `<span class="tab-count ${t.tone || ''}">${t.count}</span>` : ''}</button></li>`).join('')}
  </ul></nav>`;
}

function pageHead(title, lede, actions = '', date = true) {
  return `<header class="page-head">
    <div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}${date ? `<p class="date">${fmtLong(TODAY)}</p>` : ''}</div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </header>`;
}

function greeting() {
  const h = 14; // afternoon in the prototype
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/* Rendering: dashboard pieces ------------------------------------ */

function focusCards(s) {
  const cards = [];
  s.overdue.forEach((p) => cards.push({
    tone: 't-crit', kind: 'Chase', title: `${p.name}, ${p.type.toLowerCase()}`,
    why: `${plural(daysBetween(p.due, TODAY), 'day')} overdue. ${p.chases.length ? `${plural(p.chases.length, 'chase')} sent, last ${fmt(d(p.chases[p.chases.length - 1]))}.` : 'Not chased yet.'}`,
    cta: 'Chase or rebook', action: `data-person="${p.id}"`, pill: `<span class="pill crit">Overdue</span>`,
  }));
  s.review.forEach((p) => cards.push({
    tone: 't-info', kind: 'Sign off', title: `${p.name}, ${s.q.key} sign off`,
    why: `Submitted ${fmt(d(p.current.submitted))}. It counts towards compliance once you sign it off.`,
    cta: 'Review record', action: `data-person="${p.id}"`, pill: `<span class="pill info">With you</span>`,
  }));
  s.decisions.forEach((p) => cards.push({
    tone: 't-warn', kind: 'Decision', title: `${p.name}, return to work`,
    why: `${p.paused.reason} ends ${fmt(d(p.paused.returns))}. Book a return supervision or extend leave.`,
    cta: 'Make decision', action: `data-person="${p.id}"`, pill: `<span class="pill warn">Due ${fmt(d(p.paused.decisionDue))}</span>`,
  }));
  s.openFlags.forEach((f) => { const p = byId(f.person); cards.push({
    tone: 't-crit', kind: 'Safeguarding', title: f.title,
    why: `Raised ${fmt(d(f.raised))} in ${p.name.split(' ')[0]}'s supervision. Triage decision needed.`,
    cta: 'Open triage', action: `data-go="/safeguarding/triage"`, pill: `<span class="pill crit">${f.severity} severity</span>`,
  }); });
  cards.push({
    tone: 't-accent', kind: 'Report', title: `CQC evidence pack, ${s.q.key}`,
    why: 'Inspection window opens 1 October. Export needs signed-off records only.',
    cta: 'Open reporting suite', action: `data-go="/reports/suite"`, pill: `<span class="pill accent plain">Due 25 Sep</span>`,
  });
  return `<div class="focus">${cards.slice(0, 4).map((c) => `
    <button class="card focus-card ${c.tone}" ${c.action}>
      <div class="top"><span class="kind">${c.kind}</span>${c.pill}</div>
      <div class="title">${esc(c.title)}</div>
      <div class="why">${esc(c.why)}</div>
      <div class="foot"><span class="cta">${c.cta}${ico('arrow')}</span></div>
    </button>`).join('')}</div>`;
}

function statsRow(s) {
  const a = s.active.length;
  const tone = s.compliance >= 0.9 ? 'good' : s.compliance >= 0.75 ? 'warn' : 'crit';
  return `<div class="stats">
    <button class="card stat tone-${tone}" data-scroll="cycle">
      <span class="k">Team compliance</span>
      <span class="v num">${pct(s.compliance)}<small>${s.compliantCount} of ${a} in date</small></span>
      <span class="meter"><i style="width:${(s.signedOff / a) * 100}%"></i><i class="info" style="width:${((s.compliantCount - s.signedOff) / a) * 100}%"></i><i class="crit" style="width:${((a - s.compliantCount) / a) * 100}%"></i></span>
      <span class="d">${s.signedOff} signed off this quarter, ${s.compliantCount - s.signedOff} in date and booked or drafting</span>
    </button>
    <button class="card stat ${s.openActions ? 'tone-warn' : 'tone-good'}" data-scroll="attention">
      <span class="k">Open actions</span>
      <span class="v num">${s.openActions}<small>need you</small></span>
      <span class="d">${plural(s.overdue.length, 'overdue')} · ${s.review.length} awaiting sign off · ${plural(s.openFlags.length, 'safeguarding flag')} · ${plural(s.decisions.length, 'decision')}</span>
      <span class="link">Work through them</span>
    </button>
    <button class="card stat ${s.overdue.length ? 'tone-crit' : 'tone-good'}" data-scroll="attention">
      <span class="k">Overdue</span>
      <span class="v num">${s.overdue.length}<small>${s.overdue.length ? s.overdue.map((p) => p.name).join(', ') : 'nobody'}</small></span>
      <span class="d">${s.atRisk.length ? `${plural(s.atRisk.length, 'person', 'people')} due within ${POLICY.atRiskDays} days: ${s.atRisk.map((p) => p.name.split(' ')[0]).join(', ')}` : `Nobody due within ${POLICY.atRiskDays} days`}</span>
      <span class="link">${s.overdue.length ? 'Chase now' : 'View cycle'}</span>
    </button>
    <button class="card stat" data-go="/development/pdps">
      <span class="k">PDP progress</span>
      <span class="v num">${pct(pdpProgress(s))}<small>objectives complete</small></span>
      <span class="meter"><i style="width:${pdpProgress(s) * 100}%"></i></span>
      <span class="d">${s.people.filter((p) => d(p.pdp.review) <= addDays(TODAY, 30)).length} PDP reviews due in the next 30 days</span>
    </button>
  </div>`;
}
const pdpProgress = (s) => { const t = s.people.reduce((n, p) => n + p.pdp.objectives, 0); const c = s.people.reduce((n, p) => n + p.pdp.complete, 0); return t ? c / t : 0; };

function attentionCard(s) {
  const rows = [];
  s.overdue.forEach((p) => rows.push(`<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill crit">${esc(p.label)}</span></div>
      <div class="meta"><span>${esc(p.type)}</span><span>Was due ${fmt(p.due, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="${p.chases.length >= 3 ? 'crit' : ''}">${plural(p.chases.length, 'chase')}${p.chases.length ? `, last ${fmt(d(p.chases[p.chases.length - 1]))}${p.lastChaseRead === false ? ' (unread)' : ''}` : ''}</span></div></div>
    <div class="acts"><button class="btn sm secondary" data-act="note" data-id="${p.id}">Add note</button><button class="btn sm secondary" data-act="chase" data-id="${p.id}">Send chase</button><button class="btn sm primary" data-act="book" data-id="${p.id}">Book now</button></div>
  </div>`));
  s.review.forEach((p) => rows.push(`<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill info">Awaiting your sign off</span></div>
      <div class="meta"><span>${esc(p.type)}</span><span>Held ${fmt(d(p.current.held))}, submitted ${fmt(d(p.current.submitted))}</span><span class="warn">Blocked on you, not on ${p.name.split(' ')[0]}</span></div></div>
    <div class="acts"><button class="btn sm secondary" data-person="${p.id}">Open record</button><button class="btn sm primary" data-act="signoff" data-id="${p.id}">Sign off</button></div>
  </div>`));
  s.decisions.forEach((p) => rows.push(`<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill warn">Decision due ${fmt(d(p.paused.decisionDue))}</span></div>
      <div class="meta"><span>${esc(p.paused.reason)} since ${fmt(d(p.paused.since))}</span><span>Excluded from compliance while paused</span></div></div>
    <div class="acts"><button class="btn sm secondary" data-act="extend" data-id="${p.id}">Extend leave</button><button class="btn sm primary" data-act="rejoin" data-id="${p.id}">Book return supervision</button></div>
  </div>`));
  s.atRisk.forEach((p) => rows.push(`<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill ${p.tone}">${esc(p.label)}</span></div>
      <div class="meta"><span>${esc(p.type)}</span><span class="warn">Due in ${plural(p.daysToDue, 'day')} (${fmt(p.due)})</span><span>No action needed unless the booking slips</span></div></div>
    <div class="acts"><button class="btn sm secondary" data-person="${p.id}">View</button></div>
  </div>`));

  const good = s.gap === 0;
  return `<div class="card">
    <div class="attn-summary">
      <span class="big num ${good ? 'good' : ''}">${good ? '100%' : pct(1 - s.compliance)}</span>
      <div class="what"><strong>${good ? 'Team is fully compliant' : `Gap to 100% compliance`}</strong>
        <span>${good ? 'Everything left here is early warning.' : `${plural(s.overdue.length, 'overdue supervision')}, ${s.review.length} awaiting your sign off. Closing these takes the team to 100%.`}</span></div>
      <div class="breakdown">
        ${s.overdue.length ? `<span class="pill crit">${s.overdue.length} overdue</span>` : ''}
        ${s.review.length ? `<span class="pill info">${s.review.length} to sign off</span>` : ''}
        ${s.decisions.length ? `<span class="pill warn">${plural(s.decisions.length, 'decision')}</span>` : ''}
        ${s.atRisk.length ? `<span class="pill outline plain">${s.atRisk.length} due soon</span>` : ''}
      </div>
    </div>
    ${rows.length ? rows.join('') : `<div class="attn-empty"><strong>Nothing needs you right now</strong>Every active team member is in date and nothing is waiting for sign off.</div>`}
    ${s.overdue.length > 1 ? `<div style="padding:12px 20px;border-top:1px solid var(--line)"><button class="btn sm primary" data-act="chase-all">Chase all overdue (${s.overdue.length})</button></div>` : ''}
  </div>`;
}

function safeguardingBanner(s) {
  if (!s.openFlags.length) return '';
  const f = s.openFlags[0]; const p = byId(f.person);
  return `<div class="alert ${f.severity === 'high' ? 'crit' : ''}">
    <div class="ico">${ico('shield')}</div>
    <div class="txt"><strong>Safeguarding: ${esc(f.title)}</strong><span>Raised ${fmt(d(f.raised))} from ${esc(p.name)}'s supervision. ${plural(s.openFlags.length, 'open flag')}. Triage decision outstanding.</span></div>
    <button class="btn sm secondary" data-go="/safeguarding/triage">Open triage ${ico('arrow')}</button>
  </div>`;
}

/* Cycle grid ----------------------------------------------------- */

function quarterCell(p, q) {
  // What happened (or is planned) for this person in this quarter.
  const signed = p.history.find((h) => h.signedOff && inRange(d(h.signedOff), q.start, q.end));
  // In the current quarter the live status wins: someone supervised in
  // early July can still be due again before the end of September.
  if (q.current && !p.paused && p.status !== 'complete') return statusPill(p);
  if (signed) return `<span class="pill good">${fmtShort(d(signed.signedOff))}</span>`;
  if (p.paused && d(p.paused.since) <= q.end && d(p.paused.returns) >= q.start) return `<span class="pill plain">Paused</span>`;
  if (q.current) return statusPill(p);
  if (q.past) return `<span class="pill crit">Missed</span>`;
  // Future quarter: projected due date is the quarter end, or 12 weeks after the current due if sooner.
  return `<span class="pill plain">Due ${fmtShort(q.end)}</span>`;
}

function cycleCard(s, { compact = false } = {}) {
  const qs = fyQuarters(TODAY);
  let people = s.people;
  const counts = {
    all: people.length,
    action: people.filter((p) => ['overdue', 'review', 'not_booked'].includes(p.status) || p.atRisk).length,
    overdue: people.filter((p) => p.status === 'overdue').length,
    complete: people.filter((p) => p.status === 'complete').length,
  };
  if (state.cycleFilter === 'action') people = people.filter((p) => ['overdue', 'review', 'not_booked'].includes(p.status) || p.atRisk);
  if (state.cycleFilter === 'overdue') people = people.filter((p) => p.status === 'overdue');
  if (state.cycleFilter === 'complete') people = people.filter((p) => p.status === 'complete');
  if (state.cycleSearch) people = people.filter((p) => p.name.toLowerCase().includes(state.cycleSearch.toLowerCase()) || p.role.toLowerCase().includes(state.cycleSearch.toLowerCase()));
  const order = { overdue: 0, review: 1, not_booked: 2, drafting: 3, booked: 4, complete: 5, paused: 6 };
  people = [...people].sort((a, b) => order[a.status] - order[b.status] || a.due - b.due);

  const chip = (k, l) => `<button class="chip ${state.cycleFilter === k ? 'active' : ''}" data-cycle-filter="${k}">${l} <span class="n">${counts[k]}</span></button>`;
  return `<div class="card">
    <div class="card-head">
      <div><h3>Supervision cycle</h3><div class="sub">${s.q.fy}. One supervision per quarter and no more than 12 weeks apart.</div></div>
      <div class="filters">
        ${chip('all', 'All')}${chip('action', 'Needs action')}${chip('overdue', 'Overdue')}${chip('complete', 'Signed off')}
        <label class="mini-search">${ico('search')}<input type="search" placeholder="Search team" value="${esc(state.cycleSearch)}" data-cycle-search aria-label="Search team"></label>
        <button class="btn sm secondary" data-act="export">${ico('download')} Export</button>
      </div>
    </div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Team member</th>${qs.map((q) => `<th class="${q.current ? 'here' : ''}">${q.label}${q.current ? '<small>You are here</small>' : ''}</th>`).join('')}${compact ? '' : '<th>Next due</th>'}</tr></thead>
      <tbody>${people.map((p) => `<tr>
        <td><div class="person">${avatar(p, 'sm')}<div>${personBtn(p)}<small>${esc(p.role)}${p.probation ? ' · probation' : ''}</small></div></div></td>
        ${qs.map((q) => `<td class="${q.current ? 'here' : ''}">${quarterCell(p, q)}</td>`).join('')}
        ${compact ? '' : `<td class="num">${p.paused ? '<span style="color:var(--ink-3)">Paused</span>' : `${fmt(p.due, { day: 'numeric', month: 'short', year: 'numeric' })}${p.status !== 'complete' ? ` <span style="color:var(--ink-3)">(${p.daysToDue < 0 ? `${-p.daysToDue}d ago` : `in ${p.daysToDue}d`})</span>` : ''}`}</td>`}
      </tr>`).join('') || `<tr><td colspan="6" class="empty">No one matches that filter.</td></tr>`}</tbody>
    </table></div>
    <div class="legend"><span><i class="good"></i>Signed off</span><span><i class="info"></i>Booked or awaiting sign off</span><span><i class="warn"></i>Drafting or not booked</span><span><i class="crit"></i>Overdue or missed</span><span><i class="muted"></i>Paused or future</span></div>
  </div>`;
}

/* League table --------------------------------------------------- */

function leagueRows(s) {
  const rows = MANAGERS.map((m) => m.live
    ? { ...m, compliance: s.compliance, onTime: s.active.length ? (s.active.length - s.overdue.length) / s.active.length : 1, team: s.active.length }
    : m);
  // Rank is fixed by compliance, and held when the user re-sorts.
  const ranked = [...rows].sort((a, b) => b.compliance - a.compliance || b.onTime - a.onTime);
  ranked.forEach((r, i) => (r.rank = i + 1));
  const { key, dir } = state.leagueSort;
  return ranked.sort((a, b) => {
    const va = a[key], vb = b[key];
    const c = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return dir === 'asc' ? c : -c;
  });
}

function leagueCard(s) {
  const rows = leagueRows(s);
  const th = (k, l, cls = '') => {
    const on = state.leagueSort.key === k;
    return `<th class="sortable ${on ? 'sorted' : ''} ${cls}"><button data-sort="${k}">${l} ${on ? ico(state.leagueSort.dir === 'asc' ? 'sortUp' : 'sort') : ''}</button></th>`;
  };
  const tone = (v) => (v >= 0.9 ? '' : v >= 0.75 ? 'warn' : 'crit');
  return `<div class="card">
    <div class="card-head"><div><h3>Manager league table</h3><div class="sub">All registered managers, ${esc(ME.org)}. Rank is by compliance and held when you re-sort.</div></div>
      <button class="btn sm secondary" data-act="export">${ico('download')} Export</button></div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr>${th('rank', 'Rank')}${th('name', 'Manager')}${th('site', 'Site')}${th('team', 'Team', 'r')}${th('compliance', 'Team compliance')}${th('onTime', 'On time')}</tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.live ? 'is-me' : ''}">
        <td class="rank num ${r.live ? 'me' : ''}">${r.rank}</td>
        <td><strong>${esc(r.name)}</strong>${r.live ? ' <span class="pill accent plain" style="margin-left:6px">You</span>' : ''}</td>
        <td>${esc(r.site)}</td>
        <td class="r num">${r.team}</td>
        <td><div class="bar-cell"><span class="meter"><i class="${tone(r.compliance)}" style="width:${r.compliance * 100}%"></i></span><b class="num">${pct(r.compliance)}</b></div></td>
        <td><div class="bar-cell"><span class="meter"><i class="${tone(r.onTime)}" style="width:${r.onTime * 100}%"></i></span><b class="num">${pct(r.onTime)}</b></div></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

/* Calendar ------------------------------------------------------- */

function calendarEvents(s) {
  const ev = [];
  s.people.forEach((p) => {
    p.history.forEach((h) => {
      if (h.signedOff) ev.push({ date: d(h.signedOff), tone: 'good', text: `${p.name.split(' ')[0]} signed off`, id: p.id });
      else if (h.submitted) ev.push({ date: d(h.submitted), tone: 'info', text: `${p.name.split(' ')[0]} submitted`, id: p.id });
      else if (h.booked) ev.push({ date: d(h.booked), tone: d(h.booked) < TODAY ? 'crit' : 'accent', text: `${p.name.split(' ')[0]} ${d(h.booked) < TODAY ? 'missed' : 'booked'}`, id: p.id });
    });
    if (!p.paused && p.status !== 'complete' && p.status !== 'booked') ev.push({ date: p.due, tone: p.due < TODAY ? 'crit' : 'warn', text: `${p.name.split(' ')[0]} due`, id: p.id });
    if (p.paused && p.paused.decisionDue) ev.push({ date: d(p.paused.decisionDue), tone: 'warn', text: `${p.name.split(' ')[0]} decision`, id: p.id });
  });
  return ev;
}

function calendarCard(s) {
  const m = state.calMonth;
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const pad = (first.getDay() + 6) % 7; // Monday first
  const events = calendarEvents(s).filter((e) => e.date.getMonth() === m.getMonth() && e.date.getFullYear() === m.getFullYear());
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push('<div class="cal-day pad"></div>');
  for (let day = 1; day <= days; day++) {
    const dt = new Date(m.getFullYear(), m.getMonth(), day);
    const todays = events.filter((e) => e.date.getDate() === day);
    const isToday = iso(dt) === iso(TODAY);
    cells.push(`<button class="cal-day ${isToday ? 'today' : ''} ${dt < TODAY ? 'past' : ''}" ${todays.length === 1 ? `data-person="${todays[0].id}"` : ''} aria-label="${fmt(dt, { day: 'numeric', month: 'long' })}${todays.length ? ', ' + todays.map((e) => e.text).join(', ') : ''}">
      <span class="n">${day}</span>${todays.slice(0, 3).map((e) => `<span class="cal-ev"><i class="${e.tone}"></i><span>${esc(e.text)}</span></span>`).join('')}${todays.length > 3 ? `<span class="cal-ev"><span>+${todays.length - 3} more</span></span>` : ''}
    </button>`);
  }
  const isCurrent = m.getMonth() === TODAY.getMonth() && m.getFullYear() === TODAY.getFullYear();
  return `<div class="card">
    <div class="cal-head"><h3>${m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
      <div class="nav-btns">${isCurrent ? '' : '<button class="btn xs ghost" data-cal="today">Today</button>'}<button class="icon-btn" data-cal="-1" aria-label="Previous month">${ico('left')}</button><button class="icon-btn" data-cal="1" aria-label="Next month">${ico('right')}</button></div></div>
    <div class="cal-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => `<div class="cal-dow">${x}</div>`).join('')}${cells.join('')}</div>
    <div class="legend" style="border-top:0;padding-top:4px"><span><i class="good"></i>Signed off</span><span><i class="info"></i>Submitted</span><span><i class="accent"></i>Booked</span><span><i class="warn"></i>Due or decision</span><span><i class="crit"></i>Overdue or missed</span></div>
    <div class="cal-foot">${plural(events.length, 'supervision event')} this month. Click a day to open the person.</div>
  </div>`;
}

/* Trend chart ---------------------------------------------------- */

function trendCard(s) {
  const pts = [...TREND, { m: 'Sep', y: 2026, v: s.compliance, live: true }];
  const W = 560, H = 190, L = 34, R = 16, T = 18, B = 30;
  const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v) => T + (1 - (v - 0.5) / 0.5) * (H - T - B);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1).toFixed(1)},${y(0.5)} L${x(0)},${y(0.5)} Z`;
  const grid = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const target = 0.9;
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  const delta = Math.round((last.v - prev.v) * 100);
  const fyStart = pts.findIndex((p) => p.m === 'Jul' && p.y === 2026);
  return `<div class="card trend">
    <div class="trend-head"><div class="big num">${pct(s.compliance)}<small>team compliance today</small></div><span class="fy">${s.q.fy} · target 90%</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Compliance trend over the last twelve months">
      ${grid.map((g) => `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 6}" y="${y(g) + 3.5}" text-anchor="end">${Math.round(g * 100)}</text>`).join('')}
      <line class="target" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/><text class="tg" x="${W - R}" y="${y(target) - 5}" text-anchor="end">target</text>
      ${fyStart > 0 ? `<line class="grid-line" x1="${x(fyStart) - 0.5}" x2="${x(fyStart) - 0.5}" y1="${T}" y2="${H - B + 4}" stroke-dasharray="2 3"/><text x="${x(fyStart) + 4}" y="${T + 8}">FY start</text>` : ''}
      <path class="area" d="${area}"/><path class="line" d="${path}"/>
      ${pts.map((p, i) => `<circle class="pt ${p.live ? 'end' : ''}" cx="${x(i)}" cy="${y(p.v)}" r="3"/>`).join('')}
      <text class="lbl" x="${x(pts.length - 1)}" y="${y(last.v) - 10}" text-anchor="end">${pct(last.v)}</text>
      ${pts.map((p, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${p.m}</text>`).join('')}
    </svg>
    <div class="trend-foot"><span>${delta >= 0 ? 'Up' : 'Down'} <b>${Math.abs(delta)} points</b> on August</span><span>Best: <b>100%</b> in June</span><span>Below target <b>${pts.filter((p) => p.v < target).length}</b> of ${pts.length} months</span></div>
  </div>`;
}

/* Pages ---------------------------------------------------------- */

function pageDashboard(s) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'attention', label: 'Needs attention', count: s.openActions, tone: s.overdue.length ? 'crit' : s.openActions ? 'warn' : '' },
    { id: 'cycle', label: 'Supervision cycle' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'league', label: 'League table' },
    { id: 'trend', label: 'Trend' },
  ];
  const lede = `<b>${s.signedOff} of ${s.active.length}</b> supervisions signed off this quarter. <b>${plural(s.overdue.length, 'person', 'people')}</b> overdue, <b>${s.review.length}</b> waiting on your sign off${s.paused.length ? `, ${s.paused.length} paused` : ''}.`;
  return `
    ${pageHead(`${greeting()}, ${ME.firstName}`, lede, `<button class="btn primary" data-go="/supervisions/new">${ico('plus')} Start new supervision</button>`)}
    ${sectionTabs(tabs)}
    <section class="section" id="overview" data-section>
      ${safeguardingBanner(s)}
      <div class="section-head" style="margin-top:22px"><h2>Your focus</h2><span class="sub">Ordered by what unblocks compliance first</span></div>
      ${focusCards(s)}
      <div class="section-head" style="margin-top:26px"><h2>Your stats</h2><span class="sub">Live from the team's records</span></div>
      ${statsRow(s)}
    </section>
    <section class="section" id="attention" data-section>
      <div class="section-head"><h2>Needs attention</h2><span class="sub">Everything stopping the team reaching 100%, plus early warnings</span></div>
      ${attentionCard(s)}
    </section>
    <section class="section" id="cycle" data-section>
      <div class="section-head"><h2>Team supervision cycle</h2><a href="#/supervisions/cycle" data-nav>Open full view</a></div>
      ${cycleCard(s, { compact: true })}
    </section>
    <section class="section" id="calendar" data-section>
      <div class="section-head"><h2>Calendar</h2><span class="sub">Booked, due and signed-off supervisions</span></div>
      ${calendarCard(s)}
    </section>
    <section class="section" id="league" data-section>
      <div class="section-head"><h2>League table</h2><a href="#/reports/league" data-nav>Open report</a></div>
      ${leagueCard(s)}
    </section>
    <section class="section" id="trend" data-section>
      <div class="section-head"><h2>Compliance trend</h2><a href="#/reports/compliance" data-nav>Open report</a></div>
      ${trendCard(s)}
    </section>`;
}

function pageTeam(s) {
  const tabs = [
    { id: 'overdue', label: 'Overdue', count: s.overdue.length, tone: s.overdue.length ? 'crit' : '' },
    { id: 'review', label: 'Awaiting sign off', count: s.review.length, tone: s.review.length ? 'warn' : '' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'done', label: 'Signed off this quarter', count: s.signedOff },
    { id: 'paused', label: 'Paused', count: s.paused.length },
  ];
  const table = (rows, empty) => `<div class="card"><div class="table-wrap"><table class="tbl">
    <thead><tr><th>Team member</th><th>Record</th><th>Status</th><th>Due</th><th>Last signed off</th><th></th></tr></thead>
    <tbody>${rows.length ? rows.map((p) => `<tr>
      <td><div class="person">${avatar(p, 'sm')}<div>${personBtn(p)}<small>${esc(p.role)}</small></div></div></td>
      <td>${esc(p.type)}</td><td>${statusPill(p)}</td>
      <td class="num">${p.paused ? '<span style="color:var(--ink-3)">Paused</span>' : fmt(p.due, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
      <td class="num">${p.last ? fmt(p.last.at, { day: 'numeric', month: 'short', year: 'numeric' }) : '<span style="color:var(--ink-3)">Never</span>'}</td>
      <td class="r">${p.status === 'review' ? `<button class="btn xs primary" data-act="signoff" data-id="${p.id}">Sign off</button>` : p.status === 'overdue' ? `<button class="btn xs primary" data-act="chase" data-id="${p.id}">Send chase</button>` : `<button class="btn xs secondary" data-person="${p.id}">Open</button>`}</td>
    </tr>`).join('') : `<tr><td colspan="6" class="empty">${empty}</td></tr>`}</tbody></table></div></div>`;
  const upcoming = s.people.filter((p) => ['booked', 'drafting', 'not_booked'].includes(p.status)).sort((a, b) => a.due - b.due);
  return `
    ${pageHead('Team supervisions', `Every record for your ${s.people.length} team members, grouped by what it needs from you.`, `<button class="btn secondary" data-act="export">${ico('download')} Export</button><button class="btn primary" data-go="/supervisions/new">${ico('plus')} New supervision</button>`, false)}
    ${sectionTabs(tabs)}
    <section class="section" id="overdue" data-section><div class="section-head"><h2>Overdue</h2><span class="sub">Past the due date with nothing signed off</span></div>${table(s.overdue, 'Nobody is overdue.')}</section>
    <section class="section" id="review" data-section><div class="section-head"><h2>Awaiting your sign off</h2><span class="sub">The supervisee has done their part</span></div>${table(s.review, 'Nothing is waiting on you.')}</section>
    <section class="section" id="upcoming" data-section><div class="section-head"><h2>Upcoming</h2><span class="sub">Booked, drafting or not yet booked, soonest first</span></div>${table(upcoming, 'Nothing upcoming.')}</section>
    <section class="section" id="done" data-section><div class="section-head"><h2>Signed off this quarter</h2></div>${table(s.people.filter((p) => p.status === 'complete'), 'Nothing signed off yet this quarter.')}</section>
    <section class="section" id="paused" data-section><div class="section-head"><h2>Paused</h2><span class="sub">On leave. Excluded from compliance until they return.</span></div>${table(s.paused, 'Nobody is paused.')}</section>`;
}

function pageCycle(s) {
  return `${pageHead('Supervision cycle', `${s.q.fy}. Policy: one supervision each quarter and no more than ${POLICY.cycleDays / 7} weeks between them. The due date is whichever comes first.`, '', false)}
    <div class="section" style="padding-top:8px">${cycleCard(s)}</div>`;
}

function pageAllocation(s) {
  const rows = s.people.map((p) => `<tr>
    <td><div class="person">${avatar(p, 'sm')}<div>${personBtn(p)}<small>${esc(p.role)} · ${esc(p.site)}</small></div></div></td>
    <td>${esc(ME.name)}</td><td>${statusPill(p)}</td>
    <td class="r"><button class="btn xs secondary" data-act="reassign" data-id="${p.id}">Reassign</button></td></tr>`).join('');
  return `${pageHead('Supervision allocation', 'Who supervises whom. Reassigning moves the open record and its due date with the person.', `<button class="btn secondary" data-act="export">${ico('download')} Export</button>`, false)}
    <div class="section" style="padding-top:8px">
      <div class="alloc-summary"><span>Total<b class="num">${s.people.length}</b></span><span class="good">Allocated<b class="num">${s.people.length}</b></span><span class="warn">Unallocated<b class="num">0</b></span><span class="crit">Overdue<b class="num">${s.overdue.length}</b></span><span>Paused<b class="num">${s.paused.length}</b></span></div>
      <div class="card"><div class="card-head"><div class="person">${avatar({ ...ME, hue: 175 })}<div><strong>${esc(ME.name)}</strong><small style="display:block;color:var(--ink-3);font-size:12.5px">${esc(ME.role)} · ${plural(s.people.length, 'supervisee')}</small></div></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Team member</th><th>Supervisor</th><th>Current status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
    </div>`;
}

function pageNew(s) {
  const opts = s.people.filter((p) => !p.paused && p.status !== 'complete');
  return `${pageHead('New supervision', 'Start a record. The supervisee gets a draft to add their reflections before the meeting.', '', false)}
    <div class="section" style="padding-top:8px"><div class="card"><div class="card-body">
      <div class="form-grid">
        <div class="field"><label>Team member</label><div class="ctl">${opts.length ? esc(opts[0].name) : 'Choose a person'} <span style="margin-left:auto;color:var(--ink-3)">${ico('chevDown')}</span></div></div>
        <div class="field"><label>Type</label><div class="ctl">Quarterly supervision <span style="margin-left:auto;color:var(--ink-3)">${ico('chevDown')}</span></div></div>
        <div class="field"><label>Date and time</label><div class="ctl">${fmt(addDays(TODAY, 7), { weekday: 'short', day: 'numeric', month: 'short' })}, 10:00</div></div>
        <div class="field"><label>Template</label><div class="ctl">Standard care supervision (v3, Aug 2026) <span style="margin-left:auto;color:var(--ink-3)">${ico('chevDown')}</span></div></div>
        <div class="field wide"><label>Agenda notes for the supervisee</label><div class="ctl ta">Anything you want them to prepare. They see this in their draft.</div></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px"><button class="btn primary" data-act="create">Create and send draft</button><button class="btn secondary" data-go="/dashboard">Cancel</button></div>
    </div></div>
    <div class="proto-note"><b>Prototype.</b> The form is static. Creating a record shows what the supervisee would receive and returns you to the dashboard.</div></div>`;
}

function pagePdps(s) {
  const tabs = [{ id: 'due', label: 'Reviews due', count: s.people.filter((p) => d(p.pdp.review) <= addDays(TODAY, 30)).length, tone: 'warn' }, { id: 'all', label: 'All PDPs' }];
  const row = (p) => { const pr = p.pdp.objectives ? p.pdp.complete / p.pdp.objectives : 0; return `<tr>
    <td><div class="person">${avatar(p, 'sm')}<div>${personBtn(p)}<small>${esc(p.role)}</small></div></div></td>
    <td class="num">${p.pdp.complete} of ${p.pdp.objectives}</td>
    <td><div class="bar-cell"><span class="meter"><i class="${pr === 1 ? '' : pr >= 0.5 ? 'info' : 'warn'}" style="width:${pr * 100}%"></i></span><b class="num">${pct(pr)}</b></div></td>
    <td class="num">${fmt(d(p.pdp.review), { day: 'numeric', month: 'short', year: 'numeric' })}${d(p.pdp.review) <= addDays(TODAY, 30) ? ' <span class="pill warn plain" style="margin-left:6px">Soon</span>' : ''}</td>
    <td class="r"><button class="btn xs secondary" data-person="${p.id}">Open</button></td></tr>`; };
  const tbl = (rows) => `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Team member</th><th>Objectives</th><th>Progress</th><th>Next review</th><th></th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div></div>`;
  return `${pageHead('Team PDPs', `Personal development plans. ${pct(pdpProgress(s))} of objectives complete across the team.`, '', false)}
    ${sectionTabs(tabs)}
    <section class="section" id="due" data-section><div class="section-head"><h2>Reviews due in 30 days</h2></div>${tbl(s.people.filter((p) => d(p.pdp.review) <= addDays(TODAY, 30)).sort((a, b) => d(a.pdp.review) - d(b.pdp.review)))}</section>
    <section class="section" id="all" data-section><div class="section-head"><h2>All PDPs</h2></div>${tbl([...s.people].sort((a, b) => d(a.pdp.review) - d(b.pdp.review)))}</section>`;
}

function pageProbation(s) {
  const ps = s.people.filter((p) => p.probation);
  return `${pageHead('Probation reviews', 'New starters in their first three months. Reviews count as supervisions.', '', false)}
    <div class="section" style="padding-top:8px"><div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Team member</th><th>Started</th><th>Review due</th><th>Status</th><th></th></tr></thead><tbody>
      ${ps.map((p) => `<tr><td><div class="person">${avatar(p, 'sm')}<div>${personBtn(p)}<small>${esc(p.role)}</small></div></div></td><td class="num">${fmt(d(p.started), { day: 'numeric', month: 'short', year: 'numeric' })}</td><td class="num">${fmt(addDays(d(p.started), 92), { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${statusPill(p)}</td><td class="r"><button class="btn xs primary" data-act="book" data-id="${p.id}">Book review</button></td></tr>`).join('')}
    </tbody></table></div></div></div>`;
}

function pageTriage(s) {
  const tabs = [{ id: 'open', label: 'Open', count: s.openFlags.length, tone: s.openFlags.length ? 'crit' : '' }, { id: 'closed', label: 'Closed' }];
  const flag = (f) => { const p = byId(f.person); return `<div class="card" style="margin-bottom:14px"><div class="card-body" style="display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:start">
    <div class="alert-ico" style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:${f.status === 'open' ? 'var(--crit-soft)' : 'var(--muted-soft)'};color:${f.status === 'open' ? 'var(--crit)' : 'var(--ink-3)'}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9.5C7.2 20 4 16.5 4 12V6l8-3z"/></svg></div>
    <div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h3 style="font-size:16px">${esc(f.title)}</h3><span class="pill ${f.severity === 'high' ? 'crit' : f.severity === 'medium' ? 'warn' : 'plain'}">${f.severity} severity</span><span class="pill ${f.status === 'open' ? 'info' : 'plain'} plain">${f.status}</span></div>
      <p style="color:var(--ink-2);margin-top:6px;max-width:70ch">${esc(f.summary)}</p>
      <dl class="kv" style="margin-top:12px"><dt>Person</dt><dd>${personBtn(p)}</dd><dt>Raised</dt><dd>${fmt(d(f.raised), { day: 'numeric', month: 'long', year: 'numeric' })}</dd><dt>Owner</dt><dd>${esc(ME.name)}</dd>${f.closed ? `<dt>Closed</dt><dd>${fmt(d(f.closed), { day: 'numeric', month: 'long', year: 'numeric' })}</dd>` : `<dt>Decision due</dt><dd style="color:var(--crit)">Within 24 hours of triage</dd>`}</dl></div>
    ${f.status === 'open' ? `<div style="display:flex;flex-direction:column;gap:8px"><button class="btn sm primary" data-act="refer" data-id="${f.id}">Refer to local authority</button><button class="btn sm secondary" data-act="monitor" data-id="${f.id}">Monitor internally</button><button class="btn sm ghost" data-act="close-flag" data-id="${f.id}">Close, no concern</button></div>` : ''}
  </div></div>`; };
  return `${pageHead('Safeguarding triage', 'Flags raised in supervisions. Every open flag needs a recorded decision.', '', false)}
    ${sectionTabs(tabs)}
    <section class="section" id="open" data-section><div class="section-head"><h2>Open</h2></div>${s.openFlags.length ? s.openFlags.map(flag).join('') : '<div class="card"><div class="attn-empty"><strong>No open flags</strong>Nothing needs a triage decision.</div></div>'}</section>
    <section class="section" id="closed" data-section><div class="section-head"><h2>Closed</h2></div>${SAFEGUARDING.filter((f) => f.status !== 'open').map(flag).join('') || '<div class="card"><div class="empty">Nothing closed yet.</div></div>'}</section>`;
}

function pageLog(s) {
  return `${pageHead('Concerns log', 'Every safeguarding flag ever raised for your team, newest first.', `<button class="btn secondary" data-act="export">${ico('download')} Export</button>`, false)}
    <div class="section" style="padding-top:8px"><div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Raised</th><th>Person</th><th>Concern</th><th>Severity</th><th>Status</th></tr></thead><tbody>
      ${[...SAFEGUARDING].sort((a, b) => d(b.raised) - d(a.raised)).map((f) => { const p = byId(f.person); return `<tr><td class="num">${fmt(d(f.raised), { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${personBtn(p)}</td><td>${esc(f.title)}</td><td><span class="pill ${f.severity === 'high' ? 'crit' : 'plain'}">${f.severity}</span></td><td><span class="pill ${f.status === 'open' ? 'info' : 'good'}">${f.status}${f.closed ? ` ${fmt(d(f.closed))}` : ''}</span></td></tr>`; }).join('')}
    </tbody></table></div></div></div>`;
}

function pageCompliance(s) {
  return `${pageHead('Compliance report', `How compliance is calculated: a team member is in date when this quarter's supervision is signed off, or their next one is booked or drafting and not yet due. Overdue records and records awaiting your sign off count against you. Paused staff are excluded.`, `<button class="btn secondary" data-act="export">${ico('download')} Export</button>`, false)}
    <div class="section" style="padding-top:8px">${statsRow(s)}</div>
    <div class="section two-col">${trendCard(s)}<div class="card"><div class="card-head"><h3>Breakdown</h3></div><div class="card-body"><dl class="kv">
      <dt>Active staff</dt><dd class="num">${s.active.length}</dd><dt>Signed off this quarter</dt><dd class="num">${s.signedOff}</dd><dt>Booked</dt><dd class="num">${s.booked}</dd><dt>Drafting</dt><dd class="num">${s.drafting}</dd><dt>Not booked</dt><dd class="num">${s.notBooked}</dd><dt>Awaiting sign off</dt><dd class="num">${s.review.length}</dd><dt>Overdue</dt><dd class="num" style="color:var(--crit)">${s.overdue.length}</dd><dt>Paused</dt><dd class="num">${s.paused.length}</dd>
    </dl></div></div></div>`;
}

function pageLeague(s) {
  return `${pageHead('League table', 'Registered managers across the organisation, ranked by team compliance.', '', false)}<div class="section" style="padding-top:8px">${leagueCard(s)}</div>`;
}

function pageSuite(s) {
  const reports = [
    ['CQC evidence pack', `${s.q.key} ${s.q.fy}. Signed-off supervision records, PDP summaries and safeguarding decisions.`, 'Due 25 Sep'],
    ['Supervision compliance', 'Monthly compliance by manager and site, with trend.', 'Monthly'],
    ['Overdue and chases', 'Every overdue record with its chase history.', 'Live'],
    ['Safeguarding decisions', 'Triage outcomes and time-to-decision.', 'Live'],
    ['PDP progress', 'Objectives set, completed and overdue by person.', 'Quarterly'],
  ];
  return `${pageHead('Reporting suite', 'Exports for inspection, board packs and your own tracking. Everything comes from the same records as the dashboard.', '', false)}
    <div class="section" style="padding-top:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
      ${reports.map(([t, sub, when]) => `<div class="card"><div class="card-body" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="font-size:16px">${t}</h3><span class="pill plain ${when.startsWith('Due') ? 'warn' : ''}">${when}</span></div><p style="color:var(--ink-2);font-size:14px;flex:1">${sub}</p><div style="display:flex;gap:8px"><button class="btn sm primary" data-act="export">${ico('download')} Export</button><button class="btn sm secondary" data-act="schedule-report">Schedule</button></div></div></div>`).join('')}
    </div>`;
}

const ROUTES = {
  '/dashboard': pageDashboard,
  '/supervisions/team': pageTeam,
  '/supervisions/cycle': pageCycle,
  '/supervisions/allocation': pageAllocation,
  '/supervisions/new': pageNew,
  '/development/pdps': pagePdps,
  '/development/probation': pageProbation,
  '/safeguarding/triage': pageTriage,
  '/safeguarding/log': pageLog,
  '/reports/compliance': pageCompliance,
  '/reports/league': pageLeague,
  '/reports/suite': pageSuite,
};

/* Side panel ----------------------------------------------------- */

function renderPanel(s) {
  const app = $('#app');
  app.classList.toggle('panel-open', state.panelOpen);
  const head = $('#panel-title'), body = $('#panel-body'), back = $('#panel-back');
  back.hidden = !(state.panelMode === 'thread' || (state.panelMode === 'person' && state.panelReturn));
  if (state.panelMode === 'messages') {
    head.innerHTML = `Messages ${s.unread ? `<span class="pill accent plain">${s.unread} unread</span>` : ''}`;
    let list = MESSAGES;
    if (state.msgFilter === 'unread') list = list.filter((m) => m.unread);
    body.innerHTML = `<div class="msg-filters"><button class="chip ${state.msgFilter === 'all' ? 'active' : ''}" data-msg-filter="all">All <span class="n">${MESSAGES.length}</span></button><button class="chip ${state.msgFilter === 'unread' ? 'active' : ''}" data-msg-filter="unread">Unread <span class="n">${s.unread}</span></button></div>
      ${list.map((m) => { const p = byId(m.person); return `<button class="msg ${m.unread ? 'unread' : ''}" data-thread="${m.id}">${avatar(p)}<div><div class="h"><strong>${esc(p.name)}</strong></div><div class="role">${esc(p.role)}</div><div class="t">${esc(m.text)}</div></div><div class="when"><span>${m.when}</span>${m.unread ? '<span class="unread-dot"></span>' : ''}</div></button>`; }).join('') || '<div class="empty">No unread messages.</div>'}`;
  } else if (state.panelMode === 'thread') {
    const m = MESSAGES.find((x) => x.id === state.panelArg); const p = byId(m.person);
    head.innerHTML = `Conversation`;
    body.innerHTML = `<div class="thread"><div class="thread-head">${avatar(p)}<div class="who"><strong>${esc(p.name)}</strong><span>${esc(p.role)} · ${esc(p.site)}</span></div><button class="btn xs secondary" style="margin-left:auto" data-person="${p.id}">Profile</button></div>
      <div class="thread-body">
        <div class="bubble them">${esc(m.text)}<time>${m.when}</time></div>
        ${m.id === 'c1' ? `<div class="bubble me">Thanks Sarah, I'll get to it before Friday.<time>Just now</time></div>` : ''}
      </div>
      <div class="thread-compose"><div class="ctl"><input placeholder="Reply to ${esc(p.name.split(' ')[0])}" aria-label="Reply"></div><button class="btn sm primary" data-act="send-reply">Send</button></div></div>`;
  } else if (state.panelMode === 'person') {
    const p = s.people.find((x) => x.id === state.panelArg);
    head.innerHTML = `Team member`;
    const tl = [...p.history].reverse().map((h) => {
      const dt = h.signedOff ? d(h.signedOff) : h.submitted ? d(h.submitted) : h.booked ? d(h.booked) : null;
      const tone = h.signedOff ? 'good' : h.submitted ? 'info' : h.booked ? (d(h.booked) < TODAY ? 'crit' : 'info') : 'warn';
      const what = h.signedOff ? 'Signed off' : h.submitted ? 'Submitted, awaiting sign off' : h.booked ? (d(h.booked) < TODAY ? 'Booked but not held' : 'Booked') : 'Draft started';
      return `<div class="tl"><i class="${tone}"></i><div class="t"><strong>${esc(h.type)}</strong><span>${what}${dt ? `, ${fmt(dt, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span></div></div>`;
    }).join('');
    const flags = SAFEGUARDING.filter((f) => f.person === p.id);
    body.innerHTML = `<div class="person-hero">${avatar(p, 'lg')}<div class="who"><strong>${esc(p.name)}</strong><span>${esc(p.role)} · ${esc(p.site)}${p.probation ? ' · probation' : ''}</span><div style="margin-top:8px">${statusPill(p)}${p.atRisk ? ' <span class="pill warn plain">Due soon</span>' : ''}</div></div></div>
      <div class="person-sec"><h4>Supervision</h4><dl class="kv"><dt>Next due</dt><dd>${p.paused ? 'Paused' : fmt(p.due, { day: 'numeric', month: 'short', year: 'numeric' })}</dd><dt>Last signed off</dt><dd>${p.last ? fmt(p.last.at, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}</dd><dt>Chases</dt><dd>${p.chases.length ? `${p.chases.length}, last ${fmt(d(p.chases[p.chases.length - 1]))}` : 'None'}</dd><dt>Started</dt><dd>${fmt(d(p.started), { day: 'numeric', month: 'short', year: 'numeric' })}</dd>${p.paused ? `<dt>Paused</dt><dd>${esc(p.paused.reason)}, returns ${fmt(d(p.paused.returns))}</dd>` : ''}</dl></div>
      ${p.notes.length ? `<div class="person-sec"><h4>Notes</h4>${p.notes.map((n) => `<p style="font-size:14px;color:var(--ink-2);margin-bottom:6px">${esc(n)}</p>`).join('')}</div>` : ''}
      <div class="person-sec"><h4>History</h4><div class="timeline">${tl}</div></div>
      <div class="person-sec"><h4>Development</h4><dl class="kv"><dt>PDP objectives</dt><dd>${p.pdp.complete} of ${p.pdp.objectives} complete</dd><dt>Next PDP review</dt><dd>${fmt(d(p.pdp.review), { day: 'numeric', month: 'short', year: 'numeric' })}</dd>${flags.length ? `<dt>Safeguarding</dt><dd>${plural(flags.filter((f) => f.status === 'open').length, 'open flag')}, ${flags.length} total</dd>` : ''}</dl></div>
      <div class="person-actions">
        ${p.status === 'overdue' ? `<button class="btn sm primary" data-act="book" data-id="${p.id}">Book now</button><button class="btn sm secondary" data-act="chase" data-id="${p.id}">Send chase</button>` : ''}
        ${p.status === 'review' ? `<button class="btn sm primary" data-act="signoff" data-id="${p.id}">Sign off record</button>` : ''}
        ${p.paused ? `<button class="btn sm primary" data-act="rejoin" data-id="${p.id}">Book return supervision</button>` : ''}
        ${['drafting', 'not_booked'].includes(p.status) ? `<button class="btn sm primary" data-act="book" data-id="${p.id}">Book supervision</button>` : ''}
        <button class="btn sm secondary" data-act="note" data-id="${p.id}">Add note</button>
        <button class="btn sm secondary" data-message="${p.id}">Message</button>
      </div>`;
  } else if (state.panelMode === 'notes') {
    head.innerHTML = 'Prototype notes';
    body.innerHTML = `<div class="notes">
      <p>What changed from the current dashboard, and why.</p>
      <h4>Navigation</h4>
      <ul><li>Two-level left nav. Parents (Supervisions, Development, Safeguarding, Reports) expand to show their children. Clicking a parent opens it and lands on its first child, so a click always goes somewhere.</li><li>Only one parent is open at a time. The open parent follows the current page, so deep links and back/forward expand the right group.</li><li>Counts on parents (overdue, open flags) so you can see where work is before opening the group.</li><li>The hamburger collapses the nav to an icon rail.</li></ul>
      <h4>Section tabs</h4>
      <ul><li>Sticky under the page title. Clicking scrolls to the section. A scroll-spy highlights whichever section is in view, so the tabs stay correct when you scroll by hand.</li><li>Tabs carry counts where they help (Needs attention).</li></ul>
      <h4>Messages panel</h4>
      <ul><li>Moved out of the page into a right-hand panel. On wide screens it pushes the content, below 1360px it slides over it.</li><li>The same panel shows a person's profile. Click any name to open it.</li></ul>
      <h4>Logic fixes</h4>
      <ul><li>One data model drives every number. The screenshots showed 90% compliance next to "11 of 18 signed off" and an "Overdue (0)" filter beside 1 overdue. That can't happen here.</li><li>Due date is the earlier of quarter end and 12 weeks since the last supervision, per policy. "Null supervision" becomes the record type.</li><li>Records awaiting the manager's sign off are shown as blocked on the manager, not the supervisee, and still count against compliance until signed.</li><li>Staff on leave are paused and excluded from the denominator, with a return decision surfaced as an action.</li><li>Calendar opens on the current month. Focus cards and Needs attention are the same list in two shapes, ordered by what unblocks compliance first.</li><li>Actions work: Sign off, Send chase, Book now and Book return supervision update the data and every figure recalculates.</li></ul>
      <h4>Try</h4>
      <ul><li>Sign off Sarah Mitchell from Needs attention and watch compliance and the league table move.</li><li>Press <code>D</code> to toggle dark mode.</li></ul>
    </div>`;
  }
}

/* Actions -------------------------------------------------------- */

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `${ico('check')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function doAction(act, id) {
  const p = TEAM.find((x) => x.id === id);
  const s = derive();
  switch (act) {
    case 'signoff': { const rec = p.history[p.history.length - 1]; rec.signedOff = iso(TODAY); toast(`${p.name}'s ${rec.type.toLowerCase()} signed off. Compliance is now ${pct(derive().compliance)}.`); break; }
    case 'chase': { p.chases.push(iso(TODAY)); p.lastChaseRead = false; toast(`Chase sent to ${p.name} (${plural(p.chases.length, 'chase')} in total).`); break; }
    case 'chase-all': { s.overdue.forEach((o) => byId(o.id).chases.push(iso(TODAY))); toast(`Chased ${plural(s.overdue.length, 'person', 'people')}.`); break; }
    case 'book': { const rec = p.history[p.history.length - 1]; const when = addDays(TODAY, 5); if (rec && !rec.signedOff) rec.booked = iso(when); else p.history.push({ type: 'Quarterly supervision', booked: iso(when) }); toast(`Booked ${p.name} for ${fmt(when, { weekday: 'short', day: 'numeric', month: 'short' })}. Still overdue until it is signed off.`); break; }
    case 'rejoin': { const when = d(p.paused.returns); delete p.paused; p.history.push({ type: 'Return to work supervision', booked: iso(when) }); toast(`${p.name} returns ${fmt(when)}. Return supervision booked and they are back in the compliance count.`); break; }
    case 'extend': { p.paused.returns = iso(addDays(d(p.paused.returns), 28)); p.paused.decisionDue = p.paused.returns; toast(`${p.name}'s leave extended to ${fmt(d(p.paused.returns))}.`); break; }
    case 'note': toast(`Note added to ${p.name}'s record.`); return;
    case 'export': toast('Export queued. You will get it by email in a minute or two.'); return;
    case 'schedule-report': toast('Report scheduled monthly.'); return;
    case 'reassign': toast(`Reassign ${p.name}: pick a new supervisor (not in prototype).`); return;
    case 'create': toast('Draft sent to the supervisee.'); go('/dashboard'); return;
    case 'send-reply': toast('Reply sent.'); return;
    case 'refer': case 'monitor': case 'close-flag': { const f = SAFEGUARDING.find((x) => x.id === id); f.status = 'closed'; f.closed = iso(TODAY); f.decision = act; toast(act === 'refer' ? 'Referred to the local authority. Decision recorded.' : act === 'monitor' ? 'Set to internal monitoring. Decision recorded.' : 'Closed with no concern. Decision recorded.'); break; }
  }
  render();
}

/* Router and rendering ------------------------------------------- */

function go(route) { location.hash = '#' + route; }

function groupForRoute(route) {
  const g = NAV.find((g) => g.children && g.children.some((c) => route === c.route || route.startsWith(c.route + '/')));
  return g ? g.id : null;
}

function render() {
  const s = derive();
  renderNav(s);
  renderTopbar(s);
  const page = ROUTES[state.route] || pageDashboard;
  $('#page-inner').innerHTML = page(s);
  renderPanel(s);
  setupScrollSpy();
}

let spy = null;
function setupScrollSpy() {
  if (spy) { spy.disconnect(); spy = null; }
  const sections = $$('[data-section]');
  const tabs = $$('.section-tabs button[data-scroll]');
  if (!sections.length || !tabs.length) return;
  const setActive = (id) => tabs.forEach((t) => t.classList.toggle('active', t.dataset.scroll === id));
  setActive(sections[0].id);
  const root = $('#page');
  // Track the section whose top is nearest to (but above) the tab bar.
  const update = () => {
    const line = root.getBoundingClientRect().top + 70;
    let current = sections[0];
    for (const sec of sections) if (sec.getBoundingClientRect().top <= line) current = sec;
    // At the very bottom, the last section wins even if it is short.
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = sections[sections.length - 1];
    setActive(current.id);
  };
  root.onscroll = update;
  update();
}

function onHashChange() {
  const route = location.hash.replace(/^#/, '') || '/dashboard';
  state.route = ROUTES[route] ? route : '/dashboard';
  const g = groupForRoute(state.route);
  if (g) state.openGroup = g;
  if (state.panelMode === 'person') { state.panelMode = 'messages'; state.panelOpen = false; }
  render();
  $('#page').scrollTop = 0;
}

/* Events --------------------------------------------------------- */

function openPanel(mode, arg = null) {
  state.panelOpen = true; state.panelMode = mode; state.panelArg = arg;
  render();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-group],[data-scroll],[data-go],[data-person],[data-act],[data-thread],[data-msg-filter],[data-cycle-filter],[data-sort],[data-cal],[data-message],[data-nav],#btn-menu,#btn-chat,#btn-notes,#panel-close,#panel-back,#scrim,#announce-prev,#announce-next,#announce-close,#btn-theme');
  if (!t) return;
  if (t.dataset.group) {
    const g = NAV.find((x) => x.id === t.dataset.group);
    const wasOpen = state.openGroup === g.id;
    if (state.navRail) { state.navRail = false; $('#app').classList.remove('nav-rail'); }
    if (wasOpen && groupForRoute(state.route) !== g.id) { state.openGroup = null; render(); return; }
    if (groupForRoute(state.route) === g.id) { state.openGroup = wasOpen ? null : g.id; render(); return; }
    state.openGroup = g.id; go(g.children[0].route); return;
  }
  if (t.dataset.scroll) { const sec = document.getElementById(t.dataset.scroll); if (sec) sec.scrollIntoView({ block: 'start' }); return; }
  if (t.dataset.go) { go(t.dataset.go); return; }
  if (t.hasAttribute('data-nav')) { return; } // plain anchor, hashchange handles it
  if (t.dataset.person) { state.panelReturn = state.panelMode === 'thread' ? state.panelArg : null; openPanel('person', t.dataset.person); return; }
  if (t.dataset.message) { const m = MESSAGES.find((x) => x.person === t.dataset.message) || MESSAGES[0]; openPanel('thread', m.id); return; }
  if (t.dataset.thread) { const m = MESSAGES.find((x) => x.id === t.dataset.thread); m.unread = false; openPanel('thread', m.id); return; }
  if (t.dataset.msgFilter) { state.msgFilter = t.dataset.msgFilter; render(); return; }
  if (t.dataset.cycleFilter) { state.cycleFilter = t.dataset.cycleFilter; render(); return; }
  if (t.dataset.sort) { const k = t.dataset.sort; state.leagueSort = state.leagueSort.key === k ? { key: k, dir: state.leagueSort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'name' || k === 'site' || k === 'rank' ? 'asc' : 'desc' }; render(); return; }
  if (t.dataset.cal) { state.calMonth = t.dataset.cal === 'today' ? new Date(TODAY.getFullYear(), TODAY.getMonth(), 1) : new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + Number(t.dataset.cal), 1); render(); return; }
  if (t.dataset.act) { doAction(t.dataset.act, t.dataset.id); return; }
  if (t.id === 'btn-menu') { state.navRail = !state.navRail; $('#app').classList.toggle('nav-rail', state.navRail); return; }
  if (t.id === 'btn-chat') { if (state.panelOpen && (state.panelMode === 'messages' || state.panelMode === 'thread')) { state.panelOpen = false; render(); } else openPanel('messages'); return; }
  if (t.id === 'btn-notes') { if (state.panelOpen && state.panelMode === 'notes') { state.panelOpen = false; render(); } else openPanel('notes'); return; }
  if (t.id === 'panel-close' || t.id === 'scrim') { state.panelOpen = false; render(); return; }
  if (t.id === 'panel-back') { if (state.panelMode === 'person' && state.panelReturn) { openPanel('thread', state.panelReturn); state.panelReturn = null; } else openPanel('messages'); return; }
  if (t.id === 'announce-prev') { state.announceIdx = (state.announceIdx + ANNOUNCEMENTS.length - 1) % ANNOUNCEMENTS.length; render(); return; }
  if (t.id === 'announce-next') { state.announceIdx = (state.announceIdx + 1) % ANNOUNCEMENTS.length; render(); return; }
  if (t.id === 'announce-close') { state.announceHidden = true; render(); return; }
  if (t.id === 'btn-theme') { toggleTheme(); return; }
});

document.addEventListener('input', (e) => {
  if (e.target.matches('[data-cycle-search]')) {
    state.cycleSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = $('[data-cycle-search]'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.panelOpen) { state.panelOpen = false; render(); }
  if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(e.target.tagName)) toggleTheme();
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); $('#search-input').focus(); }
});

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'light' : 'dark';
}

window.addEventListener('hashchange', onHashChange);
onHashChange();
