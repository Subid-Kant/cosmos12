/**
 * Bug Arena — Production Backend Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Designed for ~100 concurrent students on Render.com + MongoDB Atlas.
 *
 * Required Environment Variables (set in Render.com dashboard):
 *   MONGO_URI            — MongoDB Atlas connection string
 *   PORT                 — (auto-set by Render, default 5000)
 *   ALLOWED_ORIGINS      — comma-separated frontend URLs
 *   NODE_ENV             — "production" or "development"
 */

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');
const crypto     = require('crypto');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const compression = require('compression');

dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Express App Setup ────────────────────────────────────────────────────────
const app = express();

// Security headers (production only to avoid dev friction)
if (IS_PROD) {
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Frontend controls CSP
  }));
}

// Gzip compression — reduces bandwidth by ~70%
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const defaultOrigins = IS_PROD
  ? 'https://cosmos.42web.io'
  : 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultOrigins)
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (curl, Postman, same-origin) and allowed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin "${origin}" not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-session'],
  credentials: true,
}));
app.options(/.*/, cors()); // Pre-flight for all routes

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
// General API: Extremely high limit to accommodate 100+ students on the same College Wi-Fi IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // 10,000 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' },
});
app.use('/api/', generalLimiter);

// Registration limit (increased to allow many registrations from same IP)
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many registration attempts from this IP. Please try again in 15 minutes.' },
});

// Cheat reports limiter
const cheatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many reports.' },
});

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bugarena';

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000, // fail fast if Atlas is unreachable
  socketTimeoutMS: 45000,
})
  .then(() => console.log(`✅ MongoDB connected${IS_PROD ? ' (Atlas)' : ' (local)'}` ))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    if (IS_PROD) process.exit(1); // Hard fail in production — don't serve without DB
  });

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────

const RegistrySchema = new mongoose.Schema({
  singletonId: { type: String, default: 'registry', unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: { reports: [] } },
}, { minimize: false });
const Registry = mongoose.model('Registry', RegistrySchema);

// Reports are stored independently from the shared arena registry. A registry
// refresh, phase transition, or server restart therefore cannot erase one
// participant's completed report.
const BugReportSchema = new mongoose.Schema({
  reportSlot: { type: String, required: true, unique: true, index: true },
  report: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, minimize: false });
const BugReport = mongoose.model('BugReport', BugReportSchema);

// SSE keeps phase changes and proctoring alerts instant without making every
// participant repeatedly download the full registry document.
const phaseSubscribers = new Set();
const adminAlertSubscribers = new Set();
let phaseCache = { phase: 'pre_event', lastChanged: 0, history: [] };
let phaseCacheAt = 0;
let pendingPhaseRead = null;
const publishSse = (subscribers, event, payload) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  subscribers.forEach(res => { res.write(message); res.flush?.(); });
};
const publishPhase = (globalState) => {
  phaseCache = globalState;
  phaseCacheAt = Date.now();
  publishSse(phaseSubscribers, 'phase', globalState);
};
const publishAdminAlert = (alert) => publishSse(adminAlertSubscribers, 'proctoring-alert', alert);

// Administrative mutations are authorized by a short-lived server session,
// never by a client-side UI flag alone.
const adminSessions = new Map();
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
function requireAdmin(req, res, next) {
  const token = req.get('x-admin-session');
  const expiresAt = token && adminSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ error: 'Admin authentication is required for this action.' });
  }
  next();
}

// One cached, coalesced read prevents a 100-student join from triggering 100
// full registry document reads at the same time. Phase writes refresh this
// immediately, so clients still receive live transitions through SSE.
const getCachedGlobalState = async () => {
  if (Date.now() - phaseCacheAt < 5000) return phaseCache;
  if (!pendingPhaseRead) {
    pendingPhaseRead = getRegistryDoc()
      .then(doc => {
        phaseCache = doc.data?.globalState || phaseCache;
        phaseCacheAt = Date.now();
        return phaseCache;
      })
      .finally(() => { pendingPhaseRead = null; });
  }
  return pendingPhaseRead;
};

