/* ---------------------------------------------------------------
   Supervisions dashboard prototype — data model
   One source of truth. Every count on every page is derived from
   this in app.js, so compliance, overdue and open actions can never
   disagree with each other.
   --------------------------------------------------------------- */

const TODAY = new Date(2026, 8, 2); // Wed 2 September 2026

/* Supervision policy for this organisation. */
const POLICY = {
  cycleDays: 84,                 // no more than 12 weeks between supervisions
  atRiskDays: 14,                // "due soon" window
  fyStartMonth: 6,               // FY quarters start in July (0-based)
  quarters: [
    { key: 'Q1', label: 'Q1', months: [6, 7, 8] },
    { key: 'Q2', label: 'Q2', months: [9, 10, 11] },
    { key: 'Q3', label: 'Q3', months: [0, 1, 2] },
    { key: 'Q4', label: 'Q4', months: [3, 4, 5] },
  ],
};

const ME = {
  id: 'jo',
  name: 'James Okafor',
  firstName: 'James',
  role: 'Registered Manager',
  site: 'Northfield House',
  org: 'Ako Health London',
  initials: 'JO',
};

const SITES = ['Northfield House', 'Willow House', 'Elm Court'];

/* Roles James can switch between. The prototype shows the manager view
   throughout; switching only changes the label and greets the change. */
const ROLES = [
  { id: 'rm', role: 'Registered Manager', site: 'Northfield House', org: 'Ako Health London' },
  { id: 'dm', role: 'Deputy Manager', site: 'Willow House', org: 'Ako Health London' },
  { id: 'lr', role: 'Learner', site: 'Northfield House', org: 'Ako Health London' },
];

/* Team. `history` is every supervision record for the person, newest
   last. A record with `signedOff` counts as complete. `submitted`
   without `signedOff` is waiting on the manager. `booked` is a date
   in the diary. `draft` means the supervisee has started notes. */
