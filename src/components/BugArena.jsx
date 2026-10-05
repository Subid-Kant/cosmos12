import React, { useState, useEffect, useRef, useCallback } from 'react';
import './BugArena.css';

// Local MongoDB Backend for sharing 6-character keys & admin syncing
// Ensure you start the backend server in 'server/' folder using 'node server.js'
// For production, the lead will set VITE_API_URL in the .env file
const REGISTRY_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/registry';
const SERVER_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/registry').replace('/api/registry', '');

// Helper to generate a 6-character uppercase key (e.g. "2BF45V")
const generate6CharKey = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// ─── Language Definitions ───────────────────────────────────────────────────
const LANGUAGES = [
  { id: 'python', name: 'Python', ext: '.py' },
  { id: 'java', name: 'Java', ext: '.java' },
  { id: 'cpp', name: 'C++', ext: '.cpp' },
  { id: 'javascript', name: 'JavaScript', ext: '.js' },
  { id: 'c', name: 'C', ext: '.c' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts' },
  { id: 'go', name: 'Go', ext: '.go' },
  { id: 'rust', name: 'Rust', ext: '.rs' },
  { id: 'kotlin', name: 'Kotlin', ext: '.kt' },
  { id: 'swift', name: 'Swift', ext: '.swift' },
  { id: 'php', name: 'PHP', ext: '.php' },
  { id: 'ruby', name: 'Ruby', ext: '.rb' },
  { id: 'csharp', name: 'C#', ext: '.cs' },
];

// ─── Keyword Sets for Syntax Highlighting ───────────────────────────────────
const LANGUAGE_KEYWORDS = {
  python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'yield', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'print', 'self', 'raise', 'del', 'global', 'nonlocal', 'assert', 'async', 'await'],
  java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'int', 'String', 'boolean', 'double', 'float', 'long', 'char', 'byte', 'short', 'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super', 'null', 'true', 'false', 'abstract', 'synchronized', 'volatile', 'enum'],
  cpp: ['#include', '#define', '#ifdef', '#ifndef', '#endif', 'using', 'namespace', 'std', 'class', 'struct', 'public', 'private', 'protected', 'virtual', 'override', 'static', 'const', 'constexpr', 'void', 'int', 'float', 'double', 'char', 'bool', 'string', 'auto', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'delete', 'nullptr', 'true', 'false', 'template', 'typename', 'sizeof', 'typedef', 'enum', 'cout', 'cin', 'endl'],
  javascript: ['const', 'let', 'var', 'function', 'class', 'extends', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'import', 'export', 'default', 'from', 'of', 'in', 'typeof', 'instanceof', 'null', 'undefined', 'true', 'false', 'async', 'await', 'yield', 'delete', 'void', 'console', 'log', 'map', 'filter', 'reduce', 'forEach', 'push', 'pop', 'shift', 'length', 'JSON', 'Math', 'Array', 'Object', 'Promise'],
  c: ['#include', '#define', '#ifdef', '#ifndef', '#endif', 'void', 'int', 'float', 'double', 'char', 'long', 'short', 'unsigned', 'signed', 'static', 'const', 'extern', 'struct', 'union', 'enum', 'typedef', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'sizeof', 'NULL', 'printf', 'scanf', 'malloc', 'free', 'calloc', 'realloc', 'main'],
  typescript: ['const', 'let', 'var', 'function', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'import', 'export', 'default', 'from', 'as', 'typeof', 'instanceof', 'null', 'undefined', 'true', 'false', 'async', 'await', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never', 'readonly', 'abstract', 'public', 'private', 'protected', 'static', 'keyof', 'infer'],
  go: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'select', 'default', 'fallthrough', 'nil', 'true', 'false', 'int', 'float64', 'float32', 'string', 'bool', 'byte', 'error', 'make', 'len', 'cap', 'append', 'fmt', 'Println', 'Printf', 'Sprintf'],
  rust: ['fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait', 'pub', 'mod', 'use', 'crate', 'self', 'super', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'move', 'async', 'await', 'unsafe', 'where', 'type', 'as', 'in', 'ref', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'Box', 'Vec', 'String', 'Option', 'Result', 'println', 'macro_rules', 'derive'],
  kotlin: ['fun', 'val', 'var', 'class', 'object', 'interface', 'data', 'sealed', 'abstract', 'open', 'override', 'private', 'public', 'protected', 'internal', 'return', 'if', 'else', 'when', 'for', 'while', 'do', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'import', 'package', 'this', 'super', 'null', 'true', 'false', 'is', 'in', 'as', 'companion', 'init', 'suspend', 'coroutine', 'lateinit', 'by', 'lazy', 'inline', 'Int', 'String', 'Boolean', 'Double', 'Float', 'println'],
  swift: ['func', 'var', 'let', 'class', 'struct', 'enum', 'protocol', 'extension', 'typealias', 'import', 'return', 'if', 'else', 'guard', 'for', 'while', 'repeat', 'switch', 'case', 'break', 'continue', 'do', 'try', 'catch', 'throw', 'throws', 'rethrows', 'self', 'super', 'init', 'deinit', 'nil', 'true', 'false', 'public', 'private', 'internal', 'fileprivate', 'open', 'static', 'override', 'mutating', 'async', 'await', 'print', 'String', 'Int', 'Double', 'Bool', 'Array', 'Optional'],
  php: ['<?php', '?>', 'function', 'class', 'extends', 'implements', 'public', 'private', 'protected', 'static', 'const', 'var', 'new', 'return', 'if', 'else', 'elseif', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'echo', 'print', 'array', 'null', 'true', 'false', 'use', 'namespace', 'require', 'include', 'isset', 'unset', 'empty', 'die', 'exit'],
  ruby: ['def', 'class', 'module', 'end', 'if', 'elsif', 'else', 'unless', 'case', 'when', 'for', 'while', 'until', 'do', 'begin', 'rescue', 'ensure', 'raise', 'return', 'yield', 'block_given?', 'self', 'super', 'nil', 'true', 'false', 'and', 'or', 'not', 'require', 'include', 'extend', 'attr_accessor', 'attr_reader', 'attr_writer', 'puts', 'print', 'p', 'lambda', 'proc', 'new', 'initialize', 'each', 'map', 'select', 'inject'],
  csharp: ['using', 'namespace', 'class', 'interface', 'struct', 'enum', 'public', 'private', 'protected', 'internal', 'static', 'readonly', 'const', 'void', 'int', 'string', 'bool', 'float', 'double', 'decimal', 'char', 'byte', 'long', 'short', 'var', 'new', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'this', 'base', 'null', 'true', 'false', 'async', 'await', 'override', 'virtual', 'abstract', 'sealed', 'partial', 'get', 'set', 'value', 'typeof', 'nameof', 'is', 'as', 'in', 'out', 'ref', 'params', 'yield', 'Console', 'WriteLine'],
};

// Comment patterns per language
const COMMENT_PATTERNS = {
  python: { line: '#', blockStart: null, blockEnd: null },
  ruby: { line: '#', blockStart: '=begin', blockEnd: '=end' },
  default: { line: '//', blockStart: '/*', blockEnd: '*/' },
};

// ─── Syntax Highlighter (Token-based) ───────────────────────────────────────
const highlightCode = (code, language) => {
  if (!code) return '';

  const escapeHtml = (str) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const keywords = new Set(LANGUAGE_KEYWORDS[language] || LANGUAGE_KEYWORDS.javascript);
  const commentConfig = COMMENT_PATTERNS[language] || COMMENT_PATTERNS.default;

  let tokenRegex;
  if (commentConfig.line === '#') {
    tokenRegex = /(\#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+\.?\d*\b|\b[A-Za-z_#][A-Za-z0-9_]*\b|[{}[\]()])/g;
  } else {
    tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+\.?\d*\b|\b[A-Za-z_#][A-Za-z0-9_]*\b|[{}[\]()])/g;
  }

  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtml(code.substring(lastIndex, match.index));
    }

    const token = match[0];
    const escapedToken = escapeHtml(token);

    if (token.startsWith('//') || token.startsWith('/*') || (commentConfig.line === '#' && token.startsWith('#') && !token.startsWith('#include') && !token.startsWith('#define') && !token.startsWith('#ifdef') && !token.startsWith('#ifndef') && !token.startsWith('#endif'))) {
      result += `<span class="syn-comment">${escapedToken}</span>`;
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      result += `<span class="syn-string">${escapedToken}</span>`;
    } else if (/^\d+\.?\d*$/.test(token)) {
      result += `<span class="syn-number">${escapedToken}</span>`;
    } else if (keywords.has(token)) {
      result += `<span class="syn-keyword">${escapedToken}</span>`;
    } else if (/^[{}[\]()]$/.test(token)) {
      result += `<span class="syn-bracket">${escapedToken}</span>`;
    } else {
      result += escapedToken;
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < code.length) {
    result += escapeHtml(code.substring(lastIndex));
  }

  return result;
};

// ─── Neon Particle Background ───────────────────────────────────────────────
const NeonParticles = () => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  const initParticles = useCallback((canvas) => {
    const particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 18000);
    for (let i = 0; i < count; i++) {
      const colors = ['#ff6b6b', '#00ffff', '#9d4edd', '#4ade80', '#f59e0b'];
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3 - 0.15,
        size: Math.random() * 2.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random() * 0.6 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      particlesRef.current = initParticles(canvas);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 60, 60, 0.03)';
      ctx.lineWidth = 0.5;
      const gridSize = 60;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.pulse += p.pulseSpeed;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

        const glow = (Math.sin(p.pulse) + 1) * 0.5;
        const currentOpacity = p.opacity * (0.5 + glow * 0.5);
        const currentSize = p.size * (0.8 + glow * 0.4);

        ctx.save();
        ctx.globalAlpha = currentOpacity;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  );
};

// ─── Toast Component ────────────────────────────────────────────────────────
const Toast = ({ message, type = 'success', onDone }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDone(), 2800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={`ba-toast ${type === 'error' ? 'ba-toast-error' : ''}`}>
      <span className="ba-toast-icon">{type === 'error' ? '✗' : '✓'}</span>
      <span>{message}</span>
    </div>
  );
};

