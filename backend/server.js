require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

// ============================================
// API Keys Management
// ============================================
const API_KEYS_FILE = process.env.API_KEYS_FILE || './api-keys.json';
const API_KEY_HEADER = 'x-api-key';

// Permission levels
const PERMISSIONS = {
  READ: 'read',      // Can only read (health checks, test connections)
  FULL: 'full',      // Full access (read + send emails)
  ADMIN: 'admin',    // Admin access (full + manage keys)
};

// Endpoint permission requirements
const ENDPOINT_PERMISSIONS = {
  // Public endpoints (no auth required)
  'GET:/api/health': null,
  'GET:/api/health/live': null,
  'GET:/metrics': null,
  
  // Read-only endpoints
  'GET:/api/health/detailed': PERMISSIONS.READ,
  'GET:/api/health/ready': PERMISSIONS.READ,
  'GET:/api/test-smtp': PERMISSIONS.READ,
  'GET:/api/keys': PERMISSIONS.READ,
  
  // Full access endpoints
  'POST:/api/send-email': PERMISSIONS.FULL,
  
  // Admin endpoints
  'POST:/api/keys': PERMISSIONS.ADMIN,
  'DELETE:/api/keys': PERMISSIONS.ADMIN,
  'PUT:/api/keys': PERMISSIONS.ADMIN,
};

// Load API keys from file or environment
let apiKeys = [];

const loadApiKeys = () => {
  try {
    // First try to load from file
    if (fs.existsSync(API_KEYS_FILE)) {
      const data = fs.readFileSync(API_KEYS_FILE, 'utf8');
      apiKeys = JSON.parse(data);
      console.log(`🔑 Loaded ${apiKeys.length} API key(s) from file`);
      return;
    }
    
    // Fallback to environment variables
    const envKeys = process.env.API_KEYS;
    if (envKeys) {
      apiKeys = JSON.parse(envKeys);
      console.log(`🔑 Loaded ${apiKeys.length} API key(s) from environment`);
      return;
    }
    
    // Legacy single key support
    if (process.env.API_KEY) {
      apiKeys = [{
        id: 'legacy-key',
        name: 'Legacy API Key',
        key: process.env.API_KEY,
        permission: PERMISSIONS.FULL,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        usageCount: 0,
      }];
      console.log('🔑 Using legacy single API key');
      return;
    }
    
    console.warn('⚠️ No API keys configured - running in development mode');
  } catch (error) {
    console.error('❌ Error loading API keys:', error.message);
  }
};

const saveApiKeys = () => {
  try {
    // Don't save keys from environment
    if (process.env.API_KEYS || process.env.API_KEY) {
      return;
    }
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
  } catch (error) {
    console.error('❌ Error saving API keys:', error.message);
  }
};

loadApiKeys();

// Check if permission level allows access
const hasPermission = (keyPermission, requiredPermission) => {
  if (!requiredPermission) return true; // Public endpoint
  
  const hierarchy = [PERMISSIONS.READ, PERMISSIONS.FULL, PERMISSIONS.ADMIN];
  const keyLevel = hierarchy.indexOf(keyPermission);
  const requiredLevel = hierarchy.indexOf(requiredPermission);
  
  return keyLevel >= requiredLevel;
};