const TEAM = [
  {
    id: 'tw', name: 'Tom Whitfield', role: 'Care Assistant', site: 'Northfield House',
    hue: 280, started: '2023-03-06',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-01-19' },
      { type: 'Quarterly supervision', signedOff: '2026-04-26' },
      { type: 'Quarterly supervision', booked: '2026-07-19' },
    ],
    chases: ['2026-07-21', '2026-07-28', '2026-08-04', '2026-08-11', '2026-08-25', '2026-09-01'],
    lastChaseRead: false,
    notes: ['Missed the 19 Jul slot (sickness). Rebooking has not been confirmed.'],
    pdp: { objectives: 3, complete: 1, review: '2026-10-15' },
  },
  {
    id: 'sm', name: 'Sarah Mitchell', role: 'Senior Carer', site: 'Northfield House',
    hue: 160, started: '2021-09-13',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-03-09' },
      { type: 'Quarterly supervision', signedOff: '2026-06-02' },
      { type: 'Quarterly supervision', submitted: '2026-08-24', held: '2026-08-24' },
    ],
    chases: [],
    notes: ['Submitted Q1 notes on 24 Aug. Waiting on your sign off.'],
    pdp: { objectives: 4, complete: 4, review: '2026-11-02' },
  },
  {
    id: 'ps', name: 'Priya Sharma', role: 'Support Worker', site: 'Northfield House',
    hue: 40, started: '2024-01-15',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-04-07' },
      { type: 'Quarterly supervision', signedOff: '2026-06-30' },
      { type: 'Quarterly supervision', draft: true, booked: '2026-09-16' },
    ],
    chases: [],
    notes: [],
    pdp: { objectives: 3, complete: 3, review: '2026-09-30' },
  },
  {
    id: 'dc', name: 'David Chen', role: 'Care Assistant', site: 'Northfield House',
    hue: 210, started: '2022-05-02',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-03-24' },
      { type: 'Quarterly supervision', signedOff: '2026-06-18' },
      { type: 'Quarterly supervision', booked: '2026-09-10' },
    ],
    chases: [],
    notes: [],
    pdp: { objectives: 2, complete: 0, review: '2026-10-01' },
  },
  {
    id: 'ak', name: 'Aisha Khan', role: 'Care Assistant', site: 'Northfield House',
    hue: 330, started: '2020-11-09',
    paused: { reason: 'Maternity leave', since: '2026-03-02', returns: '2026-09-10', decisionDue: '2026-09-10' },
    history: [
      { type: 'Quarterly supervision', signedOff: '2025-12-15' },
      { type: 'Return to work meeting', signedOff: '2026-02-23' },
    ],
    chases: [],
    notes: ['Rejoin decision needed before 10 Sep: return-to-work supervision, or extend leave.'],
    pdp: { objectives: 2, complete: 1, review: '2026-12-01' },
  },
  {
    id: 'mt', name: 'Michael Thompson', role: 'Care Assistant', site: 'Northfield House',
    hue: 20, started: '2023-08-21',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-02-16' },
      { type: 'Quarterly supervision', signedOff: '2026-05-25' },
      { type: 'Quarterly supervision', signedOff: '2026-08-24' },
    ],
    chases: [],
    notes: [],
    pdp: { objectives: 3, complete: 2, review: '2026-11-24' },
  },
  {
    id: 'ah', name: 'Amina Hassan', role: 'Team Leader', site: 'Northfield House',
    hue: 120, started: '2019-04-01',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-02-02' },
      { type: 'Quarterly supervision', signedOff: '2026-05-11' },
      { type: 'Quarterly supervision', signedOff: '2026-08-12' },
    ],
    chases: [],
    notes: [],
    pdp: { objectives: 4, complete: 3, review: '2026-11-12' },
  },
  {
    id: 'lo', name: "Liam O'Connor", role: 'Night Care Assistant', site: 'Northfield House',
    hue: 250, started: '2024-10-14',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-04-14' },
      { type: 'Quarterly supervision', signedOff: '2026-07-07' },
      { type: 'Quarterly supervision', booked: '2026-09-24' },
    ],
    chases: [],
    notes: [],
    pdp: { objectives: 2, complete: 1, review: '2027-01-07' },
  },
  {
    id: 'ga', name: 'Grace Adeyemi', role: 'Care Assistant', site: 'Northfield House',
    hue: 60, started: '2022-02-14',
    history: [
      { type: 'Quarterly supervision', signedOff: '2026-02-09' },
      { type: 'Quarterly supervision', signedOff: '2026-05-05' },
      { type: 'Quarterly supervision', signedOff: '2026-08-05' },
    ],
    chases: [],
    notes: [],
    pdp: { objectives: 3, complete: 3, review: '2026-11-05' },
  },
  {
    id: 'rp', name: 'Ravi Patel', role: 'Care Assistant', site: 'Northfield House',
    hue: 190, started: '2026-06-15', probation: true,
    history: [
      { type: 'Induction supervision', signedOff: '2026-07-15' },
      { type: 'Probation review', draft: true },
    ],
    chases: [],
    notes: ['Probation review due before 15 Sep (3 months).'],
    pdp: { objectives: 3, complete: 0, review: '2026-09-15' },
  },
];

/* Safeguarding flags raised against or by the team. */
const SAFEGUARDING = [
  {
    id: 'sg1', person: 'sm', raised: '2026-08-28', severity: 'high', status: 'open',
    title: 'Disclosure made during supervision',
    summary: 'Sarah recorded a disclosure from a resident about a night-shift incident. Needs a decision on referral to the local authority within 24 hours of triage.',
    owner: 'jo',
  },
  {
    id: 'sg2', person: 'tw', raised: '2026-06-03', severity: 'low', status: 'closed',
    title: 'Medication round late (no harm)',
    summary: 'Logged as a near miss. Closed after a reflective discussion in April supervision.',
    owner: 'jo', closed: '2026-06-10',
  },
];