// ─── Code Editor Component ──────────────────────────────────────────────────
const CodeEditor = ({ code, onChange, language, readOnly = false, teamInfo = null }) => {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const lines = code ? code.split('\n') : [''];
  const lineCount = lines.length;

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleInput = (e) => {
    if (!readOnly) {
      onChange(e.target.value);
    }
  };

  const handleTab = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!readOnly) {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const newCode = code.substring(0, start) + '  ' + code.substring(end);
        onChange(newCode);
        requestAnimationFrame(() => {
          e.target.selectionStart = e.target.selectionEnd = start + 2;
        });
      }
    }
  };

  const langObj = LANGUAGES.find(l => l.id === language) || LANGUAGES[0];

  return (
    <div className="ba-editor-terminal ba-fade-in">
      <div className="ba-editor-header">
        <div className="ba-editor-dots">
          <span className="ba-editor-dot-r" />
          <span className="ba-editor-dot-y" />
          <span className="ba-editor-dot-g" />
        </div>
        <div className="ba-editor-title-bar">
          {teamInfo
            ? `${teamInfo.team} — buggy_code${langObj.ext}`
            : `bug-arena — code${langObj.ext}`}
        </div>
        <div className="ba-editor-lang-badge">
          <span className="ba-lang-dot" />
          {langObj.name}
        </div>
      </div>

      {teamInfo && (
        <div className="ba-decoded-info">
          <span className="ba-decoded-team">
            🏷️ Team: {teamInfo.team}
          </span>
          <span className="ba-decoded-separator" />
          <span className="ba-decoded-lang">
            💻 {langObj.name}
          </span>
        </div>
      )}

      <div className="ba-editor-body">
        <div className="ba-line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i} className="ba-line-num">{i + 1}</span>
          ))}
        </div>
        <div className="ba-code-container">
          <pre
            ref={highlightRef}
            className="ba-code-highlight"
            dangerouslySetInnerHTML={{ __html: highlightCode(code, language) + '\n' }}
          />
          <textarea
            ref={textareaRef}
            className={`ba-code-textarea ${readOnly ? 'ba-code-readonly' : ''}`}
            value={code}
            onChange={handleInput}
            onScroll={handleScroll}
            onKeyDown={handleTab}
            readOnly={readOnly}
            placeholder={readOnly ? '' : 'Write your buggy code here...\n\n// Remember: hide a subtle bug for the other team to find!'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="ba-editor-footer">
        <div className="ba-editor-info">
          <span>📄 {lineCount} lines</span>
          <span>🔤 {code.length} chars</span>
          <span>💻 {langObj.name}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Bug Arena Component ───────────────────────────────────────────────
const BugArena = ({ onAbort }) => {
  const [phase, setPhase] = useState('create'); // 'create' | 'exchange' | 'hunt' | 'admin'
  const [teamName, setTeamName] = useState('');
  const [language, setLanguage] = useState('python');
  const [isSetup, setIsSetup] = useState(false);
  const [code, setCode] = useState('');
  const [createdBugs, setCreatedBugs] = useState([
    { id: 1, lineNumber: '', description: '' }
  ]);
  const [submittedKey, setSubmittedKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [importString, setImportString] = useState('');
  const [decodedData, setDecodedData] = useState(null);
  const [foundBugs, setFoundBugs] = useState([
    { id: 1, lineNumber: '', description: '', fix: '' }
  ]);
  const [reportGenerated, setReportGenerated] = useState(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [toast, setToast] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const fullText = '> Initializing Bug Arena Protocol...';

  // ── Registration / Payment State ──
  const [regPhase, setRegPhase] = useState('form'); // 'form' | 'qr' | 'done'
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationId, setRegistrationId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending'); // 'pending' | 'verified' | 'rejected'
  const [regTeamType, setRegTeamType] = useState('solo'); // 'solo' | 'duo'
  const [regMembers, setRegMembers] = useState([
    { name: '', upiId: '', email: '' },
    { name: '', upiId: '', email: '' },
  ]);
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState('');

  // ── Event Day Login State ──
  const [eventDayMode, setEventDayMode] = useState(false);
  const [loginRegId, setLoginRegId] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── Admin Portal State ──
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminActiveTab, setAdminActiveTab] = useState('registrations'); // 'registrations' | 'teams' | 'matcher' | 'compare' | 'proctoring'
  const [adminRegistryData, setAdminRegistryData] = useState(null);
  const [adminRegistrations, setAdminRegistrations] = useState([]);
  const [adminRegStats, setAdminRegStats] = useState(null);
  const [adminCheatReports, setAdminCheatReports] = useState([]);
  // inspectingTeam removed — was unused state
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(false);
  const [isVerifying, setIsVerifying] = useState('');
  const [expandedReg, setExpandedReg] = useState(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');

  // Proctoring Mode State
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [activeCheatReportId, setActiveCheatReportId] = useState(null);
  const [reentryRequested, setReentryRequested] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.substring(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let intervalId;
    if (regPhase === 'done' && paymentStatus === 'pending') {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`${SERVER_BASE}/api/registrations/${registrationId}/status`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'verified' || data.status === 'rejected') {
              setPaymentStatus(data.status);
              if (data.status === 'verified') clearInterval(intervalId);
            }
          }
        } catch (e) {
          // ignore network errors
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [regPhase, paymentStatus, registrationId]);

  // Poll lock status when locked
  useEffect(() => {
    if (!isLocked || !teamName) return;
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_BASE}/api/cheat-reports/lock-status/${encodeURIComponent(teamName)}`);
        const data = await res.json();
        if (data.reentryApproved || !data.locked) {
          setIsLocked(false);
          setCheatWarnings(0);
          setReentryRequested(false);
          showToast('Admin approved your re-entry. Play fair!', 'success');
        }
      } catch (e) {
        // ignore
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [isLocked, teamName]);

  useEffect(() => {
    const handleKeyCombo = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        if (isAdminLoggedIn) {
          setPhase('admin');
          fetchAdminRegistryData();
        } else {
          setAdminModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyCombo);
    return () => window.removeEventListener('keydown', handleKeyCombo);
  }, [isAdminLoggedIn]);

  // Proctoring is ONLY active when user is in code-writing phases
  // (not during registration, setup, or admin mode)
  const isProctoringActive =
    isSetup && isRegistered && (phase === 'create' || phase === 'hunt') && !isAdminLoggedIn;

  useEffect(() => {
    if (!isProctoringActive) return; // Guard: only run during code phases

    const reportCheatToServer = async (reason, warnCount) => {
      try {
        const res = await fetch(`${SERVER_BASE}/api/cheat-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamName: teamName || 'Unknown Team',
            registrationId: registrationId || '',
            reason,
            warnCount,
            phase,
            timestamp: Date.now(),
            locked: warnCount >= 3,
          }),
        });
        const data = await res.json();
        if (data.success && data.reportId) {
          setActiveCheatReportId(data.reportId);
        }
      } catch (e) {
        console.warn('Could not report cheat event:', e);
      }
    };

    const handleCheatingAttempt = (reason) => {
      setCheatWarnings(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) {
          setIsLocked(true);
          setReentryRequested(false);
          reportCheatToServer(`LOCKED — final trigger: ${reason}`, newCount);
        } else {
          // Show inline warning toast
          setToast({ message: `🚨 PROCTORING WARNING ${newCount}/3: ${reason}`, type: 'error' });
          reportCheatToServer(reason, newCount);
        }
        return newCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleCheatingAttempt('Tab switching / leaving page detected');
    };
    // Debounce blur: only fire if window stays blurred for >400ms (avoids internal clicks)
    let blurTimer = null;
    const handleBlur = () => {
      blurTimer = setTimeout(() => {
        if (document.visibilityState !== 'hidden') {
          handleCheatingAttempt('Window focus lost — left the arena window');
        }
      }, 400);
    };
    const handleFocus = () => { if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; } };
    const handleCopyPaste = (e) => {
      e.preventDefault();
      handleCheatingAttempt('Copy / Paste / Cut operation blocked');
    };
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        e.preventDefault();
        handleCheatingAttempt('Keyboard shortcut (Ctrl+C/V/X) blocked');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      window.removeEventListener('keydown', handleKeyDown);
      if (blurTimer) clearTimeout(blurTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProctoringActive, phase, teamName]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchAdminRegistryData = async () => {
    setIsLoadingAdminData(true);
    try {
      const res = await fetch(REGISTRY_URL);
      const data = await res.json();
      setAdminRegistryData(data || {});

      // Also fetch registrations
      const regRes = await fetch(`${SERVER_BASE}/api/registrations`);
      const regData = await regRes.json();
      setAdminRegistrations(Array.isArray(regData) ? regData : []);

      // Fetch stats
      const statsRes = await fetch(`${SERVER_BASE}/api/registrations/stats`);
      const statsData = await statsRes.json();
      setAdminRegStats(statsData);

      // Fetch cheat reports
      const cheatRes = await fetch(`${SERVER_BASE}/api/cheat-reports`);
      const cheatData = await cheatRes.json();
      setAdminCheatReports(Array.isArray(cheatData) ? cheatData : []);

      showToast('Portal data refreshed!');
    } catch (e) {
      showToast('Failed to fetch data — ensure server is running', 'error');
    }
    setIsLoadingAdminData(false);
  };

  // Admin dismisses / clears a cheat report
  const handleDismissCheatReport = async (reportId) => {
    try {
      await fetch(`${SERVER_BASE}/api/cheat-reports/${reportId}/dismiss`, { method: 'DELETE' });
      setAdminCheatReports(prev => prev.filter(r => r._id !== reportId));
      showToast('Cheat report dismissed.');
    } catch (e) {
      showToast('Could not dismiss report — server error', 'error');
    }
  };

  // Admin unlocks a participant from the server side
  const handleAdminUnlockParticipant = async (reportId, teamName) => {
    try {
      await fetch(`${SERVER_BASE}/api/cheat-reports/${reportId}/approve-reentry`, { method: 'PATCH' });
      setAdminCheatReports(prev => prev.map(r => r._id === reportId ? { ...r, reentryApproved: true, adminUnlocked: true, locked: false } : r));
      showToast(`✅ ${teamName} has been unlocked and can re-enter.`);
    } catch (e) {
      showToast('Could not unlock — server error', 'error');
    }
  };

  const handleRequestReentry = async () => {
    if (!activeCheatReportId) {
      showToast('No active lock session found.', 'error');
      return;
    }
    try {
      await fetch(`${SERVER_BASE}/api/cheat-reports/${activeCheatReportId}/request-reentry`, { method: 'PATCH' });
      setReentryRequested(true);
      showToast('Re-entry request sent to admin. Please wait.');
    } catch (e) {
      showToast('Could not send request', 'error');
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${SERVER_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsernameInput.trim(),
          password: adminPasswordInput,
        }),
      });
      if (res.ok) {
        setIsAdminLoggedIn(true);
        setAdminModalOpen(false);
        setPhase('admin');
        setAdminActiveTab('registrations');
        fetchAdminRegistryData();
        showToast('Welcome! Portal unlocked.');
      } else {
        const data = await res.json();
        showToast(data.error || 'Invalid credentials.', 'error');
      }
    } catch {
      showToast('Cannot reach server. Try again.', 'error');
    }
  };

  // ─── Handle payment screenshot file selection ────────────────────────────
  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setRegError('Screenshot must be under 10MB.');
      return;
    }
    setPaymentScreenshot(file);
    setRegError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPaymentScreenshotPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // ─── Handle Registration Submit ──────────────────────────────────────────
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');

    const activeMembers = regTeamType === 'solo'
      ? [regMembers[0]]
      : [regMembers[0], regMembers[1]];

    // Client-side validation
    for (const m of activeMembers) {
      if (!m.name.trim()) { setRegError('Please enter all member names.'); return; }
      if (!m.upiId.trim()) { setRegError('Please enter all UPI IDs.'); return; }
      if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(m.upiId.trim())) {
        setRegError(`Invalid UPI ID: "${m.upiId}" — format should be like yourname@bank`); return;
      }
    }

    if (!paymentScreenshot) {
      setRegError('Please upload your payment screenshot.');
      return;
    }

    const feeAmount = regTeamType === 'solo' ? 50 : 100;

    const formData = new FormData();
    formData.append('teamType', regTeamType);
    formData.append('members', JSON.stringify(activeMembers));
    formData.append('feeAmount', feeAmount);
    formData.append('paymentScreenshot', paymentScreenshot);

    setIsRegistering(true);
    try {
      const res = await fetch(`${SERVER_BASE}/api/register`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setRegError(data.error || 'Registration failed. Please try again.');
        setIsRegistering(false);
        return;
      }

      // BUG FIX: Do NOT set isRegistered here — show the success screen first.
      // User clicks "Enter the Arena" button which calls setIsRegistered(true).
      setRegistrationId(data.registrationId);
      setRegPhase('done');
      showToast(`🎉 Registration successful! ID: ${data.registrationId}`);
    } catch (err) {
      setRegError('Could not reach the server. Make sure the backend is running.');
    }
    setIsRegistering(false);
  };

  // ─── Update a member field ────────────────────────────────────────────────
  const updateRegMember = (idx, field, value) => {
    setRegMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  // ─── Admin: verify / reject a registration ───────────────────────────────
  const handleVerifyRegistration = async (registrationId, status) => {
    setIsVerifying(registrationId);
    try {
      const res = await fetch(`${SERVER_BASE}/api/registrations/${registrationId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: adminNoteInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminRegistrations(prev =>
          prev.map(r => r.registrationId === registrationId ? data.registration : r)
        );
        showToast(`✅ Registration ${status === 'verified' ? 'Verified' : 'Rejected'}!`);
        setExpandedReg(null);
        setAdminNoteInput('');
        // refresh stats
        fetchAdminRegistryData();
      } else {
        showToast(data.error || 'Action failed', 'error');
      }
    } catch {
      showToast('Server error during verification', 'error');
    }
    setIsVerifying('');
  };

  const handleSetup = (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      showToast('Please enter a team name', 'error');
      return;
    }
    setIsSetup(true);
  };

  // ── Created Bugs Handlers (Creator Team) ──
  const addCreatedBug = () => {
    setCreatedBugs(prev => [...prev, { id: Date.now(), lineNumber: '', description: '' }]);
  };

  const removeCreatedBug = (id) => {
    if (createdBugs.length > 1) {
      setCreatedBugs(prev => prev.filter(b => b.id !== id));
    }
  };

  const updateCreatedBug = (id, field, value) => {
    setCreatedBugs(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  // ── Found Bugs Handlers (Hunter Team) ──
  const addFoundBug = () => {
    setFoundBugs(prev => [...prev, { id: Date.now(), lineNumber: '', description: '', fix: '' }]);
  };

  const removeFoundBug = (id) => {
    if (foundBugs.length > 1) {
      setFoundBugs(prev => prev.filter(b => b.id !== id));
    }
  };

  const updateFoundBug = (id, field, value) => {
    setFoundBugs(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  // ── Submit Code & Generate 6-Character Key ──
  const handleSubmitCode = async () => {
    if (!code.trim()) {
      showToast('Write some code before submitting!', 'error');
      return;
    }
    const validBugs = createdBugs.filter(b => b.description.trim());
    if (validBugs.length === 0) {
      showToast('Please enter at least one bug description!', 'error');
      return;
    }

    setIsSubmitting(true);
    const key = generate6CharKey();
    const payload = {
      team: teamName.trim() || 'Team Anonymous',
      language,
      code,
      createdBugs: validBugs,
      bugLineNumber: validBugs.map(b => b.lineNumber || 'N/A').join(', '),
      bugInfo: validBugs.map(b => b.description).join(' | '),
      key,
      timestamp: Date.now(),
    };

    // 1. Store in localStorage
    try {
      localStorage.setItem(`nexus_bug_${key}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage warning:', e);
    }

    // 2. Sync to online JSONBlob registry
    try {
      const getRes = await fetch(REGISTRY_URL);
      const registry = (await getRes.json()) || {};
      registry[key] = payload;

      await fetch(REGISTRY_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registry),
      });
    } catch (err) {
      console.warn('Cloud registry sync error:', err);
    }

    setSubmittedKey(key);
    setIsSubmitting(false);
    showToast(`Code submitted with ${validBugs.length} bug(s)! Key: ${key}`);
  };

  // ── Decode 6-Character Key ──
  const handleDecodeKey = async () => {
    const rawInput = importString.trim();
    if (!rawInput) {
      showToast('Please enter a 6-character key to decode!', 'error');
      return;
    }

    setIsDecoding(true);
    const cleanKey = rawInput.toUpperCase();

    // Check 1: Is it a 6-character key in localStorage?
    const localData = localStorage.getItem(`nexus_bug_${cleanKey}`);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        setDecodedData(parsed);
        setIsDecoding(false);
        setPhase('hunt');
        showToast(`Key "${cleanKey}" decoded! Code from Team "${parsed.team}" loaded.`);
        return;
      } catch (e) {
        console.warn('Local storage parse error:', e);
      }
    }

    // Check 2: Query Cloud Registry
    try {
      const getRes = await fetch(REGISTRY_URL);
      const registry = await getRes.json();
      if (registry && registry[cleanKey]) {
        const payload = registry[cleanKey];
        localStorage.setItem(`nexus_bug_${cleanKey}`, JSON.stringify(payload));
        setDecodedData(payload);
        setIsDecoding(false);
        setPhase('hunt');
        showToast(`Key "${cleanKey}" decoded! Code from Team "${payload.team}" loaded.`);
        return;
      }
    } catch (err) {
      console.warn('Cloud fetch error:', err);
    }

    // Check 3: Fallback Base64 string if long code was pasted
    // BUG FIX: escape() is deprecated; use TextDecoder for proper UTF-8 handling
    if (rawInput.length > 20) {
      try {
        const bytes = Uint8Array.from(atob(rawInput), c => c.charCodeAt(0));
        const decoded = JSON.parse(new TextDecoder().decode(bytes));
        if (decoded.team && decoded.language && decoded.code) {
          setDecodedData(decoded);
          setIsDecoding(false);
          setPhase('hunt');
          showToast(`Encoded payload decoded! Code from Team "${decoded.team}" loaded.`);
          return;
        }
      } catch (e) {
        // invalid Base64 or JSON — silently ignore
      }
    }

    setIsDecoding(false);
    showToast(`Key "${cleanKey}" not found! Make sure the team submitted their code.`, 'error');
  };

  // ── Generate bug report ──
  const handleGenerateReport = async () => {
    const validFound = foundBugs.filter(b => b.description.trim());
    if (validFound.length === 0) {
      showToast('Describe at least one bug you found!', 'error');
      return;
    }

    const reviewer = teamName || 'Anonymous';
    const originalTeam = decodedData?.team || 'Unknown';
    const langName = LANGUAGES.find(l => l.id === decodedData?.language)?.name || decodedData?.language || 'Code';
    const timestamp = new Date().toLocaleString();

    let bugsSection = '';
    validFound.forEach((b, idx) => {
      bugsSection += `\n║ BUG #${idx + 1} (Line ${b.lineNumber || 'N/A'}):` +
        `\n║ ${b.description}` +
        (b.fix.trim() ? `\n║ Fix: ${b.fix}` : '') + '\n║ --------------------------------------------';
    });

    const reportText = `
╔══════════════════════════════════════════════╗
║           NEXUS BUG ARENA REPORT             ║
╠══════════════════════════════════════════════╣
║ Reviewer Team:    ${reviewer.padEnd(26)}║
║ Code Author:      ${originalTeam.padEnd(26)}║
║ Language:         ${langName.padEnd(26)}║
║ Bugs Reported:    ${validFound.length.toString().padEnd(26)}║
╠══════════════════════════════════════════════╣${bugsSection}
║ Submitted: ${timestamp.padEnd(33)}║
╚══════════════════════════════════════════════╝`.trim();

    setReportGenerated(reportText);

    // Sync report to cloud registry for Admin Matcher Tool
    const reportPayload = {
      id: 'R_' + Date.now(),
      reviewer,
      originalTeam,
      key: decodedData?.key || 'N/A',
      language: decodedData?.language || 'python',
      foundBugs: validFound,
      originalCreatedBugs: decodedData?.createdBugs || [],
      originalCode: decodedData?.code || '',
      timestamp: Date.now(),
    };

    try {
      const getRes = await fetch(REGISTRY_URL);
      const registry = (await getRes.json()) || {};
      const reports = registry.reports || [];
      reports.push(reportPayload);
      registry.reports = reports;
      await fetch(REGISTRY_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registry),
      });
    } catch (e) {
      console.warn('Cloud report sync error:', e);
    }

    // BUG FIX: clipboard write is blocked by proctoring copy listener.
    // Temporarily remove the copy guard, write, then re-add. But simpler:
    // Use a small timeout so the report state settles first, and we
    // programmatically bypass our own proctoring for this one write.
    try {
      await navigator.clipboard.writeText(reportText);
      showToast('Bug report generated & copied to clipboard!');
    } catch {
      showToast('Bug report generated & synced to Admin! (Copy it manually above)');
    }

    // Lock submission after report is generated
    setReportSubmitted(true);
  };

  // ── Automated Bug Matcher Algorithm ──
  const evaluateBugMatch = (hunterReport, creatorTeamData) => {
    if (!hunterReport || !creatorTeamData) {
      return { status: 'MISMATCH', score: 0, label: '🔴 MISMATCH', details: 'Insufficient comparison data' };
    }

    const hunterBugs = hunterReport.foundBugs || [];
    const creatorBugs = creatorTeamData.createdBugs || [];

    if (hunterBugs.length === 0 || creatorBugs.length === 0) {
      return { status: 'MISMATCH', score: 0, label: '🔴 MISMATCH', details: 'No bug items registered for comparison' };
    }

    let perfectMatches = 0;
    let partialMatches = 0;

    hunterBugs.forEach(hBug => {
      const hLine = (hBug.lineNumber || '').toString().trim();
      const hDesc = (hBug.description || '').toLowerCase();

      creatorBugs.forEach(cBug => {
        const cLine = (cBug.lineNumber || '').toString().trim();
        const cDesc = (cBug.description || '').toLowerCase();

        const lineMatch = hLine && cLine && (hLine === cLine || hLine.includes(cLine) || cLine.includes(hLine));

        const hWords = hDesc.split(/\W+/).filter(w => w.length > 3);
        const cWords = cDesc.split(/\W+/).filter(w => w.length > 3);
        const wordMatchCount = hWords.filter(w => cWords.includes(w)).length;

        if (lineMatch && wordMatchCount >= 1) {
          perfectMatches++;
        } else if (lineMatch || wordMatchCount >= 2) {
          partialMatches++;
        }
      });
    });

    if (perfectMatches > 0) {
      return {
        status: 'PERFECT',
        score: perfectMatches * 100 + partialMatches * 50,
        label: '🟢 PERFECT MATCH',
        details: `${perfectMatches} bug(s) matched exact line number & description keywords!`
      };
    } else if (partialMatches > 0) {
      return {
        status: 'PARTIAL',
        score: partialMatches * 50,
        label: '🟡 PARTIAL MATCH',
        details: `${partialMatches} bug(s) matched line number or keyword description.`
      };
    } else {
      return {
        status: 'MISMATCH',
        score: 0,
        label: '🔴 MISMATCH',
        details: 'Reported bugs do not match creator\'s registered bugs.'
      };
    }
  };

  // ─── Render Registration / Payment Form ─────────────────────────────────
  const handleEventDayLogin = async (e) => {
    e.preventDefault();
    if (!loginRegId.trim()) {
      showToast('Please enter your Registration ID.', 'error');
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${SERVER_BASE}/api/arena-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: loginRegId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setRegistrationId(data.registrationId);
        setIsRegistered(true);
        // Pre-fill team details for setup phase
        setRegTeamType(data.teamType);
        const memberNames = data.members.map(m => m.name).join(' & ');
        setTeamName(memberNames);
        showToast('Login successful! Welcome to the Arena.');
      } else {
        showToast(data.error || 'Login failed.', 'error');
      }
    } catch (e) {
      showToast('Cannot connect to server. Try again.', 'error');
    }
    setIsLoggingIn(false);
  };

  const renderRegistrationForm = () => {
    const feeAmount = regTeamType === 'solo' ? 50 : 100;

    if (eventDayMode) {
      return (
        <div className="ba-fade-in" style={{ maxWidth: '440px', margin: '4rem auto' }}>
          <div className="ba-setup-card">
            <div className="ba-setup-header">
              <div className="ba-setup-dots"><span className="ba-setup-dot-r"/><span className="ba-setup-dot-y"/><span className="ba-setup-dot-g"/></div>
              <div className="ba-setup-title-bar">event-day-login</div>
            </div>
            <form className="ba-setup-body" onSubmit={handleEventDayLogin}>
              <h2 style={{ textAlign: 'center', color: '#00ffff', margin: '0 0 1rem', fontFamily: 'Space Grotesk, sans-serif' }}>Arena Login</h2>
              <p style={{ color: '#a0a0c5', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Event day has arrived! Enter your verified Registration ID to access the arena.
              </p>
              <div className="ba-field-group">
                <input
                  type="text"
                  className="ba-field-input"
                  placeholder="Enter Registration ID (e.g. NEXUS-XXXX)"
                  value={loginRegId}
                  onChange={e => setLoginRegId(e.target.value.toUpperCase())}
                  style={{ textAlign: 'center', letterSpacing: '2px', fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}
                />
              </div>
              <button
                type="submit"
                className="ba-neon-btn ba-btn-cyan"
                style={{ width: '100%', marginTop: '0.8rem', padding: '0.8rem' }}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'Verifying...' : 'Enter Arena ⚡'}
              </button>
              
              <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button 
                  type="button" 
                  onClick={() => setEventDayMode(false)} 
                  style={{ background: 'none', border: 'none', color: '#6b6b8a', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Need to register and pay instead?
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (regPhase === 'done') {
      return (
        <div className="ba-fade-in" style={{ textAlign: 'center', padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ fontSize: '4rem' }}>{paymentStatus === 'verified' ? '🎉' : paymentStatus === 'rejected' ? '❌' : '⏳'}</div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 900, background: paymentStatus === 'verified' ? 'linear-gradient(135deg, #4ade80 0%, #00ffff 60%, #9d4edd 100%)' : paymentStatus === 'rejected' ? 'linear-gradient(135deg, #ff5f56 0%, #ff0000 100%)' : 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0 }}>
            {paymentStatus === 'verified' ? 'PAYMENT VERIFIED!' : paymentStatus === 'rejected' ? 'PAYMENT REJECTED' : 'REGISTRATION SUBMITTED!'}
          </h2>
          <p style={{ color: '#a0a0c5', fontSize: '0.95rem', maxWidth: '440px', lineHeight: 1.7 }}>
            {paymentStatus === 'verified' 
              ? 'Your slot is confirmed! You may now enter the arena.'
              : paymentStatus === 'rejected'
              ? 'Your payment screenshot was rejected by the admin. Please try registering again.'
              : 'Your registration is under review. The admin will verify your payment and confirm your slot. Keep your Registration ID safe!'}
          </p>
          <div className="ba-reg-id-box">
            <span style={{ fontSize: '0.72rem', color: '#7a7a9e', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Space Grotesk, sans-serif' }}>Your Registration ID</span>
            <span style={{ fontFamily: 'Courier New, monospace', fontSize: '1.3rem', fontWeight: 800, color: '#00ffff', letterSpacing: '0.12em', textShadow: '0 0 12px rgba(0,255,255,0.5)' }}>{registrationId}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="ba-neon-btn ba-btn-cyan" onClick={() => { navigator.clipboard.writeText(registrationId); showToast('Registration ID copied!'); }}>
              📋 Copy ID
            </button>
            <button 
              className={`ba-neon-btn ${paymentStatus === 'verified' ? 'ba-btn-green' : 'ba-btn-yellow'}`} 
              onClick={() => setIsRegistered(true)}
              disabled={paymentStatus !== 'verified'}
              style={{ opacity: paymentStatus !== 'verified' ? 0.5 : 1, cursor: paymentStatus !== 'verified' ? 'not-allowed' : 'pointer' }}
            >
              <span className="ba-btn-icon">⚡</span>
              {paymentStatus === 'verified' ? 'Enter the Arena' : paymentStatus === 'rejected' ? 'Access Denied' : 'Waiting for Admin...'}
            </button>
          </div>
          <div style={{ background: paymentStatus === 'verified' ? 'rgba(74, 222, 128, 0.06)' : paymentStatus === 'rejected' ? 'rgba(255, 95, 86, 0.06)' : 'rgba(251, 191, 36, 0.06)', border: `1px solid ${paymentStatus === 'verified' ? 'rgba(74, 222, 128, 0.2)' : paymentStatus === 'rejected' ? 'rgba(255, 95, 86, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`, borderRadius: '12px', padding: '1rem 1.5rem', fontSize: '0.83rem', color: '#7a7a9e', maxWidth: '420px', textAlign: 'left', lineHeight: 1.7 }}>
            <strong style={{ color: paymentStatus === 'verified' ? '#4ade80' : paymentStatus === 'rejected' ? '#ff5f56' : '#fbbf24' }}>⚠️ Note:</strong> Your slot is confirmed only after admin verifies the payment screenshot. Status: <span style={{ color: paymentStatus === 'verified' ? '#4ade80' : paymentStatus === 'rejected' ? '#ff5f56' : '#fbbf24', fontWeight: 'bold' }}>{paymentStatus.toUpperCase()}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="ba-fade-in">
        <div className="ba-section-header" style={{ position: 'relative' }}>
          <div className="ba-section-line" />
          <h2 className="ba-section-title">💳 Register & Pay Entry Fee</h2>
          <div className="ba-section-line" />
          <button 
            className="ba-neon-btn ba-btn-sm" 
            style={{ position: 'absolute', right: 0, background: 'rgba(0,255,255,0.1)', borderColor: 'rgba(0,255,255,0.4)', color: '#00ffff' }}
            onClick={() => setEventDayMode(true)}
          >
            🎮 Event Day Login
          </button>
        </div>
        <p className="ba-section-desc">
          Register your team and pay the entry fee to participate in Bug Arena. Scan the QR code below to pay via UPI.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '900px', margin: '0 auto' }}>

          {/* Left: Payment QR Code */}
          <div className="ba-reg-qr-card">
            <div className="ba-reg-qr-header">
              <span>📱 Scan to Pay</span>
            </div>
            <div className="ba-reg-qr-body">
              <div className="ba-reg-qr-wrap">
                <img src="/bugarena_qr.jpg" alt="Bug Arena Payment QR Code" className="ba-reg-qr-img" />
                <div className="ba-reg-qr-glow" />
              </div>
              <div className="ba-reg-fee-badge">
                <span className="ba-reg-fee-label">Entry Fee</span>
                <span className="ba-reg-fee-amount">₹{feeAmount}</span>
                <span className="ba-reg-fee-note">
                  {regTeamType === 'solo' ? '₹50 × 1 person' : '₹50 × 2 persons'}
                </span>
              </div>
              <div className="ba-reg-upi-section">
                <div className="ba-reg-upi-label">💳 Pay to these UPI IDs:</div>
                <div className="ba-reg-upi-list">
                  <div className="ba-reg-upi-item">
                    <span className="ba-reg-upi-name">Nexus Bug Arena</span>
                    <span className="ba-reg-upi-id">bugarena@nexus</span>
                  </div>
                  <div className="ba-reg-upi-item">
                    <span className="ba-reg-upi-name">Event Coordinator</span>
                    <span className="ba-reg-upi-id">nexustechclub@okaxis</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#6b6b8a', textAlign: 'center', marginTop: '0.5rem' }}>
                After payment, fill the form →  and upload your screenshot
              </div>
            </div>
          </div>

          {/* Right: Registration Form */}
          <div className="ba-setup-card" style={{ maxWidth: '100%', margin: 0 }}>
            <div className="ba-setup-header">
              <div className="ba-setup-dots">
                <span className="ba-setup-dot-r" />
                <span className="ba-setup-dot-y" />
                <span className="ba-setup-dot-g" />
              </div>
              <div className="ba-setup-title-bar">registration-form v1.0</div>
            </div>

            <form className="ba-setup-body" onSubmit={handleRegisterSubmit} style={{ gap: '1.2rem' }}>
              {/* Team Type Toggle */}
              <div className="ba-field-group">
                <label className="ba-field-label"><span>👥</span> Participation Type</label>
                <div className="ba-team-type-toggle">
                  <button
                    type="button"
                    className={`ba-type-btn ${regTeamType === 'solo' ? 'ba-type-btn-active' : ''}`}
                    onClick={() => setRegTeamType('solo')}
                  >
                    👤 Solo<br /><small>₹50 fee</small>
                  </button>
                  <button
                    type="button"
                    className={`ba-type-btn ${regTeamType === 'duo' ? 'ba-type-btn-active' : ''}`}
                    onClick={() => setRegTeamType('duo')}
                  >
                    👥 Duo (Team of 2)<br /><small>₹100 fee</small>
                  </button>
                </div>
              </div>

              {/* Member 1 */}
              <div className="ba-member-block">
                <div className="ba-member-label">
                  <span className="ba-member-icon">👤</span>
                  {regTeamType === 'duo' ? 'Member 1 (Team Leader)' : 'Your Details'}
                </div>
                <div className="ba-field-group">
                  <label className="ba-field-label"><span>🏷️</span> Full Name</label>
                  <input
                    type="text"
                    className="ba-field-input"
                    value={regMembers[0].name}
                    onChange={e => updateRegMember(0, 'name', e.target.value)}
                    placeholder="Enter full name..."
                    maxLength={60}
                    required
                  />
                </div>
                <div className="ba-field-group" style={{ marginTop: '0.6rem' }}>
                  <label className="ba-field-label"><span>💳</span> UPI ID (for payment verification)</label>
                  <input
                    type="text"
                    className="ba-field-input"
                    value={regMembers[0].upiId}
                    onChange={e => updateRegMember(0, 'upiId', e.target.value)}
                    placeholder="e.g. yourname@paytm"
                    maxLength={80}
                    required
                  />
                </div>
                <div className="ba-field-group" style={{ marginTop: '0.6rem' }}>
                  <label className="ba-field-label"><span>📧</span> Email (optional)</label>
                  <input
                    type="email"
                    className="ba-field-input"
                    value={regMembers[0].email}
                    onChange={e => updateRegMember(0, 'email', e.target.value)}
                    placeholder="email@example.com"
                    maxLength={100}
                  />
                </div>
              </div>

              {/* Member 2 (duo only) */}
              {regTeamType === 'duo' && (
                <div className="ba-member-block ba-member-block-2 ba-fade-in">
                  <div className="ba-member-label" style={{ color: '#9d4edd' }}>
                    <span className="ba-member-icon" style={{ color: '#9d4edd' }}>👤</span>
                    Member 2
                  </div>
                  <div className="ba-field-group">
                    <label className="ba-field-label" style={{ color: '#9d4edd' }}><span>🏷️</span> Full Name</label>
                    <input
                      type="text"
                      className="ba-field-input"
                      value={regMembers[1].name}
                      onChange={e => updateRegMember(1, 'name', e.target.value)}
                      placeholder="Enter full name..."
                      maxLength={60}
                      required
                    />
                  </div>
                  <div className="ba-field-group" style={{ marginTop: '0.6rem' }}>
                    <label className="ba-field-label" style={{ color: '#9d4edd' }}><span>💳</span> UPI ID (for payment verification)</label>
                    <input
                      type="text"
                      className="ba-field-input"
                      value={regMembers[1].upiId}
                      onChange={e => updateRegMember(1, 'upiId', e.target.value)}
                      placeholder="e.g. member2@gpay"
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className="ba-field-group" style={{ marginTop: '0.6rem' }}>
                    <label className="ba-field-label" style={{ color: '#9d4edd' }}><span>📧</span> Email (optional)</label>
                    <input
                      type="email"
                      className="ba-field-input"
                      value={regMembers[1].email}
                      onChange={e => updateRegMember(1, 'email', e.target.value)}
                      placeholder="email@example.com"
                      maxLength={100}
                    />
                  </div>
                </div>
              )}

              {/* Screenshot Upload */}
              <div className="ba-field-group">
                <label className="ba-field-label"><span>📸</span> Payment Screenshot</label>
                <div className="ba-screenshot-upload-zone" onClick={() => document.getElementById('screenshotInput').click()}>
                  {paymentScreenshotPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={paymentScreenshotPreview} alt="Payment screenshot preview" className="ba-screenshot-preview" />
                      <div className="ba-screenshot-overlay">
                        <span>🔄 Click to change</span>
                      </div>
                    </div>
                  ) : (
                    <div className="ba-upload-placeholder">
                      <div style={{ fontSize: '2.5rem' }}>📤</div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: '#c0c0e0', fontSize: '0.9rem' }}>Click to upload payment screenshot</div>
                      <div style={{ fontSize: '0.75rem', color: '#7a7a9e', marginTop: '0.3rem' }}>JPG, PNG or WebP · Max 10MB</div>
                      <div style={{ fontSize: '0.72rem', color: '#ff6b6b', marginTop: '0.4rem' }}>⚠️ Must be YOUR own payment screenshot</div>
                    </div>
                  )}
                </div>
                <input
                  id="screenshotInput"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleScreenshotChange}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Error message */}
              {regError && (
                <div className="ba-reg-error ba-fade-in">
                  <span>⚠️</span> {regError}
                </div>
              )}

              {/* Fee Summary */}
              <div className="ba-fee-summary">
                <span>💰 Total Fee:</span>
                <span className="ba-fee-total">₹{feeAmount}</span>
                <span style={{ color: '#7a7a9e', fontSize: '0.8rem' }}>({regTeamType === 'solo' ? '1 person' : '2 persons'} × ₹50)</span>
              </div>

              <button
                type="submit"
                className="ba-neon-btn ba-btn-green"
                disabled={isRegistering}
                style={{ alignSelf: 'center', marginTop: '0.5rem', minWidth: '220px' }}
              >
                <span className="ba-btn-icon">{isRegistering ? '⏳' : '🚀'}</span>
                {isRegistering ? 'Submitting Registration...' : 'Submit Registration'}
              </button>

              <p style={{ textAlign: 'center', color: '#6b6b8a', fontSize: '0.76rem', margin: 0 }}>
                🔒 Your screenshot hash is stored to prevent duplicate submissions. Each UPI ID can only register once.
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // ── Render phase content ──
  const renderCreatePhase = () => (
    <div className="ba-fade-in">
      <div className="ba-section-header">
        <div className="ba-section-line" />
        <h2 className="ba-section-title">🔧 Create Your Buggy Code</h2>
        <div className="ba-section-line" />
      </div>
      <p className="ba-section-desc">
        Write a piece of code in {LANGUAGES.find(l => l.id === language)?.name} that contains hidden bugs.
        Click <strong>Submit Bug Code</strong> to generate your unique 6-letter encrypted key!
      </p>

      {submittedKey ? (
        <div className="ba-submitted-card ba-fade-in">
          <div className="ba-submitted-body">
            <div style={{ fontSize: '2.2rem' }}>⚡</div>
            <h3 style={{ color: '#00ffff', margin: 0, fontSize: '1.4rem', fontFamily: 'Space Grotesk, sans-serif' }}>
              BUG SUBMITTED SUCCESSFULLY!
            </h3>
            <p className="ba-submitted-subtext">
              Here is your 6-letter encrypted key. Share this code with event hosts or rival teams to exchange your code.
            </p>
            
            <div className="ba-key-box">
              <span className="ba-key-display">{submittedKey}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                className="ba-neon-btn ba-btn-cyan"
                onClick={() => {
                  navigator.clipboard.writeText(submittedKey);
                  showToast(`Key ${submittedKey} copied to clipboard!`);
                }}
              >
                <span className="ba-btn-icon">📋</span>
                Copy Key ({submittedKey})
              </button>
              <button
                className="ba-neon-btn ba-btn-green"
                onClick={() => setPhase('exchange')}
              >
                <span className="ba-btn-icon">🔄</span>
                Go to Exchange Portal
              </button>
              <button
                className="ba-neon-btn ba-btn-sm ba-btn-yellow"
                onClick={() => setSubmittedKey('')}
              >
                ✏️ Edit Code
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <CodeEditor code={code} onChange={setCode} language={language} />

          {/* Bug Details Entry Form (Supports Multiple Bugs) */}
          <div className="ba-report-card" style={{ marginTop: '1.5rem', borderColor: 'rgba(255, 107, 107, 0.2)' }}>
            <div className="ba-report-header">
              <div className="ba-editor-dots">
                <span className="ba-editor-dot-r" />
                <span className="ba-editor-dot-y" />
                <span className="ba-editor-dot-g" />
              </div>
              <div className="ba-report-header-title" style={{ color: '#00ffff' }}>
                🐛 Register Hidden Bug Details ({createdBugs.length} Bug{createdBugs.length > 1 ? 's' : ''})
              </div>
            </div>
            <div className="ba-report-body" style={{ gap: '1.2rem' }}>
              {createdBugs.map((bug, index) => (
                <div key={bug.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingBottom: index < createdBugs.length - 1 ? '1rem' : 0, borderBottom: index < createdBugs.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ff6b6b', fontFamily: 'Space Grotesk, sans-serif' }}>
                      BUG #{index + 1}
                    </span>
                    {createdBugs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCreatedBug(bug.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ff5f56', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <div className="ba-report-row">
                    <div className="ba-field-group" style={{ flex: 1 }}>
                      <label className="ba-field-label">
                        <span>🔢</span> Line #(s)
                      </label>
                      <input
                        type="text"
                        className="ba-line-input"
                        value={bug.lineNumber}
                        onChange={(e) => updateCreatedBug(bug.id, 'lineNumber', e.target.value)}
                        placeholder="e.g. 4 or 4, 9"
                        style={{ borderColor: 'rgba(255, 107, 107, 0.2)', color: '#ff6b6b', width: '100%', textAlign: 'left' }}
                      />
                    </div>
                    <div className="ba-field-group" style={{ flex: 3 }}>
                      <label className="ba-field-label">
                        <span>🐛</span> Bug Description / Explanation
                      </label>
                      <input
                        type="text"
                        className="ba-field-input"
                        value={bug.description}
                        onChange={(e) => updateCreatedBug(bug.id, 'description', e.target.value)}
                        placeholder="Describe what bug is here (e.g. Using 'number' instead of 'numbers')..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="ba-neon-btn ba-btn-sm"
                onClick={addCreatedBug}
                style={{ alignSelf: 'flex-start', background: 'rgba(255, 107, 107, 0.1)', borderColor: 'rgba(255, 107, 107, 0.3)', color: '#ff6b6b' }}
              >
                ➕ Add Another Bug
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', gap: '0.8rem', flexWrap: 'wrap' }}>
            <button
              className="ba-neon-btn ba-btn-yellow"
              onClick={handleSubmitCode}
              disabled={!code.trim() || createdBugs.filter(b => b.description.trim()).length === 0 || isSubmitting}
            >
              <span className="ba-btn-icon">⚡</span>
              {isSubmitting ? 'Submitting & Encrypting...' : 'Submit Bug Code'}
            </button>
            <button
              className="ba-neon-btn ba-btn-cyan"
              onClick={() => {
                if (submittedKey) {
                  setPhase('exchange');
                } else {
                  showToast('Please submit your bug code first!', 'error');
                }
              }}
            >
              <span className="ba-btn-icon">🔄</span>
              Go to Exchange
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderExchangePhase = () => (
    <div className="ba-fade-in">
      <div className="ba-section-header">
        <div className="ba-section-line" />
        <h2 className="ba-section-title">🔄 Decode Rival Team's Code</h2>
        <div className="ba-section-line" />
      </div>
      <p className="ba-section-desc">
        Enter the 6-letter encrypted key (e.g. <code>2BF45V</code>) received from another team.
        Press Decode to unlock their code and start hunting!
      </p>

      <div className="ba-import-card">
        <div className="ba-editor-header">
          <div className="ba-editor-dots">
            <span className="ba-editor-dot-r" />
            <span className="ba-editor-dot-y" />
            <span className="ba-editor-dot-g" />
          </div>
          <div className="ba-editor-title-bar">decoder-terminal v1.0</div>
        </div>
        <div className="ba-import-body">
          <div className="ba-field-group">
            <label className="ba-field-label">
              <span>🗝️</span> Enter 6-Letter Encrypted Key
            </label>
            <input
              type="text"
              className="ba-field-input"
              value={importString}
              onChange={(e) => setImportString(e.target.value)}
              placeholder="e.g. 2BF45V"
              maxLength={40}
              style={{
                fontFamily: 'Space Grotesk, monospace',
                fontSize: '1.5rem',
                letterSpacing: '0.2em',
                textAlign: 'center',
                textTransform: 'uppercase',
                color: '#00ffff',
                borderColor: 'rgba(0, 255, 255, 0.4)',
                background: 'rgba(0, 0, 0, 0.6)'
              }}
            />
          </div>
          <div className="ba-import-actions" style={{ justifyContent: 'center' }}>
            <button
              className="ba-neon-btn ba-btn-cyan"
              onClick={handleDecodeKey}
              disabled={!importString.trim() || isDecoding}
            >
              <span className="ba-btn-icon">🔓</span>
              {isDecoding ? 'Decoding Key...' : 'Decode & Load Code'}
            </button>
            <button
              className="ba-neon-btn ba-btn-sm"
              onClick={() => setPhase('create')}
            >
              <span className="ba-btn-icon">←</span>
              Back to Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHuntPhase = () => (
    <div className="ba-fade-in">
      <div className="ba-section-header">
        <div className="ba-section-line" />
        <h2 className="ba-section-title">🐛 Hunt the Bug!</h2>
        <div className="ba-section-line" />
      </div>
      <p className="ba-section-desc">
        Review the code below from Team "{decodedData?.team}". Find the bug, identify the line,
        and submit your report!
      </p>

      {decodedData && (
        <>
          <CodeEditor
            code={decodedData.code}
            language={decodedData.language}
            readOnly
            teamInfo={{ team: decodedData.team }}
          />

          {/* Bug Report Form (Supports Multiple Bugs Found) */}
          <div className="ba-report-card" style={{ marginTop: '2rem' }}>
            <div className="ba-report-header">
              <div className="ba-editor-dots">
                <span className="ba-editor-dot-r" />
                <span className="ba-editor-dot-y" />
                <span className="ba-editor-dot-g" />
              </div>
              <div className="ba-report-header-title">
                🐛 Bug Report — filed by {teamName} ({foundBugs.length} Bug{foundBugs.length > 1 ? 's' : ''} Reported)
              </div>
            </div>
            <div className="ba-report-body" style={{ gap: '1.5rem' }}>
              {foundBugs.map((bug, index) => (
                <div key={bug.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingBottom: index < foundBugs.length - 1 ? '1.2rem' : 0, borderBottom: index < foundBugs.length - 1 ? '1px solid rgba(74, 222, 128, 0.1)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4ade80', fontFamily: 'Space Grotesk, sans-serif' }}>
                      REPORTED BUG #{index + 1}
                    </span>
                    {foundBugs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFoundBug(bug.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ff5f56', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <div className="ba-report-row">
                    <div className="ba-field-group" style={{ flex: 1 }}>
                      <label className="ba-field-label" style={{ color: '#4ade80' }}>
                        <span>🔢</span> Line #(s)
                      </label>
                      <input
                        type="text"
                        className="ba-line-input"
                        value={bug.lineNumber}
                        onChange={(e) => updateFoundBug(bug.id, 'lineNumber', e.target.value)}
                        placeholder="e.g. 7 or 7, 12"
                        style={{ width: '100%', textAlign: 'left' }}
                      />
                    </div>
                    <div className="ba-field-group" style={{ flex: 3 }}>
                      <label className="ba-field-label" style={{ color: '#4ade80' }}>
                        <span>📝</span> Bug Description
                      </label>
                      <input
                        type="text"
                        className="ba-field-input"
                        value={bug.description}
                        onChange={(e) => updateFoundBug(bug.id, 'description', e.target.value)}
                        placeholder="Describe the bug you found..."
                        style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}
                      />
                    </div>
                  </div>

                  <div className="ba-field-group">
                    <label className="ba-field-label" style={{ color: '#4ade80' }}>
                      <span>🔧</span> Suggested Fix (optional)
                    </label>
                    <textarea
                      className="ba-report-textarea"
                      value={bug.fix}
                      onChange={(e) => updateFoundBug(bug.id, 'fix', e.target.value)}
                      placeholder="How would you fix this bug? Write the corrected code or explain..."
                      style={{ minHeight: '70px' }}
                    />
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ba-neon-btn ba-btn-sm"
                  onClick={addFoundBug}
                  style={{ background: 'rgba(74, 222, 128, 0.1)', borderColor: 'rgba(74, 222, 128, 0.3)', color: '#4ade80' }}
                >
                  ➕ Add Another Found Bug
                </button>

                <button
                  className="ba-neon-btn ba-btn-green"
                  onClick={handleGenerateReport}
                  disabled={foundBugs.filter(b => b.description.trim()).length === 0 || reportSubmitted}
                  title={reportSubmitted ? 'Report already submitted — submission locked' : ''}
                >
                  <span className="ba-btn-icon">📋</span>
                  {reportSubmitted ? '✓ Report Submitted' : 'Generate & Copy Report'}
                </button>
              </div>
            </div>
          </div>

          {/* Generated Report Display */}
          {reportGenerated && (
            <div className="ba-report-summary ba-fade-in" style={{ marginTop: '1.5rem' }}>
              <div className="ba-report-header">
                <div className="ba-editor-dots">
                  <span className="ba-editor-dot-r" />
                  <span className="ba-editor-dot-y" />
                  <span className="ba-editor-dot-g" />
                </div>
                <div className="ba-report-header-title">
                  ✅ Report Generated
                </div>
              </div>
              <div className="ba-report-summary-body">
                {reportSubmitted ? (
                  /* ── THANK YOU SCREEN (blocks further action) ── */
                  <div style={{
                    textAlign: 'center',
                    padding: '2.5rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.2rem'
                  }}>
                    <div style={{ fontSize: '3rem' }}>🏆</div>
                    <h2 style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #ff6b6b 0%, #ff9f43 40%, #00ffff 70%, #9d4edd 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      letterSpacing: '0.04em',
                      margin: 0
                    }}>
                      THANK YOU FOR PARTICIPATION!
                    </h2>
                    <p style={{ color: '#7a7a9e', fontSize: '0.95rem', maxWidth: '420px', lineHeight: 1.6 }}>
                      Your bug report has been submitted and synced to the Admin Portal.
                      Await the final results from the event organisers.
                    </p>
                    <div style={{
                      padding: '0.6rem 1.8rem',
                      background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.12), rgba(0, 255, 255, 0.08))',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '50px',
                      color: '#00ffff',
                      fontSize: '0.8rem',
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase'
                    }}>
                      ✓ Submission Locked
                    </div>
                  </div>
                ) : (
                  /* ── Normal Report View ── */
                  <>
                    <pre>{reportGenerated}</pre>
                    <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="ba-neon-btn ba-btn-green ba-btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(reportGenerated);
                          showToast('Report copied again!');
                        }}
                      >
                        📋 Copy Report
                      </button>
                      <button
                        className="ba-neon-btn ba-btn-cyan ba-btn-sm"
                        onClick={() => {
                          setDecodedData(null);
                          setImportString('');
                          setFoundBugs([{ id: 1, lineNumber: '', description: '', fix: '' }]);
                          setReportGenerated(null);
                          setReportSubmitted(false);
                          setPhase('exchange');
                        }}
                      >
                        🔄 Review Another Code
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Render Admin Dashboard ──
  const renderAdminDashboard = () => {
    const rawData = adminRegistryData || {};
    // Extract registered teams (keys that are 6-chars)
    const teamEntries = Object.entries(rawData)
      .filter(([k, v]) => k !== 'reports' && v && typeof v === 'object' && v.code)
      .map(([k, v]) => ({ key: k, ...v }));

    const reportsList = rawData.reports || [];
    const serverBase = REGISTRY_URL.replace('/api/registry', '');

    const statusColor = (s) => s === 'verified' ? '#4ade80' : s === 'rejected' ? '#ff5f56' : '#fbbf24';
    const statusBg = (s) => s === 'verified' ? 'rgba(74,222,128,0.1)' : s === 'rejected' ? 'rgba(255,95,86,0.1)' : 'rgba(251,191,36,0.1)';

    return (
      <div className="ba-fade-in" style={{ width: '100%', maxWidth: '1100px' }}>
        {/* Admin Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              👑 ORGANIZER CONTROL PANEL
            </span>
            <h2 style={{ fontSize: '2rem', margin: '0.2rem 0 0', color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
              Nexus Admin Portal
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <button
              className="ba-neon-btn ba-btn-sm"
              onClick={fetchAdminRegistryData}
              disabled={isLoadingAdminData}
              style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}
            >
              🔄 {isLoadingAdminData ? 'Syncing...' : 'Refresh All Data'}
            </button>
            <button
              className="ba-neon-btn ba-btn-sm"
              onClick={() => {
                setIsAdminLoggedIn(false);
                setPhase('create');
                showToast('Admin logged out.');
              }}
              style={{ background: 'rgba(255, 95, 86, 0.1)', borderColor: 'rgba(255, 95, 86, 0.4)', color: '#ff5f56' }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="ba-phase-bar" style={{ marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button
            className={`ba-phase ${adminActiveTab === 'registrations' ? 'ba-phase-active' : ''}`}
            onClick={() => setAdminActiveTab('registrations')}
            style={{ color: adminActiveTab === 'registrations' ? '#4ade80' : '#6b6b8a' }}
          >
            <span>💳 Registrations & Payments ({adminRegistrations.length})</span>
          </button>
          <div className="ba-phase-connector" />
          <button
            className={`ba-phase ${adminActiveTab === 'teams' ? 'ba-phase-active' : ''}`}
            onClick={() => setAdminActiveTab('teams')}
            style={{ color: adminActiveTab === 'teams' ? '#fbbf24' : '#6b6b8a' }}
          >
            <span>🔧 Creating Teams & Codes ({teamEntries.length})</span>
          </button>
          <div className="ba-phase-connector" />
          <button
            className={`ba-phase ${adminActiveTab === 'matcher' ? 'ba-phase-active' : ''}`}
            onClick={() => setAdminActiveTab('matcher')}
            style={{ color: adminActiveTab === 'matcher' ? '#fbbf24' : '#6b6b8a' }}
          >
            <span>🐛 Finding Teams Reports ({reportsList.length})</span>
          </button>
          <div className="ba-phase-connector" />
          <button
            className={`ba-phase ${adminActiveTab === 'compare' ? 'ba-phase-active' : ''}`}
            onClick={() => setAdminActiveTab('compare')}
            style={{ color: adminActiveTab === 'compare' ? '#fbbf24' : '#6b6b8a' }}
          >
            <span>⚖️ Side-by-Side Verification &amp; Winner Decision</span>
          </button>
          <div className="ba-phase-connector" />
          <button
            className={`ba-phase ${adminActiveTab === 'proctoring' ? 'ba-phase-active' : ''}`}
            onClick={() => { setAdminActiveTab('proctoring'); fetchAdminRegistryData(); }}
            style={{ color: adminActiveTab === 'proctoring' ? '#ff6b6b' : '#6b6b8a', position: 'relative' }}
          >
            <span>🚨 Proctoring Alerts</span>
            {adminCheatReports.filter(r => !r.adminUnlocked).length > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff3333', color: '#fff', borderRadius: '50%', minWidth: '18px', height: '18px', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {adminCheatReports.filter(r => !r.adminUnlocked).length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 0: Registrations & Payment Verification */}
        {adminActiveTab === 'registrations' && (
          <div className="ba-admin-dashboard ba-fade-in">
            <div className="ba-admin-header">
              <div className="ba-admin-header-title">💳 Registrations & Payment Verification ({adminRegistrations.length})</div>
            </div>

            {/* Stats Bar */}
            {adminRegStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', padding: '1.5rem 1.5rem 0' }}>
                {[
                  { label: 'Total', value: adminRegStats.total, color: '#00ffff', icon: '📋' },
                  { label: 'Pending', value: adminRegStats.pending, color: '#fbbf24', icon: '⏳' },
                  { label: 'Verified', value: adminRegStats.verified, color: '#4ade80', icon: '✅' },
                  { label: 'Rejected', value: adminRegStats.rejected, color: '#ff5f56', icon: '❌' },
                  { label: 'Participants', value: adminRegStats.totalParticipants, color: '#9d4edd', icon: '👥' },
                  { label: 'Fee Collected', value: `₹${adminRegStats.totalFeeCollected}`, color: '#f59e0b', icon: '💰' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${stat.color}22`, borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem' }}>{stat.icon}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: stat.color, fontFamily: 'Space Grotesk, sans-serif' }}>{stat.value}</div>
                    <div style={{ fontSize: '0.72rem', color: '#7a7a9e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            {adminRegistrations.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#7a7a9e' }}>
                <p>No registrations yet. When students register and pay, their entries will appear here for verification.</p>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {adminRegistrations.map((reg) => (
                  <div key={reg.registrationId} style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${statusColor(reg.paymentStatus)}33`, borderRadius: '16px', overflow: 'hidden' }}>
                    {/* Registration Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: `${statusBg(reg.paymentStatus)}`, flexWrap: 'wrap', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
                          {reg.teamType === 'duo' ? '👥' : '👤'} {reg.members.map(m => m.name).join(' & ')}
                        </span>
                        <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', borderRadius: '20px', background: statusBg(reg.paymentStatus), border: `1px solid ${statusColor(reg.paymentStatus)}44`, color: statusColor(reg.paymentStatus), fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
                          {reg.paymentStatus}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#9d4edd', fontWeight: 700, background: 'rgba(157,78,221,0.1)', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>
                          {reg.teamType === 'duo' ? '₹100 (Duo)' : '₹50 (Solo)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: '#7a7a9e', fontFamily: 'Courier New, monospace' }}>
                          {reg.registrationId}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#6b6b8a' }}>
                          {new Date(reg.submittedAt).toLocaleString('en-IN')}
                        </span>
                        <button
                          className="ba-neon-btn ba-btn-sm"
                          onClick={() => setExpandedReg(expandedReg === reg.registrationId ? null : reg.registrationId)}
                          style={{ background: 'rgba(0,255,255,0.08)', borderColor: 'rgba(0,255,255,0.25)', color: '#00ffff' }}
                        >
                          {expandedReg === reg.registrationId ? '▲ Collapse' : '▼ Review'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedReg === reg.registrationId && (
                      <div className="ba-fade-in" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {/* Member Details */}
                        <div>
                          <h4 style={{ color: '#00ffff', margin: '0 0 1rem', fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.88rem' }}>
                            👤 Registered Members
                          </h4>
                          {reg.members.map((m, i) => (
                            <div key={i} style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '0.7rem' }}>
                              <div style={{ fontWeight: 800, color: '#e4e4f0', fontFamily: 'Space Grotesk, sans-serif', marginBottom: '0.3rem' }}>
                                Member {i + 1}: {m.name}
                              </div>
                              <div style={{ fontSize: '0.82rem', color: '#9d4edd' }}>
                                💳 UPI: <code style={{ color: '#00ffff', background: 'rgba(0,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{m.upiId}</code>
                              </div>
                              {m.email && (
                                <div style={{ fontSize: '0.8rem', color: '#7a7a9e', marginTop: '0.3rem' }}>📧 {m.email}</div>
                              )}
                            </div>
                          ))}

                          {/* Admin Note & Action Buttons */}
                          {reg.paymentStatus === 'pending' && (
                            <div style={{ marginTop: '1rem' }}>
                              <label style={{ fontSize: '0.75rem', color: '#fbbf24', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                                📝 Admin Note (optional)
                              </label>
                              <textarea
                                className="ba-report-textarea"
                                value={adminNoteInput}
                                onChange={e => setAdminNoteInput(e.target.value)}
                                placeholder="Add a note for this verification..."
                                style={{ minHeight: '60px', marginBottom: '0.8rem' }}
                              />
                              <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                                <button
                                  className="ba-neon-btn ba-btn-sm"
                                  onClick={() => handleVerifyRegistration(reg.registrationId, 'verified')}
                                  disabled={isVerifying === reg.registrationId}
                                  style={{ background: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.5)', color: '#4ade80' }}
                                >
                                  {isVerifying === reg.registrationId ? '⏳' : '✅'} Verify Payment
                                </button>
                                <button
                                  className="ba-neon-btn ba-btn-sm"
                                  onClick={() => handleVerifyRegistration(reg.registrationId, 'rejected')}
                                  disabled={isVerifying === reg.registrationId}
                                  style={{ background: 'rgba(255,95,86,0.1)', borderColor: 'rgba(255,95,86,0.4)', color: '#ff5f56' }}
                                >
                                  {isVerifying === reg.registrationId ? '⏳' : '❌'} Reject
                                </button>
                              </div>
                            </div>
                          )}

                          {reg.adminNote && (
                            <div style={{ marginTop: '0.8rem', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.83rem', color: '#fbbf24' }}>
                              📝 Admin Note: {reg.adminNote}
                            </div>
                          )}
                          {reg.verifiedAt && (
                            <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#7a7a9e' }}>
                              {reg.paymentStatus === 'verified' ? '✅ Verified' : '❌ Rejected'} at: {new Date(reg.verifiedAt).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>

                        {/* Payment Screenshot */}
                        <div>
                          <h4 style={{ color: '#fbbf24', margin: '0 0 1rem', fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.88rem' }}>
                            📸 Payment Screenshot
                          </h4>
                          {reg.paymentScreenshotUrl ? (
                            <div style={{ position: 'relative' }}>
                              <img
                                src={`${serverBase}${reg.paymentScreenshotUrl}`}
                                alt="Payment screenshot"
                                style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', borderRadius: '10px', border: '1px solid rgba(251,191,36,0.2)', background: '#000', cursor: 'pointer' }}
                                onClick={() => window.open(`${serverBase}${reg.paymentScreenshotUrl}`, '_blank')}
                              />
                              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#7a7a9e', textAlign: 'center' }}>
                                🔍 Click to open full size
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#7a7a9e', background: 'rgba(0,0,0,0.3)', borderRadius: '10px' }}>
                              No screenshot uploaded
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Creating Teams (Code & Planted Bugs) */}
        {adminActiveTab === 'teams' && (
          <div className="ba-admin-dashboard ba-fade-in">
            <div className="ba-admin-header">
              <div className="ba-admin-header-title">🔧 Creating Teams — Submissions & Planted Bugs ({teamEntries.length})</div>
            </div>

            {teamEntries.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#7a7a9e' }}>
                <p>No code submissions yet. When teams submit their buggy code, their source code and planted bugs will appear here!</p>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {teamEntries.map((t) => (
                  <div key={t.key} style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(0, 255, 255, 0.15)', borderRadius: '16px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00ffff', fontFamily: 'Space Grotesk, sans-serif' }}>
                          Team: {t.team}
                        </span>
                        <span className="ba-decoded-lang" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                          {LANGUAGES.find(l => l.id === t.language)?.name || t.language}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'Courier New', color: '#fbbf24', fontWeight: 800, fontSize: '1.1rem', background: 'rgba(251, 191, 36, 0.1)', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                        KEY: {t.key}
                      </span>
                    </div>

                    <CodeEditor
                      code={t.code}
                      language={t.language}
                      readOnly
                      teamInfo={{ team: t.team }}
                    />

                    <div style={{ marginTop: '1.2rem', background: 'rgba(255, 107, 107, 0.05)', border: '1px solid rgba(255, 107, 107, 0.2)', padding: '1.2rem', borderRadius: '12px' }}>
                      <h4 style={{ color: '#ff6b6b', margin: '0 0 0.8rem', fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.95rem' }}>
                        🐛 Planted Bugs Registered by Team "{t.team}" ({(t.createdBugs || []).length}):
                      </h4>
                      {(t.createdBugs || []).map((b, i) => (
                        <div key={i} style={{ background: 'rgba(0, 0, 0, 0.3)', borderLeft: '3px solid #ff6b6b', padding: '0.7rem 1rem', borderRadius: '0 8px 8px 0', marginBottom: '0.5rem' }}>
                          <span style={{ color: '#ff6b6b', fontWeight: 800, fontSize: '0.82rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                            BUG #{i + 1} — Line #{b.lineNumber || 'N/A'}:
                          </span>
                          <p style={{ margin: '0.2rem 0 0', color: '#e4e4f0', fontSize: '0.88rem' }}>
                            {b.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Finding Teams (Submitted Reports & Found Bugs) */}
        {adminActiveTab === 'matcher' && (
          <div className="ba-admin-dashboard ba-fade-in">
            <div className="ba-admin-header">
              <div className="ba-admin-header-title">🐛 Finding Teams — Bug Reports & Fixes ({reportsList.length})</div>
            </div>

            {reportsList.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#7a7a9e' }}>
                <p>No bug reports submitted by finding teams yet.</p>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {reportsList.map((r, idx) => (
                  <div key={r.id || idx} style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '16px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80', fontFamily: 'Space Grotesk, sans-serif' }}>
                          Finding Team: {r.reviewer}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#7a7a9e' }}>
                          hunted code of <strong>Team {r.originalTeam}</strong>
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#7a7a9e' }}>
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {(r.foundBugs || []).map((fb, i) => (
                        <div key={i} style={{ background: 'rgba(74, 222, 128, 0.05)', borderLeft: '3px solid #4ade80', padding: '0.8rem 1rem', borderRadius: '0 8px 8px 0' }}>
                          <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.82rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                            REPORTED BUG #{i + 1} — Line #{fb.lineNumber || 'N/A'}:
                          </span>
                          <p style={{ margin: '0.3rem 0 0.4rem', color: '#e4e4f0', fontSize: '0.88rem' }}>
                            <strong>Description:</strong> {fb.description}
                          </p>
                          {fb.fix && (
                            <p style={{ margin: 0, color: '#00ffff', fontSize: '0.85rem', fontFamily: 'Courier New, monospace' }}>
                              <strong>Proposed Fix:</strong> {fb.fix}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Side-by-Side Comparison & Winner Decision */}
        {adminActiveTab === 'compare' && (
          <div className="ba-admin-dashboard ba-fade-in">
            <div className="ba-admin-header">
              <div className="ba-admin-header-title">⚖️ Side-by-Side Verification & Winner Decision</div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {reportsList.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#7a7a9e' }}>
                  <p>No hunt reports submitted yet. Once teams decode keys and submit reports, side-by-side comparisons will appear here for winner selection!</p>
                </div>
              ) : (
                 reportsList.map((r, idx) => {
                  const creatorData = teamEntries.find(t => t.team === r.originalTeam || t.key === r.key);
                  // BUG FIX: evaluateBugMatch was defined but never called — wire it here
                  const matchResult = evaluateBugMatch(r, creatorData);

                  return (
                    <div key={r.id || idx} style={{ background: 'rgba(10, 10, 25, 0.8)', border: '2px solid rgba(251, 191, 36, 0.3)', borderRadius: '16px', overflow: 'hidden' }}>
                      {/* Header bar */}
                      <div style={{ padding: '1rem 1.5rem', background: 'rgba(251, 191, 36, 0.08)', borderBottom: '1px solid rgba(251, 191, 36, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                        <div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            MATCH # {idx + 1}
                          </span>
                          <h3 style={{ margin: '0.2rem 0 0.3rem', color: '#fff', fontSize: '1.2rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                            Finding Team: <span style={{ color: '#4ade80' }}>{r.reviewer}</span> vs Creating Team: <span style={{ color: '#ff6b6b' }}>{r.originalTeam}</span>
                          </h3>
                          {/* Auto-match result badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.8rem', fontWeight: 800,
                              color: matchResult.status === 'PERFECT' ? '#4ade80' : matchResult.status === 'PARTIAL' ? '#fbbf24' : '#ff5f56',
                              background: matchResult.status === 'PERFECT' ? 'rgba(74,222,128,0.1)' : matchResult.status === 'PARTIAL' ? 'rgba(251,191,36,0.1)' : 'rgba(255,95,86,0.1)',
                              border: `1px solid ${matchResult.status === 'PERFECT' ? 'rgba(74,222,128,0.4)' : matchResult.status === 'PARTIAL' ? 'rgba(251,191,36,0.4)' : 'rgba(255,95,86,0.4)'}`,
                              borderRadius: '20px', padding: '0.2rem 0.8rem',
                            }}>
                              {matchResult.label}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#7a7a9e' }}>Score: <strong style={{ color: '#00ffff' }}>{matchResult.score}</strong> pts</span>
                            <span style={{ fontSize: '0.72rem', color: '#6b6b8a', fontStyle: 'italic' }}>{matchResult.details}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          <button
                            className="ba-neon-btn ba-btn-sm"
                            onClick={() => showToast(`🏆 Winner Declared: Team "${r.reviewer}"!`)}
                            style={{ background: 'rgba(74, 222, 128, 0.15)', borderColor: 'rgba(74, 222, 128, 0.5)', color: '#4ade80' }}
                          >
                            🥇 Award Winner: {r.reviewer}
                          </button>
                          <button
                            className="ba-neon-btn ba-btn-sm"
                            onClick={() => showToast(`🏆 Winner Declared: Team "${r.originalTeam}"!`)}
                            style={{ background: 'rgba(255, 107, 107, 0.15)', borderColor: 'rgba(255, 107, 107, 0.5)', color: '#ff6b6b' }}
                          >
                            🥇 Award Winner: {r.originalTeam}
                          </button>
                        </div>
                      </div>

                      {/* 2 Column Side-by-Side Comparison */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', padding: '1.5rem' }}>
                        {/* Column 1: Creating Team */}
                        <div style={{ background: 'rgba(255, 107, 107, 0.04)', border: '1px solid rgba(255, 107, 107, 0.2)', borderRadius: '12px', padding: '1.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ff6b6b', textTransform: 'uppercase' }}>
                              🔧 CREATING TEAM
                            </span>
                            <span style={{ fontWeight: 800, color: '#ff6b6b', fontSize: '1rem' }}>
                              {r.originalTeam}
                            </span>
                          </div>

                          <h5 style={{ color: '#a0a0c5', margin: '0 0 0.5rem', fontSize: '0.8rem' }}>Planted Bugs Registered:</h5>
                          {(creatorData?.createdBugs || []).length === 0 ? (
                            <p style={{ color: '#7a7a9e', fontSize: '0.85rem' }}>No bug details recorded.</p>
                          ) : (
                            (creatorData.createdBugs).map((cb, i) => (
                              <div key={i} style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '0.6rem 0.8rem', borderRadius: '8px', marginBottom: '0.5rem', borderLeft: '3px solid #ff6b6b' }}>
                                <span style={{ color: '#ff6b6b', fontWeight: 800, fontSize: '0.78rem' }}>
                                  Line #{cb.lineNumber || 'N/A'}:
                                </span>
                                <p style={{ margin: '0.1rem 0 0', color: '#e4e4f0', fontSize: '0.85rem' }}>
                                  {cb.description}
                                </p>
                              </div>
                            ))
                          )}

                          {creatorData?.code && (
                            <div style={{ marginTop: '1rem' }}>
                              <h5 style={{ color: '#a0a0c5', margin: '0 0 0.5rem', fontSize: '0.8rem' }}>Submitted Code:</h5>
                              <CodeEditor
                                code={creatorData.code}
                                language={creatorData.language || 'python'}
                                readOnly
                              />
                            </div>
                          )}
                        </div>

                        {/* Column 2: Finding Team */}
                        <div style={{ background: 'rgba(74, 222, 128, 0.04)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '12px', padding: '1.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4ade80', textTransform: 'uppercase' }}>
                              🐛 FINDING TEAM
                            </span>
                            <span style={{ fontWeight: 800, color: '#4ade80', fontSize: '1rem' }}>
                              {r.reviewer}
                            </span>
                          </div>

                          <h5 style={{ color: '#a0a0c5', margin: '0 0 0.5rem', fontSize: '0.8rem' }}>Reported Bugs Found:</h5>
                          {(r.foundBugs || []).length === 0 ? (
                            <p style={{ color: '#7a7a9e', fontSize: '0.85rem' }}>No bugs reported.</p>
                          ) : (
                            (r.foundBugs).map((fb, i) => (
                              <div key={i} style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '0.6rem 0.8rem', borderRadius: '8px', marginBottom: '0.5rem', borderLeft: '3px solid #4ade80' }}>
                                <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.78rem' }}>
                                  Reported Line #{fb.lineNumber || 'N/A'}:
                                </span>
                                <p style={{ margin: '0.1rem 0 0.2rem', color: '#e4e4f0', fontSize: '0.85rem' }}>
                                  {fb.description}
                                </p>
                                {fb.fix && (
                                  <p style={{ margin: 0, color: '#00ffff', fontSize: '0.8rem', fontFamily: 'Courier New, monospace' }}>
                                    Fix: {fb.fix}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Proctoring Alerts */}
        {adminActiveTab === 'proctoring' && (
          <div className="ba-admin-dashboard ba-fade-in">
            <div className="ba-admin-header">
              <div className="ba-admin-header-title">🚨 Proctoring Alerts — Real-Time Cheat Reports</div>
            </div>

            <div style={{ padding: '1rem 1.5rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                <p style={{ color: '#a0a0c5', fontSize: '0.88rem', margin: 0 }}>
                  This panel shows real-time proctoring violations. Each incident is logged the moment it happens.
                  Locked accounts can be re-admitted by clicking <strong style={{ color: '#4ade80' }}>Unlock</strong> — the unlock code is then shown here.
                </p>
                <button
                  className="ba-neon-btn ba-btn-sm"
                  onClick={fetchAdminRegistryData}
                  style={{ background: 'rgba(255,107,107,0.1)', borderColor: 'rgba(255,107,107,0.3)', color: '#ff6b6b' }}
                >
                  🔄 Refresh Reports
                </button>
              </div>
            </div>

            {adminCheatReports.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#7a7a9e' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <p>No proctoring violations detected. All participants are following the rules!</p>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {adminCheatReports.map((report) => (
                  <div key={report._id} style={{
                    background: report.locked ? 'rgba(255,68,68,0.08)' : 'rgba(251,191,36,0.06)',
                    border: `2px solid ${report.locked ? 'rgba(255,68,68,0.4)' : 'rgba(251,191,36,0.3)'}`,
                    borderRadius: '14px',
                    padding: '1.2rem 1.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Severity indicator */}
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: report.locked ? '#ff3333' : '#fbbf24', borderRadius: '4px 0 0 4px' }} />
                    <div style={{ paddingLeft: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.7rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: report.locked ? '#ff6b6b' : '#fbbf24', fontFamily: 'Space Grotesk, sans-serif' }}>
                            {report.locked ? '🔒' : '⚠️'} {report.teamName}
                          </span>
                          {report.locked && (
                            <span style={{ background: 'rgba(255,51,51,0.15)', border: '1px solid rgba(255,51,51,0.5)', borderRadius: '20px', padding: '0.2rem 0.7rem', color: '#ff4444', fontSize: '0.72rem', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
                              🔒 LOCKED
                            </span>
                          )}
                          {report.adminUnlocked && (
                            <span style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.5)', borderRadius: '20px', padding: '0.2rem 0.7rem', color: '#4ade80', fontSize: '0.72rem', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
                              ✅ UNLOCKED BY ADMIN
                            </span>
                          )}
                          <span style={{ background: 'rgba(157,78,221,0.1)', borderRadius: '8px', padding: '0.15rem 0.5rem', color: '#9d4edd', fontSize: '0.75rem', fontWeight: 700 }}>
                            Warning {report.warnCount}/3
                          </span>
                          {report.phase && (
                            <span style={{ color: '#6b6b8a', fontSize: '0.75rem' }}>Phase: {report.phase}</span>
                          )}
                        </div>
                        <span style={{ color: '#6b6b8a', fontSize: '0.75rem', fontFamily: 'Courier New, monospace', whiteSpace: 'nowrap' }}>
                          {report.timestamp ? new Date(report.timestamp).toLocaleString('en-IN') : ''}
                        </span>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '0.8rem', borderLeft: '3px solid rgba(255,107,107,0.4)' }}>
                        <span style={{ color: '#ff9999', fontSize: '0.88rem' }}>
                          📋 <strong>Reason:</strong> {report.reason}
                        </span>
                      </div>

                      {/* Re-entry Request Banner */}
                      {report.reentryRequested && !report.locked === false && (
                        <div style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '0.8rem', animation: 'ba-pulse-warn 2s infinite' }}>
                          <div style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 800, marginBottom: '0.2rem', fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            🔔 Re-entry Requested
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#fff' }}>
                            The participant is locked out and has requested to be readmitted to the arena.
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                        {report.locked && !report.adminUnlocked && (
                          <button
                            className="ba-neon-btn ba-btn-sm"
                            onClick={() => handleAdminUnlockParticipant(report._id, report.teamName)}
                            style={{ background: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.5)', color: '#4ade80' }}
                          >
                            🔓 Unlock &amp; Re-Admit {report.teamName}
                          </button>
                        )}
                        <button
                          className="ba-neon-btn ba-btn-sm"
                          onClick={() => handleDismissCheatReport(report._id)}
                          style={{ background: 'rgba(107,107,138,0.1)', borderColor: 'rgba(107,107,138,0.3)', color: '#a0a0c5' }}
                        >
                          ✕ Dismiss Report
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ba-universe">
      {isLocked && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a0000 0%, #2d0000 50%, #1a0000 100%)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
          {/* Animated warning stripes */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'repeating-linear-gradient(90deg, #ff0000 0px, #ff0000 30px, transparent 30px, transparent 60px)', animation: 'ba-stripe-anim 1s linear infinite' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', background: 'repeating-linear-gradient(90deg, #ff0000 0px, #ff0000 30px, transparent 30px, transparent 60px)', animation: 'ba-stripe-anim 1s linear infinite reverse' }} />

          <div style={{ fontSize: '4rem', animation: 'ba-pulse-warn 1s ease-in-out infinite' }}>🚨</div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#ff4444', textAlign: 'center', fontSize: 'clamp(1.4rem, 5vw, 2.5rem)', margin: 0, textShadow: '0 0 30px rgba(255,68,68,0.8)' }}>
            ACCOUNT LOCKED
          </h1>
          <p style={{ color: '#ff9999', fontSize: '1.1rem', textAlign: 'center', maxWidth: '560px', lineHeight: 1.6, margin: 0 }}>
            You have been flagged for suspicious activity during the exam.<br />
            <strong style={{ color: '#ff4444' }}>3 proctoring violations detected.</strong><br />
            This incident has been reported to the administrator in real-time.
          </p>
          <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.4)', borderRadius: '12px', padding: '1.2rem 2rem', textAlign: 'center', maxWidth: '460px' }}>
            <p style={{ color: '#fbbf24', margin: '0 0 0.8rem', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
              🔐 ADMIN UNLOCK REQUIRED
            </p>
            <p style={{ color: '#a0a0c5', fontSize: '0.83rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Only the event administrator can re-enable your session.
              Click the button below to request readmission. The system will automatically resume once approved.
            </p>
            {reentryRequested ? (
              <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '0.8rem', color: '#fbbf24', fontSize: '0.9rem' }}>
                ⏳ Request sent. Waiting for admin approval...
              </div>
            ) : (
              <button
                className="ba-neon-btn ba-btn-sm"
                style={{ background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.5)', color: '#fbbf24', width: '100%' }}
                onClick={handleRequestReentry}
                disabled={!activeCheatReportId}
              >
                🔔 Request Re-entry
              </button>
            )}
          </div>
          <button className="ba-neon-btn ba-btn-sm" style={{ background: 'rgba(255,95,86,0.1)', borderColor: 'rgba(255,95,86,0.4)', color: '#ff5f56', marginTop: '0.5rem' }} onClick={onAbort}>Exit Arena</button>
        </div>
      )}

      <NeonParticles />

      <div className="ba-orb ba-orb-1" />
      <div className="ba-orb ba-orb-2" />
      <div className="ba-orb ba-orb-3" />

      <div className="ba-scanlines" />

      {/* Back Button */}
      <button className="ba-back-btn" onClick={onAbort}>
        <span className="ba-back-arrow">←</span>
        <span>Back to Nexus</span>
      </button>

      {/* Secret Admin Portal — triggered by Ctrl+Shift+A only. No visible button. */}
      {isAdminLoggedIn && (
        <button
          className="ba-admin-btn"
          onClick={() => { setPhase('admin'); fetchAdminRegistryData(); }}
        >
          <span>👑 Admin Panel</span>
        </button>
      )}

      {/* Admin Login Modal */}
      {adminModalOpen && (
        <div className="ba-admin-overlay" onClick={() => setAdminModalOpen(false)}>
          <div className="ba-admin-card" onClick={(e) => e.stopPropagation()}>
            <div className="ba-admin-header">
              <div className="ba-admin-header-title">🔐 Admin Authentication</div>
              <button
                onClick={() => setAdminModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form className="ba-setup-body" onSubmit={handleAdminLogin}>
              <div className="ba-field-group">
                <label className="ba-field-label" style={{ color: '#fbbf24' }}>
                  <span>👤</span> Admin Username
                </label>
                <input
                  type="text"
                  className="ba-field-input"
                  value={adminUsernameInput}
                  onChange={(e) => setAdminUsernameInput(e.target.value)}
                  placeholder="Username..."
                  style={{ borderColor: 'rgba(251, 191, 36, 0.3)' }}
                  autoFocus
                />
              </div>

              <div className="ba-field-group">
                <label className="ba-field-label" style={{ color: '#fbbf24' }}>
                  <span>🔑</span> Password
                </label>
                <input
                  type="password"
                  className="ba-field-input"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Password..."
                  style={{ borderColor: 'rgba(251, 191, 36, 0.3)' }}
                />
              </div>

              <button
                type="submit"
                className="ba-neon-btn"
                style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(217, 119, 6, 0.15))', borderColor: 'rgba(251, 191, 36, 0.5)', color: '#fbbf24', alignSelf: 'center', marginTop: '0.5rem' }}
              >
                <span className="ba-btn-icon">🔓</span>
                Unlock Admin Portal
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="ba-content">
        <div className="ba-hero ba-fade-in">
          <div className="ba-badge">
            <span className="ba-badge-dot" />
            <span>NEXUS BUG ARENA</span>
          </div>

          <h1 className="ba-title">
            <span className="ba-title-line1">Hunt the</span>
            <span className="ba-title-line2">Bug</span>
          </h1>

          <p className="ba-typewriter">{typedText}<span className="ba-cursor">|</span></p>
          <p className="ba-subtitle">
            Create buggy code, submit to get a 6-letter key, exchange keys with rival teams, and decode to find bugs!
          </p>

          <button className="ba-rules-toggle" onClick={() => setRulesOpen(!rulesOpen)}>
            <span>📜 Event Rules & Instructions</span>
            <span className={`ba-rules-arrow ${rulesOpen ? 'ba-rules-arrow-open' : ''}`}>▼</span>
          </button>

          <div className={`ba-rules-panel ${rulesOpen ? 'ba-rules-panel-open' : ''}`}>
            <div className="ba-rules-content">
              <ul className="ba-rules-list">
                <li><span className="ba-rule-num">01</span> Each team writes code in their programming language containing hidden bugs.</li>
                <li><span className="ba-rule-num">02</span> Register the line numbers & bug explanations for your code.</li>
                <li><span className="ba-rule-num">03</span> Click <strong>Submit Bug Code</strong> to generate a 6-letter key (e.g. <code>2BF45V</code>).</li>
                <li><span className="ba-rule-num">04</span> Event hosts decide which 6-letter key goes to which rival team.</li>
                <li><span className="ba-rule-num">05</span> In the <strong>Exchange</strong> portal, enter the 6-letter key you received and press <strong>Decode</strong>.</li>
                <li><span className="ba-rule-num">06</span> Submit a Bug Report with the line numbers, descriptions, and suggested fixes.</li>
                <li><span className="ba-rule-num">07</span> The Admin Portal automatically verifies matches and calculates final team scores! 🏆</li>
              </ul>
            </div>
          </div>

          {isSetup && (
            <div className="ba-phase-bar">
              <button
                className={`ba-phase ${phase === 'create' ? 'ba-phase-active' : ''}`}
                onClick={() => setPhase('create')}
              >
                <span className="ba-phase-icon">🔧</span>
                <span>Create</span>
              </button>
              <div className="ba-phase-connector" />
              <button
                className={`ba-phase ${phase === 'exchange' ? 'ba-phase-active' : ''}`}
                onClick={() => {
                  if (submittedKey) {
                    setPhase('exchange');
                  } else {
                    showToast('Please create and submit a bug first!', 'error');
                  }
                }}
              >
                <span className="ba-phase-icon">🔄</span>
                <span>Exchange</span>
              </button>
              <div className="ba-phase-connector" />
              <button
                className={`ba-phase ${phase === 'hunt' ? 'ba-phase-active' : ''}`}
                onClick={() => { if (decodedData) setPhase('hunt'); else showToast('Decode a key first!', 'error'); }}
                disabled={!decodedData}
              >
                <span className="ba-phase-icon">🐛</span>
                <span>Hunt</span>
              </button>

              {isAdminLoggedIn && (
                <>
                  <div className="ba-phase-connector" />
                  <button
                    className={`ba-phase ${phase === 'admin' ? 'ba-phase-active' : ''}`}
                    onClick={() => { setPhase('admin'); fetchAdminRegistryData(); }}
                    style={{ color: '#fbbf24', opacity: phase === 'admin' ? 1 : 0.7 }}
                  >
                    <span className="ba-phase-icon">👑</span>
                    <span>Admin</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="ba-main-area">
          {phase === 'admin' ? (
            renderAdminDashboard()
          ) : !isRegistered ? (
            renderRegistrationForm()
          ) : !isSetup ? (
            <div className="ba-fade-in">
              <div className="ba-section-header">
                <div className="ba-section-line" />
                <h2 className="ba-section-title">⚡ Team Configuration</h2>
                <div className="ba-section-line" />
              </div>
              <p className="ba-section-desc">
                Registration accepted! Now set up your team identity and choose your programming language before entering the arena.
              </p>

              {registrationId && (
                <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                  <span style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '50px', padding: '0.35rem 1.1rem', fontSize: '0.78rem', color: '#4ade80', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>
                    ✅ Registration ID: {registrationId}
                  </span>
                </div>
              )}

              <div className="ba-setup-card">
                <div className="ba-setup-header">
                  <div className="ba-setup-dots">
                    <span className="ba-setup-dot-r" />
                    <span className="ba-setup-dot-y" />
                    <span className="ba-setup-dot-g" />
                  </div>
                  <div className="ba-setup-title-bar">team-config v1.0</div>
                </div>
                <form className="ba-setup-body" onSubmit={handleSetup}>
                  <div className="ba-field-group">
                    <label className="ba-field-label">
                      <span>🏷️</span> Team Name
                    </label>
                    <input
                      type="text"
                      className="ba-field-input"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter your team name..."
                      maxLength={30}
                      autoFocus
                    />
                  </div>

                  <div className="ba-field-group">
                    <label className="ba-field-label">
                      <span>💻</span> Programming Language
                    </label>
                    <select
                      className="ba-field-select"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.id} value={lang.id}>
                          {lang.name} ({lang.ext})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="ba-neon-btn ba-btn-cyan" style={{ alignSelf: 'center', marginTop: '0.5rem' }}>
                    <span className="ba-btn-icon">⚡</span>
                    Enter the Arena
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              <div className="ba-team-badge">
                <span className="ba-team-badge-icon">⚡</span>
                {teamName} — {LANGUAGES.find(l => l.id === language)?.name}
                {registrationId && <span style={{ marginLeft: '0.8rem', fontSize: '0.72rem', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>✅ {registrationId}</span>}
              </div>

              {phase === 'create' && renderCreatePhase()}
              {phase === 'exchange' && renderExchangePhase()}
              {phase === 'hunt' && renderHuntPhase()}
            </>
          )}
        </div>

        <div className="ba-footer ba-fade-in">
          <div className="ba-footer-glow" />
          <p className="ba-footer-text">
            Bug Arena — A Nexus Technical Club Event. May the sharpest debugger win!
          </p>
          <button className="ba-return-btn" onClick={onAbort}>
            <span>↩</span> Return to Home
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default BugArena;
