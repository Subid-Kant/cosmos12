import React, { useState, useEffect, useRef, useCallback } from 'react';
import './BugArena.css';

// Local MongoDB Backend for sharing 6-character keys & admin syncing
// Ensure you start the backend server in 'server/' folder using 'node server.js'
// For production, the lead will set VITE_API_URL in the .env file
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace('/api/registry', '');
  // Default to the live Render server if .env is missing (so teammates can test without setup)
  return 'https://bug-arena-backend.onrender.com';
};
const SERVER_BASE = getBaseUrl();
const REGISTRY_URL = `${SERVER_BASE}/api/registry`;

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

// Bug Arena is operated in four isolated competition tracks. Keeping this
// explicit prevents a submission from being reviewed against another language.
const EVENT_LANGUAGE_IDS = ['python', 'java', 'c', 'cpp'];
const EVENT_LANGUAGES = LANGUAGES.filter(lang => EVENT_LANGUAGE_IDS.includes(lang.id));

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

// ─── Syntax Highlighter (Token-based, linear-time & optimized) ─────────────
const highlightCode = (code, language) => {
  if (!code) return '';

  const escapeHtml = (str) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const keywords = new Set(LANGUAGE_KEYWORDS[language] || LANGUAGE_KEYWORDS.javascript);
  const commentConfig = COMMENT_PATTERNS[language] || COMMENT_PATTERNS.default;

  // Linear regex that prevents catastrophic backtracking on unclosed quotes/strings
  const tokenRegex = commentConfig.line === '#'
    ? /(\#[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+\.?\d*\b|\b[A-Za-z_#][A-Za-z0-9_]*\b|[{}[\]()])/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+\.?\d*\b|\b[A-Za-z_#][A-Za-z0-9_]*\b|[{}[\]()])/g;

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
const NeonParticles = React.memo(() => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  const initParticles = useCallback((canvas) => {
    const particles = [];
    const count = Math.min(30, Math.floor((canvas.width * canvas.height) / 25000));
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
});

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
const CodeEditor = React.memo(({ code, onChange, language, readOnly = false, teamInfo = null, highlightLine = null }) => {
  const [localCode, setLocalCode] = useState(code || '');
  const [editorMode, setEditorMode] = useState('direct'); // 'direct' (instant native typing) | 'glow' (syntax overlay)
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // If the parent resets the code (e.g. wiped), or it's a read-only loaded code, sync it to local
  useEffect(() => {
    if (readOnly || code === '') {
      setLocalCode(code || '');
    }
  }, [code, readOnly]);

  // Debounce sending code back to parent (1200ms) to avoid heavy parent re-renders while typing
  useEffect(() => {
    if (readOnly) return;
    const handler = setTimeout(() => {
      onChange(localCode);
    }, 1200);
    return () => clearTimeout(handler);
  }, [localCode, onChange, readOnly]);

  const lines = localCode ? localCode.split('\n') : [''];
  const lineCount = lines.length;

  const highlightedHtml = React.useMemo(() => {
    if (!readOnly && editorMode === 'direct') return '';
    return highlightCode(localCode, language) + '\n';
  }, [localCode, language, readOnly, editorMode]);

  const lineNumbers = React.useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => {
      const isTarget = highlightLine && (i + 1 === Number(highlightLine));
      return (
        <span
          key={i}
          className="ba-line-num"
          style={isTarget ? {
            background: 'rgba(0, 255, 255, 0.35)',
            color: '#00ffff',
            fontWeight: 900,
            borderRadius: '4px',
            border: '1px solid #00ffff',
            padding: '0 4px',
            boxShadow: '0 0 8px rgba(0, 255, 255, 0.6)'
          } : undefined}
        >
          {i + 1}
        </span>
      );
    });
  }, [lineCount, highlightLine]);

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
      setLocalCode(e.target.value);
    }
  };

  const handleBlur = () => {
    if (!readOnly) {
      onChange(localCode);
    }
  };

  const handleTab = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!readOnly) {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const newCode = localCode.substring(0, start) + '  ' + localCode.substring(end);
        setLocalCode(newCode);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {!readOnly && (
            <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.45)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={() => setEditorMode('direct')}
                title="Ultra-fast native typing (0ms latency)"
                style={{
                  background: editorMode === 'direct' ? 'rgba(0,255,255,0.2)' : 'transparent',
                  color: editorMode === 'direct' ? '#00ffff' : '#8888aa',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ⚡ Ultra-Fast
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('glow')}
                title="Syntax color glow mode"
                style={{
                  background: editorMode === 'glow' ? 'rgba(157,78,221,0.25)' : 'transparent',
                  color: editorMode === 'glow' ? '#c77dff' : '#8888aa',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                🎨 Syntax Glow
              </button>
            </div>
          )}
          <div className="ba-editor-lang-badge">
            <span className="ba-lang-dot" />
            {langObj.name}
          </div>
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
          {lineNumbers}
        </div>
        <div className="ba-code-container">
          {(readOnly || editorMode === 'glow') && (
            <pre
              ref={highlightRef}
              className="ba-code-highlight"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          )}
          <textarea
            ref={textareaRef}
            className={`ba-code-textarea ${readOnly ? 'ba-code-readonly' : ''} ${!readOnly && editorMode === 'direct' ? 'ba-direct-typing' : ''}`}
            value={localCode}
            onChange={handleInput}
            onBlur={handleBlur}
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
          <span>🔤 {localCode.length} chars</span>
          <span>💻 {langObj.name}</span>
          {!readOnly && (
            <span style={{ color: editorMode === 'direct' ? '#00ffff' : '#c77dff', fontSize: '0.7rem' }}>
              {editorMode === 'direct' ? '⚡ 0ms latency typing' : '🎨 Syntax glow active'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Admin Login Modal ──────────────────────────────────────────────────────
const AdminLoginModal = ({ onClose, onLogin, isAuthenticating }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="ba-admin-overlay" onClick={onClose}>
      <div className="ba-admin-card" onClick={(e) => e.stopPropagation()}>
        <div className="ba-admin-header">
          <div className="ba-admin-header-title">🔐 Admin Authentication</div>
          <button
            onClick={onClose}
            disabled={isAuthenticating}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        <form className="ba-setup-body" onSubmit={handleSubmit}>
          <div className="ba-field-group">
            <label className="ba-field-label" style={{ color: '#fbbf24' }}>
              <span>👤</span> Admin Username
            </label>
            <input
              type="text"
              className="ba-field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isAuthenticating}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isAuthenticating}
              placeholder="Password..."
              style={{ borderColor: 'rgba(251, 191, 36, 0.3)' }}
            />
          </div>
          <button
            type="submit"
            disabled={isAuthenticating}
            className="ba-neon-btn ba-btn-cyan"
            style={{ width: '100%', marginTop: '1rem', background: 'rgba(251, 191, 36, 0.2)', borderColor: 'rgba(251, 191, 36, 0.6)', color: '#fbbf24' }}
          >
            {isAuthenticating ? 'Authenticating…' : 'Authenticate 🚀'}
          </button>
        </form>
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

  // ── Registration / Organizer Approval State ──
  const [regPhase, setRegPhase] = useState('form'); // 'form' | 'qr' | 'done'
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationId, setRegistrationId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending'); // 'pending' | 'verified' | 'rejected'
  const [regMembers, setRegMembers] = useState([
    { name: '', email: '', phone: '' },
  ]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState('');

  // ── Event Day Login State ──
  const [eventDayMode, setEventDayMode] = useState(false);
  const [loginRegId, setLoginRegId] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── Global Event State ──
  const [globalEventPhase, setGlobalEventPhase] = useState('pre_event'); // pre_event | coding | exchange | hunting | post_event

  // ── Admin Portal State ──
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminAuthToken, setAdminAuthToken] = useState('');
  const [isAdminAuthenticating, setIsAdminAuthenticating] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
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
  const [compareLangFilter, setCompareLangFilter] = useState('all');
  const [compareStatusFilter, setCompareStatusFilter] = useState('all'); // 'all' | 'pending' | 'decided' | 'spam'
  const [compareSearchQuery, setCompareSearchQuery] = useState('');
  const [expandedAiDossier, setExpandedAiDossier] = useState({});
  const [bugOverrides, setBugOverrides] = useState({});
  const [reviewedVerifications, setReviewedVerifications] = useState({});
  const [activeCodeInspector, setActiveCodeInspector] = useState({}); // { [reportId]: boolean }
  const [highlightedCodeLine, setHighlightedCodeLine] = useState({}); // { [reportId]: lineNumber }
  const [showTrackLeaderboard, setShowTrackLeaderboard] = useState(false);

  // Proctoring Mode State
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [activeCheatReportId, setActiveCheatReportId] = useState(null);
  const [reentryRequested, setReentryRequested] = useState(false);
  const [unlockGracePeriod, setUnlockGracePeriod] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenStartedRef = useRef(false);
  const globalPhaseRef = useRef(globalEventPhase);
  globalPhaseRef.current = globalEventPhase;
  // Ref to hold the previous submission key when editing code after submit
  // (survives submittedKey being cleared to show the editor again)
  const pendingEditKeyRef = useRef(null);
  // Stable key used by the background draft saver before a student presses
  // Submit. The server promotes this draft when the host closes coding.
  const draftKeyRef = useRef('');
  const liveDraftRef = useRef({});
  const getDraftKey = () => {
    if (!draftKeyRef.current) draftKeyRef.current = generate6CharKey();
    return draftKeyRef.current;
  };
  liveDraftRef.current = { teamName, registrationId, language, code, createdBugs, decodedData, foundBugs, submittedKey };

  // Restore session from sessionStorage on initial load
  useEffect(() => {
    // 1. Check for pending reload lock from previous unload/reload attempt
    try {
      const reloadLock = localStorage.getItem('bugarena_reload_lock');
      if (reloadLock) {
        const parsed = JSON.parse(reloadLock);
        localStorage.removeItem('bugarena_reload_lock');
        setIsLocked(true);
        setCheatWarnings(1);
        setIsSetup(true);
        if (parsed.teamName) setTeamName(parsed.teamName);
        if (parsed.registrationId) setRegistrationId(parsed.registrationId);
        fetch(`${SERVER_BASE}/api/cheat-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamName: parsed.teamName || 'Unknown Team',
            registrationId: parsed.registrationId || '',
            reason: parsed.reason || 'LOCKED — Page reload / Tab closed during active contest',
            warnCount: 1,
            phase: parsed.phase || 'create',
            timestamp: Date.now(),
            locked: true,
          }),
        }).catch(() => {});
        showToast('Account is locked due to page reload during the competition.', 'error');
      }
    } catch {}

    // 2. Restore session from sessionStorage
    try {
      const saved = sessionStorage.getItem('bugarena_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.teamName) setTeamName(parsed.teamName);
        if (parsed.registrationId) setRegistrationId(parsed.registrationId);
        if (parsed.isRegistered) setIsRegistered(parsed.isRegistered);
        if (parsed.isSetup) setIsSetup(parsed.isSetup);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.isLocked) setIsLocked(parsed.isLocked);
        if (parsed.activeCheatReportId) setActiveCheatReportId(parsed.activeCheatReportId);
        if (parsed.reentryRequested) setReentryRequested(parsed.reentryRequested);
        if (parsed.submittedKey) setSubmittedKey(parsed.submittedKey);
        if (parsed.draftKey) draftKeyRef.current = parsed.draftKey;
        if (parsed.phase && parsed.phase !== 'admin') setPhase(parsed.phase);

        // Verify with server if this session has an active lock
        const idToCheck = parsed.registrationId || parsed.teamName;
        if (idToCheck) {
          fetch(`${SERVER_BASE}/api/cheat-reports/lock-status/${encodeURIComponent(idToCheck)}`)
            .then(res => res.json())
            .then(data => {
              if (data.locked === true && data.reentryApproved !== true) {
                setIsLocked(true);
                setIsSetup(true);
                setCheatWarnings(1);
                if (data._id || data.reportId) setActiveCheatReportId(data._id || data.reportId);
                if (data.reentryRequested) setReentryRequested(true);
              }
            })
            .catch(() => {});
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Restore the local administrator view after a laptop sleep/reload. Portal
  // data is always fetched again, so the displayed event state stays current.
  useEffect(() => {
    try {
      const savedAdminToken = sessionStorage.getItem('ba_admin_token');
      if (savedAdminToken) {
        setAdminAuthToken(savedAdminToken);
        setIsAdminLoggedIn(true);
        setPhase('admin');
        fetchAdminRegistryData();
      } else {
        // A legacy UI-only marker must never restore administrative access.
        // The organizer needs a fresh server-authenticated login instead.
        sessionStorage.removeItem('ba_admin_session');
      }
    } catch { /* storage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync core session state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('bugarena_session', JSON.stringify({
        teamName,
        registrationId,
        isRegistered,
        isSetup,
        language,
        phase: phase === 'admin' ? 'create' : phase,
        isLocked,
        activeCheatReportId,
        reentryRequested,
        submittedKey,
        draftKey: draftKeyRef.current,
      }));
    } catch { /* ignore */ }
  }, [teamName, registrationId, isRegistered, isSetup, language, phase, isLocked, activeCheatReportId, reentryRequested, submittedKey]);

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
      }, 15000); // 15s interval to avoid hammering the server
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [regPhase, paymentStatus, registrationId]);

  // Fetch immediately, then poll. The first update must not wait for an
  // interval after the admin moves the event to a new phase.
  useEffect(() => {
    if (!isRegistered) return;
    const syncGlobalPhase = async () => {
      try {
        const getRes = await fetch(`${SERVER_BASE}/api/event-phase`, { cache: 'no-store' });
        const eventState = await getRes.json();
        if (eventState?.phase) {
          setGlobalEventPhase(eventState.phase);
        }
      } catch (err) {
        // ignore
      }
    };
    syncGlobalPhase();
    // EventSource delivers host transitions instantly. The small fallback read
    // protects the event if a restrictive network blocks SSE.
    const stream = typeof EventSource !== 'undefined'
      ? new EventSource(`${SERVER_BASE}/api/event-phase/stream`)
      : null;
    if (stream) {
      stream.addEventListener('phase', (event) => {
        try {
          const eventState = JSON.parse(event.data);
          if (eventState?.phase) setGlobalEventPhase(eventState.phase);
        } catch { /* ignore malformed event */ }
      });
      // The organiser is about to close coding/hunting. Flush the latest
      // local fields immediately; the server waits briefly, promotes drafts,
      // then applies the non-bypassable phase lock.
      stream.addEventListener('phase-closing', (event) => {
        try {
          const { currentPhase } = JSON.parse(event.data);
          const draft = liveDraftRef.current;
          if (!draft.teamName?.trim()) return;
          if (currentPhase === 'coding') {
            const key = draft.submittedKey || pendingEditKeyRef.current || getDraftKey();
            fetch(`${SERVER_BASE}/api/drafts/code`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                key, team: draft.teamName.trim(), registrationId: draft.registrationId || '', language: draft.language,
                code: draft.code, createdBugs: draft.createdBugs,
                bugLineNumber: draft.createdBugs.map(b => b.lineNumber || 'N/A').join(', '),
                bugInfo: draft.createdBugs.map(b => b.description).filter(Boolean).join(' | '),
                timestamp: Date.now(), isDraft: true,
              }),
            }).catch(() => {});
          }
          if (currentPhase === 'hunting' && draft.decodedData) {
            const reportSlot = `${draft.registrationId || draft.teamName.trim().toLowerCase()}::${draft.decodedData.key || 'N/A'}::${(draft.decodedData.language || 'python').toLowerCase()}`;
            fetch(`${SERVER_BASE}/api/drafts/report`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: `R_DRAFT_${reportSlot.replace(/[^A-Za-z0-9]/g, '_').slice(0, 80)}`, reportSlot,
                reviewerRegistrationId: draft.registrationId || '', reviewer: draft.teamName.trim(),
                originalTeam: draft.decodedData.team || 'Unknown', key: draft.decodedData.key || 'N/A',
                language: draft.decodedData.language || 'python', foundBugs: draft.foundBugs,
                originalCreatedBugs: draft.decodedData.createdBugs || [], originalCode: draft.decodedData.code || '',
                timestamp: Date.now(), isDraft: true,
              }),
            }).catch(() => {});
          }
        } catch { /* ignore a malformed closing notice */ }
      });
    }
    const intervalId = setInterval(syncGlobalPhase, 30000);
    return () => { clearInterval(intervalId); stream?.close(); };
  }, [isRegistered]);

  // Save work-in-progress without marking it submitted. This is debounced so
  // typing remains smooth even with 100 participants. The server finalizes the
  // latest saved draft at the exact moment the administrator changes phase.
  useEffect(() => {
    if (!isSetup || !teamName.trim() || globalEventPhase !== 'coding') return;
    const timer = setTimeout(() => {
      const key = submittedKey || pendingEditKeyRef.current || getDraftKey();
      fetch(`${SERVER_BASE}/api/drafts/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          team: teamName.trim(),
          registrationId: registrationId || '',
          language,
          code,
          createdBugs,
          bugLineNumber: createdBugs.map(b => b.lineNumber || 'N/A').join(', '),
          bugInfo: createdBugs.map(b => b.description).filter(Boolean).join(' | '),
          timestamp: Date.now(),
          isDraft: true,
        }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [isSetup, teamName, registrationId, language, code, createdBugs, submittedKey, globalEventPhase]);

  useEffect(() => {
    if (!isSetup || !teamName.trim() || !decodedData || globalEventPhase !== 'hunting') return;
    const timer = setTimeout(() => {
      const reportSlot = `${registrationId || teamName.trim().toLowerCase()}::${decodedData?.key || 'N/A'}::${(decodedData?.language || 'python').toLowerCase()}`;
      fetch(`${SERVER_BASE}/api/drafts/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `R_DRAFT_${reportSlot.replace(/[^A-Za-z0-9]/g, '_').slice(0, 80)}`,
          reportSlot,
          reviewerRegistrationId: registrationId || '',
          reviewer: teamName.trim(),
          originalTeam: decodedData?.team || 'Unknown',
          key: decodedData?.key || 'N/A',
          language: decodedData?.language || 'python',
          foundBugs,
          originalCreatedBugs: decodedData?.createdBugs || [],
          originalCode: decodedData?.code || '',
          timestamp: Date.now(),
          isDraft: true,
        }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [isSetup, teamName, registrationId, decodedData, foundBugs, globalEventPhase]);

  // The host phase is authoritative: players cannot keep editing a previous
  // phase after an event transition.
  const prevGlobalPhaseRef = React.useRef(globalEventPhase);
  useEffect(() => {
    if (isAdminLoggedIn) return;
    
    if (prevGlobalPhaseRef.current !== globalEventPhase) {
      if (globalEventPhase === 'pre_event') {
        setPhase('create');
      } else if (globalEventPhase === 'coding') {
        if (!submittedKey) setPhase('create');
      } else if (globalEventPhase === 'exchange') {
        setPhase('exchange');
      } else if (globalEventPhase === 'hunting') {
        setPhase(decodedData ? 'hunt' : 'exchange');
      } else if (globalEventPhase === 'post_event') {
        setPhase(decodedData ? 'hunt' : 'exchange');
      }
      prevGlobalPhaseRef.current = globalEventPhase;
    }
  }, [globalEventPhase, submittedKey, isAdminLoggedIn, decodedData]);

  // Poll lock status when locked — responsive poll (every 2.5s)
  useEffect(() => {
    if (!isLocked) return;
    const identifier = teamName || registrationId;
    if (!identifier) return;

    let isMounted = true;
    const checkLockStatus = async () => {
      try {
        const res = await fetch(`${SERVER_BASE}/api/cheat-reports/lock-status/${encodeURIComponent(identifier)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if ((data._id || data.reportId) && !activeCheatReportId) {
          setActiveCheatReportId(data._id || data.reportId);
        }
        if (typeof data.reentryRequested === 'boolean') {
          setReentryRequested(data.reentryRequested);
        }

        // ONLY unlock if admin explicitly approved or cleared
        if (data.reentryApproved === true) {
          setIsLocked(false);
          setCheatWarnings(0);
          setReentryRequested(false);
          // Grace period so player can focus their window without instant re-lock
          setUnlockGracePeriod(true);
          setTimeout(() => {
            setUnlockGracePeriod(false);
          }, 8000);
          showToast('Admin approved your re-entry. Welcome back!', 'success');
        }
      } catch (e) {
        // ignore
      }
    };

    // Immediate check
    checkLockStatus();
    // 2.5s interval for fast re-entry response
    const intervalId = setInterval(checkLockStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isLocked, teamName, registrationId, activeCheatReportId]);

  // INITIAL LOAD CHECK: Prevent bypassing lock by refreshing the page
  useEffect(() => {
    const identifier = teamName || registrationId;
    if (identifier && !isAdminLoggedIn) {
      const checkInitialLock = async () => {
        try {
          const res = await fetch(`${SERVER_BASE}/api/cheat-reports/lock-status/${encodeURIComponent(identifier)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.locked === true && data.reentryApproved !== true) {
              setIsLocked(true);
              setCheatWarnings(1);
              if (data._id || data.reportId) setActiveCheatReportId(data._id || data.reportId);
              if (data.reentryRequested) setReentryRequested(true);
            }
          }
        } catch (e) { /* ignore */ }
      };
      checkInitialLock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetup, teamName, registrationId, isAdminLoggedIn]);

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

  // Helper for cross-browser fullscreen element
  const getFullscreenElement = useCallback(() => {
    return document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.webkitCurrentFullScreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null;
  }, []);

  // Safe cross-browser enter fullscreen
  const enterFullscreenMode = useCallback(async () => {
    const el = document.documentElement;
    const rfs = el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;

    if (rfs) {
      try {
        await rfs.call(el);
        fullscreenStartedRef.current = true;
        setIsFullscreen(true);
        return true;
      } catch (err) {
        console.warn('Native requestFullscreen failed:', err);
        showToast('Fullscreen could not start. Please allow fullscreen in your browser and try again.', 'error');
        return false;
      }
    } else {
      showToast('This browser does not support fullscreen mode. Use a supported desktop browser.', 'error');
      return false;
    }
  }, []);

  const handleUnlockWorkspace = useCallback(async () => {
    await enterFullscreenMode();
  }, [enterFullscreenMode]);

  // Track real fullscreen state with all browser vendor events
  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!getFullscreenElement();
      if (isFs) fullscreenStartedRef.current = true;
      setIsFullscreen(isFs);

      // Leaving fullscreen during a live contest is treated exactly like
      // leaving the arena. The final judging phase intentionally releases it.
      if (!isFs && fullscreenStartedRef.current && globalPhaseRef.current !== 'post_event' &&
        isSetup && isRegistered && !isAdminLoggedIn && !isLocked) {
        setIsLocked(true);
        setCheatWarnings(1);
        setReentryRequested(false);
        setToast({ message: '🚨 Fullscreen mode was exited. Your session is locked; request admin re-entry.', type: 'error' });
        fetch(`${SERVER_BASE}/api/cheat-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamName: teamName || 'Unknown Team', registrationId, phase,
            reason: 'LOCKED — Fullscreen mode exited during active contest',
            warnCount: 1, timestamp: Date.now(), locked: true,
          }),
        }).then(res => res.json()).then(data => {
          if (data.reportId || data._id) setActiveCheatReportId(data.reportId || data._id);
        }).catch(() => {});
      }
    };
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(evt => document.addEventListener(evt, onFsChange));
    return () => {
      events.forEach(evt => document.removeEventListener(evt, onFsChange));
    };
  }, [getFullscreenElement, isSetup, isRegistered, isAdminLoggedIn, isLocked, teamName, registrationId, phase]);

  // The browser requires a deliberate click to enter fullscreen. We do not
  // provide a windowed bypass for live event phases.
  useEffect(() => {
    if (globalEventPhase === 'post_event' && getFullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) {
        const result = exit.call(document);
        if (result?.catch) result.catch(() => {});
      }
    }
  }, [globalEventPhase, getFullscreenElement]);

  // Register an active contest only after native fullscreen succeeds. A student
  // who is still on the fullscreen prompt has not started the contest and must
  // not be penalized for reloading that prompt.
  useEffect(() => {
    if (isSetup && isFullscreen && isRegistered && !isAdminLoggedIn && (phase === 'create' || phase === 'hunt') && registrationId) {
      fetch(`${SERVER_BASE}/api/arena-session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, teamName, phase }),
      }).catch(() => {});
    }
  }, [isSetup, isFullscreen, isRegistered, isAdminLoggedIn, phase, registrationId, teamName]);

  // Proctoring is ONLY active when user is in code-writing phases
  // (not during registration, setup, admin mode, or while locked / in unlock grace period)
  const isProctoringActive =
    isSetup && isFullscreen && isRegistered && (phase === 'create' || phase === 'hunt') && !isAdminLoggedIn && !isLocked && !unlockGracePeriod;

  useEffect(() => {
    if (!isProctoringActive) return; // Guard: only run during active code phases
    let violationHandled = false;

    const reportCheatToServer = async (reason, warnCount = 1) => {
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
            locked: true,
          }),
        });
        const data = await res.json();
        if (data.success && (data.reportId || data._id)) {
          setActiveCheatReportId(data.reportId || data._id);
        }
      } catch (e) {
        console.warn('Could not report cheat event:', e);
      }
    };

    const handleCheatingAttempt = (reason) => {
      if (violationHandled) return;
      violationHandled = true;
      // Zero tolerance: lock locally first, then report immediately so the
      // administrator's SSE alert arrives without waiting for a page refresh.
      setIsLocked(true);
      setCheatWarnings(1);
      setReentryRequested(false);
      setToast({ message: `🚨 PROCTORING VIOLATION: ${reason}. Your screen has been locked!`, type: 'error' });
      reportCheatToServer(`LOCKED — ${reason}`, 1);
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
      const key = e.key.toLowerCase();
      const isClipboardShortcut = (e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(key);
      const isInspectionShortcut = key === 'f12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        ((e.ctrlKey || e.metaKey) && ['u', 's', 'p'].includes(key));
      if (isClipboardShortcut || isInspectionShortcut) {
        e.preventDefault();
        handleCheatingAttempt(isInspectionShortcut ? 'Restricted browser/developer shortcut detected' : 'Copy / paste / cut shortcut blocked');
      }
    };
    const handleContextMenu = (e) => {
      e.preventDefault();
      handleCheatingAttempt('Context menu attempt detected');
    };

    const handleBeforeUnload = (e) => {
      // 1. Browser native confirmation prompt
      e.preventDefault();
      e.returnValue = 'PROCTORING WARNING: Reloading or leaving the contest window will LOCK your account!';

      // 2. Persist reload lock locally
      try {
        localStorage.setItem('bugarena_reload_lock', JSON.stringify({
          teamName: teamName || 'Unknown Team',
          registrationId: registrationId || '',
          reason: 'LOCKED — Page reload / Tab closed during active contest',
          phase,
          timestamp: Date.now(),
        }));
      } catch {}

      // 3. Send immediate beacon to server
      try {
        const payload = JSON.stringify({
          teamName: teamName || 'Unknown Team',
          registrationId: registrationId || '',
          reason: 'LOCKED — Page reload / Tab closed during active contest',
          warnCount: 1,
          phase,
          timestamp: Date.now(),
          locked: true,
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`${SERVER_BASE}/api/cheat-report`, blob);
      } catch (err) {
        console.warn('Beacon send failed:', err);
      }

      return e.returnValue;
    };

    const handlePageHide = () => {
      try {
        const payload = JSON.stringify({
          teamName: teamName || 'Unknown Team',
          registrationId: registrationId || '',
          reason: 'LOCKED — Page reload / Tab closed during active contest',
          warnCount: 1,
          phase,
          timestamp: Date.now(),
          locked: true,
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`${SERVER_BASE}/api/cheat-report`, blob);
      } catch {}
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      if (blurTimer) clearTimeout(blurTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProctoringActive, phase, teamName, registrationId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchAdminRegistryData = async () => {
    setIsLoadingAdminData(true);
    try {
      const [res, regRes, statsRes, cheatRes] = await Promise.all([
        fetch(REGISTRY_URL),
        fetch(`${SERVER_BASE}/api/registrations`),
        fetch(`${SERVER_BASE}/api/registrations/stats`),
        fetch(`${SERVER_BASE}/api/cheat-reports`),
      ]);
      const data = await res.json();
      setAdminRegistryData(data || {});
      if (data?.verifications) {
        const loadedOverrides = {};
        Object.entries(data.verifications).forEach(([repId, v]) => {
          if (v && v.overrides) loadedOverrides[repId] = v.overrides;
        });
        setBugOverrides(prev => ({ ...loadedOverrides, ...prev }));
      }
      const regData = await regRes.json();
      setAdminRegistrations(Array.isArray(regData) ? regData : []);
      const statsData = await statsRes.json();
      setAdminRegStats(statsData);
      const cheatData = await cheatRes.json();
      setAdminCheatReports(Array.isArray(cheatData) ? cheatData : []);
      showToast('Portal data refreshed!');
    } catch (e) {
      showToast('Failed to fetch data — ensure server is running', 'error');
    }
    setIsLoadingAdminData(false);
  };

  // Full dashboard data includes every source file and report. Keep it as a
  // very low-frequency fallback; phase and proctoring changes are already
  // delivered immediately through their dedicated endpoints.
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    const intervalId = setInterval(async () => {
      try {
        const [res, regRes, statsRes, cheatRes] = await Promise.all([
          fetch(REGISTRY_URL),
          fetch(`${SERVER_BASE}/api/registrations`),
          fetch(`${SERVER_BASE}/api/registrations/stats`),
          fetch(`${SERVER_BASE}/api/cheat-reports`),
        ]);
        
        const data = await res.json();
        if (data) {
          setAdminRegistryData(data);
          if (data.verifications) {
            const loadedOverrides = {};
            Object.entries(data.verifications).forEach(([repId, v]) => {
              if (v && v.overrides) loadedOverrides[repId] = v.overrides;
            });
            setBugOverrides(prev => ({ ...loadedOverrides, ...prev }));
          }
        }

        const regData = await regRes.json();
        if (Array.isArray(regData)) setAdminRegistrations(regData);
        
        const statsData = await statsRes.json();
        setAdminRegStats(statsData);
        
        const cheatData = await cheatRes.json();
        if (Array.isArray(cheatData)) setAdminCheatReports(cheatData);
      } catch (e) { /* silent */ }
    }, 60000);
    return () => clearInterval(intervalId);
  }, [isAdminLoggedIn]);

  useEffect(() => {
    if (!isAdminLoggedIn || typeof EventSource === 'undefined') return;
    const stream = new EventSource(`${SERVER_BASE}/api/admin-alerts/stream`);
    const onAlert = (event) => {
      try {
        const alert = JSON.parse(event.data);
        setAdminCheatReports(prev => {
          const existing = prev.findIndex(report => report._id === alert.id);
          const next = { ...alert, _id: alert.id, locked: true, adminUnlocked: false };
          return existing >= 0 ? prev.map((report, index) => index === existing ? { ...report, ...next } : report) : [next, ...prev];
        });
        showToast(`🚨 Immediate proctoring alert: ${alert.teamName} — ${alert.reason}`, 'error');
      } catch { /* ignore malformed alert */ }
    };
    stream.addEventListener('proctoring-alert', onAlert);
    return () => stream.close();
  }, [isAdminLoggedIn]);

  // Admin dismisses / clears a cheat report
  const handleDismissCheatReport = async (reportId) => {
    try {
      const response = await fetch(`${SERVER_BASE}/api/cheat-reports/${reportId}/dismiss`, {
        method: 'DELETE',
        headers: { 'x-admin-session': adminAuthToken },
      });
      if (!response.ok) throw new Error('Dismissal was rejected by the server.');
      setAdminCheatReports(prev => prev.filter(r => r._id !== reportId));
      showToast('Cheat report dismissed.');
    } catch (e) {
      showToast('Could not dismiss report — server error', 'error');
    }
  };

  // Admin unlocks a participant from the server side
  const handleAdminUnlockParticipant = async (reportId, teamName, regId) => {
    try {
      const res = await fetch(`${SERVER_BASE}/api/cheat-reports/approve-reentry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-session': adminAuthToken },
        body: JSON.stringify({ reportId, teamName, registrationId: regId }),
      });
      if (res.status === 401) {
        try {
          sessionStorage.removeItem('ba_admin_session');
          sessionStorage.removeItem('ba_admin_token');
        } catch {}
        setAdminAuthToken('');
        setIsAdminLoggedIn(false);
        setPhase('create');
        setAdminModalOpen(true);
        throw new Error('Your admin session expired. Please log in again, then approve the re-entry request.');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Unlock was rejected by the server.');
      }
      setAdminCheatReports(prev => prev.map(r => r._id === reportId ? { ...r, reentryApproved: true, adminUnlocked: true, locked: false, reentryRequested: false } : r));
      showToast(`✅ ${teamName} has been unlocked and can re-enter.`);
      fetchAdminRegistryData();
    } catch (e) {
      showToast(e.message || 'Could not unlock — server error', 'error');
    }
  };

  const handleRequestReentry = async () => {
    const identifier = activeCheatReportId || registrationId || teamName;
    if (!identifier) {
      showToast('No active lock session found.', 'error');
      return;
    }
    try {
      const res = await fetch(`${SERVER_BASE}/api/cheat-reports/request-reentry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: activeCheatReportId || '',
          teamName: teamName || '',
          registrationId: registrationId || '',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReentryRequested(true);
        if (data.report?._id) setActiveCheatReportId(data.report._id);
        showToast('Re-entry request sent to admin. Please wait.');
      } else if (activeCheatReportId) {
        await fetch(`${SERVER_BASE}/api/cheat-reports/${activeCheatReportId}/request-reentry`, { method: 'PATCH' });
        setReentryRequested(true);
        showToast('Re-entry request sent to admin. Please wait.');
      } else {
        showToast(data.error || 'Could not send request', 'error');
      }
    } catch (e) {
      showToast('Could not send request', 'error');
    }
  };

  const handleAdminLogin = async (username, password) => {
    setIsAdminAuthenticating(true);
    try {
      const res = await fetch(`${SERVER_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.token) throw new Error('Missing admin session token');
        setAdminAuthToken(data.token);
        setIsAdminLoggedIn(true);
        setAdminModalOpen(false);
        setPhase('admin');
        setAdminActiveTab('registrations');
        try {
          sessionStorage.setItem('ba_admin_session', 'true');
          sessionStorage.setItem('ba_admin_token', data.token);
        } catch {}
        fetchAdminRegistryData();
        showToast('Welcome! Portal unlocked.');
      } else {
        const data = await res.json();
        showToast(data.error || 'Invalid credentials.', 'error');
      }
    } catch {
      showToast('Cannot reach server. Try again.', 'error');
    } finally {
      setIsAdminAuthenticating(false);
    }
  };

  const handleAdminLogout = () => {
    // The admin view is restored only from this session marker after a reload,
    // so it must be removed on logout as well as updating React state.
    try {
      sessionStorage.removeItem('ba_admin_session');
      sessionStorage.removeItem('ba_admin_token');
    } catch {}
    setAdminAuthToken('');
    setIsAdminLoggedIn(false);
    setAdminRegistryData(null);
    setAdminRegistrations([]);
    setAdminRegStats(null);
    setAdminCheatReports([]);
    setPhase('create');
    showToast('Admin logged out. Login is required to reopen the portal.');
  };

  // ─── Handle Registration Submit ──────────────────────────────────────────
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');

    const activeMembers = [regMembers[0]];

    // Client-side validation
    for (const m of activeMembers) {
      if (!m.name.trim()) { setRegError('Please enter all member names.'); return; }
      if (!/^\S+@\S+\.\S+$/.test(m.email.trim())) { setRegError('Please enter a valid email address for every member.'); return; }
      if (!/^[6-9]\d{9}$/.test(m.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))) { setRegError('Please enter a valid 10-digit Indian phone number for every member.'); return; }
    }

    setIsRegistering(true);
    try {
      const res = await fetch(`${SERVER_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamType: 'solo', members: activeMembers }),
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
      showToast(`🎉 Registration submitted! ID: ${data.registrationId}`);
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
        headers: { 'Content-Type': 'application/json', 'x-admin-session': adminAuthToken },
        body: JSON.stringify({ status, adminNote: adminNoteInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminRegistrations(prev =>
          prev.map(r => r.registrationId === registrationId ? data.registration : r)
        );
        showToast(`✅ Registration ${status === 'verified' ? 'Approved' : 'Rejected'}!`);
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

  const handleExportRegistrations = () => {
    const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Registration ID', 'Approval status', 'Submitted at', 'Name', 'Email', 'Phone', 'Admin note'],
      ...adminRegistrations.map(reg => {
        const members = reg.members || [];
        return [reg.registrationId, reg.paymentStatus === 'verified' ? 'Approved' : reg.paymentStatus === 'rejected' ? 'Rejected' : 'Pending approval', new Date(reg.submittedAt).toLocaleString('en-IN'), members[0]?.name || '', members[0]?.email || '', members[0]?.phone || '', reg.adminNote || ''];
      }),
    ];
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bug-arena-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Registration CSV downloaded.');
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      showToast('Please enter a team name', 'error');
      return;
    }
    const identifier = teamName.trim() || registrationId;
    try {
      const res = await fetch(`${SERVER_BASE}/api/cheat-reports/lock-status/${encodeURIComponent(identifier)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.locked === true && data.reentryApproved !== true) {
          setIsLocked(true);
          setCheatWarnings(1);
          if (data._id || data.reportId) setActiveCheatReportId(data._id || data.reportId);
          if (data.reentryRequested) setReentryRequested(true);
          setIsSetup(true);
          showToast('Session is locked due to a proctoring violation.', 'error');
          return;
        }
      }
    } catch { /* proceed */ }
    if (registrationId) {
      fetch(`${SERVER_BASE}/api/arena-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, programmingLanguage: language }),
      }).catch(() => {});
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
  // Uses a stable team-based slot key so re-submissions UPSERT the same entry
  // (admin panel always shows only the LATEST version)
  const handleSubmitCode = async (isAutoSubmit = false) => {
    if (globalEventPhase !== 'coding') {
      showToast('The coding phase has ended. Code editing and submission are locked.', 'error');
      return;
    }
    if (!isAutoSubmit && !isFullscreen) {
      showToast('Fullscreen mode is required before submitting.', 'error');
      return;
    }
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

    // Use the SAME key as the previous submission (if editing) so admin sees one entry.
    // Only generate a new key on the very first submission for this team.
    // pendingEditKeyRef holds the key when user clicked "Edit & Resubmit" (submittedKey was cleared for UX)
    const existingKey = submittedKey || pendingEditKeyRef.current || draftKeyRef.current;
    const isResubmit = !!existingKey;
    const key = isResubmit ? existingKey : generate6CharKey();
    draftKeyRef.current = key;
    pendingEditKeyRef.current = null; // consumed

    const payload = {
      team: teamName.trim() || 'Team Anonymous',
      registrationId: registrationId || '',
      language,
      code,
      createdBugs: validBugs,
      bugLineNumber: validBugs.map(b => b.lineNumber || 'N/A').join(', '),
      bugInfo: validBugs.map(b => b.description).join(' | '),
      key,
      timestamp: Date.now(),
      updatedAt: isResubmit ? Date.now() : null,
      isEdited: isResubmit,
    };

    // 1. Store in localStorage (keyed by team key)
    try {
      localStorage.setItem(`nexus_bug_${key}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage warning:', e);
    }

    // 2. Atomic server-side upsert: concurrent teams cannot overwrite each
    // other's submissions during the final-minute rush.
    try {
      const response = await fetch(`${SERVER_BASE}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || 'Submission save failed');
      }
    } catch (err) {
      console.warn('Cloud registry sync error:', err);
      setIsSubmitting(false);
      showToast(err.message || 'Could not save your code. Please try submitting again.', 'error');
      return;
    }

    if (registrationId) {
      fetch(`${SERVER_BASE}/api/arena-session/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      }).catch(() => {});
    }

    setSubmittedKey(key);
    setIsSubmitting(false);
    if (isResubmit) {
      showToast(`✅ Code updated! Admin panel now shows your latest version. Key: ${key}`);
    } else {
      showToast(`Code submitted with ${validBugs.length} bug(s)! Key: ${key}`);
    }
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

    // ── Anti-cheat: Block a team from decoding their own submitted key ──
    if (submittedKey && cleanKey === submittedKey.toUpperCase()) {
      setIsDecoding(false);
      showToast('❌ You cannot decode your own key! The admin will assign you a rival team\'s code.', 'error');
      setImportString('');
      return;
    }

    // Check 1: Is it a 6-character key in localStorage?
    const localData = localStorage.getItem(`nexus_bug_${cleanKey}`);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        // Guard: also block if the payload team matches their own team name
        if (parsed.team && teamName && parsed.team.trim().toLowerCase() === teamName.trim().toLowerCase()) {
          setIsDecoding(false);
          showToast('❌ This code belongs to your own team — you cannot hunt your own bugs!', 'error');
          setImportString('');
          return;
        }
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
        // Anti-cheat: block if the payload belongs to the same team
        if (payload.team && teamName && payload.team.trim().toLowerCase() === teamName.trim().toLowerCase()) {
          setIsDecoding(false);
          showToast('❌ This code belongs to your own team — you cannot hunt your own bugs!', 'error');
          setImportString('');
          return;
        }
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
  const handleGenerateReport = async (isAutoSubmit = false) => {
    if (!isAutoSubmit && globalEventPhase !== 'hunting') {
      showToast('Bug reports can only be updated while the hunting phase is open.', 'error');
      return;
    }
    const validFound = foundBugs.filter(b => b.description.trim());
    if (validFound.length === 0) {
      showToast(isAutoSubmit ? 'Hunting ended with no completed bug report to submit.' : 'Describe at least one bug you found!', isAutoSubmit ? 'info' : 'error');
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
      // This identity is stable for a team's review of one exchanged code.
      // The server replaces this slot on every update, rather than adding a
      // second card that would confuse the verification team.
      reportSlot: `${registrationId || reviewer.trim().toLowerCase()}::${decodedData?.key || 'N/A'}::${(decodedData?.language || 'python').toLowerCase()}`,
      reviewerRegistrationId: registrationId || '',
      reviewer,
      originalTeam,
      key: decodedData?.key || 'N/A',
      language: decodedData?.language || 'python',
      foundBugs: validFound,
      originalCreatedBugs: decodedData?.createdBugs || [],
      originalCode: decodedData?.code || '',
      timestamp: Date.now(),
      updatedAt: Date.now(),
      isUpdated: reportSubmitted,
    };

    try {
      const response = await fetch(`${SERVER_BASE}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || 'Report save failed');
      }
    } catch (e) {
      console.warn('Cloud report sync error:', e);
      showToast(e.message || 'Could not save your bug report. Please try again.', 'error');
      return;
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

    // Keep the same form editable until the hunting phase ends. A later save
    // replaces this report and receives a later queue position.
    setReportSubmitted(true);
  };

  // ── Multi-Factor Semantic & Intent Bug Matching Engine ──
  const BUG_CATEGORIES = {
    INDEX_BOUNDS: {
      name: 'Index & Array Bounds / Off-by-One',
      icon: '📏',
      keywords: ['index', 'bound', 'bounds', 'array', 'list', 'length', 'size', 'len', 'off-by-one', 'oob', 'subscript', 'element', 'position', 'out of range', 'indexerror', 'arrayindexoutofbounds', 'stringindexoutofbounds', 'overflow', 'slice', 'iteration', 'exceeds', 'last element'],
    },
    NULL_REFERENCE: {
      name: 'Null / Undefined Pointer Dereference',
      icon: '🚫',
      keywords: ['null', 'none', 'nil', 'nullpointer', 'npe', 'pointer', 'dereference', 'empty', 'undefined', 'segfault', 'nonetype', 'nullpointerexception', 'unassigned', 'uninitialized', 'missing object', 'null check'],
    },
    INFINITE_LOOP: {
      name: 'Infinite Loop & Termination Flaw',
      icon: '🔄',
      keywords: ['loop', 'while', 'for', 'iterate', 'iteration', 'infinite', 'termination', 'condition', 'counter', 'increment', 'decrement', 'hangs', 'stuck', 'forever', 'never terminates', 'never ends', 'while true', 'infinite recursion'],
    },
    SYNTAX_STRUCTURE: {
      name: 'Syntax, Punctuation & Bracket Error',
      icon: '🔣',
      keywords: ['syntax', 'semicolon', 'colon', 'paren', 'parenthesis', 'bracket', 'brace', 'indent', 'indentation', 'quote', 'comma', 'unclosed', 'missing colon', 'missing semicolon', 'curly', 'indentationerror', 'parse error'],
    },
    LOGIC_OPERATOR: {
      name: 'Logical Operator & Inverted Condition',
      icon: '🔀',
      keywords: ['logic', 'condition', 'boolean', 'operator', 'inverted', 'reversed', 'wrong condition', 'equals', 'equality', 'comparison', 'and/or', 'greater', 'less', '<=', '>=', '!=', '==', '===', 'negation', 'if statement', 'branch', 'wrong operator', 'inverted check'],
    },
    VARIABLE_SCOPE: {
      name: 'Variable Typo, Scope & Undeclared Name',
      icon: '🏷️',
      keywords: ['variable', 'var', 'identifier', 'name', 'naming', 'misspelled', 'typo', 'undefined', 'undeclared', 'scope', 'reference', 'shadowing', 'nameerror', 'unbound', 'local', 'global', 'wrong variable'],
    },
    MATH_ARITHMETIC: {
      name: 'Math, Arithmetic & Division by Zero',
      icon: '➗',
      keywords: ['math', 'calculation', 'divide', 'division', 'zero', 'overflow', 'underflow', 'modulo', 'sign', 'negative', 'sum', 'multiply', 'zerodivisionerror', 'arithmeticexception', 'precision', 'float', 'divide by zero'],
    },
    TYPE_MISMATCH: {
      name: 'Data Type Mismatch & Casting Error',
      icon: '🔤',
      keywords: ['type', 'cast', 'datatype', 'string', 'int', 'integer', 'float', 'double', 'conversion', 'incompatible', 'parse', 'typeerror', 'classcastexception', 'numberformatexception', 'type error', 'cannot convert'],
    },
    RETURN_BEHAVIOR: {
      name: 'Missing, Void or Early Return',
      icon: '↩️',
      keywords: ['return', 'output', 'missing return', 'void', 'early return', 'result', 'yield', 'exit', 'no return', 'unreachable', 'dead code', 'wrong return value'],
    },
    RECURSION_BASE: {
      name: 'Recursion Base Case & Stack Overflow',
      icon: '🧱',
      keywords: ['recursion', 'recursive', 'base case', 'stack overflow', 'stackoverflowerror', 'maximum recursion', 'recursionerror', 'deep recursion', 'missing base case'],
    },
    RESOURCE_IO: {
      name: 'Resource Leak, File & Stream Error',
      icon: '📁',
      keywords: ['file', 'stream', 'close', 'closed', 'socket', 'leak', 'unclosed', 'resource', 'ioexception', 'filenotfound', 'buffer', 'flush', 'connection'],
    },
    IMPORT_MODULE: {
      name: 'Module Import & Dependency Error',
      icon: '📦',
      keywords: ['import', 'module', 'package', 'library', 'dependency', 'include', 'require', 'modulenotfounderror', 'cannot find symbol'],
    },
  };

  const STOPWORDS = new Set([
    'the', 'is', 'in', 'at', 'of', 'a', 'an', 'this', 'that', 'on', 'with', 'for', 'to', 'by', 'it', 'as', 'be', 'we',
    'have', 'has', 'do', 'does', 'from', 'but', 'not', 'are', 'was', 'were', 'been', 'there', 'their', 'they', 'what',
    'which', 'who', 'when', 'where', 'why', 'how', 'code', 'bug', 'line', 'here', 'error', 'found', 'problem', 'instead',
    'team', 'please', 'check', 'fix', 'should', 'could', 'would', 'will', 'must', 'can', 'may'
  ]);

  const extractLineNumbers = (val) => {
    if (!val) return [];
    const matches = val.toString().match(/\b\d+\b/g);
    return matches ? [...new Set(matches.map(Number))] : [];
  };

  const calculateLineProximity = (hLines, cLines) => {
    if (hLines.length === 0 || cLines.length === 0) return 0.35;
    let minDiff = Infinity;
    for (const h of hLines) {
      for (const c of cLines) {
        const diff = Math.abs(h - c);
        if (diff < minDiff) minDiff = diff;
      }
    }
    if (minDiff === 0) return 1.0;     // exact same line
    if (minDiff === 1) return 0.90;    // adjacent line (off-by-1)
    if (minDiff === 2) return 0.80;    // 2 lines away (inside same statement/loop)
    if (minDiff <= 4) return 0.65;     // 3-4 lines away (same block)
    if (minDiff <= 7) return 0.40;     // same function
    return 0.15;
  };

  const tokenizeClean = (str) => {
    if (!str) return [];
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  };

  const detectBugCategory = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase();
    let bestCat = null;
    let maxMatches = 0;

    Object.entries(BUG_CATEGORIES).forEach(([catKey, catObj]) => {
      let matches = 0;
      catObj.keywords.forEach(kw => {
        if (kw.includes(' ') && lower.includes(kw)) {
          matches += 3; // Multi-word phrases carry strong weight
        } else if (lower.includes(kw)) {
          matches += 1;
        }
      });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestCat = catKey;
      }
    });

    return maxMatches >= 1 ? bestCat : null;
  };

  const computeSemanticSimilarity = (hDesc, cDesc) => {
    const hRaw = (hDesc || '').toLowerCase().trim();
    const cRaw = (cDesc || '').toLowerCase().trim();
    if (!hRaw || !cRaw) return 0;

    const hTokens = tokenizeClean(hDesc);
    const cTokens = tokenizeClean(cDesc);

    // Exact phrase or substring match boost
    let substringScore = 0;
    if (hRaw.includes(cRaw) || cRaw.includes(hRaw)) {
      substringScore = 0.55;
    }

    // Direct token overlap
    let directMatches = 0;
    for (const ht of hTokens) {
      if (cTokens.includes(ht)) directMatches++;
    }
    const minTokens = Math.min(hTokens.length, cTokens.length) || 1;
    const tokenScore = Math.min(1.0, directMatches / minTokens);

    // Category Alignment (solves concise 1-liner vs verbose descriptions)
    const hCat = detectBugCategory(hDesc);
    const cCat = detectBugCategory(cDesc);
    const categoryAligned = (hCat && cCat && hCat === cCat);
    const categoryScore = categoryAligned ? 0.90 : 0;

    return Math.min(1.0, (tokenScore * 0.35) + (categoryScore * 0.45) + substringScore);
  };

  const extractCodeContextWindow = (code, lines) => {
    if (!code || lines.length === 0) return { snippet: '', identifiers: [] };
    const codeLines = code.split('\n');
    const minLine = Math.max(1, Math.min(...lines) - 2);
    const maxLine = Math.min(codeLines.length, Math.max(...lines) + 2);
    
    const snippetLines = [];
    for (let i = minLine; i <= maxLine; i++) {
      if (codeLines[i - 1] !== undefined) {
        snippetLines.push(codeLines[i - 1]);
      }
    }
    const snippet = snippetLines.join(' ');
    // Extract programming identifiers (var names, functions)
    const identifiers = snippet
      .replace(/[^\w]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()));

    return { snippet: snippet.toLowerCase(), identifiers: [...new Set(identifiers)] };
  };

  const computeDeepBugAnalysis = (hunterReport, creatorTeamData, overrides = {}) => {
    const emptyResult = {
      pairs: [],
      unmatchedHunterBugs: [],
      missedCreatorBugs: [],
      verifiedCount: 0,
      hunterBonusCount: 0,
      acceptedBonusCount: 0,
      falsePositiveCount: 0,
      precisionRate: 0,
      isHighSpam: false,
      hunterScore: 0,
      creatorScore: 0,
      recommendedWinner: 'None',
      recommendationReason: 'Insufficient data for comparison',
      status: 'NO_DATA',
    };

    if (!hunterReport) return emptyResult;

    const hunterBugs = hunterReport.foundBugs || [];
    const creatorBugs = (creatorTeamData?.createdBugs?.length > 0)
      ? creatorTeamData.createdBugs
      : (hunterReport.originalCreatedBugs || []);
    const originalCode = creatorTeamData?.code || hunterReport.originalCode || '';

    if (hunterBugs.length === 0 && creatorBugs.length === 0) return emptyResult;

    // Build candidate pair scoring matrix
    const candidates = [];
    hunterBugs.forEach((hBug, hIdx) => {
      const hLines = extractLineNumbers(hBug.lineNumber);
      const hCategory = detectBugCategory(hBug.description);
      const hTokens = tokenizeClean(hBug.description);

      creatorBugs.forEach((cBug, cIdx) => {
        const cLines = extractLineNumbers(cBug.lineNumber);
        const cCategory = detectBugCategory(cBug.description);
        const cTokens = tokenizeClean(cBug.description);

        const lineScore = calculateLineProximity(hLines, cLines);
        const semanticScore = computeSemanticSimilarity(hBug.description, cBug.description);

        // Check code context anchors around the combined lines
        const targetLines = [...hLines, ...cLines];
        const { snippet, identifiers } = extractCodeContextWindow(originalCode, targetLines);
        
        let anchorScore = 0.4;
        let matchedAnchor = null;
        if (identifiers.length > 0) {
          const hHasAnchor = identifiers.find(id => hTokens.includes(id.toLowerCase()));
          const cHasAnchor = identifiers.find(id => cTokens.includes(id.toLowerCase()));
          if (hHasAnchor && cHasAnchor) {
            anchorScore = 1.0;
            matchedAnchor = hHasAnchor;
          } else if (hHasAnchor || cHasAnchor) {
            anchorScore = 0.75;
            matchedAnchor = hHasAnchor || cHasAnchor;
          }
        }

        const categoryAligned = (hCategory && cCategory && hCategory === cCategory);

        // Multi-probability weighted confidence
        let confidence = Math.round(
          ((lineScore * 0.35) + (semanticScore * 0.40) + (anchorScore * 0.25)) * 100
        );

        // Specific Probability Boosts (handles 1-line vs verbose description and off-by-N)
        if (categoryAligned && lineScore >= 0.65) {
          confidence = Math.max(confidence, 88); // High confidence: shared concept and adjacent block
        }
        if (categoryAligned && lineScore >= 0.85) {
          confidence = Math.max(confidence, 96); // Exceptional: same line + same concept
        }
        if (lineScore === 1.0 && (semanticScore >= 0.35 || matchedAnchor)) {
          confidence = Math.max(confidence, 92);
        }

        let justification = '';
        if (categoryAligned) {
          const catName = BUG_CATEGORIES[hCategory]?.name || 'Concept Defect';
          justification = `Both identify ${catName} near Line ${hLines.join(',') || cLines.join(',')} (${Math.round(semanticScore * 100)}% semantic alignment). Verified across 1-liner vs detailed description.`;
        } else if (lineScore >= 0.85 && semanticScore >= 0.4) {
          justification = `Direct alignment on Line ${hLines.join(',') || cLines.join(',')} (${Math.round(semanticScore * 100)}% keyword overlap).`;
        } else if (lineScore >= 0.80) {
          justification = `Same execution block (within 2 lines). Targeted variables and behavior correlate.`;
        } else if (semanticScore >= 0.6) {
          justification = `Strong conceptual match (${Math.round(semanticScore * 100)}% semantic overlap), despite line drift.`;
        } else {
          justification = `Weak correlation between descriptions and line targets.`;
        }

        candidates.push({
          hIdx,
          cIdx,
          hBug,
          cBug,
          confidence,
          category: hCategory || cCategory || null,
          categoryName: BUG_CATEGORIES[hCategory || cCategory]?.name || null,
          categoryIcon: BUG_CATEGORIES[hCategory || cCategory]?.icon || '🐛',
          lineScore: Math.round(lineScore * 100),
          semanticScore: Math.round(semanticScore * 100),
          matchedAnchor,
          justification,
        });
      });
    });

    candidates.sort((a, b) => b.confidence - a.confidence);

    const matchedH = new Set();
    const matchedC = new Set();
    const pairs = [];

    for (const cand of candidates) {
      if (!matchedH.has(cand.hIdx) && !matchedC.has(cand.cIdx)) {
        const overrideKey = `${hunterReport.id}_h${cand.hBug.id || cand.hIdx}`;
        const userOverride = overrides[overrideKey];

        const isConfident = cand.confidence >= 45;
        if (isConfident || userOverride === 'confirmed') {
          matchedH.add(cand.hIdx);
          matchedC.add(cand.cIdx);

          // Confidence is a suggestion, never a verification. Only an admin
          // override can turn a row into a scoring decision.
          const status = userOverride || 'suggested';
          pairs.push({
            ...cand,
            status,
            userOverridden: !!userOverride,
          });
        }
      }
    }

    const unmatchedHunterBugs = hunterBugs
      .map((hBug, hIdx) => ({ hBug, hIdx }))
      .filter(({ hIdx }) => !matchedH.has(hIdx))
      .map(({ hBug, hIdx }) => {
        const overrideKey = `${hunterReport.id}_h${hBug.id || hIdx}`;
        return {
          hBug,
          hIdx,
          // An unmatched claim requires human review; it is not automatically
          // false or penalty-worthy.
          status: overrides[overrideKey] || 'suggested',
          userOverridden: !!overrides[overrideKey],
        };
      });

    const missedCreatorBugs = creatorBugs
      .map((cBug, cIdx) => ({ cBug, cIdx }))
      .filter(({ cIdx }) => !matchedC.has(cIdx));

    let verifiedCount = 0;
    let hunterBonusCount = 0;
    let falsePositiveCount = 0;
    let acceptedBonusCount = 0;

    pairs.forEach(p => {
      if (p.status === 'confirmed') {
        verifiedCount++;
        if (p.hBug.fix && p.hBug.fix.trim().length > 5) hunterBonusCount++;
      } else if (p.status === 'rejected') {
        falsePositiveCount++;
      }
    });

    unmatchedHunterBugs.forEach(u => {
      if (u.status === 'bonus') {
        acceptedBonusCount++;
      } else if (u.status === 'rejected') {
        falsePositiveCount++;
      }
    });

    // Precision & Anti-Spam Calculation (prevents spamming reports to steal wins)
    const totalReported = hunterBugs.length;
    const precisionRate = totalReported > 0
      ? Math.round(((verifiedCount + acceptedBonusCount) / totalReported) * 100)
      : 0;
    const isHighSpam = (totalReported >= (creatorBugs.length + 2) && precisionRate < 50) || falsePositiveCount >= 3;

    // Fair Scoring Model
    // Verified planted bugs: +100 pts
    // Bonus genuine unintended bugs: +75 pts
    // Accurate fixes provided: +25 pts
    // False/unverified claims: -40 pts penalty
    const hunterScore = Math.max(0, (verifiedCount * 100) + (acceptedBonusCount * 75) + (hunterBonusCount * 25) - (falsePositiveCount * 40));
    // Creator Defense: +80 pts per missed stealth bug + 50 pts bonus if hunter spammed
    const creatorScore = (missedCreatorBugs.length * 80) + (isHighSpam ? 50 : 0);

    let recommendedWinner = 'None';
    let recommendationReason = '';

    if (isHighSpam && creatorScore >= hunterScore) {
      recommendedWinner = hunterReport.originalTeam;
      recommendationReason = `Creating Team defended against ${falsePositiveCount} false claims (Finding Team spam-penalized: ${precisionRate}% accuracy). Creator's stealth defense prevailed!`;
    } else if (verifiedCount > 0 && verifiedCount >= creatorBugs.length && falsePositiveCount === 0) {
      recommendedWinner = hunterReport.reviewer;
      recommendationReason = `Finding Team cleanly caught all ${verifiedCount}/${creatorBugs.length} planted bugs with 100% precision & 0 false claims!`;
    } else if (missedCreatorBugs.length > verifiedCount) {
      recommendedWinner = hunterReport.originalTeam;
      recommendationReason = `Creating Team's stealth bugs prevailed (${missedCreatorBugs.length} missed bugs vs ${verifiedCount} caught).`;
    } else if (hunterScore > creatorScore && precisionRate >= 50) {
      recommendedWinner = hunterReport.reviewer;
      recommendationReason = `Finding Team leads on verified accuracy points (${hunterScore} pts vs ${creatorScore} defense pts, ${precisionRate}% precision).`;
    } else if (creatorScore > hunterScore) {
      recommendedWinner = hunterReport.originalTeam;
      recommendationReason = `Creating Team leads on stealth defense points (${creatorScore} pts vs ${hunterScore} pts).`;
    } else {
      recommendedWinner = 'TIE';
      recommendationReason = `Close contest (${hunterScore} pts each). Admin discretion or code quality tie-breaker advised.`;
    }

    return {
      pairs,
      unmatchedHunterBugs,
      missedCreatorBugs,
      verifiedCount,
      hunterBonusCount,
      acceptedBonusCount,
      falsePositiveCount,
      precisionRate,
      isHighSpam,
      hunterScore,
      creatorScore,
      recommendedWinner,
      recommendationReason,
      status: verifiedCount > 0 ? (verifiedCount === creatorBugs.length ? 'PERFECT' : 'PARTIAL') : 'PENDING_REVIEW',
    };
  };

  const evaluateBugMatch = (hunterReport, creatorTeamData) => {
    const analysis = computeDeepBugAnalysis(hunterReport, creatorTeamData);
    if (analysis.status === 'PERFECT') {
      return {
        status: 'PERFECT',
        score: analysis.hunterScore,
        label: '🟢 PERFECT MATCH',
        details: `${analysis.verifiedCount} bug(s) verified! 0 false claims.`
      };
    } else if (analysis.status === 'PARTIAL') {
      return {
        status: 'PARTIAL',
        score: analysis.hunterScore,
        label: '🟡 PARTIAL MATCH',
        details: `${analysis.verifiedCount} verified bug(s) | ${analysis.falsePositiveCount} false claim(s).`
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

  // ── Admin Decision & Bug Override Handlers ──
  const handleSaveAdminDecision = async (reportId, winner, details = {}) => {
    try {
      const decision = {
        winner,
        reason: details.reason || '',
        hunterScore: details.hunterScore || 0,
        creatorScore: details.creatorScore || 0,
        verifiedCount: details.verifiedCount || 0,
        overrides: bugOverrides[reportId] || {},
        decidedAt: Date.now(),
      };
      const response = await fetch(`${SERVER_BASE}/api/verifications/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-session': adminAuthToken },
        body: JSON.stringify(decision),
      });
      if (!response.ok) throw new Error('Decision save failed');
      setAdminRegistryData(prev => ({
        ...(prev || {}),
        verifications: { ...(prev?.verifications || {}), [reportId]: decision },
      }));
      showToast(`🏆 Decision Saved: Winner is "${winner}"!`, 'success');
    } catch (e) {
      showToast('Could not save verdict — network error', 'error');
    }
  };

  const handleToggleBugOverride = (reportId, bugKey, newStatus) => {
    setBugOverrides(prev => {
      const reportOverrides = { ...(prev[reportId] || {}) };
      if (reportOverrides[bugKey] === newStatus) {
        delete reportOverrides[bugKey]; // toggle off
      } else {
        reportOverrides[bugKey] = newStatus;
      }
      return { ...prev, [reportId]: reportOverrides };
    });
  };

  // ── Workload Reduction: suggestions only ───────────────────────────────
  // A heuristic can highlight evidence, but it must not award points or save a
  // winner. The administrator makes the final decision after reviewing rows.
  const handleBatchAutoVerify = async (targetLang = 'all') => {
    try {
      const targetReports = reportsList.filter(r => {
        if (targetLang === 'all') return true;
        const lang = (r.language || '').toLowerCase() || 'python';
        return lang === targetLang.toLowerCase();
      });

      if (targetReports.length === 0) {
        showToast('No matches found for auto-verification', 'info');
        return;
      }

      const suggestedCount = targetReports.reduce((count, r) => {
        const creatorData = teamEntries.find(t => t.team === r.originalTeam || t.key === r.key);
        const analysis = computeDeepBugAnalysis(r, creatorData, bugOverrides[r.id] || {});
        return count + analysis.pairs.filter(p => p.confidence >= 75).length;
      }, 0);
      showToast(`Review aid found ${suggestedCount} high-confidence alignments. No points, claims, or winners were changed.`, 'info');
    } catch (e) {
      showToast('Batch auto-verification failed: ' + e.message, 'error');
    }
  };

  const handleCopyWinnerSummary = (targetLang = 'all') => {
    const targetReports = reportsList.filter(r => {
      if (targetLang === 'all') return true;
      const lang = (r.language || '').toLowerCase() || 'python';
      return lang === targetLang.toLowerCase();
    });

    if (targetReports.length === 0) {
      showToast('No match records to export.', 'info');
      return;
    }

    let summaryText = `═══════════════════════════════════════════════════════════\n`;
    summaryText += `  🏆 BUG ARENA TOURNAMENT — VERIFICATION RESULTS REPORT\n`;
    summaryText += `  TRACK: ${targetLang.toUpperCase()} | Generated: ${new Date().toLocaleString()}\n`;
    summaryText += `═══════════════════════════════════════════════════════════\n\n`;

    targetReports.forEach((r, idx) => {
      const creatorData = teamEntries.find(t => t.team === r.originalTeam || t.key === r.key);
      const analysis = computeDeepBugAnalysis(r, creatorData, bugOverrides[r.id] || {});
      const verdict = adminRegistryData?.verifications?.[r.id];
      const langName = LANGUAGES.find(l => l.id === (r.language || creatorData?.language))?.name || (r.language || 'Code').toUpperCase();

      summaryText += `MATCH #${idx + 1} [${langName}] Key: ${r.key}\n`;
      summaryText += `  Finding Team:  ${r.reviewer} (Net Score: ${analysis.hunterScore} pts, Accuracy: ${analysis.precisionRate}%)\n`;
      summaryText += `  Creating Team: ${r.originalTeam} (Defense Score: ${analysis.creatorScore} pts)\n`;
      summaryText += `  Verified Bugs: ${analysis.verifiedCount} caught | ${analysis.falsePositiveCount} false claims | ${analysis.missedCreatorBugs.length} stealth bugs held\n`;
      summaryText += `  WINNER:        ${verdict?.winner || analysis.recommendedWinner} ${verdict ? '👑 [Decided]' : '🤖 [AI Recommended]'}\n`;
      summaryText += `  Verdict Note:  ${verdict?.reason || analysis.recommendationReason}\n`;
      summaryText += `───────────────────────────────────────────────────────────\n`;
    });

    navigator.clipboard.writeText(summaryText)
      .then(() => showToast('📋 Tournament Verification Summary copied to clipboard!'))
      .catch(() => showToast('Could not copy automatically — check console', 'error'));
  };

  // ─── Render Registration / Organizer Approval Form ──────────────────────
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
        if (data.programmingLanguage && LANGUAGES.some(lang => lang.id === data.programmingLanguage)) {
          setLanguage(data.programmingLanguage);
        }
        // Pre-fill team details for setup phase
        const memberNames = data.members.map(m => m.name).join(' & ');
        setTeamName(memberNames);
        if (data.isLocked) {
          setIsLocked(true);
          setIsSetup(true); // Ensures the full-screen locked proctoring modal takes control immediately
          setCheatWarnings(1);
          if (data.cheatReport?._id) setActiveCheatReportId(data.cheatReport._id);
          if (data.cheatReport?.reentryRequested) setReentryRequested(true);
          showToast('Account is locked due to a proctoring violation. Request re-entry to continue.', 'error');
        } else {
          showToast('Login successful! Welcome to the Arena.');
        }
      } else {
        showToast(data.error || 'Login failed.', 'error');
      }
    } catch (e) {
      showToast('Cannot connect to server. Try again.', 'error');
    }
    setIsLoggingIn(false);
  };

  const renderRegistrationForm = () => {
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
                  Need to register instead?
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
            {paymentStatus === 'verified' ? 'REGISTRATION APPROVED!' : paymentStatus === 'rejected' ? 'REGISTRATION REJECTED' : 'REGISTRATION SUBMITTED!'}
          </h2>
          <p style={{ color: '#a0a0c5', fontSize: '0.95rem', maxWidth: '440px', lineHeight: 1.7 }}>
            {paymentStatus === 'verified' 
              ? 'Your registration is approved! You may now enter the arena.'
              : paymentStatus === 'rejected'
              ? 'Your registration was rejected by the organizer. Please register again with corrected details.'
              : 'Your registration is under review. The organizer will approve your slot. Keep your Registration ID safe!'}
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
            <strong style={{ color: paymentStatus === 'verified' ? '#4ade80' : paymentStatus === 'rejected' ? '#ff5f56' : '#fbbf24' }}>⚠️ Note:</strong> Your slot is confirmed only after organizer approval. Status: <span style={{ color: paymentStatus === 'verified' ? '#4ade80' : paymentStatus === 'rejected' ? '#ff5f56' : '#fbbf24', fontWeight: 'bold' }}>{paymentStatus === 'verified' ? 'APPROVED' : paymentStatus === 'rejected' ? 'REJECTED' : 'PENDING APPROVAL'}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="ba-fade-in">
        <div className="ba-section-header" style={{ position: 'relative' }}>
          <div className="ba-section-line" />
          <h2 className="ba-section-title">📝 Event Registration</h2>
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
          Register your details for free. Your organizer-approved Registration ID will be used to enter the arena on event day.
        </p>

        <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}>
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
              {/* Member 1 */}
              <div className="ba-member-block">
                <div className="ba-member-label">
                  <span className="ba-member-icon">👤</span>
                  Your Details
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
                  <label className="ba-field-label"><span>📧</span> Email Address</label>
                  <input
                    type="email"
                    className="ba-field-input"
                    value={regMembers[0].email}
                    onChange={e => updateRegMember(0, 'email', e.target.value)}
                    placeholder="email@example.com"
                    maxLength={100}
                    required
                  />
                </div>
                <div className="ba-field-group" style={{ marginTop: '0.6rem' }}>
                  <label className="ba-field-label"><span>📱</span> Phone Number</label>
                  <input
                    type="tel"
                    className="ba-field-input"
                    value={regMembers[0].phone}
                    onChange={e => updateRegMember(0, 'phone', e.target.value)}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    maxLength={13}
                    required
                  />
                </div>
              </div>

              {/* Error message */}
              {regError && (
                <div className="ba-reg-error ba-fade-in">
                  <span>⚠️</span> {regError}
                </div>
              )}

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
                🔒 Registration is free. Email addresses and phone numbers are used only to prevent duplicate entries and manage attendance.
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // ── Render phase content ──
  const renderCreatePhase = () => {
    if (globalEventPhase === 'pre_event') {
      return (
        <div className="ba-fade-in ba-waitroom">
          {/* Decorative ring */}
          <div className="ba-waitroom-ring ba-waitroom-ring--cyan">
            <div className="ba-waitroom-ring-inner">
              <span className="ba-waitroom-icon">⏳</span>
            </div>
          </div>
          {/* Step badge */}
          <div className="ba-waitroom-step">
            <span className="ba-waitroom-step-dot ba-waitroom-step-dot--cyan" />
            Phase 1 of 5
          </div>
          <h2 className="ba-waitroom-title" style={{ color: '#00ffff' }}>Waiting Room</h2>
          <p className="ba-waitroom-desc">
            The event has not started yet.<br />
            Please wait for the admin to initiate the <strong>Coding Phase</strong>.
          </p>
          <div className="ba-waitroom-status ba-waitroom-status--cyan">
            <span className="ba-waitroom-pulse-dot ba-waitroom-pulse-dot--cyan" />
            Admin has not started the event yet — standby
          </div>
          <div className="ba-waitroom-hint">
            💡 Tip: Make sure your team name is correct before the phase begins.
          </div>
        </div>
      );
    }
    
    if (globalEventPhase !== 'coding') {
      return (
        <div className="ba-fade-in ba-waitroom">
          <div className="ba-waitroom-ring ba-waitroom-ring--red">
            <div className="ba-waitroom-ring-inner">
              <span className="ba-waitroom-icon">🔒</span>
            </div>
          </div>
          <div className="ba-waitroom-step">
            <span className="ba-waitroom-step-dot ba-waitroom-step-dot--red" />
            Coding Phase Ended
          </div>
          <h2 className="ba-waitroom-title" style={{ color: '#ff5f56' }}>Coding Phase Closed</h2>
          <p className="ba-waitroom-desc">
            The coding window has closed.<br />
            Your latest saved work has been <strong>automatically submitted</strong>. No further editing is allowed; head to the <strong>Exchange Portal</strong>.
          </p>
          <div className="ba-waitroom-status ba-waitroom-status--red">
            <span className="ba-waitroom-pulse-dot ba-waitroom-pulse-dot--red" />
            Code submission locked
          </div>
          <button className="ba-neon-btn ba-btn-cyan" onClick={() => setPhase('exchange')} style={{ marginTop: '1.5rem' }}>
            🔄 Go to Exchange Portal
          </button>
        </div>
      );
    }


    return (
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
                onClick={() => {
                  // Save the current key into the ref so handleSubmitCode can
                  // reuse it (upsert) when the user re-submits after editing.
                  pendingEditKeyRef.current = submittedKey;
                  setSubmittedKey(''); // show the editor again
                }}
              >
                ✏️ Edit &amp; Resubmit Code
              </button>
            </div>
          </div>
        </div>
      ) : (!isFullscreen) ? (
        /* Fullscreen Hard Lock: The entire writing & submission workspace is locked */
        <div className="ba-fade-in" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '380px',
          gap: '1.4rem',
          background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.08) 0%, rgba(10,12,24,0.7) 100%)',
          border: '2px dashed rgba(251,191,36,0.4)',
          borderRadius: '16px',
          padding: '3.5rem 2rem',
          margin: '1.5rem 0',
          textAlign: 'center',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(251,191,36,0.12)',
            border: '2px solid rgba(251,191,36,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.4rem',
            boxShadow: '0 0 25px rgba(251,191,36,0.25)',
          }}>
            🔒
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, color: '#fbbf24', fontSize: '1.35rem', letterSpacing: '0.5px' }}>
              FULLSCREEN REQUIRED TO WRITE CODE
            </div>
            <p style={{ color: '#a0a0c5', fontSize: '0.92rem', maxWidth: '480px', margin: '0.6rem auto 0', lineHeight: 1.6 }}>
              Writing, editing, and submitting buggy code is locked until you enter Fullscreen mode.
              You must remain in fullscreen until the host starts final judging.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
            <button
              className="ba-neon-btn ba-btn-yellow"
              style={{ fontSize: '1rem', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
              onClick={handleUnlockWorkspace}
            >
              <span style={{ fontSize: '1.2rem' }}>⛶</span>
              <span>Enter Fullscreen Mode to Unlock</span>
            </button>
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
              disabled={!code.trim() || createdBugs.filter(b => b.description.trim()).length === 0 || isSubmitting || !isFullscreen}
              title={!isFullscreen ? 'Fullscreen mode is required to submit your code' : ''}
            >
              <span className="ba-btn-icon">⚡</span>
              {isSubmitting ? 'Submitting & Encrypting...' : !isFullscreen ? '🔒 Fullscreen Required to Submit' : 'Submit Bug Code'}
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
  };

  const renderExchangePhase = () => {
    if (globalEventPhase === 'coding' || globalEventPhase === 'pre_event') {
      return (
        <div className="ba-fade-in ba-waitroom">
          <div className="ba-waitroom-ring ba-waitroom-ring--yellow">
            <div className="ba-waitroom-ring-inner">
              <span className="ba-waitroom-icon">⏸️</span>
            </div>
          </div>
          <div className="ba-waitroom-step">
            <span className="ba-waitroom-step-dot ba-waitroom-step-dot--yellow" />
            Phase 3 of 5
          </div>
          <h2 className="ba-waitroom-title" style={{ color: '#fbbf24' }}>Exchange Portal</h2>
          <p className="ba-waitroom-desc">
            Code exchange hasn’t opened yet.<br />
            Finish writing your buggy code in the <strong>Coding Phase</strong> first.
          </p>
          <div className="ba-waitroom-status ba-waitroom-status--yellow">
            <span className="ba-waitroom-pulse-dot ba-waitroom-pulse-dot--yellow" />
            Coding phase is still active
          </div>
          <button className="ba-neon-btn ba-btn-cyan" onClick={() => setPhase('create')} style={{ marginTop: '1.5rem' }}>
            ← Back to Coding
          </button>
        </div>
      );
    }

    if (globalEventPhase === 'exchange') {
      return (
        <div className="ba-fade-in ba-waitroom">
          <div className="ba-waitroom-ring ba-waitroom-ring--purple">
            <div className="ba-waitroom-ring-inner">
              <span className="ba-waitroom-icon">🤝</span>
            </div>
          </div>
          <div className="ba-waitroom-step">
            <span className="ba-waitroom-step-dot ba-waitroom-step-dot--purple" />
            Phase 3 of 5 — Exchanging
          </div>
          <h2 className="ba-waitroom-title" style={{ color: '#9d4edd' }}>Code Exchange Portal</h2>
          <p className="ba-waitroom-desc">
            The admin is collecting and distributing keys.<br />
            Please wait until the <strong>Bug Hunting Phase</strong> officially begins.
          </p>
          <div className="ba-waitroom-status ba-waitroom-status--purple">
            <span className="ba-waitroom-pulse-dot ba-waitroom-pulse-dot--purple" />
            Admin is distributing codes — standby
          </div>
          <div className="ba-waitroom-hint">
            💡 You’ll receive a 6-letter key from your team or event host.
          </div>
        </div>
      );
    }

    return (
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
  };

  const renderHuntPhase = () => {
    if (globalEventPhase !== 'hunting') {
      return (
        <div className="ba-fade-in ba-waitroom">
          <div className="ba-waitroom-ring ba-waitroom-ring--green">
            <div className="ba-waitroom-ring-inner">
              <span className="ba-waitroom-icon">🏁</span>
            </div>
          </div>
          <div className="ba-waitroom-step">
            <span className="ba-waitroom-step-dot ba-waitroom-step-dot--green" />
            Phase 5 of 5 — Event Ended
          </div>
          <h2 className="ba-waitroom-title" style={{ color: '#4ade80' }}>{globalEventPhase === 'post_event' ? 'Hunting Phase Ended' : 'Bug Hunting Is Not Open'}</h2>
          <p className="ba-waitroom-desc">
            {globalEventPhase === 'post_event'
              ? 'The event has concluded. Your latest saved bug report has been automatically submitted and reporting is now locked. Await the final results from the organizers.'
              : 'Wait for the administrator to open the Bug Hunting phase. Reports cannot be edited or submitted yet.'}
          </p>
          <div className="ba-waitroom-status ba-waitroom-status--green">
            <span className="ba-waitroom-pulse-dot ba-waitroom-pulse-dot--green" />
            {globalEventPhase === 'post_event' ? 'All submissions locked — judging in progress' : 'Hunting submission locked'}
          </div>
          <div className="ba-waitroom-hint">
            🏆 Stay tuned for the final leaderboard!
          </div>
        </div>
      );
    }

    return (
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
                  disabled={foundBugs.filter(b => b.description.trim()).length === 0}
                  title={reportSubmitted ? 'Save your revision. It replaces the earlier report and moves to the latest queue position.' : ''}
                >
                  <span className="ba-btn-icon">📋</span>
                  {reportSubmitted ? 'Update Report & Copy' : 'Generate & Copy Report'}
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
                {/* Normal report view — always visible */}
                {reportGenerated && (
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
                    {reportSubmitted && (
                      <div style={{ textAlign: 'center', marginTop: '0.6rem', color: '#00ffff', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em' }}>
                        ✓ SAVED — you may edit and update this same report until the hunting phase ends. Updates receive a new submission time.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    );
  };

  // ── Phase order map for direction detection ──
  const PHASE_ORDER = { pre_event: 0, coding: 1, exchange: 2, hunting: 3, post_event: 4 };
  const PHASE_LABELS = {
    pre_event:  { step: 1, label: 'Waiting Room',          desc: 'Players are logged in but cannot write code yet.' },
    coding:     { step: 2, label: 'Coding Phase',          desc: 'Everyone can write and submit their buggy code.' },
    exchange:   { step: 3, label: 'Code Exchange',         desc: 'Coding locked. Admin distributes keys to teams.' },
    hunting:    { step: 4, label: 'Bug Hunting Phase',     desc: 'Teams decode rival code and submit bug reports.' },
    post_event: { step: 5, label: 'Event Ended (Judging)', desc: 'All submissions locked. Admin reviews results.' },
  };
  const PHASE_REVERT_WARNINGS = {
    pre_event:  'Players will be sent back to the Waiting Room. Their submitted codes and reports are SAFE.',
    coding:     'Players will be returned to the Coding Phase. Already-submitted codes are SAFE — they will see their key.',
    exchange:   'Players will return to the Exchange waiting room. Submitted codes and reports are SAFE.',
    hunting:    'Players will be returned to the Hunting Phase. Previously submitted reports are SAFE.',
    post_event: 'Event will be marked as ended again. All submissions are SAFE.',
  };

  const handleUpdateGlobalPhase = async (newPhase, forceOverride = false) => {
    const currentPhase = adminRegistryData?.globalState?.phase || 'pre_event';
    const isGoingBack = PHASE_ORDER[newPhase] < PHASE_ORDER[currentPhase];
    const isSamePhase = newPhase === currentPhase;

    if (isSamePhase) return; // no-op

    if (isGoingBack && !forceOverride) {
      showToast('❌ Reverting to previous phases is disabled to ensure data consistency.', 'error');
      return;
    }

    try {
      const response = await fetch(`${SERVER_BASE}/api/event-phase`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-session': adminAuthToken },
        body: JSON.stringify({ phase: newPhase }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          setAdminAuthToken('');
          setIsAdminLoggedIn(false);
          try { sessionStorage.removeItem('ba_admin_token'); } catch {}
          setAdminModalOpen(true);
          showToast('Your admin session expired. Please sign in again to change the phase.', 'error');
          return;
        }
        throw new Error(data.error || `Phase update failed (${response.status})`);
      }
      setAdminRegistryData(prev => ({ ...(prev || {}), globalState: data.globalState }));
      setGlobalEventPhase(newPhase); // update local admin view immediately
      const dir = isGoingBack ? '← Reversed' : '→ Advanced';
      showToast(`${dir} — Phase: ${PHASE_LABELS[newPhase].label}`);
    } catch (e) {
      showToast(e.message || 'Could not update the event phase. Check the backend connection.', 'error');
    }
  };

  const renderAdminDashboard = () => {
    const rawData = adminRegistryData || {};
    // Extract registered teams (keys that are 6-chars)
    const latestTeamEntries = Object.entries(rawData)
      .filter(([k, v]) => k !== 'reports' && k !== 'globalState' && k !== 'verifications' && v && typeof v === 'object' && v.code)
      .map(([k, v]) => ({ key: k, ...v }));
    // Defensive display de-duplication for records saved by older app versions.
    // The server already replaces a participant's earlier record; this keeps
    // the review view clean if legacy duplicate keys exist in MongoDB.
    const byParticipant = new Map();
    latestTeamEntries.forEach(entry => {
      const identity = entry.registrationId || String(entry.team || entry.key).trim().toLowerCase();
      const previous = byParticipant.get(identity);
      if (!previous || Number(entry.updatedAt || entry.timestamp || 0) >= Number(previous.updatedAt || previous.timestamp || 0)) {
        byParticipant.set(identity, entry);
      }
    });
    const teamEntries = [...byParticipant.values()];

    // Only retain the newest version of each team's report for each exchanged
    // code. Legacy duplicate entries are also collapsed here defensively.
    const latestReportsBySlot = new Map();
    const storedReports = [
      ...(Array.isArray(rawData.reports) ? rawData.reports : []),
      ...Object.values(rawData.reportSlots || {}),
    ];
    storedReports.filter(Boolean).forEach(report => {
      const reportSlot = report.reportSlot || `${report.reviewerRegistrationId || String(report.reviewer || '').trim().toLowerCase()}::${report.key || 'N/A'}::${String(report.language || '').toLowerCase()}`;
      const previous = latestReportsBySlot.get(reportSlot);
      if (!previous || Number(report.updatedAt || report.timestamp || 0) >= Number(previous.updatedAt || previous.timestamp || 0)) {
        latestReportsBySlot.set(reportSlot, { ...report, reportSlot });
      }
    });
    const languageQueueCounts = new Map();
    const reportsList = [...latestReportsBySlot.values()]
      .sort((a, b) => Number(a.updatedAt || a.timestamp || 0) - Number(b.updatedAt || b.timestamp || 0))
      .map(report => {
        const language = String(report.language || '').toLowerCase();
        const queuePosition = (languageQueueCounts.get(language) || 0) + 1;
        languageQueueCounts.set(language, queuePosition);
        return { ...report, queuePosition };
      });

    const statusColor = (s) => s === 'verified' ? '#4ade80' : s === 'rejected' ? '#ff5f56' : '#fbbf24';
    const statusBg = (s) => s === 'verified' ? 'rgba(74,222,128,0.1)' : s === 'rejected' ? 'rgba(255,95,86,0.1)' : 'rgba(251,191,36,0.1)';

    return (
      <div className="ba-fade-in" style={{ width: '100%', maxWidth: '1400px' }}>
        {/* Phase Control Block */}
        {(() => {
          const currentPhase = rawData?.globalState?.phase || 'pre_event';
          const history = rawData?.globalState?.history || [];
          const phases = ['pre_event', 'coding', 'exchange', 'hunting', 'post_event'];
          return (
            <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '14px', padding: '1.4rem 1.6rem', marginBottom: '2rem', border: '1px solid rgba(0,255,255,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#00ffff', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>⏱️ Global Event Control</h3>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#7a7a9e' }}>
                    Current: <strong style={{ color: '#fbbf24' }}>{PHASE_LABELS[currentPhase]?.label}</strong>
                    {' — '}{PHASE_LABELS[currentPhase]?.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  {history.length > 0 && (
                    <details style={{ fontSize: '0.72rem', color: '#6b6b8a', cursor: 'pointer' }}>
                      <summary style={{ color: '#7a7a9e' }}>Phase History ({history.length})</summary>
                      <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {history.slice().reverse().map((h, i) => (
                          <span key={i}>{new Date(h.at).toLocaleTimeString()} — {PHASE_LABELS[h.from]?.label} → {PHASE_LABELS[h.to]?.label}</span>
                        ))}
                      </div>
                    </details>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={async () => {
                        if(window.prompt('Type WIPE to delete all submitted codes & bug reports from the database. (Registrations & Cheat history remain)') === 'WIPE') {
                          try {
                            const newReg = { globalState: { phase: 'pre_event', history: [], lastChanged: Date.now() }, reports: [] };
                            const wipeResponse = await fetch(REGISTRY_URL, { method: 'PUT', headers: {'Content-Type': 'application/json', 'x-admin-session': adminAuthToken}, body: JSON.stringify(newReg) });
                            if (!wipeResponse.ok) {
                              const failure = await wipeResponse.json().catch(() => ({}));
                              throw new Error(failure.error || 'Wipe request was rejected');
                            }
                            setGlobalEventPhase('pre_event');
                            fetchAdminRegistryData();
                            showToast('All codes wiped and event reset!', 'success');
                          } catch (e) {
                            showToast(e.message || 'Wipe failed', 'error');
                          }
                        }
                      }}
                      style={{ fontSize: '0.65rem', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.5)', color: '#fbbf24', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🧹 Wipe Test Codes
                    </button>
                    {currentPhase !== 'pre_event' && (
                      <button 
                        onClick={() => {
                          if(window.prompt('Type RESET to force the event back to Waiting Room. This is for dev testing only.') === 'RESET') {
                            handleUpdateGlobalPhase('pre_event', true);
                          }
                        }}
                        style={{ fontSize: '0.65rem', background: 'rgba(255, 95, 86, 0.1)', border: '1px solid rgba(255, 95, 86, 0.5)', color: '#ff5f56', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                        title="Force reset phase for testing purposes"
                      >
                        ⚠️ Dev Reset to Waiting Room
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Phase Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                {phases.map((p, idx) => {
                  const isActive = currentPhase === p;
                  const isPast = PHASE_ORDER[p] < PHASE_ORDER[currentPhase];
                  const isFuture = PHASE_ORDER[p] > PHASE_ORDER[currentPhase];
                  return (
                    <>
                      <button
                        key={p}
                        onClick={() => handleUpdateGlobalPhase(p)}
                        title={isPast ? `↩ Revert to: ${PHASE_LABELS[p].label}` : PHASE_LABELS[p].desc}
                        style={{
                          padding: '0.55rem 0.9rem',
                          borderRadius: '8px',
                          border: isActive
                            ? '2px solid #00ffff'
                            : isPast
                            ? '1px dashed rgba(251,191,36,0.5)'
                            : '1px solid rgba(255,255,255,0.1)',
                          background: isActive
                            ? 'rgba(0,255,255,0.15)'
                            : isPast
                            ? 'rgba(251,191,36,0.06)'
                            : 'rgba(255,255,255,0.04)',
                          color: isActive ? '#00ffff' : isPast ? '#fbbf24' : '#6b6b8a',
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 800 : 500,
                          fontFamily: 'Space Grotesk, sans-serif',
                          cursor: isActive ? 'default' : 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
                          minWidth: '80px',
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>
                          {isActive ? '🟢' : isPast ? '↩' : '○'}
                        </span>
                        <span>{PHASE_LABELS[p].step}. {PHASE_LABELS[p].label.split(' ')[0]}</span>
                        {isActive && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>ACTIVE</span>}
                        {isPast && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>Revert</span>}
                      </button>
                      {idx < phases.length - 1 && (
                        <span style={{ color: PHASE_ORDER[phases[idx+1]] <= PHASE_ORDER[currentPhase] ? '#fbbf24' : '#3a3a5a', fontSize: '1rem' }}>→</span>
                      )}
                    </>
                  );
                })}
              </div>
              <p style={{ margin: '0.8rem 0 0', fontSize: '0.72rem', color: '#6b6b8a' }}>
                ℹ️ Phases must be advanced sequentially. Reverting is disabled.
              </p>
            </div>
          );
        })()}

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
              onClick={handleAdminLogout}
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
            <span>🧾 Registrations & Approvals ({adminRegistrations.length})</span>
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

        {/* TAB 0: Registrations & Organizer Approval */}
        {adminActiveTab === 'registrations' && (
          <div className="ba-admin-dashboard ba-fade-in">
            <div className="ba-admin-header">
              <div className="ba-admin-header-title">🧾 Registration Approvals ({adminRegistrations.length})</div>
              <button className="ba-neon-btn ba-btn-sm" onClick={handleExportRegistrations} disabled={adminRegistrations.length === 0} style={{ background: 'rgba(0,255,255,0.08)', borderColor: 'rgba(0,255,255,0.35)', color: '#00ffff' }}>⬇ Export CSV</button>
            </div>

            {/* Stats Bar */}
            {adminRegStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', padding: '1.5rem 1.5rem 0' }}>
                {[
                  { label: 'Total', value: adminRegStats.total, color: '#00ffff', icon: '📋' },
                  { label: 'Pending approval', value: adminRegStats.pending, color: '#fbbf24', icon: '⏳' },
                  { label: 'Approved', value: adminRegStats.verified, color: '#4ade80', icon: '✅' },
                  { label: 'Rejected', value: adminRegStats.rejected, color: '#ff5f56', icon: '❌' },
                  { label: 'Participants', value: adminRegStats.totalParticipants, color: '#9d4edd', icon: '👥' },
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
                <p>No registrations yet. Student details will appear here when they register for approval.</p>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {adminRegistrations.map((reg) => (
                  <div key={reg.registrationId} style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${statusColor(reg.paymentStatus)}33`, borderRadius: '16px', overflow: 'hidden' }}>
                    {/* Registration Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: `${statusBg(reg.paymentStatus)}`, flexWrap: 'wrap', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
                          👤 {(reg.members || []).map(m => m?.name || m || 'Participant').join(' & ')}
                        </span>
                        <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', borderRadius: '20px', background: statusBg(reg.paymentStatus), border: `1px solid ${statusColor(reg.paymentStatus)}44`, color: statusColor(reg.paymentStatus), fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
                          {reg.paymentStatus === 'verified' ? 'approved' : reg.paymentStatus === 'rejected' ? 'rejected' : 'pending approval'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#9d4edd', fontWeight: 700, background: 'rgba(157,78,221,0.1)', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>
                          Individual registration
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
                      <div className="ba-fade-in" style={{ padding: '1.5rem' }}>
                        {/* Member Details */}
                        <div>
                          <h4 style={{ color: '#00ffff', margin: '0 0 1rem', fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.88rem' }}>
                            👤 Registered Members
                          </h4>
                          {(reg.members || []).map((m, i) => (
                            <div key={i} style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.1)', borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '0.7rem' }}>
                              <div style={{ fontWeight: 800, color: '#e4e4f0', fontFamily: 'Space Grotesk, sans-serif', marginBottom: '0.3rem' }}>
                                Member {i + 1}: {typeof m === 'string' ? m : (m?.name || 'Member')}
                              </div>
                              {m?.email && (
                                <div style={{ fontSize: '0.8rem', color: '#7a7a9e', marginTop: '0.3rem' }}>📧 {m.email}</div>
                              )}
                              {m?.phone && (
                                <div style={{ fontSize: '0.8rem', color: '#7a7a9e', marginTop: '0.3rem' }}>📱 {m.phone}</div>
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
                                placeholder="Add an approval or attendance note..."
                                style={{ minHeight: '60px', marginBottom: '0.8rem' }}
                              />
                              <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                                <button
                                  className="ba-neon-btn ba-btn-sm"
                                  onClick={() => handleVerifyRegistration(reg.registrationId, 'verified')}
                                  disabled={isVerifying === reg.registrationId}
                                  style={{ background: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.5)', color: '#4ade80' }}
                                >
                                  {isVerifying === reg.registrationId ? '⏳' : '✅'} Approve Registration
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
                              {reg.paymentStatus === 'verified' ? '✅ Approved' : '❌ Rejected'} at: {new Date(reg.verifiedAt).toLocaleString('en-IN')}
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

        {/* TAB 3: Side-by-Side Verification & Winner Decision */}
        {adminActiveTab === 'compare' && (
          <div className="ba-admin-dashboard ba-fade-in">
            {/* Top Verification Control Bar */}
            <div className="ba-admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div className="ba-admin-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>⚖️ Side-by-Side Verification &amp; Winner Decision</span>
                  <span style={{ fontSize: '0.85rem', background: 'rgba(0, 255, 255, 0.15)', border: '1px solid rgba(0, 255, 255, 0.4)', color: '#00ffff', borderRadius: '12px', padding: '0.15rem 0.6rem', fontWeight: 800 }}>
                    {reportsList.length} Total Matches
                  </span>
                </div>
                <div style={{ color: '#8888aa', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                  Intelligent multi-probability semantic evaluator &amp; anti-spam adjudication engine
                </div>
              </div>

              {/* Workload Reduction Tools */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ba-neon-btn ba-btn-sm"
                  onClick={() => handleBatchAutoVerify(compareLangFilter)}
                  style={{ background: 'rgba(74, 222, 128, 0.15)', borderColor: 'rgba(74, 222, 128, 0.6)', color: '#4ade80', fontWeight: 800 }}
                  title="Counts high-confidence alignments to guide manual review. It never changes points, claims, or winners."
                >
                  🔎 Review Suggestions
                </button>

                <button
                  type="button"
                  className="ba-neon-btn ba-btn-sm"
                  onClick={() => handleCopyWinnerSummary(compareLangFilter)}
                  style={{ background: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.5)', color: '#fbbf24', fontWeight: 800 }}
                  title="Copy a full summary report of all verified winners to clipboard"
                >
                  📋 Export Results
                </button>

                <button
                  type="button"
                  className="ba-neon-btn ba-btn-sm"
                  onClick={() => setShowTrackLeaderboard(prev => !prev)}
                  style={{ background: showTrackLeaderboard ? 'rgba(157, 78, 221, 0.3)' : 'rgba(157, 78, 221, 0.12)', borderColor: 'rgba(157, 78, 221, 0.6)', color: '#e0aaff', fontWeight: 800 }}
                >
                  🏆 {showTrackLeaderboard ? 'Hide Standings' : 'Track Standings'}
                </button>

                <button
                  type="button"
                  className="ba-neon-btn ba-btn-sm"
                  onClick={fetchAdminRegistryData}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.2)', color: '#aaa' }}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Language Isolation Board — each column is an independent review lane */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                borderRadius: '14px',
                padding: '0.9rem 1.2rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.82rem', color: '#00ffff', fontWeight: 900, fontFamily: 'Space Grotesk, sans-serif' }}>
                    🌐 Language isolation board
                  </span>
                  <span style={{ color: '#9fa0bd', fontSize: '0.73rem' }}>
                    Only Python ↔ Python, Java ↔ Java, C ↔ C, and C++ ↔ C++ reports are reviewable.
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.6rem' }}>
                {['all', ...EVENT_LANGUAGES.map(lang => lang.id)].map((langKey) => {
                  const eligibleReports = reportsList.filter(r => {
                    const creator = teamEntries.find(t => t.team === r.originalTeam || t.key === r.key);
                    const reportLanguage = (r.language || '').toLowerCase();
                    return EVENT_LANGUAGE_IDS.includes(reportLanguage) && reportLanguage === (creator?.language || '').toLowerCase();
                  });
                  const count = langKey === 'all' ? eligibleReports.length : eligibleReports.filter(r => (r.language || '').toLowerCase() === langKey).length;
                  const decidedCount = langKey === 'all'
                    ? eligibleReports.filter(r => !!adminRegistryData?.verifications?.[r.id]).length
                    : eligibleReports.filter(r => (r.language || '').toLowerCase() === langKey && !!adminRegistryData?.verifications?.[r.id]).length;
                  const langObj = LANGUAGES.find(l => l.id === langKey);
                  const label = langKey === 'all' ? 'All Tracks' : (langObj ? langObj.name : langKey.toUpperCase());
                  const isSelected = compareLangFilter === langKey;

                  return (
                    <button
                      key={langKey}
                      type="button"
                      onClick={() => setCompareLangFilter(langKey)}
                      style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #00ffff' : '1px solid rgba(255, 255, 255, 0.12)',
                        background: isSelected ? 'rgba(0, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                        color: isSelected ? '#00ffff' : '#8888aa',
                        fontWeight: isSelected ? 900 : 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.45rem',
                      }}
                    >
                      <span>{label}</span>
                      <span style={{
                        background: isSelected ? '#00ffff' : 'rgba(255, 255, 255, 0.1)',
                        color: isSelected ? '#000' : '#aaa',
                        borderRadius: '10px',
                        padding: '0.1rem 0.45rem',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                      }}>
                        {count} {decidedCount > 0 ? `(${decidedCount}✓)` : ''}
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>

              {/* Secondary Toolbar: Status Filters & Search */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '0.7rem 1rem',
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#7a7a9e', fontWeight: 800 }}>Status:</span>
                  {[
                    { id: 'all', label: 'All Matches' },
                    { id: 'pending', label: '⏳ Pending Review' },
                    { id: 'decided', label: '✅ Decided' },
                    { id: 'spam', label: '🚨 Spam Flagged' },
                  ].map(tab => {
                    const isTab = compareStatusFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCompareStatusFilter(tab.id)}
                        style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: '8px',
                          border: isTab ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isTab ? 'rgba(251, 191, 36, 0.2)' : 'transparent',
                          color: isTab ? '#fbbf24' : '#8888aa',
                          fontSize: '0.76rem',
                          fontWeight: isTab ? 800 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={compareSearchQuery}
                    onChange={(e) => setCompareSearchQuery(e.target.value)}
                    placeholder="Search by team or key..."
                    style={{
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(0, 255, 255, 0.25)',
                      borderRadius: '8px',
                      padding: '0.35rem 0.8rem',
                      color: '#e4e4f0',
                      fontSize: '0.78rem',
                      outline: 'none',
                      minWidth: '200px',
                    }}
                  />
                  {compareSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCompareSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Tournament Standings / Track Leaderboard View */}
              {showTrackLeaderboard && (() => {
                const targetReports = reportsList.filter(r => {
                  if (compareLangFilter === 'all') return true;
                  const lang = (r.language || '').toLowerCase() || 'python';
                  return lang === compareLangFilter.toLowerCase();
                });

                // Calculate cumulative verified performance
                const teamStats = {};
                targetReports.forEach(r => {
                  const creatorData = teamEntries.find(t => t.team === r.originalTeam || t.key === r.key);
                  const analysis = computeDeepBugAnalysis(r, creatorData, bugOverrides[r.id] || {});
                  const verdict = adminRegistryData?.verifications?.[r.id];

                  // Hunter stats
                  if (!teamStats[r.reviewer]) {
                    teamStats[r.reviewer] = { team: r.reviewer, points: 0, wins: 0, matches: 0, verifiedBugs: 0, precision: [] };
                  }
                  teamStats[r.reviewer].matches += verdict ? 1 : 0;
                  teamStats[r.reviewer].points += verdict?.hunterScore || 0;
                  teamStats[r.reviewer].verifiedBugs += verdict?.verifiedCount || 0;
                  if (verdict) teamStats[r.reviewer].precision.push(analysis.precisionRate);
                  if (verdict?.winner === r.reviewer) {
                    teamStats[r.reviewer].wins += 1;
                  }

                  // Creator stats
                  if (!teamStats[r.originalTeam]) {
                    teamStats[r.originalTeam] = { team: r.originalTeam, points: 0, wins: 0, matches: 0, verifiedBugs: 0, precision: [] };
                  }
                  teamStats[r.originalTeam].matches += verdict ? 1 : 0;
                  teamStats[r.originalTeam].points += verdict?.creatorScore || 0;
                  if (verdict?.winner === r.originalTeam) {
                    teamStats[r.originalTeam].wins += 1;
                  }
                });

                const sortedTeams = Object.values(teamStats).sort((a, b) => b.points - a.points || b.wins - a.wins);

                return (
                  <div style={{
                    background: 'rgba(15, 18, 38, 0.95)',
                    border: '2px solid rgba(157, 78, 221, 0.4)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <h3 style={{ margin: 0, color: '#e0aaff', fontSize: '1.15rem', fontFamily: 'Space Grotesk, sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🏆</span>
                        <span>{compareLangFilter === 'all' ? 'All Tracks' : compareLangFilter.toUpperCase()} Tournament Standings</span>
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: '#a0a0c5' }}>
                        Ranked by Fair Verified Points &amp; Anti-Spam Accuracy
                      </span>
                    </div>

                    {sortedTeams.length === 0 ? (
                      <p style={{ color: '#8888aa', fontSize: '0.85rem', margin: 0 }}>No match records available yet for this track.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#8888aa', textAlign: 'left' }}>
                              <th style={{ padding: '0.6rem 0.8rem' }}>Rank</th>
                              <th style={{ padding: '0.6rem 0.8rem' }}>Team Name</th>
                              <th style={{ padding: '0.6rem 0.8rem' }}>Matches</th>
                              <th style={{ padding: '0.6rem 0.8rem' }}>Wins</th>
                              <th style={{ padding: '0.6rem 0.8rem' }}>Verified Bugs</th>
                              <th style={{ padding: '0.6rem 0.8rem' }}>Avg Accuracy</th>
                              <th style={{ padding: '0.6rem 0.8rem' }}>Total Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedTeams.map((t, idx) => {
                              const avgPrec = t.precision.length > 0 ? Math.round(t.precision.reduce((a, b) => a + b, 0) / t.precision.length) : 0;
                              return (
                                <tr key={t.team} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: idx === 0 ? 'rgba(251, 191, 36, 0.06)' : 'transparent' }}>
                                  <td style={{ padding: '0.7rem 0.8rem', fontWeight: 900 }}>
                                    {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                                  </td>
                                  <td style={{ padding: '0.7rem 0.8rem', color: '#00ffff', fontWeight: 800 }}>{t.team}</td>
                                  <td style={{ padding: '0.7rem 0.8rem', color: '#aaa' }}>{t.matches}</td>
                                  <td style={{ padding: '0.7rem 0.8rem', color: '#4ade80', fontWeight: 800 }}>{t.wins}</td>
                                  <td style={{ padding: '0.7rem 0.8rem', color: '#fbbf24' }}>{t.verifiedBugs}</td>
                                  <td style={{ padding: '0.7rem 0.8rem', color: avgPrec >= 65 ? '#4ade80' : '#ff7777' }}>{avgPrec}%</td>
                                  <td style={{ padding: '0.7rem 0.8rem', color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>{t.points} pts</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Match Entries */}
              {(() => {
                const filteredReports = reportsList.filter(r => {
                  const creatorData = teamEntries.find(t => t.team === r.originalTeam || t.key === r.key);
                  const reportLanguage = (r.language || '').toLowerCase();
                  const creatorLanguage = (creatorData?.language || '').toLowerCase();

                  // Only the four announced tracks participate. A report that
                  // does not match the original submission's language is held
                  // out of scoring rather than mixing language columns.
                  if (!EVENT_LANGUAGE_IDS.includes(reportLanguage) ||
                    !EVENT_LANGUAGE_IDS.includes(creatorLanguage) ||
                    reportLanguage !== creatorLanguage) return false;

                  // 1. Language track filter
                  if (compareLangFilter !== 'all') {
                    if (reportLanguage !== compareLangFilter.toLowerCase()) return false;
                  }

                  // 2. Search query filter
                  if (compareSearchQuery.trim()) {
                    const q = compareSearchQuery.toLowerCase().trim();
                    const rev = (r.reviewer || '').toLowerCase();
                    const orig = (r.originalTeam || '').toLowerCase();
                    const key = (r.key || '').toLowerCase();
                    if (!rev.includes(q) && !orig.includes(q) && !key.includes(q)) return false;
                  }

                  // 3. Status filter
                  const savedVerdict = adminRegistryData?.verifications?.[r.id];
                  const analysis = computeDeepBugAnalysis(r, creatorData, bugOverrides[r.id] || {});

                  if (compareStatusFilter === 'pending' && !!savedVerdict) return false;
                  if (compareStatusFilter === 'decided' && !savedVerdict) return false;
                  if (compareStatusFilter === 'spam' && !analysis.isHighSpam) return false;

                  return true;
                });

                if (filteredReports.length === 0) {
                  return (
                    <div style={{ padding: '3.5rem', textAlign: 'center', color: '#7a7a9e', background: 'rgba(0,0,0,0.3)', borderRadius: '16px' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🔍</div>
                      <p style={{ margin: 0, fontSize: '1rem', color: '#e4e4f0' }}>
                        No comparison reports found matching your current filter criteria.
                      </p>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#7777aa' }}>
                        Track: <strong>{compareLangFilter.toUpperCase()}</strong> | Status: <strong>{compareStatusFilter.toUpperCase()}</strong>
                      </p>
                    </div>
                  );
                }

                return filteredReports.map((r, idx) => {
                  const creatorData = teamEntries.find(t => t.team === r.originalTeam || t.key === r.key);
                  const analysis = computeDeepBugAnalysis(r, creatorData, bugOverrides[r.id] || {});
                  const savedVerdict = adminRegistryData?.verifications?.[r.id];
                  const langName = LANGUAGES.find(l => l.id === (r.language || creatorData?.language))?.name || (r.language || 'Code').toUpperCase();
                  const isDossierOpen = !!expandedAiDossier[r.id];
                  const isCodeOpen = !!activeCodeInspector[r.id];
                  const currentHighlightedLine = highlightedCodeLine[r.id] || null;
                  const isReviewed = !!reviewedVerifications[r.id] || !!savedVerdict;

                  // Validate language isolation
                  const hunterLang = (r.language || '').toLowerCase();
                  const creatorLang = (creatorData?.language || '').toLowerCase();
                  const isLanguageMatched = (!hunterLang || !creatorLang) || (hunterLang === creatorLang);

                  return (
                    <div
                      key={r.id || idx}
                      style={{
                        background: 'rgba(10, 12, 26, 0.88)',
                        border: savedVerdict ? '2px solid rgba(74, 222, 128, 0.5)' : analysis.isHighSpam ? '2px solid rgba(255, 95, 86, 0.5)' : '2px solid rgba(251, 191, 36, 0.35)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                      }}
                    >
                      {/* Match Header Bar */}
                      <div style={{
                        padding: '1.2rem 1.6rem',
                        background: savedVerdict
                          ? 'linear-gradient(90deg, rgba(74,222,128,0.12) 0%, rgba(10,12,26,0.85) 100%)'
                          : analysis.isHighSpam
                          ? 'linear-gradient(90deg, rgba(255,95,86,0.15) 0%, rgba(10,12,26,0.85) 100%)'
                          : 'linear-gradient(90deg, rgba(251,191,36,0.1) 0%, rgba(10,12,26,0.85) 100%)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'Space Grotesk, sans-serif' }}>
                              MATCH #{idx + 1}
                            </span>

                            <span style={{ background: 'rgba(157,78,221,0.17)', border: '1px solid rgba(199,125,255,0.55)', color: '#e0c2ff', borderRadius: '4px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 800 }}>
                              ⏱ Queue #{r.queuePosition} in {langName}{r.isUpdated ? ' · Updated' : ''}
                            </span>

                            {/* Intra-Language Integrity Badge */}
                            <span style={{
                              background: isLanguageMatched ? 'rgba(0, 255, 255, 0.15)' : 'rgba(255, 95, 86, 0.2)',
                              border: isLanguageMatched ? '1px solid rgba(0, 255, 255, 0.4)' : '1px solid rgba(255, 95, 86, 0.5)',
                              color: isLanguageMatched ? '#00ffff' : '#ff7777',
                              borderRadius: '4px',
                              padding: '0.15rem 0.55rem',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                            }}>
                              {isLanguageMatched ? `💻 ${langName} ⟷ ${langName} (Intra-Language Match)` : `⚠️ Cross-Language Anomaly (${hunterLang} vs ${creatorLang})`}
                            </span>

                            <span style={{ color: '#7a7a9e', fontSize: '0.72rem', fontFamily: 'Courier New, monospace' }}>
                              KEY: {r.key} · {new Date(r.updatedAt || r.timestamp || Date.now()).toLocaleTimeString()}
                            </span>

                            {analysis.isHighSpam && (
                              <span style={{ background: 'rgba(255, 95, 86, 0.2)', border: '1px solid #ff5f56', color: '#ff5f56', padding: '0.15rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 900 }}>
                                🚨 LOW ACCURACY / SPAM PENALIZED ({analysis.precisionRate}% Precision)
                              </span>
                            )}
                          </div>

                          <h3 style={{ margin: '0 0 0.4rem', color: '#fff', fontSize: '1.25rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                            Finding Team: <span style={{ color: '#4ade80', fontWeight: 800 }}>{r.reviewer}</span>
                            <span style={{ color: '#6b6b8a', margin: '0 0.5rem', fontSize: '0.9rem' }}>vs</span>
                            Creating Team: <span style={{ color: '#ff6b6b', fontWeight: 800 }}>{r.originalTeam}</span>
                          </h3>

                          {/* Quick Score Metrics */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              color: savedVerdict ? '#4ade80' : isReviewed ? '#fbbf24' : '#00ffff',
                              background: savedVerdict ? 'rgba(74,222,128,0.15)' : isReviewed ? 'rgba(251,191,36,0.15)' : 'rgba(0,255,255,0.1)',
                              border: `1px solid ${savedVerdict ? 'rgba(74,222,128,0.5)' : isReviewed ? 'rgba(251,191,36,0.5)' : 'rgba(0,255,255,0.4)'}`,
                              borderRadius: '20px',
                              padding: '0.2rem 0.8rem',
                            }}>
                              {savedVerdict ? `✅ DECIDED: ${savedVerdict.winner}` : isReviewed ? `🟡 READY TO DECLARE (${analysis.verifiedCount} confirmed)` : '🔎 EVIDENCE NOT YET REVIEWED'}
                            </span>

                            <span style={{ fontSize: '0.78rem', color: '#a0a0c5' }}>
                              Net Finder Score: <strong style={{ color: '#4ade80' }}>{analysis.hunterScore} pts</strong>
                              {' '}({analysis.verifiedCount} verified, {analysis.falsePositiveCount} false @ -40/ea)
                            </span>

                            <span style={{ fontSize: '0.78rem', color: '#a0a0c5' }}>
                              Creator Defense: <strong style={{ color: '#ff6b6b' }}>{analysis.creatorScore} pts</strong>
                              {' '}({analysis.missedCreatorBugs.length} stealth bugs defended)
                            </span>
                          </div>

                          {/* Deliberately compact decision snapshot: admins can
                              understand the match before opening any detail. */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.45rem', marginTop: '0.85rem', maxWidth: '760px' }}>
                            {[
                              ['Creator planted', (creatorData?.createdBugs || r.originalCreatedBugs || []).length, '#ff6b6b'],
                              ['Hunter reported', (r.foundBugs || []).filter(b => b.description?.trim()).length, '#4ade80'],
                              ['To confirm', analysis.pairs.length, '#00ffff'],
                              ['Needs attention', analysis.unmatchedHunterBugs.length + analysis.missedCreatorBugs.length, '#fbbf24'],
                            ].map(([label, value, color]) => (
                              <div key={label} style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${color}33`, borderRadius: '7px', padding: '0.35rem 0.55rem' }}>
                                <div style={{ color: '#8888aa', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                                <div style={{ color, fontWeight: 900, fontSize: '1rem', marginTop: '0.05rem' }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Winner Decision Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
                          {savedVerdict && (
                            <div style={{
                              background: 'rgba(74, 222, 128, 0.15)',
                              border: '1px solid rgba(74, 222, 128, 0.5)',
                              borderRadius: '8px',
                              padding: '0.35rem 0.8rem',
                              color: '#4ade80',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                            }}>
                              <span>👑</span>
                              <span>DECIDED WINNER: {savedVerdict.winner}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="ba-neon-btn ba-btn-sm"
                              onClick={() => handleSaveAdminDecision(r.id, r.reviewer, {
                                hunterScore: analysis.hunterScore,
                                creatorScore: analysis.creatorScore,
                                verifiedCount: analysis.verifiedCount,
                                reason: analysis.recommendationReason,
                              })}
                              disabled={!isReviewed}
                              title={isReviewed ? 'Save finding team as the winner' : 'Open and review the evidence before declaring a winner'}
                              style={{
                                background: savedVerdict?.winner === r.reviewer ? 'rgba(74, 222, 128, 0.3)' : 'rgba(74, 222, 128, 0.12)',
                                borderColor: 'rgba(74, 222, 128, 0.6)',
                                color: '#4ade80',
                                fontWeight: 800,
                                opacity: isReviewed ? 1 : 0.45,
                                cursor: isReviewed ? 'pointer' : 'not-allowed',
                              }}
                            >
                              🥇 Award: {r.reviewer} ({analysis.hunterScore} pts)
                            </button>

                            <button
                              type="button"
                              className="ba-neon-btn ba-btn-sm"
                              onClick={() => handleSaveAdminDecision(r.id, r.originalTeam, {
                                hunterScore: analysis.hunterScore,
                                creatorScore: analysis.creatorScore,
                                verifiedCount: analysis.verifiedCount,
                                reason: analysis.recommendationReason,
                              })}
                              disabled={!isReviewed}
                              title={isReviewed ? 'Save creating team as the winner' : 'Open and review the evidence before declaring a winner'}
                              style={{
                                background: savedVerdict?.winner === r.originalTeam ? 'rgba(255, 107, 107, 0.3)' : 'rgba(255, 107, 107, 0.12)',
                                borderColor: 'rgba(255, 107, 107, 0.6)',
                                color: '#ff6b6b',
                                fontWeight: 800,
                                opacity: isReviewed ? 1 : 0.45,
                                cursor: isReviewed ? 'pointer' : 'not-allowed',
                              }}
                            >
                              🥇 Award: {r.originalTeam} ({analysis.creatorScore} pts)
                            </button>

                            <button
                              type="button"
                              className="ba-neon-btn ba-btn-sm"
                              onClick={() => handleSaveAdminDecision(r.id, 'DRAW / TIE', {
                                hunterScore: analysis.hunterScore,
                                creatorScore: analysis.creatorScore,
                                verifiedCount: analysis.verifiedCount,
                                reason: 'Admin declared tie',
                              })}
                              disabled={!isReviewed}
                              title={isReviewed ? 'Save a draw decision' : 'Open and review the evidence before declaring a winner'}
                              style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24', opacity: isReviewed ? 1 : 0.45, cursor: isReviewed ? 'pointer' : 'not-allowed' }}
                            >
                              🤝 Draw
                            </button>
                          </div>
                        </div>
                      </div>

                      <details
                        onToggle={(event) => {
                          if (event.currentTarget.open) setReviewedVerifications(prev => ({ ...prev, [r.id]: true }));
                        }}
                        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <summary style={{ cursor: 'pointer', padding: '1rem 1.6rem', color: '#00ffff', fontWeight: 800, fontSize: '0.86rem', listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                          <span>1. Review bug evidence before declaring a winner</span>
                          <span style={{ color: '#a0a0c5', fontSize: '0.76rem', fontWeight: 600 }}>
                            {analysis.pairs.length} suggested • {analysis.unmatchedHunterBugs.length} unmatched • {analysis.missedCreatorBugs.length} missed
                          </span>
                        </summary>

                      {/* AI Judging Recommendation Banner */}
                      <div style={{
                        padding: '0.8rem 1.6rem',
                        background: 'rgba(0, 0, 0, 0.35)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.8rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                          <span style={{ fontSize: '1.1rem' }}>🤖</span>
                          <span style={{ fontSize: '0.82rem', color: '#e4e4f0' }}>
                            <strong>Review aid only — no points are awarded automatically:</strong>{' '}
                            <span style={{ color: analysis.recommendedWinner === r.reviewer ? '#4ade80' : analysis.recommendedWinner === r.originalTeam ? '#ff6b6b' : '#fbbf24', fontWeight: 800 }}>
                              {analysis.recommendedWinner}
                            </span>
                            {' — '}{analysis.recommendationReason}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          <button
                            type="button"
                            onClick={() => setActiveCodeInspector(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                            style={{
                              background: isCodeOpen ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                              border: '1px solid rgba(0, 255, 255, 0.4)',
                              borderRadius: '6px',
                              color: '#00ffff',
                              padding: '0.25rem 0.7rem',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <span>👁️ {isCodeOpen ? 'Hide Code Split-View' : 'Source Code Split-View'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedAiDossier(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(251, 191, 36, 0.3)',
                              borderRadius: '6px',
                              color: '#fbbf24',
                              padding: '0.25rem 0.7rem',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <span>{isDossierOpen ? '▲ Hide Analysis Dossier' : '▼ View AI Semantic Breakdown'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Interactive Code Spotlight Split View */}
                      {isCodeOpen && (
                        <div style={{
                          padding: '1.2rem 1.6rem',
                          background: 'rgba(0, 0, 0, 0.6)',
                          borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <div style={{ color: '#00ffff', fontSize: '0.82rem', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>
                              🔍 Code Spotlight — {r.originalTeam}'s Submitted {langName} Source:
                              {currentHighlightedLine && (
                                <span style={{ marginLeft: '0.6rem', background: '#00ffff', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 900 }}>
                                  Target Line: #{currentHighlightedLine}
                                </span>
                              )}
                            </div>
                            <span style={{ color: '#8888aa', fontSize: '0.74rem' }}>
                              Click "Focus Line" on any bug row below to illuminate the targeted code statement
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 0.8fr)', gap: '1rem', alignItems: 'start' }}>
                            <CodeEditor
                              code={creatorData?.code || r.originalCode}
                              language={(creatorData?.language || r.language || 'python')}
                              readOnly
                              highlightLine={currentHighlightedLine}
                            />
                            <div style={{ background: 'rgba(8, 12, 25, 0.9)', border: '1px solid rgba(0,255,255,0.22)', borderRadius: '10px', overflow: 'hidden' }}>
                              <div style={{ padding: '0.65rem 0.8rem', color: '#00ffff', fontWeight: 900, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(0,255,255,0.15)' }}>
                                Review checklist
                              </div>
                              <div style={{ padding: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '390px', overflowY: 'auto' }}>
                                <div>
                                  <div style={{ color: '#ff7777', fontSize: '0.7rem', fontWeight: 900, marginBottom: '0.35rem' }}>CREATOR PLANTED</div>
                                  {(creatorData?.createdBugs || r.originalCreatedBugs || []).map((bug, bugIndex) => (
                                    <button key={`creator-${bugIndex}`} type="button" onClick={() => setHighlightedCodeLine(prev => ({ ...prev, [r.id]: bug.lineNumber }))} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,95,86,0.06)', border: '1px solid rgba(255,95,86,0.18)', borderRadius: '6px', color: '#e4e4f0', padding: '0.45rem', marginBottom: '0.35rem', cursor: 'pointer', fontSize: '0.74rem' }}>
                                      <strong style={{ color: '#ff7777' }}>L{bug.lineNumber || '—'}</strong> · {bug.description || 'No description'}
                                    </button>
                                  ))}
                                </div>
                                <div>
                                  <div style={{ color: '#4ade80', fontSize: '0.7rem', fontWeight: 900, marginBottom: '0.35rem' }}>HUNTER REPORTED</div>
                                  {(r.foundBugs || []).filter(b => b.description?.trim()).map((bug, bugIndex) => (
                                    <button key={`hunter-${bugIndex}`} type="button" onClick={() => setHighlightedCodeLine(prev => ({ ...prev, [r.id]: bug.lineNumber }))} style={{ width: '100%', textAlign: 'left', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: '6px', color: '#e4e4f0', padding: '0.45rem', marginBottom: '0.35rem', cursor: 'pointer', fontSize: '0.74rem' }}>
                                      <strong style={{ color: '#4ade80' }}>L{bug.lineNumber || '—'}</strong> · {bug.description}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expanded AI Semantic Dossier */}
                      {isDossierOpen && (
                        <div style={{
                          padding: '1.2rem 1.6rem',
                          background: 'rgba(0, 255, 255, 0.03)',
                          borderBottom: '1px solid rgba(0, 255, 255, 0.15)',
                          fontSize: '0.8rem',
                          color: '#b0b0d0',
                          lineHeight: 1.6,
                        }}>
                          <h4 style={{ margin: '0 0 0.6rem', color: '#00ffff', fontSize: '0.88rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                            🧠 Deep Cross-Examination &amp; Multi-Probability Dossier:
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {analysis.pairs.map((p, pIdx) => (
                              <div key={pIdx} style={{ background: 'rgba(0,0,0,0.4)', padding: '0.6rem 0.9rem', borderRadius: '8px', borderLeft: '3px solid #00ffff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                  <strong style={{ color: '#00ffff' }}>Pair #{pIdx + 1} (Confidence: {p.confidence}%):</strong>
                                  {p.categoryName && (
                                    <span style={{ background: 'rgba(0,255,255,0.15)', color: '#00ffff', padding: '0.05rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                      {p.categoryIcon} {p.categoryName}
                                    </span>
                                  )}
                                  {p.matchedAnchor && (
                                    <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '0.05rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                      ⚓ Anchor: '{p.matchedAnchor}'
                                    </span>
                                  )}
                                </div>
                                <div style={{ color: '#e4e4f0' }}>{p.justification}</div>
                                <div style={{ color: '#7a7a9e', fontSize: '0.74rem', marginTop: '0.2rem' }}>
                                  [Proximity: {p.lineScore}% | Semantic Description Overlap: {p.semanticScore}%]
                                </div>
                              </div>
                            ))}

                            {analysis.unmatchedHunterBugs.map((u, uIdx) => (
                              <div key={`u-${uIdx}`} style={{ background: 'rgba(255,95,86,0.06)', padding: '0.6rem 0.9rem', borderRadius: '8px', borderLeft: '3px solid #ff5f56' }}>
                                <strong style={{ color: '#ff5f56' }}>Unmatched Hunter Claim #{uIdx + 1} (-40 pts):</strong>{' '}
                                Hunter reported Line #{u.hBug.lineNumber || 'N/A'} ("{u.hBug.description}"), but Creator planted no bug matching this location or concept. Assessed as an unverified/false claim to prevent spam wins.
                              </div>
                            ))}

                            {analysis.missedCreatorBugs.map((m, mIdx) => (
                              <div key={`m-${mIdx}`} style={{ background: 'rgba(157,78,221,0.08)', padding: '0.6rem 0.9rem', borderRadius: '8px', borderLeft: '3px solid #9d4edd' }}>
                                <strong style={{ color: '#c77dff' }}>Missed Planted Bug #{mIdx + 1} (+80 pts Defense):</strong>{' '}
                                Creator planted Line #{m.cBug.lineNumber || 'N/A'} ("{m.cBug.description}"). Finding team failed to detect this bug. Stealth defense awarded to creator.
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Side-by-Side Bug Verification Rows */}
                      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        {/* 1. Mapped Pairs */}
                        {analysis.pairs.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>✅</span>
                              <span>Suggested Bug Alignments — confirm or reject ({analysis.pairs.length})</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              {analysis.pairs.map((pair, pIdx) => {
                                const overrideKey = `${r.id}_h${pair.hBug.id || pair.hIdx}`;
                                const currentStatus = bugOverrides[r.id]?.[overrideKey] || pair.status;

                                return (
                                  <div
                                    key={pIdx}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr auto 1fr auto',
                                      gap: '1rem',
                                      alignItems: 'center',
                                      background: 'rgba(0, 0, 0, 0.4)',
                                      border: currentStatus === 'rejected' ? '1px solid rgba(255,95,86,0.3)' : '1px solid rgba(74, 222, 128, 0.25)',
                                      borderRadius: '12px',
                                      padding: '1rem 1.2rem',
                                    }}
                                  >
                                    {/* Left: Creator Bug */}
                                    <div style={{ borderLeft: '3px solid #ff6b6b', paddingLeft: '0.8rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#ff6b6b', fontWeight: 800, textTransform: 'uppercase' }}>
                                          Planted by {r.originalTeam} — Line #{pair.cBug.lineNumber || 'N/A'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveCodeInspector(prev => ({ ...prev, [r.id]: true }));
                                            setHighlightedCodeLine(prev => ({ ...prev, [r.id]: pair.cBug.lineNumber }));
                                          }}
                                          style={{ background: 'transparent', border: 'none', color: '#00ffff', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}
                                        >
                                          🔍 Focus in Code
                                        </button>
                                      </div>
                                      <div style={{ color: '#e4e4f0', fontSize: '0.86rem', marginTop: '0.2rem' }}>
                                        {pair.cBug.description}
                                      </div>
                                    </div>

                                    {/* Center Connector */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                      <span style={{ fontSize: '1.1rem', color: '#4ade80' }}>⟷</span>
                                      <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        color: pair.confidence >= 75 ? '#4ade80' : '#fbbf24',
                                        background: pair.confidence >= 75 ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '10px',
                                      }}>
                                        {pair.confidence}% MATCH
                                      </span>
                                      {pair.categoryName && (
                                        <span style={{ fontSize: '0.64rem', color: '#aaa' }}>
                                          {pair.categoryIcon}
                                        </span>
                                      )}
                                    </div>

                                    {/* Right: Hunter Bug */}
                                    <div style={{ borderLeft: '3px solid #4ade80', paddingLeft: '0.8rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 800, textTransform: 'uppercase' }}>
                                          Reported by {r.reviewer} — Line #{pair.hBug.lineNumber || 'N/A'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveCodeInspector(prev => ({ ...prev, [r.id]: true }));
                                            setHighlightedCodeLine(prev => ({ ...prev, [r.id]: pair.hBug.lineNumber }));
                                          }}
                                          style={{ background: 'transparent', border: 'none', color: '#00ffff', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}
                                        >
                                          🔍 Focus in Code
                                        </button>
                                      </div>
                                      <div style={{ color: '#e4e4f0', fontSize: '0.86rem', marginTop: '0.2rem' }}>
                                        {pair.hBug.description}
                                      </div>
                                      {pair.hBug.fix && (
                                        <div style={{ color: '#00ffff', fontSize: '0.76rem', marginTop: '0.3rem', fontFamily: 'Courier New, monospace' }}>
                                          Fix: {pair.hBug.fix}
                                        </div>
                                      )}
                                    </div>

                                    {/* Right: Admin Override Toggles */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleBugOverride(r.id, overrideKey, 'confirmed')}
                                        style={{
                                          padding: '0.25rem 0.6rem',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                          border: currentStatus === 'confirmed' || currentStatus === 'CONFIRMED' ? '1px solid #4ade80' : '1px solid rgba(74,222,128,0.3)',
                                          background: currentStatus === 'confirmed' || currentStatus === 'CONFIRMED' ? 'rgba(74,222,128,0.3)' : 'transparent',
                                          color: '#4ade80',
                                        }}
                                      >
                                        ✓ Valid Match
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleBugOverride(r.id, overrideKey, 'rejected')}
                                        style={{
                                          padding: '0.25rem 0.6rem',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                          border: currentStatus === 'rejected' ? '1px solid #ff5f56' : '1px solid rgba(255,95,86,0.3)',
                                          background: currentStatus === 'rejected' ? 'rgba(255,95,86,0.3)' : 'transparent',
                                          color: '#ff5f56',
                                        }}
                                      >
                                        ✕ Reject Claim
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. Unmatched Hunter Bugs (Potential False Claims / Spam) */}
                        {analysis.unmatchedHunterBugs.length > 0 && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>⚠️</span>
                              <span>Unmatched Hunter Claims — Admin Review Needed ({analysis.unmatchedHunterBugs.length})</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              {analysis.unmatchedHunterBugs.map(({ hBug, hIdx }, uIdx) => {
                                const overrideKey = `${r.id}_h${hBug.id || hIdx}`;
                                const isBonus = bugOverrides[r.id]?.[overrideKey] === 'bonus';
                                const isRejected = bugOverrides[r.id]?.[overrideKey] === 'rejected';

                                return (
                                  <div
                                    key={uIdx}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      background: 'rgba(251, 191, 36, 0.04)',
                                      border: isBonus ? '1px solid rgba(0, 255, 255, 0.4)' : '1px solid rgba(251, 191, 36, 0.25)',
                                      borderRadius: '12px',
                                      padding: '0.9rem 1.2rem',
                                      gap: '1rem',
                                    }}
                                  >
                                    <div style={{ flex: 1, borderLeft: '3px solid #fbbf24', paddingLeft: '0.8rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 800 }}>
                                          Reported by {r.reviewer} — Line #{hBug.lineNumber || 'N/A'}
                                        </span>
                                        <span style={{ background: isBonus ? 'rgba(0,255,255,0.15)' : 'rgba(255,95,86,0.15)', color: isBonus ? '#00ffff' : '#ff7777', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                                          {isBonus ? '⭐ ACCEPTED AS BONUS GENUINE BUG (+75 pts)' : isRejected ? '✕ REJECTED CLAIM (-40 pts)' : '⚠️ UNMATCHED — review before accepting or rejecting'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveCodeInspector(prev => ({ ...prev, [r.id]: true }));
                                            setHighlightedCodeLine(prev => ({ ...prev, [r.id]: hBug.lineNumber }));
                                          }}
                                          style={{ background: 'transparent', border: 'none', color: '#00ffff', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}
                                        >
                                          🔍 Focus in Code
                                        </button>
                                      </div>
                                      <div style={{ color: '#e4e4f0', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                        {hBug.description}
                                      </div>
                                      {hBug.fix && (
                                        <div style={{ color: '#00ffff', fontSize: '0.75rem', marginTop: '0.2rem', fontFamily: 'Courier New, monospace' }}>
                                          Proposed Fix: {hBug.fix}
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleBugOverride(r.id, overrideKey, 'bonus')}
                                        style={{
                                          padding: '0.35rem 0.8rem',
                                          borderRadius: '6px',
                                          fontSize: '0.72rem',
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                          border: isBonus ? '1px solid #00ffff' : '1px solid rgba(0,255,255,0.3)',
                                          background: isBonus ? 'rgba(0,255,255,0.2)' : 'transparent',
                                          color: '#00ffff',
                                        }}
                                      >
                                        {isBonus ? '✓ Marked as Bonus' : '⭐ Grant Bonus Bug'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleBugOverride(r.id, overrideKey, 'rejected')}
                                        style={{
                                          padding: '0.35rem 0.8rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
                                          cursor: 'pointer', border: isRejected ? '1px solid #ff5f56' : '1px solid rgba(255,95,86,0.3)',
                                          background: isRejected ? 'rgba(255,95,86,0.2)' : 'transparent', color: '#ff7777',
                                        }}
                                      >
                                        {isRejected ? '✓ Rejection saved' : '✕ Reject claim'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 3. Missed Creator Bugs (Stealth Defense) */}
                        {analysis.missedCreatorBugs.length > 0 && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#c77dff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>🛡️</span>
                              <span>Missed Planted Bugs — Creating Team Stealth Defense ({analysis.missedCreatorBugs.length} Undetected)</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              {analysis.missedCreatorBugs.map(({ cBug }, mIdx) => (
                                <div
                                  key={mIdx}
                                  style={{
                                    background: 'rgba(157, 78, 221, 0.05)',
                                    border: '1px solid rgba(157, 78, 221, 0.3)',
                                    borderRadius: '12px',
                                    padding: '0.9rem 1.2rem',
                                    borderLeft: '3px solid #9d4edd',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '0.72rem', color: '#c77dff', fontWeight: 800 }}>
                                      Planted by {r.originalTeam} — Line #{cBug.lineNumber || 'N/A'}
                                    </span>
                                    <span style={{ background: 'rgba(157,78,221,0.2)', color: '#e0aaff', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                                      🛡️ STEALTH DEFENSE HELD (+80 pts)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveCodeInspector(prev => ({ ...prev, [r.id]: true }));
                                        setHighlightedCodeLine(prev => ({ ...prev, [r.id]: cBug.lineNumber }));
                                      }}
                                      style={{ background: 'transparent', border: 'none', color: '#00ffff', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}
                                    >
                                      🔍 Focus in Code
                                    </button>
                                  </div>
                                  <div style={{ color: '#e4e4f0', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                    {cBug.description}
                                  </div>
                                  <div style={{ color: '#8888aa', fontSize: '0.72rem', marginTop: '0.2rem', fontStyle: 'italic' }}>
                                    Finding team failed to report this bug. Stealth defense successfully held.
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      </details>
                    </div>
                  );
                });
              })()}
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
                          <span style={{ background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '8px', padding: '0.15rem 0.5rem', color: '#ff6b6b', fontSize: '0.75rem', fontWeight: 700 }}>
                            🚨 Zero-Tolerance Violation
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
                      {report.reentryRequested && report.locked && (
                        <div style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '0.8rem' }}>
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
                            onClick={() => handleAdminUnlockParticipant(report._id, report.teamName, report.registrationId)}
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
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#c2413c' }} />
          <div style={{ fontSize: '3rem' }}>🔒</div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#ff6b6b', textAlign: 'center', fontSize: 'clamp(1.4rem, 5vw, 2.5rem)', margin: 0 }}>
            ACCOUNT LOCKED
          </h1>
          <p style={{ color: '#ff9999', fontSize: '1.1rem', textAlign: 'center', maxWidth: '560px', lineHeight: 1.6, margin: 0 }}>
            You have been flagged for suspicious activity during the competition.<br />
            <strong style={{ color: '#ff4444' }}>Proctoring violation detected — Zero Tolerance Policy.</strong><br />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '0.8rem', color: '#fbbf24', fontSize: '0.9rem' }}>
                  ⏳ Request sent. Waiting for admin approval...
                </div>
                <button
                  className="ba-neon-btn ba-btn-sm"
                  style={{ background: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.4)', color: '#4ade80', width: '100%' }}
                  onClick={async () => {
                    const identifier = teamName || registrationId;
                    if (!identifier) return;
                    try {
                      const res = await fetch(`${SERVER_BASE}/api/cheat-reports/lock-status/${encodeURIComponent(identifier)}`);
                      const data = await res.json();
                      if (data.reentryApproved === true) {
                        setIsLocked(false);
                        setCheatWarnings(0);
                        setReentryRequested(false);
                        setUnlockGracePeriod(true);
                        setTimeout(() => setUnlockGracePeriod(false), 8000);
                        showToast('Admin approved your re-entry. Welcome back!', 'success');
                      } else {
                        showToast('Request is still pending admin review.', 'error');
                      }
                    } catch {
                      showToast('Cannot connect to server.', 'error');
                    }
                  }}
                >
                  🔄 Check Unlock Status Now
                </button>
              </div>
            ) : (
              <button
                className="ba-neon-btn ba-btn-sm"
                style={{ background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.5)', color: '#fbbf24', width: '100%' }}
                onClick={handleRequestReentry}
                disabled={reentryRequested || (!activeCheatReportId && !teamName && !registrationId)}
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
        <AdminLoginModal 
          onClose={() => setAdminModalOpen(false)} 
          onLogin={handleAdminLogin} 
          isAuthenticating={isAdminAuthenticating}
        />
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
                <li><span className="ba-rule-num">07</span> Admins review every reported bug before saving final scores and winners. 🏆</li>
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
                      {EVENT_LANGUAGES.map(lang => (
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
          ) : !isAdminLoggedIn && globalEventPhase !== 'post_event' && !isFullscreen ? (
            <div className="ba-fade-in" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '420px', gap: '1.4rem', textAlign: 'center', padding: '3rem 2rem',
              background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.1) 0%, rgba(10,12,24,0.8) 70%)',
              border: '2px solid rgba(251,191,36,0.45)', borderRadius: '18px',
            }}>
              <div style={{ fontSize: '3.5rem' }}>🔒</div>
              <div>
                <h2 style={{ margin: 0, color: '#fbbf24', fontFamily: 'Space Grotesk, sans-serif' }}>Fullscreen required</h2>
                <p style={{ maxWidth: '540px', color: '#b0b0d0', lineHeight: 1.65, margin: '0.7rem auto 0' }}>
                  Enter fullscreen to begin the live arena. Leaving fullscreen before final judging locks your session and requires administrator approval.
                </p>
              </div>
              <button className="ba-neon-btn ba-btn-yellow" onClick={handleUnlockWorkspace} style={{ fontSize: '1rem', padding: '0.9rem 2rem' }}>
                ⛶ Enter Fullscreen &amp; Begin
              </button>
              <span style={{ color: '#7777aa', fontSize: '0.78rem' }}>Fullscreen ends automatically when the administrator starts final judging.</span>
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
