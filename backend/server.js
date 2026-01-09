require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// ============================================
// API Key Authentication
// ============================================
const API_KEY = process.env.API_KEY;
const API_KEY_HEADER = 'x-api-key';

// Endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  '/api/health',
  '/api/health/live',
  '/metrics',
];

// API Key validation middleware
const authenticateApiKey = (req, res, next) => {
  // Skip auth for public endpoints
  if (PUBLIC_ENDPOINTS.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }

  // Skip auth if API_KEY is not configured (development mode)
  if (!API_KEY) {
    console.warn('⚠️ API_KEY not configured - running in development mode without authentication');
    return next();
  }

  const providedKey = req.headers[API_KEY_HEADER];

  if (!providedKey) {
    metrics.requests.unauthorized++;
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key is required. Provide it in the x-api-key header.',
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedKey),
    Buffer.from(API_KEY)
  );

  if (!isValid) {
    metrics.requests.unauthorized++;
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Invalid API key.',
    });
  }

  next();
};

// ============================================
// Metrics Collection
// ============================================
const metrics = {
  requests: { total: 0, success: 0, error: 0, unauthorized: 0 },
  emails: { sent: 0, failed: 0 },
  smtp: { status: 'unknown', lastCheck: null },
  uptime: Date.now(),
  responseTime: { total: 0, count: 0 },
};

// Middleware to track request metrics
app.use((req, res, next) => {
  const start = Date.now();
  metrics.requests.total++;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.responseTime.total += duration;
    metrics.responseTime.count++;
    
    if (res.statusCode >= 400) {
      metrics.requests.error++;
    } else {
      metrics.requests.success++;
    }
  });
  
  next();
});

// ============================================
// CORS Configuration
// ============================================
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', API_KEY_HEADER],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Apply API key authentication to all routes
app.use(authenticateApiKey);

// ============================================
// Rate Limiting (Simple in-memory)
// ============================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '30'); // 30 requests per minute