// API Key validation middleware
const authenticateApiKey = (req, res, next) => {
  const endpoint = `${req.method}:${req.path}`;
  const requiredPermission = ENDPOINT_PERMISSIONS[endpoint];
  
  // Check for public endpoints
  if (requiredPermission === null || requiredPermission === undefined) {
    // Check if it's a known public endpoint pattern
    if (req.path.startsWith('/api/health') && req.method === 'GET' && !req.path.includes('detailed') && !req.path.includes('ready')) {
      return next();
    }
    if (req.path === '/metrics' && req.method === 'GET') {
      return next();
    }
  }
  
  // Get required permission for the endpoint
  const permission = ENDPOINT_PERMISSIONS[endpoint];
  
  // If no permission defined, default to FULL for POST/DELETE/PUT, READ for GET
  const effectivePermission = permission !== undefined ? permission : 
    (req.method === 'GET' ? PERMISSIONS.READ : PERMISSIONS.FULL);
  
  // If null, it's public
  if (effectivePermission === null) {
    return next();
  }

  // Skip auth if no keys configured (development mode)
  if (apiKeys.length === 0) {
    console.warn('⚠️ No API keys configured - allowing request in dev mode');
    req.apiKeyInfo = { permission: PERMISSIONS.ADMIN, name: 'Dev Mode' };
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

  // Find matching key using timing-safe comparison
  const keyInfo = apiKeys.find(k => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedKey),
        Buffer.from(k.key)
      );
    } catch {
      return false;
    }
  });

  if (!keyInfo) {
    metrics.requests.unauthorized++;
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Invalid API key.',
    });
  }

  // Check if key is active
  if (keyInfo.active === false) {
    metrics.requests.unauthorized++;
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'API key is disabled.',
    });
  }

  // Check permission level
  if (!hasPermission(keyInfo.permission, effectivePermission)) {
    metrics.requests.unauthorized++;
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: `Insufficient permissions. Required: ${effectivePermission}, Your level: ${keyInfo.permission}`,
    });
  }

  // Update usage stats
  keyInfo.lastUsedAt = new Date().toISOString();
  keyInfo.usageCount = (keyInfo.usageCount || 0) + 1;
  
  // Attach key info to request
  req.apiKeyInfo = keyInfo;
  
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
  keyUsage: {},
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
    
    // Track per-key usage
    if (req.apiKeyInfo) {
      const keyId = req.apiKeyInfo.id || 'unknown';
      if (!metrics.keyUsage[keyId]) {
        metrics.keyUsage[keyId] = { requests: 0, lastUsed: null };
      }
      metrics.keyUsage[keyId].requests++;
      metrics.keyUsage[keyId].lastUsed = new Date().toISOString();
    }
  });
  
  next();
});

// ============================================
// CORS Configuration
// ============================================
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', API_KEY_HEADER],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Apply API key authentication to all routes
app.use(authenticateApiKey);

// ============================================
// Rate Limiting
// ============================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '30');

const rateLimit = (req, res, next) => {
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
    authEnabled: apiKeys.length > 0,
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
    authEnabled: apiKeys.length > 0,
    apiKeyCount: apiKeys.length,
    yourPermission: req.apiKeyInfo?.permission || 'none',
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
// Prometheus Metrics (Public)
// ============================================
app.get('/metrics', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.uptime) / 1000);
  const avgResponseTime = metrics.responseTime.count > 0 
    ? metrics.responseTime.total / metrics.responseTime.count 
    : 0;
  const memUsage = process.memoryUsage();

  let keyMetrics = '';
  for (const [keyId, usage] of Object.entries(metrics.keyUsage)) {
    keyMetrics += `email_backend_key_requests_total{key_id="${keyId}"} ${usage.requests}\n`;
  }

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

# HELP email_backend_api_keys_total Number of configured API keys
# TYPE email_backend_api_keys_total gauge
email_backend_api_keys_total ${apiKeys.length}

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

# HELP email_backend_key_requests_total Requests per API key
# TYPE email_backend_key_requests_total counter
${keyMetrics}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

// ============================================
// API Key Management Endpoints
// ============================================

// List API keys (read permission - shows limited info)
app.get('/api/keys', (req, res) => {
  const isAdmin = req.apiKeyInfo?.permission === PERMISSIONS.ADMIN;
  
  const keys = apiKeys.map(k => ({
    id: k.id,
    name: k.name,
    permission: k.permission,
    active: k.active !== false,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    usageCount: k.usageCount || 0,
    // Only show key prefix for admin
    keyPreview: isAdmin ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : undefined,
  }));
  
  res.json({
    success: true,
    keys,
    yourPermission: req.apiKeyInfo?.permission,
  });
});

