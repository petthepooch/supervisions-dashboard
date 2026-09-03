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
const NOW = new Date(2026, 8, 2, 14, 10);
const dtm = (s) => new Date(s.replace(' ', 'T'));
function ago(s) {
  const t = dtm(s); const mins = Math.round((NOW - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24 && t.getDate() === NOW.getDate()) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round((new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / DAY);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
const clock = (s) => dtm(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const lastMsg = (c) => c.thread[c.thread.length - 1];
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
    status = 'booked'; tone = 'accent'; label = `Booked ${fmt(d(current.booked))}`;
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
  const unreadNotifs = NOTIFICATIONS.filter((n) => !n.read).length;
  const q = quarterOf(TODAY);
  return {
    people, active, paused, q,
    compliance: active.length ? compliant / active.length : 1,
    compliantCount: compliant,
    signedOff: count('complete'), booked: count('booked'), drafting: count('drafting'), notBooked: count('not_booked'),
    overdue, review, atRisk, openFlags, decisions, unread, unreadNotifs,
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
  navArea: 'supervisions',
  role: 'rm',
  roleMenu: false,
  navAnim: null,
  trendRange: '12m',
  openMenu: null,
  attnFilter: 'all',
  msgTab: 'chats',
  contactSearch: '',
};

/* Navigation model ----------------------------------------------- */

/* Product areas. The top level lists areas; entering one swaps the nav
   for that area's own menu. Every route belongs to exactly one area. */
const AREAS = [
  { id: 'learning', label: 'Learning', icon: 'book', home: '/learning/courses', blurb: 'Courses, learners and assignments',
    sections: [{ label: 'Learning', items: [['Courses', '/learning/courses'], ['Learners', '/learning/learners'], ['Assignments', '/learning/assignments'], ['Reports', '/learning/reports']] }] },
  { id: 'competencies', label: 'Competencies', icon: 'award', home: '/competencies/frameworks', blurb: 'Frameworks, assessments and sign-offs',
    sections: [{ label: 'Competencies', items: [['Frameworks', '/competencies/frameworks'], ['Assessments', '/competencies/assessments'], ['Sign-offs', '/competencies/signoffs'], ['Reports', '/competencies/reports']] }] },
  { id: 'events', label: 'Events', icon: 'calendar', home: '/events/calendar', blurb: 'Training days, bookings and venues',
    sections: [{ label: 'Events', items: [['Calendar', '/events/calendar'], ['Bookings', '/events/bookings'], ['Venues', '/events/venues']] }] },
  { id: 'supervisions', label: 'Supervisions', icon: 'clipboard', home: '/dashboard', blurb: 'Supervision cycle, PDPs, safeguarding and reporting', badge: (s) => s.overdue.length + s.review.length + s.openFlags.length,
    sections: [
      { label: 'Supervise', items: [['Dashboard', '/dashboard'], ['Team supervisions', '/supervisions/team'], ['Supervision cycle', '/supervisions/cycle'], ['Allocation', '/supervisions/allocation'], ['New supervision', '/supervisions/new']] },
      { label: 'Develop', items: [['Team PDPs', '/development/pdps'], ['Probation reviews', '/development/probation']] },
      { label: 'Safeguard', items: [['Triage', '/safeguarding/triage', (s) => s.openFlags.length], ['Concerns log', '/safeguarding/log']] },
      { label: 'Report', items: [['Compliance', '/reports/compliance'], ['League table', '/reports/league'], ['Reporting suite', '/reports/suite']] },
    ] },
];
const areaForRoute = (route) => AREAS.find((ar) => ar.sections.some((sec) => sec.items.some(([, r]) => route === r || route.startsWith(r + '/'))));

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
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 8l9 6 9-6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  warnTri: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3l9-16zM12 10v4M12 17h.01"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15zM4 20.5A2.5 2.5 0 016.5 18H20"/></svg>',
  award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};
const ico = (n) => ICONS[n] || '';

/* Rendering: shell ----------------------------------------------- */

function renderNav(s) {
  const list = $('#nav-list');
  const area = AREAS.find((ar) => ar.id === state.navArea);
  const cur = areaForRoute(state.route);
  let html;
  if (!area) {
    html = `<li><a class="nav-item ${state.route === '/home' ? 'active' : ''}" href="#/home" data-nav>${ico('home').replace('<svg ', '<svg class="ico" ')}<span class="label">Home</span></a></li>
      <li class="nav-section-label show">Features</li>
      ${AREAS.map((ar) => { const badge = ar.badge ? ar.badge(s) : 0; return `<li><button class="nav-parent ${cur && cur.id === ar.id ? 'current' : ''}" data-area="${ar.id}">${ico(ar.icon).replace('<svg ', '<svg class="ico" ')}<span class="label">${ar.label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ''}${ico('chev')}</button></li>`; }).join('')}`;
  } else {
    html = `<li><button class="nav-back" id="nav-back">${ico('back')}<span>All features</span></button></li>
      <li class="nav-area-title">${ico(area.icon).replace('<svg ', '<svg class="ico" ')}<span>${area.label}</span></li>
      ${area.sections.map((sec) => `${area.sections.length > 1 ? `<li class="nav-section-label show">${sec.label}</li>` : ''}${sec.items.map(([label, route, badge]) => { const n = badge ? badge(s) : 0; return `<li><a class="nav-item ${state.route === route ? 'active' : ''}" href="#${route}" data-nav><span class="label">${label}</span>${n ? `<span class="nav-badge">${n}</span>` : ''}</a></li>`; }).join('')}`).join('')}`;
  }
  list.innerHTML = html;
  const promo = $('#promo'); if (promo && !promo.dataset.dismissed) promo.hidden = state.navArea !== 'supervisions';
  if (state.navAnim) { list.classList.remove('enter-forward', 'enter-back'); void list.offsetWidth; list.classList.add(state.navAnim); state.navAnim = null; }
}

function renderRole() {
  const r = ROLES.find((x) => x.id === state.role);
  $('#me-role').textContent = `${r.role} · ${r.site}`;
  const btn = $('#btn-role'); btn.setAttribute('aria-expanded', state.roleMenu);
  const menu = $('#role-menu'); menu.hidden = !state.roleMenu;
  menu.innerHTML = `<div class="menu-label">Switch role</div>${ROLES.map((x) => `<button role="menuitemradio" aria-checked="${x.id === state.role}" class="${x.id === state.role ? 'checked' : ''}" data-role="${x.id}"><span class="role-l"><strong>${esc(x.role)}</strong><span>${esc(x.site)} · ${esc(x.org)}</span></span>${x.id === state.role ? ico('check') : ''}</button>`).join('')}<div class="menu-sep"></div><button data-act="profile">Profile and settings</button><button data-act="signout">Sign out</button>`;
}

function renderTopbar(s) {
  renderRole();
  $('#btn-chat').classList.toggle('active', state.panelOpen && ['messages', 'thread', 'contacts'].includes(state.panelMode));
  $('#btn-notes').classList.toggle('active', state.panelOpen && state.panelMode === 'notes');
  $('#chat-dot').textContent = s.unread;
  $('#chat-dot').hidden = !s.unread;
  $('#btn-bell').classList.toggle('active', state.panelOpen && state.panelMode === 'notifications');
  $('#bell-dot').textContent = s.unreadNotifs;
  $('#bell-dot').hidden = !s.unreadNotifs;
  const a = $('#announce');
  a.hidden = state.announceHidden;
  const item = ANNOUNCEMENTS[state.announceIdx];
  $('#announce-text').innerHTML = `${esc(item.text)}<a href="#${item.href || '/dashboard'}" data-nav>${esc(item.more)}</a>`;
  $('#announce-count').textContent = `${state.announceIdx + 1} of ${ANNOUNCEMENTS.length}`;
}

/* Rendering: shared components ----------------------------------- */

/* Avatar: a photo when one exists, otherwise initials on a tinted disc. */
const avatar = (p, cls = '') => {
  const src = typeof AVATARS !== 'undefined' && AVATARS[p.id];
  return `<span class="avatar ${cls} ${src ? 'has-photo' : ''}" style="--h:${p.hue}">${src ? `<img src="${src}" alt="" loading="lazy">` : (p.initials || initials(p.name))}</span>`;
};
const personBtn = (p, extra = '') => `<button data-person="${p.id}">${esc(p.name)}</button>${extra}`;
const statusPill = (p) => `<span class="pill ${p.tone}">${esc(p.label)}</span>`;

/* Segmented filter: dot (status colour), label, count. `attr` is the
   data attribute the click handler listens for. */
function segFilters(items, active, attr) {
  return `<div class="seg filters-seg" role="tablist">${items.map((it) => `<button role="tab" class="${active === it.key ? 'active' : ''}" data-${attr}="${it.key}" ${it.count === 0 && it.key !== 'all' ? 'disabled' : ''}>${it.tone ? `<i class="dot ${it.tone}"></i>` : ''}${it.label}<span class="n">${it.count}</span></button>`).join('')}</div>`;
}

function sectionTabs(tabs) {
  return `<nav class="section-tabs" aria-label="Sections"><ul>
    ${tabs.map((t) => `<li><button data-scroll="${t.id}">${t.label}${t.count != null ? `<span class="tab-count ${t.tone || ''}">${t.count}</span>` : ''}</button></li>`).join('')}
  </ul></nav>`;
}

function pageHead(title, lede, actions = '', date = true) {
  return `<header class="page-head">
    <div>${date ? `<p class="eyebrow">${fmtLong(TODAY)}</p>` : ''}<h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>
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
    why: `Submitted ${fmt(d(p.current.submitted))}. Sign off → ${pct((s.compliantCount + 1) / s.active.length)} compliance.`,
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
  const kindIcon = { Chase: 'mail', 'Sign off': 'check', Decision: 'calendar', Safeguarding: 'shield', Report: 'download' };
  return `<div class="focus">${cards.slice(0, 4).map((c) => `
    <button class="focus-card ${c.tone}" ${c.action}>
      <div class="title">${esc(c.title)}</div>
      <div class="why">${esc(c.why)}</div>
      <div class="foot">${c.pill.replace(/^<span class="pill ([^"]*)">/, (m, cls) => `<span class="pill ${cls} has-ico">${ico(kindIcon[c.kind] || 'tasks')}`)}<span class="cta">${c.cta}${ico('arrow')}</span></div>
    </button>`).join('')}</div>`;
}

function sparkline(values, cls = '') {
  // 12-point sparkline; the last point is the current period and gets a dot.
  const W = 220, H = 30, P = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i) => P + (i * (W - 2 * P)) / (values.length - 1);
  const y = (v) => max === min ? H / 2 : P + (1 - (v - min) / (max - min)) * (H - 2 * P);
  const dpath = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="l ${cls}" d="${dpath}"/><circle class="e ${cls}" cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="4"/></svg>`;
}
function flatline() {
  return `<svg viewBox="0 0 220 30" preserveAspectRatio="none" aria-hidden="true"><line class="dash" x1="4" y1="15" x2="216" y2="15"/></svg>`;
}

/* Stats strip: three cards, one shape each: label, number, one line of
   context, one bar, two captions. Every figure comes from derive(). */
function statsRow(s) {
  const total = s.active.length;
  const target = 0.9;
  const byStatus = (...st) => s.active.filter((p) => st.includes(p.status));
  const segs = [
    { label: 'Signed off', short: 'signed', people: byStatus('complete'), fill: 'good' },
    { label: 'Booked', short: 'booked', people: byStatus('booked'), fill: 'accent' },
    { label: 'Drafting', short: 'drafting', people: byStatus('drafting'), fill: 'warn' },
    { label: 'Awaiting you', short: 'awaiting', people: byStatus('review'), fill: 'info' },
    { label: 'Not booked', short: 'unbooked', people: byStatus('not_booked'), fill: 'muted' },
    { label: 'Overdue', short: 'overdue', people: byStatus('overdue'), fill: 'danger', danger: true },
  ];
  const sum = segs.reduce((n, g) => n + g.people.length, 0);
  console.assert(sum === total, `Supervision states do not sum to total: ${sum} vs ${total}`);
  const tip = (g) => [`${g.label} (${g.people.length})`, ...g.people.map((p) => `${p.name} · ${p.label}`)].join('|');

  // Next 14 days: records due soon that are not yet signed off.
  const HORIZON = 14;
  const soon = s.active.filter((p) => !['complete', 'review', 'overdue'].includes(p.status) && p.daysToDue >= 0 && p.daysToDue <= HORIZON).sort((x, y) => x.due - y.due);
  const horizonEnd = addDays(TODAY, HORIZON);

  const pdpTotal = s.people.reduce((n, p) => n + p.pdp.objectives, 0), pdpDone = s.people.reduce((n, p) => n + p.pdp.complete, 0);
  const pdpDue = s.people.filter((p) => d(p.pdp.review) <= addDays(TODAY, 30)).length;
  const card = (label, num, unit, sub, foot, attr = '') => `<button class="scard" ${attr}>
    <div class="slabel">${label}</div>
    <div class="shead"><span class="snum num">${num}</span>${unit ? `<span class="sunit">${unit}</span>` : ''}</div>
    <div class="ssub">${sub}</div>
    <div class="sfoot">${foot}</div>
  </button>`;

  return `<div class="strip">
    ${card('Compliance', total ? pct(s.compliance) : '—', '', `${s.compliantCount} of ${total} in date`,
      `<div class="sbar" role="img" aria-label="${pct(s.compliance)} compliant against a ${Math.round(target * 100)}% target"><i class="fill" style="width:${s.compliance * 100}%"></i><i class="mark" style="left:${target * 100}%"></i></div>
       <div class="scap"><span>Now</span><span>Target ${Math.round(target * 100)}%</span></div>`, 'data-scroll="trend"')}
    ${card('This quarter', total, 'due', `${s.signedOff} signed off, ${total - s.signedOff} still to close`,
      `<div class="sbar stack" role="img" aria-label="${segs.filter((g) => g.people.length).map((g) => `${g.people.length} ${g.label.toLowerCase()}`).join(', ')}">${segs.filter((g) => g.people.length).map((g) => `<i class="${g.fill}" style="flex:${g.people.length}" data-tip="${esc(tip(g))}"></i>`).join('')}</div>
       <div class="scap"><span class="segcap">${segs.filter((g) => g.people.length).map((g) => `<span class="${g.danger ? 'danger' : g.fill}"><b class="num">${g.people.length}</b> ${g.short}</span>`).join('<span class="sep">·</span>')}</span></div>`, 'data-scroll="cycle"')}
    ${card('Next 14 days', soon.length, 'due', soon.length ? `${soon.map((p) => p.name.split(' ')[0]).join(', ')} ${soon.length === 1 ? 'is' : 'are'} due before ${fmt(horizonEnd)}` : `Nothing falls due before ${fmt(horizonEnd)}`,
      `<div class="sbar timeline" role="img" aria-label="${soon.length ? soon.map((p) => `${p.name} due ${fmt(p.due)}`).join(', ') : 'Nothing due in the next 14 days'}">
         <i class="today"></i>
         ${soon.map((p) => `<i class="due ${p.tone}" style="left:${(p.daysToDue / HORIZON) * 100}%" data-tip="${esc(`${p.name}|${p.type} · ${p.status === 'booked' ? 'booked' : p.status === 'drafting' ? 'drafting' : 'not booked'}|Due ${fmt(p.due, { weekday: 'short', day: 'numeric', month: 'short' })} · in ${plural(p.daysToDue, 'day')}`)}"></i>`).join('')}
       </div>
       <div class="scap"><span>Today</span><span>${HORIZON} days</span></div>`, 'data-scroll="calendar"')}
  </div>
  <div class="strip-foot"><span>PDP objectives <b class="num">${pdpDone} of ${pdpTotal}</b> · ${pdpDue} reviews due in 30 days</span><a href="#/development/pdps" data-nav>View PDPs ${ico('arrow')}</a></div>`;
}

/* Hover tooltip for any element carrying data-tip ("title|line|line"). */
function uiTip(e) {
  const el = e.target.closest && e.target.closest('[data-tip]');
  let tipEl = $('#ui-tip');
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'ui-tip'; tipEl.className = 'ui-tip'; document.body.appendChild(tipEl); }
  if (!el) { tipEl.classList.remove('on'); return; }
  const [title, ...lines] = el.dataset.tip.split('|');
  tipEl.innerHTML = `<b>${esc(title)}</b>${lines.map((l) => `<span>${esc(l)}</span>`).join('')}`;
  const r = el.getBoundingClientRect();
  tipEl.style.left = `${r.left + r.width / 2}px`; tipEl.style.top = `${r.top}px`;
  tipEl.classList.add('on');
}
document.addEventListener('pointermove', uiTip);

const pdpProgress = (s) => { const t = s.people.reduce((n, p) => n + p.pdp.objectives, 0); const c = s.people.reduce((n, p) => n + p.pdp.complete, 0); return t ? c / t : 0; };

function attentionIntro(s) {
  const good = s.gap === 0;
  const early = [s.decisions.length ? plural(s.decisions.length, 'decision') : '', s.atRisk.length ? `${s.atRisk.length} due soon` : ''].filter(Boolean).join(' and ');
  const title = good ? 'Team is fully compliant' : `${s.gap === 1 ? 'One record is' : `${['Two', 'Three', 'Four'][s.gap - 2] || s.gap} records are`} holding compliance below 100%`;
  const sub = (good ? 'Nothing is overdue or waiting on you.' : [s.overdue.length ? plural(s.overdue.length, 'overdue supervision') : '', s.review.length ? `${s.review.length} awaiting your sign off` : ''].filter(Boolean).join(' and ') + '. Closing these takes the team to 100%.') + (early ? ` ${early.charAt(0).toUpperCase() + early.slice(1)} ${(s.decisions.length + s.atRisk.length) === 1 ? 'is an' : 'are'} early warning${(s.decisions.length + s.atRisk.length) === 1 ? '' : 's'}.` : '');
  return `<div class="card-head">
    <div><h3>${title}</h3><div class="sub">${sub}</div></div>
    ${s.overdue.length ? `<button class="btn sm secondary" data-act="${s.overdue.length > 1 ? 'chase-all' : 'chase'}" data-id="${s.overdue[0].id}">${ico('mail')} Chase ${s.overdue.length > 1 ? `all overdue (${s.overdue.length})` : s.overdue[0].name.split(' ')[0]}</button>` : ''}
  </div>`;
}

function attentionFilters(s) {
  const total = s.overdue.length + s.review.length + s.decisions.length + s.atRisk.length;
  const items = [
    { key: 'all', label: 'All', count: total },
    { key: 'overdue', label: 'Overdue', count: s.overdue.length, tone: 'crit' },
    { key: 'review', label: 'To sign off', count: s.review.length, tone: 'info' },
    { key: 'decision', label: 'Decisions', count: s.decisions.length, tone: 'warn' },
    { key: 'soon', label: 'Due soon', count: s.atRisk.length, tone: 'muted' },
  ];
  const shown = state.attnFilter === 'all' ? total : (items.find((i) => i.key === state.attnFilter) || {}).count || 0;
  return `<div class="toolbar">${segFilters(items, state.attnFilter, 'attn-filter')}<span class="toolbar-note">Showing ${shown} of ${total}</span></div>`;
}

/* Actions available for a person, by what their record needs. */
function personActions(p) {
  if (p.status === 'overdue') return [['chase', 'Send chase'], ['book', 'Book now'], ['note', 'Add note'], ['message', 'Message ' + p.name.split(' ')[0]]];
  if (p.status === 'review') return [['signoff', 'Sign off record'], ['open', 'Open record'], ['note', 'Add note'], ['message', 'Message ' + p.name.split(' ')[0]]];
  if (p.paused) return [['rejoin', 'Book return supervision'], ['extend', 'Extend leave'], ['note', 'Add note']];
  if (['booked', 'drafting', 'not_booked'].includes(p.status)) return [['book', p.status === 'booked' ? 'Rebook' : 'Book supervision'], ['chase', 'Send reminder'], ['note', 'Add note'], ['message', 'Message ' + p.name.split(' ')[0]]];
  return [['note', 'Add note'], ['message', 'Message ' + p.name.split(' ')[0]]];
}

function actionsMenu(p) {
  const open = state.openMenu === p.id;
  return `<div class="menu-wrap" data-menu-wrap>
    <button class="btn sm secondary" data-person="${p.id}">View</button>
    <button class="btn sm primary" data-menu="${p.id}" aria-haspopup="menu" aria-expanded="${open}">Actions ${ico('chevDown')}</button>
    ${open ? `<div class="menu" role="menu">${personActions(p).map(([act, label], i) => `<button role="menuitem" class="${i === 0 ? 'lead' : ''}" data-act="${act}" data-id="${p.id}">${esc(label)}</button>`).join('')}</div>` : ''}
  </div>`;
}

function attentionCard(s) {
  const rows = [];
  s.overdue.forEach((p) => rows.push({ k: 'overdue', html: `<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill crit">${esc(p.label)}</span></div>
      <div class="meta"><span>${esc(p.type)}</span><span>Was due ${fmt(p.due, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="${p.chases.length >= 3 ? 'crit' : ''}">${plural(p.chases.length, 'chase')}${p.chases.length ? `, last ${fmt(d(p.chases[p.chases.length - 1]))}${p.lastChaseRead === false ? ' (unread)' : ''}` : ''}</span></div></div>
    ${actionsMenu(p)}
  </div>` }));
  s.review.forEach((p) => rows.push({ k: 'review', html: `<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill info">Awaiting your sign off</span></div>
      <div class="meta"><span>${esc(p.type)}</span><span>Held ${fmt(d(p.current.held))}, submitted ${fmt(d(p.current.submitted))}</span><span class="warn">Blocked on you, not on ${p.name.split(' ')[0]}</span></div></div>
    ${actionsMenu(p)}
  </div>` }));
  s.decisions.forEach((p) => rows.push({ k: 'decision', html: `<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill warn">Decision due ${fmt(d(p.paused.decisionDue))}</span></div>
      <div class="meta"><span>${esc(p.paused.reason)} since ${fmt(d(p.paused.since))}</span><span>Excluded from compliance while paused</span></div></div>
    ${actionsMenu(p)}
  </div>` }));
  s.atRisk.forEach((p) => rows.push({ k: 'soon', html: `<div class="attn-row">
    ${avatar(p)}
    <div class="who"><div class="name">${personBtn(p)} <span class="pill ${p.tone}">${esc(p.label)}</span></div>
      <div class="meta"><span>${esc(p.type)}</span><span class="warn">Due in ${plural(p.daysToDue, 'day')} (${fmt(p.due)})</span><span>No action needed unless the booking slips</span></div></div>
    ${actionsMenu(p)}
  </div>` }));
  const shown = state.attnFilter === 'all' ? rows : rows.filter((r) => r.k === state.attnFilter);
  return `<div class="card">
    ${attentionIntro(s)}
    ${attentionFilters(s)}
    ${shown.length ? shown.map((r) => r.html).join('') : rows.length ? `<div class="attn-empty"><strong>Nothing in this filter</strong>Choose another filter or All.</div>` : `<div class="attn-empty"><strong>Nothing needs you right now</strong>Every active team member is in date and nothing is waiting for sign off.</div>`}
  </div>`;
}

function safeguardingBanner(s) {
  if (!s.openFlags.length) return '';
  const f = s.openFlags[0]; const p = byId(f.person);
  return `<div class="alert ${f.severity === 'high' ? 'crit' : ''}">
    <div class="ico">${ico('shield')}</div>
    <div class="txt"><strong>Safeguarding: ${esc(f.title)}</strong><span>Raised ${fmt(d(f.raised))} from ${esc(p.name)}'s supervision. ${plural(s.openFlags.length, 'open flag')}. Triage decision outstanding.</span></div>
    <button class="btn sm critical" data-go="/safeguarding/triage">Open triage ${ico('arrow')}</button>
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

  const items = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'action', label: 'Needs action', count: counts.action, tone: 'warn' },
    { key: 'overdue', label: 'Overdue', count: counts.overdue, tone: 'crit' },
    { key: 'complete', label: 'Signed off', count: counts.complete, tone: 'good' },
  ];
  return `<div class="card">
    <div class="card-head">
      <div><h3>Supervision cycle</h3><div class="sub">${s.q.fy}. One supervision per quarter and no more than 12 weeks apart.</div></div>
      <button class="btn sm secondary" data-act="export">${ico('download')} Export</button>
    </div>
    <div class="toolbar">
      ${segFilters(items, state.cycleFilter, 'cycle-filter')}
      <label class="mini-search">${ico('search')}<input type="search" placeholder="Search team" value="${esc(state.cycleSearch)}" data-cycle-search aria-label="Search team"></label>
    </div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Team member</th>${qs.map((q) => `<th class="${q.current ? 'here' : ''}">${q.label}${q.current ? '<small>You are here</small>' : ''}</th>`).join('')}${compact ? '' : '<th>Next due</th>'}</tr></thead>
      <tbody>${people.map((p) => `<tr>
        <td><div class="person">${avatar(p, 'sm')}<div>${personBtn(p)}<small>${esc(p.role)}${p.probation ? ' · probation' : ''}</small></div></div></td>
        ${qs.map((q) => `<td class="${q.current ? 'here' : ''}">${quarterCell(p, q)}</td>`).join('')}
        ${compact ? '' : `<td class="num">${p.paused ? '<span style="color:var(--ink-3)">Paused</span>' : `${fmt(p.due, { day: 'numeric', month: 'short', year: 'numeric' })}${p.status !== 'complete' ? ` <span style="color:var(--ink-3)">(${p.daysToDue < 0 ? `${-p.daysToDue}d ago` : `in ${p.daysToDue}d`})</span>` : ''}`}</td>`}
      </tr>`).join('') || `<tr><td colspan="6" class="empty">No one matches that filter.</td></tr>`}</tbody>
    </table></div>
    <div class="legend"><span><i class="good"></i>Signed off</span><span><i class="accent"></i>Booked</span><span><i class="info"></i>Awaiting sign off</span><span><i class="warn"></i>Drafting or not booked</span><span><i class="crit"></i>Overdue or missed</span><span><i class="muted"></i>Paused or future</span></div>
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
      <thead><tr>${th('rank', 'Rank')}${th('name', 'Manager')}${th('site', 'Site')}${th('team', 'Team', 'r')}${th('compliance', 'Team compliance', 'r')}${th('onTime', 'On time', 'r')}</tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.live ? 'is-me' : ''}">
        <td class="rank num ${r.live ? 'you' : ''}">${r.rank}</td>
        <td><span class="mgr">${esc(r.name)}</span>${r.live ? ' <span class="pill accent plain" style="margin-left:6px">You</span>' : ''}</td>
        <td>${esc(r.site)}</td>
        <td class="r num">${r.team}</td>
        <td class="r"><span class="pill plain ${r.compliance >= 0.9 ? 'good' : r.compliance >= 0.75 ? 'warn' : 'crit'}">${pct(r.compliance)}</span></td>
        <td class="r"><span class="pill plain ${r.onTime >= 0.9 ? 'good' : r.onTime >= 0.75 ? 'warn' : 'crit'}">${pct(r.onTime)}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

/* Calendar ------------------------------------------------------- */

function calendarEvents(s) {
  const ev = [];
  s.people.forEach((p) => {
    p.history.forEach((h) => {
      if (h.signedOff) ev.push({ date: d(h.signedOff), tone: 'good', text: `${p.name.split(' ')[0]} signed off`, what: `${h.type} signed off`, id: p.id });
      else if (h.submitted) ev.push({ date: d(h.submitted), tone: 'info', text: `${p.name.split(' ')[0]} submitted`, what: `${h.type} submitted, awaiting sign off`, id: p.id });
      else if (h.booked) ev.push({ date: d(h.booked), tone: d(h.booked) < TODAY ? 'crit' : 'accent', text: `${p.name.split(' ')[0]} ${d(h.booked) < TODAY ? 'missed' : 'booked'}`, what: `${h.type} ${d(h.booked) < TODAY ? 'booked but not held' : 'booked'}`, id: p.id });
    });
    if (!p.paused && p.status !== 'complete' && p.status !== 'booked') ev.push({ date: p.due, tone: p.due < TODAY ? 'crit' : 'warn', text: `${p.name.split(' ')[0]} due`, what: `${p.type} ${p.due < TODAY ? 'was due' : 'due'}`, id: p.id });
    if (p.paused && p.paused.decisionDue) ev.push({ date: d(p.paused.decisionDue), tone: 'warn', text: `${p.name.split(' ')[0]} decision`, what: `Return-to-work decision due`, id: p.id });
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
    const weekend = dt.getDay() === 0 || dt.getDay() === 6;
    cells.push(`<button class="cal-day ${isToday ? 'today' : ''} ${dt < TODAY ? 'past' : ''} ${weekend ? 'weekend' : ''}" ${todays.length === 1 ? `data-person="${todays[0].id}"` : ''} aria-label="${fmt(dt, { weekday: 'long', day: 'numeric', month: 'long' })}${todays.length ? ', ' + todays.map((e) => e.text).join(', ') : ''}">
      <span class="n">${day}</span>
      ${todays.slice(0, 3).map((e) => `<span class="cal-ev ${e.tone}" data-tip="${esc(`${byId(e.id).name}|${e.what}|${fmt(dt, { weekday: 'long', day: 'numeric', month: 'long' })}`)}">${esc(e.text)}</span>`).join('')}
      ${todays.length > 3 ? `<span class="cal-more">+${todays.length - 3} more</span>` : ''}
    </button>`);
  }
  // Pad the tail so the grid always ends on a Sunday.
  while (cells.length % 7 !== 0) cells.push('<div class="cal-day pad"></div>');
  const isCurrent = m.getMonth() === TODAY.getMonth() && m.getFullYear() === TODAY.getFullYear();
  return `<div class="card cal">
    <div class="cal-head">
      <div class="cal-title"><h3>${m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3><span class="sub">${plural(events.length, 'supervision event')} this month</span></div>
      <div class="nav-btns"><button class="btn xs secondary" data-cal="today" ${isCurrent ? 'disabled' : ''}>Today</button><button class="icon-btn" data-cal="-1" aria-label="Previous month">${ico('left')}</button><button class="icon-btn" data-cal="1" aria-label="Next month">${ico('right')}</button></div>
    </div>
    <div class="cal-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => `<div class="cal-dow">${x}</div>`).join('')}${cells.join('')}</div>
    <div class="legend"><span><i class="good"></i>Signed off</span><span><i class="info"></i>Submitted</span><span><i class="accent"></i>Booked</span><span><i class="warn"></i>Due or decision</span><span><i class="crit"></i>Overdue or missed</span></div>
  </div>`;
}

/* Trend chart ---------------------------------------------------- */

function trendSeries(s) {
  const all = [...TREND, { m: 'Sep', y: 2026, v: s.compliance, live: true }];
  if (state.trendRange === '6m') return all.slice(-6);
  if (state.trendRange === 'fy') return all.filter((p) => p.y === 2026 && ['Jul', 'Aug', 'Sep'].includes(p.m));
  return all;
}

function trendCard(s) {
  const pts = trendSeries(s);
  const target = 0.9;
  const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last;
  const delta = Math.round((last.v - prev.v) * 100);
  const below = pts.filter((p) => p.v < target).length;
  const best = pts.reduce((m, p) => (p.v > m.v ? p : m), pts[0]);
  const seg = (k, l) => `<button class="${state.trendRange === k ? 'active' : ''}" data-range="${k}">${l}</button>`;
  return `<div class="card trend">
    <div class="trend-head">
      <div><span class="k">Team compliance ${ico('chevR')}</span>
        <div class="big num">${pct(s.compliance)}<small>today</small><span class="delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta === 0 ? `Unchanged since ${prev.m}` : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)} pts on ${prev.m}`}</span></div></div>
      <div class="seg">${seg('6m', '6m')}${seg('12m', '12m')}${seg('fy', s.q.fy.replace('FY ', 'FY'))}</div>
    </div>
    <div class="trend-plot" data-trend><div class="tip" id="trend-tip"></div></div>
    <div class="trend-foot"><span class="key"><i></i>Share of active staff in date at month end</span><span class="key"><i class="t"></i>Target 90%</span><span>Best <b>${pct(best.v)}</b> in ${best.m}</span><span>Below target <b>${below}</b> of ${pts.length} months</span></div>
  </div>`;
}

/* The SVG is drawn with one unit per CSS pixel, so labels are real
   12px text rather than scaling with the card. Redrawn on resize. */
function drawTrend(plot) {
  const s = derive();
  const pts = trendSeries(s);
  const W = Math.max(320, Math.round(plot.clientWidth - 48)), H = 220, L = 40, R = 52, T = 14, B = 30;
  const lo = 0.5, hi = 1, target = 0.9;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, pts.length - 1);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const P = pts.map((p, i) => [x(i), y(p.v)]);
  let dpath = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1]; const cx = (x1 - x0) / 2;
    dpath += ` C${(x0 + cx).toFixed(1)},${y0.toFixed(1)} ${(x1 - cx).toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const area = `${dpath} L${P[P.length - 1][0].toFixed(1)},${y(lo)} L${P[0][0].toFixed(1)},${y(lo)} Z`;
  const last = pts[pts.length - 1];
  const step = (W - L - R) / Math.max(1, pts.length - 1);
  const old = plot.querySelector('svg'); if (old) old.remove();
  plot.insertAdjacentHTML('beforeend', `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Team compliance by month">
    <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bar)" stop-opacity="0.16"/><stop offset="1" stop-color="var(--bar)" stop-opacity="0"/></linearGradient></defs>
    ${[0.5, 0.75, 1].map((g) => `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 8}" y="${y(g) + 4}" text-anchor="end">${Math.round(g * 100)}%</text>`).join('')}
    <line class="target" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/><text class="tg" x="${W - R + 8}" y="${y(target) + 4}">Target</text>
    <path class="area" d="${area}"/><path class="line" d="${dpath}"/>
    <line class="xh" id="trend-xh" x1="0" x2="0" y1="${T}" y2="${H - B + 6}"/>
    ${pts.map((p, i) => `<circle class="pt ${p.live ? 'end' : ''}" data-i="${i}" cx="${x(i)}" cy="${y(p.v)}" r="4"/>`).join('')}
    <text class="lbl" x="${x(pts.length - 1) + 9}" y="${y(last.v) + 4}">${pct(last.v)}</text>
    ${pts.map((p, i) => `<text class="x" data-i="${i}" x="${x(i)}" y="${H - 8}" text-anchor="middle">${p.m}${p.m === 'Jan' ? ` ${String(p.y).slice(2)}` : ''}</text>`).join('')}
    ${pts.map((p, i) => `<rect class="hit" data-i="${i}" x="${x(i) - step / 2}" y="0" width="${step}" height="${H}"/>`).join('')}
  </svg>`);
}
const trendObserver = new ResizeObserver((entries) => entries.forEach((en) => drawTrend(en.target)));
function mountTrends() {
  trendObserver.disconnect();
  $$('[data-trend]').forEach((plot) => { drawTrend(plot); trendObserver.observe(plot); });
}

function trendHover(e) {
  const hit = e.target.closest('.trend .hit');
  const card = e.target.closest('.trend');
  const tip = card && card.querySelector('#trend-tip');
  if (!card) return;
  const pts = trendSeries(derive());
  card.querySelectorAll('.pt.on, .x.on, .xh.on').forEach((el) => el.classList.remove('on'));
  if (!hit) { tip && tip.classList.remove('on'); return; }
  const i = Number(hit.dataset.i); const p = pts[i];
  const dot = card.querySelector(`.pt[data-i="${i}"]`); const xl = card.querySelector(`.x[data-i="${i}"]`); const xh = card.querySelector('#trend-xh');
  dot.classList.add('on'); xl.classList.add('on');
  xh.setAttribute('x1', dot.getAttribute('cx')); xh.setAttribute('x2', dot.getAttribute('cx')); xh.classList.add('on');
  const svgRect = card.querySelector('svg').getBoundingClientRect(); const plot = card.querySelector('.trend-plot').getBoundingClientRect();
  const dr = dot.getBoundingClientRect();
  tip.style.left = `${dr.left + dr.width / 2 - plot.left}px`; tip.style.top = `${dr.top - plot.top}px`;
  tip.innerHTML = `<b>${pct(p.v)}</b><span>${p.m} ${p.y}${p.live ? ' · today' : ''}</span>`;
  tip.classList.add('on');
}
document.addEventListener('pointermove', trendHover);
document.addEventListener('pointerleave', trendHover, true);

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
      <div class="section-head" style="margin-top:40px"><h2>Your focus</h2><span class="sub">Ordered by what unblocks compliance first</span></div>
      ${focusCards(s)}
      <div class="section-head" style="margin-top:64px"><h2>Your team</h2><span class="sub">Live from the team's records</span></div>
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

function pageHome(s) {
  const counts = { supervisions: `${plural(s.openActions, 'open action')} · ${pct(s.compliance)} compliance`, learning: '4 courses due this month', competencies: '2 assessments awaiting sign-off', events: '3 training days booked' };
  return `${pageHead(`${greeting()}, ${ME.firstName}`, 'Choose a feature to get started.', '', true)}
    <div class="section" style="padding-top:8px"><div class="launcher">
      ${AREAS.map((ar) => `<button class="launch-card" data-area-go="${ar.id}">
        <span class="tile">${ico(ar.icon)}</span>
        <span class="title">${ar.label}</span>
        <span class="why">${ar.blurb}</span>
        <span class="foot"><span class="meta">${counts[ar.id] || ''}</span><span class="cta">Open ${ico('arrow')}</span></span>
      </button>`).join('')}
    </div></div>`;
}

function pageStub(area, label) {
  return (s) => `${pageHead(label, `${area.label}. This part of myAko is not built in the prototype; it is here so the navigation can be tried end to end.`, '', false)}
    <div class="section" style="padding-top:8px"><div class="card"><div class="empty"><h3>${esc(label)}</h3>Placeholder page in the ${esc(area.label)} area.</div></div></div>`;
}

const ROUTES = {
  '/home': pageHome,
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
AREAS.forEach((ar) => ar.sections.forEach((sec) => sec.items.forEach(([label, route]) => { if (!ROUTES[route]) ROUTES[route] = pageStub(ar, label); })));

/* Side panel ----------------------------------------------------- */

function renderPanel(s) {
  const app = $('#app');
  app.classList.toggle('panel-open', state.panelOpen);
  const head = $('#panel-title'), body = $('#panel-body'), back = $('#panel-back');
  back.hidden = !(state.panelMode === 'thread' || (state.panelMode === 'person' && state.panelReturn));
  if (state.panelMode === 'messages') {
    head.innerHTML = `Messages ${s.unread ? `<span class="pill accent plain">${s.unread} unread</span>` : ''}`;
    const tabs = `<div class="seg panel-seg"><button class="${state.msgTab === 'chats' ? 'active' : ''}" data-msg-tab="chats">Chats${s.unread ? `<span class="n">${s.unread}</span>` : ''}</button><button class="${state.msgTab === 'contacts' ? 'active' : ''}" data-msg-tab="contacts">Contacts<span class="n">${TEAM.length}</span></button></div>`;
    if (state.msgTab === 'chats') {
      let list = [...MESSAGES].sort((x, y) => dtm(lastMsg(y).at) - dtm(lastMsg(x).at));
      if (state.msgFilter === 'unread') list = list.filter((m) => m.unread);
      body.innerHTML = `<div class="msg-tools">${tabs}<div class="msg-filters"><button class="chip ${state.msgFilter === 'all' ? 'active' : ''}" data-msg-filter="all">All</button><button class="chip ${state.msgFilter === 'unread' ? 'active' : ''}" data-msg-filter="unread">Unread</button></div></div>
        ${list.map((m) => { const p = byId(m.person); const last = lastMsg(m); return `<button class="msg ${m.unread ? 'unread' : ''}" data-thread="${m.id}"><span class="av-wrap">${avatar(p)}<i class="presence ${PRESENCE[p.id] || 'offline'}"></i></span><div><div class="when"><span>${ago(last.at)}</span>${m.unread ? '<span class="unread-dot"></span>' : ''}</div><div class="h"><strong>${esc(p.name)}</strong></div><div class="role">${esc(p.role)}</div><div class="t">${last.from === 'me' ? 'You: ' : ''}${esc(last.text)}</div></div></button>`; }).join('') || '<div class="empty">No unread messages.</div>'}`;
    } else {
      const q = state.contactSearch.toLowerCase();
      const contacts = [...TEAM].filter((p) => !q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)).sort((x, y) => x.name.localeCompare(y.name));
      const label = { online: 'Online', away: 'Away', offline: 'Offline', leave: 'On leave' };
      body.innerHTML = `<div class="msg-tools">${tabs}<label class="mini-search wide">${ico('search')}<input type="search" placeholder="Search contacts" value="${esc(state.contactSearch)}" data-contact-search aria-label="Search contacts"></label></div>
        ${contacts.map((p) => `<button class="contact" data-message="${p.id}"><span class="av-wrap">${avatar(p)}<i class="presence ${PRESENCE[p.id] || 'offline'}"></i></span><div class="who"><strong>${esc(p.name)}</strong><span>${esc(p.role)} · ${label[PRESENCE[p.id]] || 'Offline'}</span></div>${ico('chevR')}</button>`).join('') || '<div class="empty">No one matches.</div>'}`;
    }
  } else if (state.panelMode === 'thread') {
    let m = MESSAGES.find((x) => x.id === state.panelArg);
    if (!m && String(state.panelArg).startsWith('new:')) {
      const pid = state.panelArg.slice(4);
      m = { id: 'c' + (MESSAGES.length + 1), person: pid, unread: false, thread: [] };
      MESSAGES.push(m); state.panelArg = m.id;
    }
    const p = byId(m.person);
    head.innerHTML = `Conversation`;
    let lastDay = '';
    const bubbles = m.thread.map((b) => {
      const day = dtm(b.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const sep = day !== lastDay ? `<div class="day-sep"><span>${day}</span></div>` : ''; lastDay = day;
      return `${sep}<div class="bubble ${b.from}">${esc(b.text)}<time>${clock(b.at)}</time></div>`;
    }).join('');
    body.innerHTML = `<div class="thread"><div class="thread-head"><span class="av-wrap">${avatar(p)}<i class="presence ${PRESENCE[p.id] || 'offline'}"></i></span><div class="who"><strong>${esc(p.name)}</strong><span>${esc(p.role)} · ${esc(p.site)}</span></div><button class="btn xs secondary" style="margin-left:auto" data-person="${p.id}">Profile</button></div>
      <div class="thread-body" id="thread-body">${bubbles || `<div class="empty">No messages yet. Say hello to ${esc(p.name.split(' ')[0])}.</div>`}</div>
      <div class="thread-compose"><div class="ctl"><input id="thread-input" placeholder="Message ${esc(p.name.split(' ')[0])}" aria-label="Message" autocomplete="off"></div><button class="btn sm primary" data-act="send-reply" data-id="${m.id}">Send</button></div></div>`;
    const tb = $('#thread-body'); if (tb) tb.scrollTop = tb.scrollHeight;
  } else if (state.panelMode === 'notifications') {
    head.innerHTML = `Notifications ${s.unreadNotifs ? `<span class="pill accent plain">${s.unreadNotifs} new</span>` : ''}`;
    const icon = { message: 'chat', chase: 'mail', decision: 'calendar', safeguarding: 'shield', submit: 'clipboard', signed: 'check', system: 'info' };
    const groups = [['Today', (n) => dtm(n.at).toDateString() === NOW.toDateString()], ['Earlier', (n) => dtm(n.at).toDateString() !== NOW.toDateString()]];
    body.innerHTML = `<div class="msg-tools"><span class="toolbar-note">${s.unreadNotifs ? `${s.unreadNotifs} unread` : 'All caught up'}</span>${s.unreadNotifs ? `<button class="btn xs ghost" id="notif-readall">Mark all as read</button>` : ''}</div>
      ${groups.map(([label, test]) => { const items = NOTIFICATIONS.filter(test); return items.length ? `<div class="group-label">${label}</div>${items.map((n) => `<button class="notif ${n.read ? '' : 'unread'}" data-notif="${n.id}"><span class="tile round ${n.tone}">${ico(icon[n.kind] || 'info')}</span><div><div class="when"><span>${ago(n.at)}</span>${n.read ? '' : '<span class="unread-dot"></span>'}</div><strong>${esc(n.title)}</strong><div class="t">${esc(n.body)}</div></div></button>`).join('')}` : ''; }).join('')}`;
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
  state.openMenu = null;
  const p = TEAM.find((x) => x.id === id) || {};
  const s = derive();
  switch (act) {
    case 'signoff': { const rec = p.history[p.history.length - 1]; rec.signedOff = iso(TODAY); toast(`${p.name}'s ${rec.type.toLowerCase()} signed off. Compliance is now ${pct(derive().compliance)}.`); break; }
    case 'chase': { p.chases.push(iso(TODAY)); p.lastChaseRead = false; toast(`Chase sent to ${p.name} (${plural(p.chases.length, 'chase')} in total).`); break; }
    case 'chase-all': { s.overdue.forEach((o) => byId(o.id).chases.push(iso(TODAY))); toast(`Chased ${plural(s.overdue.length, 'person', 'people')}.`); break; }
    case 'book': { const rec = p.history[p.history.length - 1]; const when = addDays(TODAY, 5); if (rec && !rec.signedOff) rec.booked = iso(when); else p.history.push({ type: 'Quarterly supervision', booked: iso(when) }); toast(`Booked ${p.name} for ${fmt(when, { weekday: 'short', day: 'numeric', month: 'short' })}. Still overdue until it is signed off.`); break; }
    case 'rejoin': { const when = d(p.paused.returns); delete p.paused; p.history.push({ type: 'Return to work supervision', booked: iso(when) }); toast(`${p.name} returns ${fmt(when)}. Return supervision booked and they are back in the compliance count.`); break; }
    case 'extend': { p.paused.returns = iso(addDays(d(p.paused.returns), 28)); p.paused.decisionDue = p.paused.returns; toast(`${p.name}'s leave extended to ${fmt(d(p.paused.returns))}.`); break; }
    case 'note': toast(`Note added to ${p.name}'s record.`); render(); return;
    case 'open': openPanel('person', p.id); return;
    case 'message': { const m = MESSAGES.find((x) => x.person === p.id); openPanel('thread', m ? m.id : 'new:' + p.id); return; }
    case 'export': toast('Export queued. You will get it by email in a minute or two.'); return;
    case 'schedule-report': toast('Report scheduled monthly.'); return;
    case 'profile': state.roleMenu = false; renderRole(); toast('Profile and settings are not in the prototype.'); return;
    case 'signout': state.roleMenu = false; renderRole(); toast('Signed out (prototype).'); return;
    case 'reassign': toast(`Reassign ${p.name}: pick a new supervisor (not in prototype).`); return;
    case 'create': toast('Draft sent to the supervisee.'); go('/dashboard'); return;
    case 'send-reply': {
      const input = $('#thread-input'); const text = input && input.value.trim();
      const m = MESSAGES.find((x) => x.id === id);
      if (!text || !m) { if (input) input.focus(); return; }
      m.thread.push({ from: 'me', at: iso(NOW) + 'T' + String(NOW.getHours()).padStart(2, '0') + ':' + String(NOW.getMinutes()).padStart(2, '0'), text });
      m.unread = false; render(); return;
    }
    case 'refer': case 'monitor': case 'close-flag': { const f = SAFEGUARDING.find((x) => x.id === id); f.status = 'closed'; f.closed = iso(TODAY); f.decision = act; toast(act === 'refer' ? 'Referred to the local authority. Decision recorded.' : act === 'monitor' ? 'Set to internal monitoring. Decision recorded.' : 'Closed with no concern. Decision recorded.'); break; }
  }
  render();
}

/* Router and rendering ------------------------------------------- */

function go(route) { location.hash = '#' + route; }


function render() {
  const s = derive();
  renderNav(s);
  renderTopbar(s);
  const page = ROUTES[state.route] || pageDashboard;
  $('#page-inner').innerHTML = page(s);
  renderPanel(s);
  setupScrollSpy();
  mountTrends();
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
  const ar = areaForRoute(state.route);
  if (state.route === '/home') { if (state.navArea) state.navAnim = 'enter-back'; state.navArea = null; }
  else if (ar && ar.id !== state.navArea) { state.navAnim = state.navArea ? null : 'enter-forward'; state.navArea = ar.id; }
  if (state.panelMode === 'person') { state.panelMode = 'messages'; state.panelOpen = false; }
  render();
  $('#page').scrollTop = 0;
}

/* Events --------------------------------------------------------- */

/* The sidebar is either fully open or hidden; when hidden, the open
   button appears in the top bar beside search. */
function setNavOpen(open) {
  state.navRail = !open;
  $('#app').classList.toggle('nav-rail', !open);
  $('#btn-nav-open').hidden = open;
}

function openPanel(mode, arg = null) {
  state.panelOpen = true; state.panelMode = mode; state.panelArg = arg;
  render();
}

document.addEventListener('click', (e) => {
  if (state.openMenu && !e.target.closest('[data-menu-wrap]')) { state.openMenu = null; render(); }
  if (state.roleMenu && !e.target.closest('.me-wrap')) { state.roleMenu = false; renderRole(); }
  const t = e.target.closest('[data-area],[data-area-go],#nav-back,[data-scroll],[data-go],[data-person],[data-act],[data-thread],[data-msg-filter],[data-cycle-filter],[data-sort],[data-cal],[data-message],[data-nav],#btn-menu,#btn-chat,#btn-notes,#panel-close,#panel-back,#scrim,#announce-prev,#announce-next,#announce-close,#btn-theme,#promo-close,[data-range],[data-menu],[data-attn-filter],#btn-bell,[data-msg-tab],[data-notif],#notif-readall,#btn-role,[data-role],#btn-nav-open');
  if (!t) return;
  if (t.dataset.area || t.dataset.areaGo) {
    const ar = AREAS.find((x) => x.id === (t.dataset.area || t.dataset.areaGo));
    if (state.navRail) setNavOpen(true);
    if (areaForRoute(state.route) === ar) { state.navArea = ar.id; state.navAnim = 'enter-forward'; render(); return; }
    state.navArea = null; go(ar.home); return;
  }
  if (t.id === 'nav-back') { state.navArea = null; state.navAnim = 'enter-back'; render(); return; }
  if (t.dataset.scroll) { const sec = document.getElementById(t.dataset.scroll); if (sec) sec.scrollIntoView({ block: 'start' }); return; }
  if (t.dataset.go) { go(t.dataset.go); return; }
  if (t.hasAttribute('data-nav')) { return; } // plain anchor, hashchange handles it
  if (t.dataset.person) { state.panelReturn = state.panelMode === 'thread' ? state.panelArg : null; openPanel('person', t.dataset.person); return; }
  if (t.dataset.message) { const m = MESSAGES.find((x) => x.person === t.dataset.message); openPanel('thread', m ? m.id : 'new:' + t.dataset.message); return; }
  if (t.dataset.thread) { const m = MESSAGES.find((x) => x.id === t.dataset.thread); m.unread = false; openPanel('thread', m.id); return; }
  if (t.dataset.msgFilter) { state.msgFilter = t.dataset.msgFilter; render(); return; }
  if (t.dataset.attnFilter) { state.attnFilter = t.dataset.attnFilter; render(); return; }
  if (t.dataset.cycleFilter) { state.cycleFilter = t.dataset.cycleFilter; render(); return; }
  if (t.dataset.sort) { const k = t.dataset.sort; state.leagueSort = state.leagueSort.key === k ? { key: k, dir: state.leagueSort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'name' || k === 'site' || k === 'rank' ? 'asc' : 'desc' }; render(); return; }
  if (t.dataset.cal) { state.calMonth = t.dataset.cal === 'today' ? new Date(TODAY.getFullYear(), TODAY.getMonth(), 1) : new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + Number(t.dataset.cal), 1); render(); return; }
  if (t.dataset.act) { doAction(t.dataset.act, t.dataset.id); return; }
  if (t.id === 'btn-menu' || t.id === 'btn-nav-open') { setNavOpen(state.navRail); return; }
  if (t.id === 'btn-chat') { if (state.panelOpen && (state.panelMode === 'messages' || state.panelMode === 'thread')) { state.panelOpen = false; render(); } else openPanel('messages'); return; }
  if (t.id === 'btn-notes') { if (state.panelOpen && state.panelMode === 'notes') { state.panelOpen = false; render(); } else openPanel('notes'); return; }
  if (t.id === 'panel-close' || t.id === 'scrim') { state.panelOpen = false; render(); return; }
  if (t.id === 'panel-back') { if (state.panelMode === 'person' && state.panelReturn) { openPanel('thread', state.panelReturn); state.panelReturn = null; } else openPanel('messages'); return; }
  if (t.id === 'announce-prev') { state.announceIdx = (state.announceIdx + ANNOUNCEMENTS.length - 1) % ANNOUNCEMENTS.length; render(); return; }
  if (t.id === 'announce-next') { state.announceIdx = (state.announceIdx + 1) % ANNOUNCEMENTS.length; render(); return; }
  if (t.id === 'announce-close') { state.announceHidden = true; render(); return; }
  if (t.id === 'btn-theme') { toggleTheme(); return; }
  if (t.id === 'btn-bell') { if (state.panelOpen && state.panelMode === 'notifications') { state.panelOpen = false; render(); } else openPanel('notifications'); return; }
  if (t.dataset.msgTab) { state.msgTab = t.dataset.msgTab; render(); return; }
  if (t.id === 'notif-readall') { NOTIFICATIONS.forEach((n) => (n.read = true)); render(); return; }
  if (t.dataset.notif) {
    const n = NOTIFICATIONS.find((x) => x.id === t.dataset.notif); n.read = true;
    if (n.go.startsWith('thread:')) { const m = MESSAGES.find((x) => x.id === n.go.slice(7)); m.unread = false; openPanel('thread', m.id); }
    else if (n.go.startsWith('person:')) openPanel('person', n.go.slice(7));
    else { state.panelOpen = false; go(n.go); }
    return;
  }
  if (t.id === 'btn-role') { state.roleMenu = !state.roleMenu; renderRole(); return; }
  if (t.dataset.role) { const r = ROLES.find((x) => x.id === t.dataset.role); state.role = r.id; state.roleMenu = false; renderRole(); toast(`Switched to ${r.role} at ${r.site}. The prototype keeps the manager view.`); return; }
  if (t.id === 'promo-close') { $('#promo').hidden = true; $('#promo').dataset.dismissed = '1'; return; }
  if (t.dataset.menu) { state.openMenu = state.openMenu === t.dataset.menu ? null : t.dataset.menu; render(); return; }
  if (t.dataset.range) { state.trendRange = t.dataset.range; render(); return; }
});

document.addEventListener('input', (e) => {
  if (e.target.matches('[data-contact-search]')) {
    state.contactSearch = e.target.value; const pos = e.target.selectionStart; render();
    const el = $('[data-contact-search]'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.matches('[data-cycle-search]')) {
    state.cycleSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = $('[data-cycle-search]'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'thread-input') { const btn = $('[data-act="send-reply"]'); if (btn) doAction('send-reply', btn.dataset.id); return; }
  if (e.key === 'Escape' && state.roleMenu) { state.roleMenu = false; renderRole(); return; }
  if (e.key === 'Escape' && state.openMenu) { state.openMenu = null; render(); return; }
  if (e.key === 'Escape' && state.panelOpen) { state.panelOpen = false; render(); }
  if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(e.target.tagName)) toggleTheme();
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); $('#search-input').focus(); }
});

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'light' : 'dark';
}

if (typeof AVATARS !== 'undefined' && AVATARS.jo) { const me = $('#me-avatar'); if (me) { me.classList.add('has-photo'); me.innerHTML = `<img src="${AVATARS.jo}" alt="">`; } }
window.addEventListener('hashchange', onHashChange);
onHashChange();