const rateLimit = (req, res, next) => {
  // Skip rate limiting for health checks
  if (req.path.startsWith('/api/health') || req.path === '/metrics') {
    return next();
  }

  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  
  if (!rateLimitStore.has(clientIp)) {
    rateLimitStore.set(clientIp, { count: 1, startTime: now });
    return next();
  }

  const clientData = rateLimitStore.get(clientIp);
  
  if (now - clientData.startTime > RATE_LIMIT_WINDOW) {
    // Reset window
    rateLimitStore.set(clientIp, { count: 1, startTime: now });
    return next();
  }

  clientData.count++;
  
  if (clientData.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} requests per minute.`,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - clientData.startTime)) / 1000),
    });
  }

  next();
};

app.use(rateLimit);

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now - data.startTime > RATE_LIMIT_WINDOW * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// SMTP Transporter
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// Verify SMTP connection on startup
const verifySMTP = async () => {
  try {
    await transporter.verify();
    metrics.smtp.status = 'connected';
    metrics.smtp.lastCheck = new Date().toISOString();
    console.log('✅ SMTP connection verified');
    return true;
  } catch (err) {
    metrics.smtp.status = 'disconnected';
    metrics.smtp.lastCheck = new Date().toISOString();
    console.error('❌ SMTP connection failed:', err.message);
    return false;
  }
};

verifySMTP();
setInterval(verifySMTP, 60000);

// ============================================
// Health Check Endpoints (Public)
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
    authEnabled: !!API_KEY,
  });
});

app.get('/api/health/detailed', async (req, res) => {
  const smtpHealthy = metrics.smtp.status === 'connected';
  const avgResponseTime = metrics.responseTime.count > 0 
    ? Math.round(metrics.responseTime.total / metrics.responseTime.count) 
    : 0;

  const health = {
    status: smtpHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
    authEnabled: !!API_KEY,
    checks: {
      smtp: {
        status: smtpHealthy ? 'pass' : 'fail',
        lastCheck: metrics.smtp.lastCheck,
      },
      memory: {
        status: 'pass',
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    },
    stats: {
      requests: metrics.requests,
      emails: metrics.emails,
      avgResponseTime: `${avgResponseTime}ms`,
    },
  };

  const statusCode = smtpHealthy ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/api/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/api/health/ready', async (req, res) => {
  if (metrics.smtp.status === 'connected') {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready', reason: 'SMTP disconnected' });
  }
});

// ============================================
// Prometheus Metrics Endpoint (Public)
// ============================================
app.get('/metrics', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.uptime) / 1000);
  const avgResponseTime = metrics.responseTime.count > 0 
    ? metrics.responseTime.total / metrics.responseTime.count 
    : 0;
  const memUsage = process.memoryUsage();

  const prometheusMetrics = `
# HELP email_backend_uptime_seconds Time since the backend started
# TYPE email_backend_uptime_seconds gauge
email_backend_uptime_seconds ${uptimeSeconds}

# HELP email_backend_requests_total Total number of HTTP requests
# TYPE email_backend_requests_total counter
email_backend_requests_total{status="success"} ${metrics.requests.success}
email_backend_requests_total{status="error"} ${metrics.requests.error}
email_backend_requests_total{status="unauthorized"} ${metrics.requests.unauthorized}

# HELP email_backend_emails_total Total number of emails processed
# TYPE email_backend_emails_total counter
email_backend_emails_total{status="sent"} ${metrics.emails.sent}
email_backend_emails_total{status="failed"} ${metrics.emails.failed}

# HELP email_backend_smtp_status SMTP connection status (1=connected, 0=disconnected)
# TYPE email_backend_smtp_status gauge
email_backend_smtp_status ${metrics.smtp.status === 'connected' ? 1 : 0}

# HELP email_backend_auth_enabled Authentication enabled (1=yes, 0=no)
# TYPE email_backend_auth_enabled gauge
email_backend_auth_enabled ${API_KEY ? 1 : 0}

# HELP email_backend_response_time_avg_ms Average response time in milliseconds
# TYPE email_backend_response_time_avg_ms gauge
email_backend_response_time_avg_ms ${avgResponseTime.toFixed(2)}

# HELP email_backend_memory_heap_used_bytes Heap memory used
# TYPE email_backend_memory_heap_used_bytes gauge
email_backend_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP email_backend_memory_heap_total_bytes Total heap memory
# TYPE email_backend_memory_heap_total_bytes gauge
email_backend_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP email_backend_memory_rss_bytes Resident set size
# TYPE email_backend_memory_rss_bytes gauge
email_backend_memory_rss_bytes ${memUsage.rss}

# HELP email_backend_rate_limit_active Active rate limit entries
# TYPE email_backend_rate_limit_active gauge
email_backend_rate_limit_active ${rateLimitStore.size}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

// ============================================
// Protected Endpoints
// ============================================

// Test SMTP connection (protected)
app.get('/api/test-smtp', async (req, res) => {
  try {
    await transporter.verify();
    metrics.smtp.status = 'connected';
    metrics.smtp.lastCheck = new Date().toISOString();
    res.json({ success: true, message: 'Conexão SMTP OK' });
  } catch (error) {
    metrics.smtp.status = 'disconnected';
    metrics.smtp.lastCheck = new Date().toISOString();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send email (protected)
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html, text } = req.body;

  // Validate required fields
  if (!to || !subject || !html) {
    return res.status(400).json({ 
      success: false, 
      message: 'Campos obrigatórios: to, subject, html' 
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Formato de email inválido' 
    });
  }

  // Validate subject length
  if (subject.length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Assunto muito longo (máximo 200 caracteres)'
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Sistema'}" <${process.env.SMTP_FROM || 'noreply@localhost'}>`,
      to,
      subject,
      html,
      text: text || '',
    });

    metrics.emails.sent++;
    console.log('📧 Email enviado:', info.messageId, 'para:', to);
    
    res.json({ 
      success: true, 
      message: 'Email enviado com sucesso',
      messageId: info.messageId 
    });
  } catch (error) {
    metrics.emails.failed++;
    console.error('❌ Erro ao enviar email:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Generate API Key (protected - requires existing API key)
app.post('/api/generate-key', (req, res) => {
  const newKey = crypto.randomBytes(32).toString('hex');
  res.json({
    success: true,
    message: 'Nova API key gerada. Atualize a variável API_KEY no .env',
    key: newKey,
    note: 'Esta key só é exibida uma vez. Guarde em local seguro.',
  });
});

// ============================================
// Graceful Shutdown
// ============================================
const shutdown = (signal) => {
  console.log(`🛑 ${signal} received, closing connections...`);
  transporter.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================
// Start Server
// ============================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend de email rodando na porta ${PORT}`);
  console.log(`🔐 Autenticação: ${API_KEY ? 'ATIVADA' : 'DESATIVADA (modo desenvolvimento)'}`);
  console.log(`📊 Métricas Prometheus: http://localhost:${PORT}/metrics`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health/detailed`);
});