// Create new API key (admin only)
app.post('/api/keys', (req, res) => {
  const { name, permission = PERMISSIONS.READ } = req.body;
  
  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Nome da chave é obrigatório',
    });
  }
  
  if (!Object.values(PERMISSIONS).includes(permission)) {
    return res.status(400).json({
      success: false,
      message: `Permissão inválida. Use: ${Object.values(PERMISSIONS).join(', ')}`,
    });
  }
  
  const newKey = {
    id: crypto.randomUUID(),
    name: name.trim(),
    key: crypto.randomBytes(32).toString('hex'),
    permission,
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: req.apiKeyInfo?.name || 'Unknown',
    lastUsedAt: null,
    usageCount: 0,
  };
  
  apiKeys.push(newKey);
  saveApiKeys();
  
  console.log(`🔑 New API key created: ${newKey.name} (${newKey.permission})`);
  
  res.status(201).json({
    success: true,
    message: 'API key criada com sucesso',
    key: {
      id: newKey.id,
      name: newKey.name,
      key: newKey.key, // Only shown once!
      permission: newKey.permission,
      createdAt: newKey.createdAt,
    },
    warning: 'Esta chave só será exibida uma vez. Guarde em local seguro!',
  });
});

// Update API key (admin only)
app.put('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  const { name, permission, active } = req.body;
  
  const keyIndex = apiKeys.findIndex(k => k.id === id);
  
  if (keyIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'API key não encontrada',
    });
  }
  
  // Don't allow modifying own key's permission/active status
  if (req.apiKeyInfo?.id === id && (permission !== undefined || active !== undefined)) {
    return res.status(400).json({
      success: false,
      message: 'Você não pode modificar sua própria chave',
    });
  }
  
  if (name) apiKeys[keyIndex].name = name.trim();
  if (permission && Object.values(PERMISSIONS).includes(permission)) {
    apiKeys[keyIndex].permission = permission;
  }
  if (active !== undefined) apiKeys[keyIndex].active = active;
  
  apiKeys[keyIndex].updatedAt = new Date().toISOString();
  saveApiKeys();
  
  res.json({
    success: true,
    message: 'API key atualizada',
    key: {
      id: apiKeys[keyIndex].id,
      name: apiKeys[keyIndex].name,
      permission: apiKeys[keyIndex].permission,
      active: apiKeys[keyIndex].active,
    },
  });
});

// Delete API key (admin only)
app.delete('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  
  // Don't allow deleting own key
  if (req.apiKeyInfo?.id === id) {
    return res.status(400).json({
      success: false,
      message: 'Você não pode deletar sua própria chave',
    });
  }
  
  const keyIndex = apiKeys.findIndex(k => k.id === id);
  
  if (keyIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'API key não encontrada',
    });
  }
  
  const deletedKey = apiKeys.splice(keyIndex, 1)[0];
  saveApiKeys();
  
  console.log(`🗑️ API key deleted: ${deletedKey.name}`);
  
  res.json({
    success: true,
    message: 'API key deletada',
  });
});

// Regenerate API key (admin only)
app.post('/api/keys/:id/regenerate', (req, res) => {
  const { id } = req.params;
  
  const keyIndex = apiKeys.findIndex(k => k.id === id);
  
  if (keyIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'API key não encontrada',
    });
  }
  
  const newKeyValue = crypto.randomBytes(32).toString('hex');
  apiKeys[keyIndex].key = newKeyValue;
  apiKeys[keyIndex].regeneratedAt = new Date().toISOString();
  saveApiKeys();
  
  console.log(`🔄 API key regenerated: ${apiKeys[keyIndex].name}`);
  
  res.json({
    success: true,
    message: 'API key regenerada',
    key: {
      id: apiKeys[keyIndex].id,
      name: apiKeys[keyIndex].name,
      key: newKeyValue, // Only shown once!
    },
    warning: 'A chave anterior foi invalidada. Esta nova chave só será exibida uma vez!',
  });
});

// ============================================
// SMTP Endpoints
// ============================================

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

app.post('/api/send-email', async (req, res) => {
  const { to, subject, html, text } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ 
      success: false, 
      message: 'Campos obrigatórios: to, subject, html' 
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Formato de email inválido' 
    });
  }

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
    console.log(`📧 Email enviado por ${req.apiKeyInfo?.name || 'Unknown'}:`, info.messageId, 'para:', to);
    
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

// ============================================
// Graceful Shutdown
// ============================================
const shutdown = (signal) => {
  console.log(`🛑 ${signal} received, saving data and closing connections...`);
  saveApiKeys();
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
  console.log(`🔐 API Keys configuradas: ${apiKeys.length}`);
  console.log(`📊 Métricas Prometheus: http://localhost:${PORT}/metrics`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health/detailed`);
});