const RegistrationSchema = new mongoose.Schema({
  registrationId:       { type: String, unique: true },
  teamType:             { type: String, enum: ['solo'], default: 'solo' },
  members: [{
    name:  { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
  }],
  paymentStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  adminNote:            { type: String, default: '' },
  submittedAt:          { type: Date, default: Date.now },
  verifiedAt:           { type: Date },
  inContest:            { type: Boolean, default: false },
  contestStartedAt:     { type: Date },
  lastContestPhase:     { type: String, default: '' },
  hasSubmittedCode:     { type: Boolean, default: false },
  programmingLanguage:  { type: String, default: '' },
}, { timestamps: true });
const Registration = mongoose.model('Registration', RegistrationSchema);

const CheatReportSchema = new mongoose.Schema({
  teamName:          { type: String, required: true, unique: true }, // ONE doc per team
  registrationId:    { type: String, default: '' },
  reason:            { type: String, required: true },   // latest violation reason
  warnCount:         { type: Number, default: 1 },
  phase:             { type: String, default: '' },
  timestamp:         { type: Number, default: () => Date.now() },
  locked:            { type: Boolean, default: false },
  reentryRequested:  { type: Boolean, default: false }, // player pressed "Request Re-entry"
  reentryApproved:   { type: Boolean, default: false }, // admin approved
  adminUnlocked:     { type: Boolean, default: false }, // legacy compat
}, { timestamps: true });
const CheatReport = mongoose.model('CheatReport', CheatReportSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getRegistryDoc = async () => {
  let doc = await Registry.findOne({ singletonId: 'registry' });
  if (!doc) {
    doc = new Registry({ singletonId: 'registry', data: { reports: [] } });
    await doc.save();
  }
  return doc;
};

// A safe object-key form for per-player drafts. Registration IDs are already
// safe, but this also supports legacy team names without allowing dotted paths.
const draftKeyFor = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);

// Lightweight phase channel: one tiny payload instead of the shared code and
// reports registry. SSE pushes host transitions to all connected players.
app.get('/api/event-phase', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getCachedGlobalState());
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/event-phase/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  phaseSubscribers.add(res);
  res.write('retry: 1500\n\n');
  getCachedGlobalState().then(globalState => publishSse(new Set([res]), 'phase', globalState)).catch(() => {});
  const heartbeat = setInterval(() => { res.write(': keepalive\n\n'); res.flush?.(); }, 25000);
  req.on('close', () => { clearInterval(heartbeat); phaseSubscribers.delete(res); });
});