/* Conversations for the messages panel. Newest message last. Times are
   on the prototype's fixed clock (2 September 2026, 14:10). */
const MESSAGES = [
  { id: 'c1', person: 'sm', unread: true, thread: [
    { from: 'me', at: '2026-08-24T16:05', text: 'Thanks for today Sarah. Add your reflections when you get a minute and submit.' },
    { from: 'them', at: '2026-08-24T18:40', text: 'Done, submitted just now. I flagged the thing we discussed about the night shift in the notes.' },
    { from: 'them', at: '2026-09-02T14:00', text: "I've submitted my supervision notes for Q2. Can you review before Friday?" },
  ] },
  { id: 'c2', person: 'rp', unread: true, thread: [
    { from: 'them', at: '2026-08-30T09:12', text: 'Morning James. Is there anything I should prepare for the probation review?' },
    { from: 'me', at: '2026-08-30T10:02', text: 'Just your induction checklist and any shifts you found hard. We will go through the competencies together.' },
    { from: 'them', at: '2026-09-02T12:10', text: "When can we schedule the probation review? It's due by the middle of the month." },
  ] },
  { id: 'c3', person: 'ps', unread: false, thread: [
    { from: 'them', at: '2026-09-01T15:30', text: 'All PDP actions completed for Q2. Evidence is attached to each objective.' },
    { from: 'me', at: '2026-09-01T16:45', text: 'Brilliant, well done. I will look through them before our next supervision on the 16th.' },
  ] },
  { id: 'c4', person: 'mt', unread: false, thread: [
    { from: 'them', at: '2026-08-31T11:20', text: 'Can you verify the medication competency evidence I uploaded?' },
    { from: 'me', at: '2026-08-31T13:05', text: 'Seen it, looks complete. Verified.' },
    { from: 'them', at: '2026-08-31T13:07', text: 'Thanks!' },
  ] },
  { id: 'c5', person: 'ah', unread: false, thread: [
    { from: 'them', at: '2026-08-30T08:45', text: 'Q2 compliance report is ready for your review. CQC audit next month.' },
    { from: 'me', at: '2026-08-30T09:30', text: 'Thanks Amina. I will export the evidence pack once Sarah and Tom are closed off.' },
  ] },
  { id: 'c6', person: 'tw', unread: false, thread: [
    { from: 'me', at: '2026-07-21T09:00', text: 'Hi Tom, we missed the supervision on the 19th. Can you send me a couple of dates that work this week?' },
    { from: 'me', at: '2026-08-11T09:00', text: 'Tom, this is now overdue. Please pick a slot from the calendar link or reply with a time.' },
    { from: 'me', at: '2026-09-01T09:00', text: 'Reminder: your quarterly supervision is 44 days overdue. I have provisionally booked Monday 7 Sept at 10:00.' },
  ] },
];

/* Presence for the contacts list. */
const PRESENCE = { sm: 'online', ps: 'online', ah: 'online', dc: 'away', mt: 'offline', tw: 'offline', lo: 'offline', ga: 'away', rp: 'online', ak: 'leave' };

