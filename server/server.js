/**
 * Bug Arena — Production Backend Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Designed for ~100 concurrent students on Render.com + MongoDB Atlas.
 *
 * Required Environment Variables (set in Render.com dashboard):
 *   MONGO_URI            — MongoDB Atlas connection string
 *   PORT                 — (auto-set by Render, default 5000)
 *   ALLOWED_ORIGINS      — comma-separated frontend URLs
 *   CLOUDINARY_CLOUD_NAME — Cloudinary cloud name (for screenshot uploads)
 *   CLOUDINARY_API_KEY    — Cloudinary API key
 *   CLOUDINARY_API_SECRET — Cloudinary API secret
 *   NODE_ENV             — "production" or "development"
 */

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
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
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow serving screenshots
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
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// ─── Multer / File Upload Setup ───────────────────────────────────────────────
// We use memory storage to keep the uploaded file in memory (req.file.buffer).
// It is then directly saved into MongoDB as a Base64 string.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const ext  = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only image files (jpg, png, webp) are allowed!'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────

const RegistrySchema = new mongoose.Schema({
  singletonId: { type: String, default: 'registry', unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: { reports: [] } },
}, { minimize: false });
const Registry = mongoose.model('Registry', RegistrySchema);

const RegistrationSchema = new mongoose.Schema({
  registrationId:       { type: String, unique: true },
  teamType:             { type: String, enum: ['solo', 'duo'], required: true },
  members: [{
    name:  { type: String, required: true },
    upiId: { type: String, required: true },
    email: { type: String, default: '' },
  }],
  feeAmount:            { type: Number, required: true },
  paymentScreenshotUrl: { type: String, default: '' },
  paymentScreenshotData: { type: String, select: false }, // Stored as Base64. Default omitted in queries
  paymentScreenshotMime: { type: String, default: 'image/jpeg' },
  screenshotHash:       { type: String, default: '' },
  paymentStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  adminNote:   { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  verifiedAt:  { type: Date },
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
    console.log(`👑 Admin login at ${new Date().toISOString()}`);
    return res.json({ success: true });
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
    const doc = await getRegistryDoc();
    res.json(doc.data || { reports: [] });
  } catch (err) {
    console.error('GET /api/registry error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/registry', async (req, res) => {
  try {
    const doc = await getRegistryDoc();
    doc.data = req.body;
    doc.markModified('data');
    await doc.save();
    res.json(doc.data);
  } catch (err) {
    console.error('PUT /api/registry error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Registration Routes ──────────────────────────────────────────────────────

// POST /api/register — Submit registration + payment screenshot
app.post('/api/register', registrationLimiter, upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { teamType, members, feeAmount } = req.body;

    let parsedMembers;
    try {
      parsedMembers = typeof members === 'string' ? JSON.parse(members) : members;
    } catch {
      return res.status(400).json({ error: 'Invalid members data.' });
    }

    if (!['solo', 'duo'].includes(teamType)) {
      return res.status(400).json({ error: 'Invalid team type.' });
    }

    const expectedCount = teamType === 'solo' ? 1 : 2;
    if (!parsedMembers || parsedMembers.length !== expectedCount) {
      return res.status(400).json({ error: `${teamType} team must have exactly ${expectedCount} member(s).` });
    }

    for (const m of parsedMembers) {
      if (!m.name?.trim()) return res.status(400).json({ error: 'Each member must have a name.' });
      if (!m.upiId?.trim()) return res.status(400).json({ error: 'Each member must have a UPI ID.' });
      if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(m.upiId.trim())) {
        return res.status(400).json({ error: `Invalid UPI ID format: "${m.upiId}"` });
      }
    }

    const expectedFee = teamType === 'solo' ? 50 : 100;
    if (parseInt(feeAmount) !== expectedFee) {
      return res.status(400).json({ error: `Fee must be ₹${expectedFee} for ${teamType}.` });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Payment screenshot is required.' });
    }

    // Generate unique registration ID first so we can use it in the URL
    const registrationId = 'REG-' +
      Date.now().toString(36).toUpperCase() + '-' +
      crypto.randomBytes(3).toString('hex').toUpperCase();

    // Compute hash for duplicate detection from the buffer
    const fileBuffer = req.file.buffer;
    const screenshotHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const paymentScreenshotUrl = `/api/registrations/${registrationId}/screenshot`;

    // Anti-fraud: duplicate screenshot check
    const duplicate = await Registration.findOne({
      screenshotHash,
      paymentStatus: { $ne: 'rejected' },
    });
    if (duplicate) {
      return res.status(409).json({
        error: 'This payment screenshot has already been submitted for another registration.',
      });
    }

    // Anti-fraud: duplicate UPI check
    for (const m of parsedMembers) {
      const existingUpi = await Registration.findOne({
        'members.upiId': m.upiId.trim(),
        paymentStatus: { $ne: 'rejected' },
      });
      if (existingUpi) {
        return res.status(409).json({
          error: `UPI ID "${m.upiId}" is already registered. Each person can only register once.`,
        });
      }
    }

    const registration = new Registration({
      registrationId,
      teamType,
      members: parsedMembers.map(m => ({
        name:  m.name.trim(),
        upiId: m.upiId.trim(),
        email: (m.email || '').trim(),
      })),
      feeAmount: parseInt(feeAmount),
      paymentScreenshotUrl,
      paymentScreenshotData: fileBuffer.toString('base64'),
      paymentScreenshotMime: req.file.mimetype,
      screenshotHash,
      paymentStatus: 'pending',
    });

    await registration.save();

    console.log(`📝 New registration: ${registrationId} | ${teamType} | ${parsedMembers.map(m => m.name).join(', ')}`);

    res.status(201).json({
      success:        true,
      registrationId,
      message:        'Registration submitted! Your payment is under review.',
      teamType,
      members:        parsedMembers.map(m => m.name),
      feeAmount:      parseInt(feeAmount),
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
    const [total, pending, verified, rejected, soloCount, duoCount, feeAgg] = await Promise.all([
      Registration.countDocuments(),
      Registration.countDocuments({ paymentStatus: 'pending' }),
      Registration.countDocuments({ paymentStatus: 'verified' }),
      Registration.countDocuments({ paymentStatus: 'rejected' }),
      Registration.countDocuments({ teamType: 'solo' }),
      Registration.countDocuments({ teamType: 'duo' }),
      Registration.aggregate([
        { $match: { paymentStatus: 'verified' } },
        { $group: { _id: null, total: { $sum: '$feeAmount' } } },
      ]),
    ]);
    res.json({
      total, pending, verified, rejected, soloCount, duoCount,
      totalFeeCollected:  feeAgg[0]?.total || 0,
      totalParticipants:  soloCount + duoCount * 2,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/registrations/:id/verify — Admin: verify or reject
app.patch('/api/registrations/:id/verify', async (req, res) => {
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

// GET /api/registrations/:id/status — Polling endpoint for participant to check if admin verified them
app.get('/api/registrations/:id/status', async (req, res) => {
  try {
    const reg = await Registration.findOne({ registrationId: req.params.id }).select('paymentStatus');
    if (!reg) return res.status(404).json({ error: 'Registration not found.' });
    res.json({ status: reg.paymentStatus });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/registrations/:id/screenshot — Serve screenshot dynamically from MongoDB
app.get('/api/registrations/:id/screenshot', async (req, res) => {
  try {
    // Explicitly select the paymentScreenshotData since it's excluded by default
    const reg = await Registration.findOne({ registrationId: req.params.id }).select('+paymentScreenshotData paymentScreenshotMime');
    if (!reg || !reg.paymentScreenshotData) {
      return res.status(404).json({ error: 'Screenshot not found.' });
    }
    
    const buffer = Buffer.from(reg.paymentScreenshotData, 'base64');
    res.set('Content-Type', reg.paymentScreenshotMime || 'image/jpeg');
    res.set('Content-Length', buffer.length);
    res.send(buffer);
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
    const reg = await Registration.findOne({ registrationId: registrationId.trim().toUpperCase() });
    if (!reg) {
      return res.status(404).json({ error: 'Registration ID not found. Check your ID and try again.' });
    }
    if (reg.paymentStatus === 'rejected') {
      return res.status(403).json({ error: 'Your registration was rejected. Contact the organizer.' });
    }
    if (reg.paymentStatus === 'pending') {
      return res.status(403).json({ status: 'pending', error: 'Your payment is still under review. Please wait for admin verification.' });
    }
    // verified
    console.log(`🎮 Arena login: ${reg.registrationId} [${reg.teamType}] ${reg.members.map(m => m.name).join(' & ')}`);
    res.json({
      success: true,
      registrationId: reg.registrationId,
      teamType: reg.teamType,
      members: reg.members.map(m => ({ name: m.name, email: m.email })),
    });
  } catch (err) {
    console.error('Arena login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Proctoring / Cheat Report Routes ────────────────────────────────────────

// POST /api/cheat-report — Upsert: one record per team (updates on repeat violations)
app.post('/api/cheat-report', cheatLimiter, async (req, res) => {
  try {
    const { teamName, reason, warnCount, phase, timestamp, locked, registrationId } = req.body;
    if (!teamName?.trim() || !reason?.trim()) {
      return res.status(400).json({ error: 'teamName and reason are required.' });
    }
    // Upsert: findOneAndUpdate with upsert so there is only ONE doc per team
    const report = await CheatReport.findOneAndUpdate(
      { teamName: teamName.trim() },
      {
        $set: {
          reason:           reason.trim(),
          warnCount:        warnCount || 1,
          phase:            phase || '',
          timestamp:        timestamp || Date.now(),
          locked:           locked || false,
          registrationId:   registrationId || '',
          // Reset re-entry request when a new violation comes in
          reentryRequested: false,
          reentryApproved:  false,
          adminUnlocked:    false,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`🚨 [${locked ? 'LOCKED' : `WARN ${warnCount}/3`}] ${teamName}: ${reason}`);
    res.status(201).json({ success: true, reportId: report._id });
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

// GET /api/cheat-reports/lock-status/:teamName — Participant polls to check if admin approved re-entry
app.get('/api/cheat-reports/lock-status/:teamName', async (req, res) => {
  try {
    const report = await CheatReport.findOne({ teamName: req.params.teamName }).lean();
    if (!report) {
      // No record at all — team has no violations. Return noReport so frontend does NOT auto-unlock.
      return res.json({ noReport: true, locked: false, reentryApproved: false, reentryRequested: false });
    }
    res.json({
      locked:           report.locked,
      reentryRequested: report.reentryRequested,
      // Only unlock when admin EXPLICITLY approved — never just because locked===false
      reentryApproved:  report.reentryApproved === true || report.adminUnlocked === true,
      warnCount:        report.warnCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/cheat-reports/:id/request-reentry — Player requests re-entry after being locked
app.patch('/api/cheat-reports/:id/request-reentry', async (req, res) => {
  try {
    const report = await CheatReport.findByIdAndUpdate(
      req.params.id,
      { reentryRequested: true, reentryApproved: false },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    console.log(`🔔 Re-entry requested by team: ${report.teamName}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/cheat-reports/:id/approve-reentry — Admin approves re-entry
app.patch('/api/cheat-reports/:id/approve-reentry', async (req, res) => {
  try {
    const report = await CheatReport.findByIdAndUpdate(
      req.params.id,
      { reentryApproved: true, adminUnlocked: true, locked: false },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    console.log(`✅ Re-entry approved for team: ${report.teamName}`);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/cheat-reports/:id/dismiss — Admin: remove a report
app.delete('/api/cheat-reports/:id/dismiss', async (req, res) => {
  try {
    await CheatReport.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/cheat-reports/:id/unlock — legacy compat
app.patch('/api/cheat-reports/:id/unlock', async (req, res) => {
  try {
    const report = await CheatReport.findByIdAndUpdate(
      req.params.id,
      { adminUnlocked: true, reentryApproved: true, locked: false },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    console.log(`🔓 Admin unlocked team: ${report.teamName}`);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
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