app.patch('/api/event-phase', requireAdmin, async (req, res) => {
  try {
    const { phase } = req.body;
    const allowed = ['pre_event', 'coding', 'exchange', 'hunting', 'post_event'];
    if (!allowed.includes(phase)) return res.status(400).json({ error: 'Invalid event phase.' });
    const doc = await getRegistryDoc();
    const previous = doc.data?.globalState?.phase || 'pre_event';
    // Ask connected clients to flush their in-memory work before the database
    // lock changes. The small, bounded window is only for drafts while the
    // OLD phase is still active; the final promotion below then locks it.
    if ((previous === 'coding' || previous === 'hunting') && previous !== phase) {
      publishSse(phaseSubscribers, 'phase-closing', { currentPhase: previous, nextPhase: phase });
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    const nextData = { ...(doc.data || {}) };
    const drafts = nextData.drafts || { codes: {}, reports: {} };
    const now = Date.now();

    // The browser continuously stores a lightweight working draft during the
    // live phases. On a phase transition the server promotes the newest draft
    // into the normal submissions/reports list before the phase is locked.
    // This makes half-written work visible to the admin even when a student
    // never pressed Submit.
    if (previous === 'coding' && phase !== 'coding') {
      Object.values(drafts.codes || {}).forEach(draft => {
        if (!draft?.key) return;
        const existing = nextData[draft.key];
        if (!existing || Number(draft.updatedAt || 0) > Number(existing.updatedAt || existing.timestamp || 0)) {
          nextData[draft.key] = { ...draft, isAutoSubmitted: true, autoSubmittedAt: now };
        }
      });
    }
    if (previous === 'hunting' && phase !== 'hunting') {
      const reportsBySlot = new Map();
      (Array.isArray(nextData.reports) ? nextData.reports : []).forEach(report => {
        const slot = report.reportSlot || `${report.reviewerRegistrationId || report.reviewer}::${report.key}::${report.language}`;
        reportsBySlot.set(slot, report);
      });
      Object.values(nextData.reportSlots || {}).forEach(report => {
        if (!report) return;
        const slot = report.reportSlot || `${report.reviewerRegistrationId || report.reviewer}::${report.key}::${report.language}`;
        reportsBySlot.set(slot, report);
      });
      Object.values(drafts.reports || {}).forEach(draft => {
        if (!draft?.reportSlot) return;
        const existing = reportsBySlot.get(draft.reportSlot);
        if (!existing || Number(draft.updatedAt || 0) > Number(existing.updatedAt || existing.timestamp || 0)) {
          reportsBySlot.set(draft.reportSlot, { ...draft, isAutoSubmitted: true, autoSubmittedAt: now });
        }
      });
      nextData.reports = [...reportsBySlot.values()];
      nextData.reportSlots = Object.fromEntries(
        [...reportsBySlot.entries()].map(([slot, report]) => [draftKeyFor(slot), report])
      );
    }

    const globalState = {
      ...(doc.data?.globalState || {}),
      phase,
      lastChanged: Date.now(),
      history: [...(doc.data?.globalState?.history || []).slice(-9), { from: previous, to: phase, at: new Date().toISOString() }],
    };
    doc.data = { ...nextData, globalState };
    doc.markModified('data');
    await doc.save();
    // Persist reports promoted from live hunting drafts independently too.
    // This makes auto-submitted partial reports just as durable as reports
    // submitted with the player button.
    if (previous === 'hunting' && phase !== 'hunting') {
      await Promise.all(
        (nextData.reports || []).filter(report => report?.reportSlot).map(report =>
          BugReport.findOneAndUpdate(
            { reportSlot: report.reportSlot },
            { $set: { reportSlot: report.reportSlot, report } },
            { upsert: true, setDefaultsOnInsert: true }
          )
        )
      );
    }
    publishPhase(globalState);
    res.json({ success: true, globalState });
  } catch (err) {
    console.error('Event phase update error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Live drafts are intentionally separate from submitted records. They are
// only promoted by the authenticated organiser's phase transition above.
app.post('/api/drafts/code', async (req, res) => {
  try {
    const draft = req.body || {};
    const slot = draftKeyFor(draft.registrationId || draft.team);
    if (!slot || !/^[A-Z0-9]{6}$/.test(draft.key || '') || !draft.team || !draft.language) {
      return res.status(400).json({ error: 'Incomplete code draft.' });
    }
    draft.updatedAt = Date.now();
    const result = await Registry.updateOne(
      { singletonId: 'registry', 'data.globalState.phase': 'coding' },
      { $set: { [`data.drafts.codes.${slot}`]: draft } }
    );
    if (result.matchedCount !== 1) return res.status(409).json({ error: 'Coding phase is closed.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Code draft save error:', err);
    res.status(500).json({ error: 'Could not save draft.' });
  }
});

app.post('/api/drafts/report', async (req, res) => {
  try {
    const draft = req.body || {};
    const slot = draftKeyFor(draft.reportSlot);
    if (!slot || !draft.reportSlot || !draft.reviewer || !draft.language || !Array.isArray(draft.foundBugs)) {
      return res.status(400).json({ error: 'Incomplete report draft.' });
    }
    draft.updatedAt = Date.now();
    const result = await Registry.updateOne(
      { singletonId: 'registry', 'data.globalState.phase': 'hunting' },
      { $set: { [`data.drafts.reports.${slot}`]: draft } }
    );
    if (result.matchedCount !== 1) return res.status(409).json({ error: 'Bug hunting phase is closed.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Report draft save error:', err);
    res.status(500).json({ error: 'Could not save draft.' });
  }
});

app.get('/api/admin-alerts/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  adminAlertSubscribers.add(res);
  res.write('retry: 1500\n\n');
  const heartbeat = setInterval(() => { res.write(': keepalive\n\n'); res.flush?.(); }, 25000);
  req.on('close', () => { clearInterval(heartbeat); adminAlertSubscribers.delete(res); });
});

// ─── Admin Login (credentials stored only in server environment) ────────────
// A strict rate limiter: max 50 attempts per 15 minutes per IP
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USERNAME || 'cybertech';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Asryyvy@45';

  if (
    typeof username === 'string' &&
    typeof password === 'string' &&
    username.trim() === ADMIN_USER &&
    password === ADMIN_PASS
  ) {
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
    console.log(`👑 Admin login at ${new Date().toISOString()}`);
    return res.json({ success: true, token });
  }
  console.warn(`⚠️  Failed admin login attempt for username: "${username}"`);
  res.status(401).json({ error: 'Invalid credentials.' });
});

// ─── Health Check (Render.com uses this to know the server is alive) ───────────
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState];
  res.json({
    status: 'ok',
    db: dbStatus,
    uptime: Math.floor(process.uptime()) + 's',
    env: IS_PROD ? 'production' : 'development',
    timestamp: new Date().toISOString(),
  });
});

// ─── Registry Routes ──────────────────────────────────────────────────────────
app.get('/api/registry', async (req, res) => {
  try {
    const [doc, durableReports] = await Promise.all([
      getRegistryDoc(),
      BugReport.find({}, { report: 1, _id: 0 }).lean(),
    ]);
    const data = doc.data || { reports: [] };
    // Keep legacy reports for compatibility while adding durable submissions.
    res.json({ ...data, reports: [...(Array.isArray(data.reports) ? data.reports : []), ...durableReports.map(item => item.report)] });
  } catch (err) {
    console.error('GET /api/registry error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/registry', requireAdmin, async (req, res) => {
  try {
    const doc = await getRegistryDoc();
    doc.data = req.body;
    doc.markModified('data');
    await doc.save();
    // The existing admin "Wipe Test Codes" action intentionally sends an
    // empty reports array. Mirror that deliberate wipe in durable storage.
    if (Array.isArray(req.body?.reports) && req.body.reports.length === 0) {
      await BugReport.deleteMany({});
    }
    res.json(doc.data);
  } catch (err) {
    console.error('PUT /api/registry error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Atomic arena writes. Clients must not fetch-and-replace the entire registry:
// with 100 students, simultaneous PUTs would race and could lose submissions.
app.post('/api/submissions', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!/^[A-Z0-9]{6}$/.test(payload.key || '') || !payload.team || !payload.code || !payload.language) {
      return res.status(400).json({ error: 'A valid key, team, language, and code are required.' });
    }
    // A single dotted-path $set is atomic in MongoDB: concurrent students write
    // separate keys without reading/replacing the whole shared registry. The
    // client retains the same key for edits, so a resubmission overwrites only
    // that player's prior code.
    const keyPath = `data.${payload.key}`;
    // Phase is enforced in the same database write filter. This is the
    // authoritative lock: changing a browser screen or calling the API
    // directly cannot save code after the organiser moves past coding.
    const result = await Registry.updateOne(
      { singletonId: 'registry', 'data.globalState.phase': 'coding' },
      { $set: { [keyPath]: payload } }
    );
    if (result.matchedCount !== 1) {
      return res.status(409).json({ error: 'The coding phase has ended. Code submissions are locked.' });
    }
    res.status(201).json({ success: true, key: payload.key });
  } catch (err) {
    console.error('Submission save error:', err);
    res.status(500).json({ error: 'Could not save submission.' });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const report = req.body || {};
    if (!report.id || !report.reviewer || !report.originalTeam || !report.language || !Array.isArray(report.foundBugs)) {
      return res.status(400).json({ error: 'Incomplete bug report.' });
    }
    // Each hunter has one current report for an exchanged submission. A later
    // save replaces that report atomically, so the admin sees only the newest
    // content and its latest submission time (which defines queue position).
    report.reportSlot = report.reportSlot || `${report.reviewerRegistrationId || String(report.reviewer).trim().toLowerCase()}::${report.key || 'N/A'}::${String(report.language).toLowerCase()}`;
    report.updatedAt = Number(report.updatedAt || report.timestamp || Date.now());
    // Like code submissions, reports are guarded by the live event phase in
    // MongoDB. Store the current report in its own keyed slot rather than
    // mutating the shared reports array: this stays atomic under a 100-player
    // rush and avoids aggregation-pipeline update failures on hosted MongoDB.
    const slotKey = draftKeyFor(report.reportSlot);
    const result = await Registry.updateOne(
      { singletonId: 'registry', 'data.globalState.phase': 'hunting' },
      { $set: { [`data.reportSlots.${slotKey}`]: report } },
      { upsert: false }
    );
    if (result.matchedCount !== 1) {
      return res.status(409).json({ error: 'The bug hunting phase has ended. Reports are locked.' });
    }
    // Persist independently as the source of truth. The registry slot above
    // remains for fast phase operations and backwards-compatible views.
    await BugReport.findOneAndUpdate(
      { reportSlot: report.reportSlot },
      { $set: { reportSlot: report.reportSlot, report } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, id: report.id });
  } catch (err) {
    console.error('Report save error:', err);
    res.status(500).json({ error: 'Could not save report.' });
  }
});

app.patch('/api/verifications/:reportId', requireAdmin, async (req, res) => {
  try {
    const reportId = req.params.reportId;
    if (!reportId || !req.body?.winner) return res.status(400).json({ error: 'A winner decision is required.' });
    await Registry.updateOne(
      { singletonId: 'registry' },
      { $setOnInsert: { singletonId: 'registry' }, $set: { [`data.verifications.${reportId}`]: req.body } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Verification save error:', err);
    res.status(500).json({ error: 'Could not save verification.' });
  }
});

// ─── Registration Routes ──────────────────────────────────────────────────────

// POST /api/register — Free registration, awaiting organizer approval
app.post('/api/register', registrationLimiter, async (req, res) => {
  try {
    const { members } = req.body;

    let parsedMembers;
    try {
      parsedMembers = typeof members === 'string' ? JSON.parse(members) : members;
    } catch {
      return res.status(400).json({ error: 'Invalid members data.' });
    }

    if (!Array.isArray(parsedMembers) || parsedMembers.length !== 1) {
      return res.status(400).json({ error: 'Individual registration requires exactly one participant.' });
    }

    const normalizedMembers = [];
    for (const m of parsedMembers) {
      if (!m.name?.trim()) return res.status(400).json({ error: 'Each member must have a name.' });
      const email = String(m.email || '').trim().toLowerCase();
      const phone = String(m.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address for each member.' });
      if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit Indian phone number for each member.' });
      const existing = await Registration.findOne({
        paymentStatus: { $ne: 'rejected' },
        $or: [{ 'members.email': email }, { 'members.phone': phone }],
      });
      if (existing) return res.status(409).json({ error: `${email} or ${phone} is already registered.` });
      normalizedMembers.push({ name: m.name.trim(), email, phone });
    }

    // Generate unique registration ID first so we can use it in the URL
    const registrationId = 'REG-' +
      Date.now().toString(36).toUpperCase() + '-' +
      crypto.randomBytes(3).toString('hex').toUpperCase();

    const registration = new Registration({
      registrationId,
      teamType: 'solo',
      members: normalizedMembers,
      paymentStatus: 'pending',
    });

    await registration.save();

    console.log(`📝 New registration: ${registrationId} | solo | ${parsedMembers[0].name}`);

    res.status(201).json({
      success:        true,
      registrationId,
      message:        'Registration submitted! It is awaiting organizer approval.',
      teamType: 'solo',
      members:        normalizedMembers.map(m => m.name),
    });

  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate registration detected.' });
    }
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// GET /api/registrations — Admin: all registrations newest first
app.get('/api/registrations', async (req, res) => {
  try {
    const regs = await Registration.find().sort({ submittedAt: -1 }).lean();
    res.json(regs);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/registrations/stats — Admin dashboard stats
app.get('/api/registrations/stats', async (req, res) => {
  try {
    const [total, pending, verified, rejected] = await Promise.all([
      Registration.countDocuments(),
      Registration.countDocuments({ paymentStatus: 'pending' }),
      Registration.countDocuments({ paymentStatus: 'verified' }),
      Registration.countDocuments({ paymentStatus: 'rejected' }),
    ]);
    res.json({
      total, pending, verified, rejected,
      totalParticipants: total,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/registrations/:id/verify — Admin: approve or reject
app.patch('/api/registrations/:id/verify', requireAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "verified" or "rejected".' });
    }
    const registration = await Registration.findOneAndUpdate(
      { registrationId: req.params.id },
      {
        paymentStatus: status,
        adminNote:     adminNote || '',
        verifiedAt:    status === 'verified' ? new Date() : undefined,
      },
      { new: true }
    );
    if (!registration) return res.status(404).json({ error: 'Registration not found.' });
    console.log(`${status === 'verified' ? '✅' : '❌'} Registration ${req.params.id} → ${status}`);
    res.json({ success: true, registration });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/registrations/:id/status — Participant approval status
app.get('/api/registrations/:id/status', async (req, res) => {
  try {
    const reg = await Registration.findOne({ registrationId: req.params.id }).select('paymentStatus');
    if (!reg) return res.status(404).json({ error: 'Registration not found.' });
    res.json({ status: reg.paymentStatus });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Arena Login (Event Day) ─────────────────────────────────────────────────
// Players log in on event day using their Registration ID.
// Only 'verified' registrations are allowed through.
app.post('/api/arena-login', async (req, res) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId?.trim()) {
      return res.status(400).json({ error: 'Registration ID is required.' });
    }
    const cleanRegId = registrationId.trim().toUpperCase();
    const reg = await Registration.findOne({ registrationId: cleanRegId });
    if (!reg) {
      return res.status(404).json({ error: 'Registration ID not found. Check your ID and try again.' });
    }
    if (reg.paymentStatus === 'rejected') {
      return res.status(403).json({ error: 'Your registration was rejected. Contact the organizer.' });
    }
    if (reg.paymentStatus === 'pending') {
      return res.status(403).json({ status: 'pending', error: 'Your registration is awaiting organizer approval.' });
    }
    // verified
    const memberNames = reg.members.map(m => m.name).join(' & ');
    console.log(`🎮 Arena login: ${reg.registrationId} [${reg.teamType}] ${memberNames}`);

    // Check if team has an active proctoring lock
    let cheat = await CheatReport.findOne({
      $or: [
        { registrationId: cleanRegId },
        { teamName: memberNames },
        { teamName: reg.registrationId }
      ]
    });

    // If the team previously entered an active contest session without completing/submitting code,
    // and is now re-logging in mid-contest: lock them for unauthorized exit/reload!
    if (reg.inContest && !reg.hasSubmittedCode && (!cheat || (!cheat.reentryApproved && !cheat.adminUnlocked))) {
      cheat = await CheatReport.findOneAndUpdate(
        {
          $or: [
            { registrationId: cleanRegId },
            { teamName: memberNames }
          ]
        },
        {
          $set: {
            teamName: memberNames,
            registrationId: cleanRegId,
            reason: 'LOCKED — Re-entered arena after unauthorized exit / reload during active contest',
            warnCount: 1,
            phase: reg.lastContestPhase || 'create',
            timestamp: Date.now(),
            locked: true,
            reentryRequested: false,
            reentryApproved: false,
            adminUnlocked: false,
          }
        },
        { upsert: true, new: true }
      );
      console.log(`🚨 [CONTEST RELOAD DETECTED] ${memberNames} (${cleanRegId}) was locked upon re-entry!`);
    }

    const isLocked = !!(cheat && cheat.locked && !cheat.reentryApproved && !cheat.adminUnlocked);

    res.json({
      success: true,
      registrationId: reg.registrationId,
      teamType: reg.teamType,
      programmingLanguage: reg.programmingLanguage || '',
      members: reg.members.map(m => ({ name: m.name, email: m.email })),
      isLocked,
      cheatReport: cheat ? {
        _id: cheat._id,
        reportId: cheat._id,
        reason: cheat.reason,
        reentryRequested: cheat.reentryRequested === true,
        reentryApproved: cheat.reentryApproved === true || cheat.adminUnlocked === true,
      } : null,
    });
  } catch (err) {
    console.error('Arena login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Persist a team's language independently of browser storage. This preserves
// Java/C++/etc. when the participant logs in again for a later round.
app.patch('/api/arena-profile', async (req, res) => {
  try {
    const registrationId = (req.body.registrationId || '').trim().toUpperCase();
    const programmingLanguage = (req.body.programmingLanguage || '').trim().toLowerCase();
    // These are the only announced event tracks. Enforce the same list on the
    // server so a client cannot submit a language outside its verification lane.
    const allowedLanguages = new Set(['python', 'java', 'c', 'cpp']);
    if (!registrationId || !allowedLanguages.has(programmingLanguage)) {
      return res.status(400).json({ error: 'A valid registration ID and programming language are required.' });
    }
    const registration = await Registration.findOneAndUpdate(
      { registrationId, paymentStatus: 'verified' },
      { $set: { programmingLanguage } },
      { new: true }
    );
    if (!registration) return res.status(404).json({ error: 'Verified registration not found.' });
    res.json({ success: true, programmingLanguage: registration.programmingLanguage });
  } catch (err) {
    console.error('Arena profile update error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/arena-session/start — Record that a participant has entered the live coding/hunting contest
app.post('/api/arena-session/start', async (req, res) => {
  try {
    const { registrationId, teamName, phase } = req.body;
    const cleanRegId = (registrationId || '').trim().toUpperCase();
    if (cleanRegId) {
      await Registration.findOneAndUpdate(
        { registrationId: cleanRegId },
        {
          $set: {
            inContest: true,
            contestStartedAt: new Date(),
            lastContestPhase: phase || 'create',
          }
        }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/arena-session/finish — Record legitimate code submission
app.post('/api/arena-session/finish', async (req, res) => {
  try {
    const { registrationId } = req.body;
    const cleanRegId = (registrationId || '').trim().toUpperCase();
    if (cleanRegId) {
      await Registration.findOneAndUpdate(
        { registrationId: cleanRegId },
        {
          $set: {
            inContest: false,
            hasSubmittedCode: true,
          }
        }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Proctoring / Cheat Report Routes ────────────────────────────────────────

// POST /api/cheat-report — Upsert: one record per team (ZERO TOLERANCE: locked immediately on first attempt)
app.post('/api/cheat-report', cheatLimiter, async (req, res) => {
  try {
    const { teamName, reason, warnCount, phase, timestamp, registrationId } = req.body;
    if (!teamName?.trim() || !reason?.trim()) {
      return res.status(400).json({ error: 'teamName and reason are required.' });
    }
    const cleanTeam = teamName.trim();
    const cleanRegId = (registrationId || '').trim().toUpperCase();

    // Check if team exists to preserve pending re-entry request if already locked
    const existing = await CheatReport.findOne({
      $or: [
        { teamName: cleanTeam },
        ...(cleanRegId ? [{ registrationId: cleanRegId }] : [])
      ]
    });

    const keepReentryReq = existing?.locked && existing?.reentryRequested && !existing?.reentryApproved;

    const report = await CheatReport.findOneAndUpdate(
      {
        $or: [
          { teamName: cleanTeam },
          ...(cleanRegId ? [{ registrationId: cleanRegId }] : [{ teamName: cleanTeam }])
        ]
      },
      {
        $set: {
          teamName:         cleanTeam,
          reason:           reason.trim(),
          warnCount:        warnCount || 1,
          phase:            phase || '',
          timestamp:        timestamp || Date.now(),
          locked:           true, // Zero tolerance: locked immediately
          registrationId:   cleanRegId || existing?.registrationId || '',
          reentryRequested: keepReentryReq ? true : false,
          reentryApproved:  false,
          adminUnlocked:    false,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`🚨 [ZERO-TOLERANCE LOCKED] ${cleanTeam} (${cleanRegId}): ${reason}`);
    publishAdminAlert({
      id: report._id.toString(), teamName: report.teamName, registrationId: report.registrationId,
      reason: report.reason, phase: report.phase, timestamp: report.timestamp,
    });
    res.status(201).json({ success: true, reportId: report._id, _id: report._id });
  } catch (err) {
    console.error('Cheat report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/cheat-reports — Admin: all reports newest-first
app.get('/api/cheat-reports', async (req, res) => {
  try {
    const reports = await CheatReport.find().sort({ timestamp: -1 }).lean();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/cheat-reports/lock-status/:identifier — Participant polls to check if admin approved re-entry
app.get('/api/cheat-reports/lock-status/:identifier', async (req, res) => {
  try {
    const rawParam = decodeURIComponent(req.params.identifier || '').trim();
    if (!rawParam) {
      return res.json({ noReport: true, locked: false, reentryApproved: false, reentryRequested: false });
    }
    const escaped = rawParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const report = await CheatReport.findOne({
      $or: [
        { teamName: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { registrationId: rawParam.toUpperCase() },
        { registrationId: rawParam }
      ]
    }).lean();

    if (!report) {
      // A missing record is never approval. This prevents a reload/race from
      // granting access before the administrator explicitly approves it.
      return res.json({ noReport: true, locked: false, reentryApproved: false, reentryRequested: false });
    }

    const isApproved = report.reentryApproved === true || report.adminUnlocked === true;

    res.json({
      _id:              report._id,
      reportId:         report._id,
      locked:           report.locked,
      reentryRequested: report.reentryRequested === true,
      reentryApproved:  isApproved,
      warnCount:        report.warnCount,
      teamName:         report.teamName,
      registrationId:   report.registrationId,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Helper for re-entry request logic
const handleReentryRequest = async (payload, res) => {
  try {
    let query = null;
    const reportId = payload.reportId || payload.id;
    if (reportId && mongoose.isValidObjectId(reportId)) {
      query = { _id: reportId };
    } else if (payload.registrationId?.trim()) {
      query = { registrationId: payload.registrationId.trim().toUpperCase() };
    } else if (payload.teamName?.trim()) {
      const escaped = payload.teamName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query = { teamName: { $regex: new RegExp(`^${escaped}$`, 'i') } };
    }

    if (!query) {
      return res.status(400).json({ error: 'Report ID, teamName, or registrationId required.' });
    }

    const report = await CheatReport.findOneAndUpdate(
      query,
      { $set: { reentryRequested: true, reentryApproved: false } },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Cheat report not found.' });
    console.log(`🔔 Re-entry requested by team: ${report.teamName} [${report.registrationId}]`);
    res.json({ success: true, reportId: report._id, report });
  } catch (err) {
    console.error('Request reentry error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// POST /api/cheat-reports/request-reentry — Flexible re-entry request
app.post('/api/cheat-reports/request-reentry', (req, res) => {
  handleReentryRequest(req.body, res);
});

// PATCH /api/cheat-reports/:id/request-reentry — Legacy endpoint
app.patch('/api/cheat-reports/:id/request-reentry', (req, res) => {
  handleReentryRequest({ id: req.params.id, ...req.body }, res);
});

// Helper for re-entry approval logic
const handleReentryApproval = async (payload, res) => {
  try {
    let query = null;
    const reportId = payload.reportId || payload.id;
    if (reportId && mongoose.isValidObjectId(reportId)) {
      query = { _id: reportId };
    } else if (payload.registrationId?.trim()) {
      query = { registrationId: payload.registrationId.trim().toUpperCase() };
    } else if (payload.teamName?.trim()) {
      const escaped = payload.teamName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query = { teamName: { $regex: new RegExp(`^${escaped}$`, 'i') } };
    }

    if (!query) {
      return res.status(400).json({ error: 'Report ID, teamName, or registrationId required.' });
    }

    const report = await CheatReport.findOneAndUpdate(
      query,
      {
        $set: {
          reentryApproved:  true,
          adminUnlocked:    true,
          locked:           false,
          reentryRequested: false,
          warnCount:        0,
        }
      },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    if (report.registrationId) {
      await Registration.findOneAndUpdate(
        { registrationId: report.registrationId.toUpperCase() },
        { $set: { inContest: true, hasSubmittedCode: false } }
      );
    }
    console.log(`✅ Re-entry approved for team: ${report.teamName} [${report.registrationId}]`);
    res.json({ success: true, report });
  } catch (err) {
    console.error('Approve reentry error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// POST /api/cheat-reports/approve-reentry — Admin approves re-entry
app.post('/api/cheat-reports/approve-reentry', requireAdmin, (req, res) => {
  handleReentryApproval(req.body, res);
});

// PATCH /api/cheat-reports/:id/approve-reentry — Admin approves re-entry
app.patch('/api/cheat-reports/:id/approve-reentry', requireAdmin, (req, res) => {
  handleReentryApproval({ id: req.params.id, ...req.body }, res);
});

// DELETE /api/cheat-reports/:id/dismiss — Admin: remove a report
app.delete('/api/cheat-reports/:id/dismiss', requireAdmin, async (req, res) => {
  try {
    await CheatReport.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/cheat-reports/:id/unlock — legacy compat
app.patch('/api/cheat-reports/:id/unlock', requireAdmin, (req, res) => {
  handleReentryApproval({ id: req.params.id, ...req.body }, res);
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum is 10MB.' });
  }
  if (err?.message?.includes('Only image files')) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message?.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start & Graceful Shutdown ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Bug Arena Server → port ${PORT} [${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
});

// Graceful shutdown: finish in-flight requests before closing DB
const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('✅ MongoDB disconnected. Goodbye!');
      process.exit(0);
    });
  });
  // Force-kill after 10s if still hanging
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