/* Notifications, newest first. `go` is a route or a person id. */
const NOTIFICATIONS = [
  { id: 'n1', at: '2026-09-02T14:00', kind: 'message', tone: 'info', title: 'Sarah Mitchell messaged you', body: 'Can you review before Friday?', go: 'thread:c1', read: false },
  { id: 'n2', at: '2026-09-02T12:10', kind: 'message', tone: 'info', title: 'Ravi Patel messaged you', body: 'When can we schedule the probation review?', go: 'thread:c2', read: false },
  { id: 'n3', at: '2026-09-02T09:00', kind: 'chase', tone: 'crit', title: 'Chase to Tom Whitfield not opened', body: 'Sent yesterday 09:00. Sixth chase on this record.', go: 'person:tw', read: false },
  { id: 'n4', at: '2026-09-01T17:30', kind: 'decision', tone: 'warn', title: 'Return-to-work decision due 10 Sept', body: "Aisha Khan's maternity leave ends. Book a return supervision or extend leave.", go: 'person:ak', read: false },
  { id: 'n5', at: '2026-08-28T16:20', kind: 'safeguarding', tone: 'crit', title: 'Safeguarding flag raised', body: 'Disclosure made during Sarah Mitchell\'s supervision. Triage decision outstanding.', go: '/safeguarding/triage', read: true },
  { id: 'n6', at: '2026-08-24T18:40', kind: 'submit', tone: 'info', title: 'Sarah Mitchell submitted Q1 supervision', body: 'Waiting on your sign off.', go: 'person:sm', read: true },
  { id: 'n7', at: '2026-08-24T15:10', kind: 'signed', tone: 'good', title: 'Michael Thompson signed off', body: 'Quarterly supervision complete. Next due 16 Nov.', go: 'person:mt', read: true },
  { id: 'n8', at: '2026-08-20T08:00', kind: 'system', tone: 'muted', title: 'Supervision templates updated', body: 'New records use the updated wellbeing section.', go: '/supervisions/new', read: true },
  { id: 'n9', at: '2026-08-12T11:05', kind: 'signed', tone: 'good', title: 'Amina Hassan signed off', body: 'Quarterly supervision complete. Next due 4 Nov.', go: 'person:ah', read: true },
];

/* Other managers, for the league table. Compliance for James is
   derived live from TEAM; the rest are fixed figures. */
const MANAGERS = [
  { id: 'jo', name: 'James Okafor', site: 'Northfield House', live: true },
  { id: 'hb', name: 'Helen Barrett', site: 'Willow House', compliance: 0.92, onTime: 0.88, team: 12 },
  { id: 'ok', name: 'Oluwaseun Kalu', site: 'Willow House', compliance: 0.83, onTime: 1.0, team: 6 },
  { id: 'fr', name: 'Fiona Reid', site: 'Elm Court', compliance: 0.75, onTime: 0.6, team: 8 },
  { id: 'ng', name: 'Nadia Grant', site: 'Elm Court', compliance: 0.6, onTime: 0.6, team: 10 },
];

/* Monthly compliance history for the trend chart (share of active
   staff in date at month end). The current month is live. */
const TREND = [
  { m: 'Oct', y: 2025, v: 0.71 }, { m: 'Nov', y: 2025, v: 0.78 }, { m: 'Dec', y: 2025, v: 0.67 },
  { m: 'Jan', y: 2026, v: 0.8 },  { m: 'Feb', y: 2026, v: 0.89 }, { m: 'Mar', y: 2026, v: 0.9 },
  { m: 'Apr', y: 2026, v: 0.88 }, { m: 'May', y: 2026, v: 0.9 },  { m: 'Jun', y: 2026, v: 1.0 },
  { m: 'Jul', y: 2026, v: 0.89 }, { m: 'Aug', y: 2026, v: 0.78 },
];

const ANNOUNCEMENTS = [
  { text: 'The myAko mobile app is now available for iOS and Android.', more: 'Download', href: '/dashboard' },
  { text: 'Supervision templates were updated on 20 August. New records use the updated wellbeing section.', more: 'See what changed', href: '/supervisions/new' },
  { text: 'Planned maintenance Sunday 14 September, 02:00 to 04:00. myAko will be read-only.', more: 'Details', href: '/dashboard' },
];

/* Cross-feature context for the Home cards and the Supervisions badge. */
const FEATURE_STATS = {
  learning: { due: 4, overdue: 1, next: 'Safeguarding adults refresher' },
  competencies: { awaiting: 2, expiring: 3 },
  events: { booked: 3, next: 'Manual handling, Tue 9 Sept' },
};
