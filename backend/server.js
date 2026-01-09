require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

// ============================================
// JWT Configuration (local, no external dependencies)
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m'; // Short-lived access token
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d'; // Long-lived refresh token
const USERS_FILE = process.env.USERS_FILE || './users.json';
const REFRESH_TOKENS_FILE = process.env.REFRESH_TOKENS_FILE || './refresh-tokens.json';
const AUDIT_LOGS_FILE = process.env.AUDIT_LOGS_FILE || './audit-logs.json';
const ALERTS_FILE = process.env.ALERTS_FILE || './security-alerts.json';
const MAX_AUDIT_LOGS = parseInt(process.env.MAX_AUDIT_LOGS || '10000'); // Keep last 10k logs
const MAX_ALERTS = parseInt(process.env.MAX_ALERTS || '1000'); // Keep last 1k alerts

// Simple JWT implementation (no external dependencies)
const base64UrlEncode = (str) => {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const base64UrlDecode = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
};

const createJwt = (payload, secret = JWT_SECRET, expiry = JWT_EXPIRY) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  // Parse expiry string (e.g., '24h', '7d', '15m')
  let expirySeconds = 24 * 60 * 60; // Default 24h
  const expiryMatch = expiry.match(/^(\d+)([hdms])$/);
  if (expiryMatch) {
    const value = parseInt(expiryMatch[1]);
    const unit = expiryMatch[2];
    if (unit === 'h') expirySeconds = value * 60 * 60;
    else if (unit === 'd') expirySeconds = value * 24 * 60 * 60;
    else if (unit === 'm') expirySeconds = value * 60;
    else if (unit === 's') expirySeconds = value;
  }
  
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expirySeconds,
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${headerB64}.${payloadB64}.${signature}`;
};

const verifyJwt = (token, secret = JWT_SECRET) => {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
};

// ============================================
// Refresh Token Management
// ============================================
let refreshTokens = [];

const loadRefreshTokens = () => {
  try {
    if (fs.existsSync(REFRESH_TOKENS_FILE)) {
      const data = fs.readFileSync(REFRESH_TOKENS_FILE, 'utf8');
      refreshTokens = JSON.parse(data);
      // Clean expired tokens on load
      const now = Date.now();
      refreshTokens = refreshTokens.filter(t => t.expiresAt > now);
      console.log(`🔄 Loaded ${refreshTokens.length} valid refresh token(s)`);
    }
  } catch (error) {
    console.error('❌ Error loading refresh tokens:', error.message);
  }
};

const saveRefreshTokens = () => {
  try {
    fs.writeFileSync(REFRESH_TOKENS_FILE, JSON.stringify(refreshTokens, null, 2));
  } catch (error) {
    console.error('❌ Error saving refresh tokens:', error.message);
  }
};

const createRefreshToken = (userId) => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  
  // Remove old tokens for this user (max 5 sessions)
  const userTokens = refreshTokens.filter(t => t.userId === userId);
  if (userTokens.length >= 5) {
    const oldestToken = userTokens.sort((a, b) => a.createdAt - b.createdAt)[0];
    refreshTokens = refreshTokens.filter(t => t.token !== oldestToken.token);
  }
  
  refreshTokens.push({
    token,
    userId,
    expiresAt,
    createdAt: Date.now(),
  });
  
  saveRefreshTokens();
  return token;
};

const verifyRefreshToken = (token) => {
  const tokenData = refreshTokens.find(t => t.token === token);
  if (!tokenData) return null;
  if (tokenData.expiresAt < Date.now()) {
    // Token expired, remove it
    refreshTokens = refreshTokens.filter(t => t.token !== token);
    saveRefreshTokens();
    return null;
  }
  return tokenData;
};

const revokeRefreshToken = (token) => {
  refreshTokens = refreshTokens.filter(t => t.token !== token);
  saveRefreshTokens();
};

const revokeAllUserTokens = (userId) => {
  refreshTokens = refreshTokens.filter(t => t.userId !== userId);
  saveRefreshTokens();
};

loadRefreshTokens();

// ============================================
// Audit Log System
// ============================================
let auditLogs = [];

const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  TOKEN_REFRESH: 'auth.token.refresh',
  
  // Users
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_ACTIVATE: 'user.activate',
  USER_DEACTIVATE: 'user.deactivate',
  
  // API Keys
  APIKEY_CREATE: 'apikey.create',
  APIKEY_UPDATE: 'apikey.update',
  APIKEY_DELETE: 'apikey.delete',
  APIKEY_REGENERATE: 'apikey.regenerate',
  
  // Email
  EMAIL_SENT: 'email.sent',
  EMAIL_FAILED: 'email.failed',
  
  // Settings
  SETTINGS_UPDATE: 'settings.update',
  
  // Conference (logged from frontend via API)
  CONFERENCE_CREATE: 'conference.create',
  CONFERENCE_UPDATE: 'conference.update',
  CONFERENCE_DELETE: 'conference.delete',
  CONFERENCE_COMPLETE: 'conference.complete',
};

const loadAuditLogs = () => {
  try {
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const data = fs.readFileSync(AUDIT_LOGS_FILE, 'utf8');
      auditLogs = JSON.parse(data);
      console.log(`📋 Loaded ${auditLogs.length} audit log(s)`);
    }
  } catch (error) {
    console.error('❌ Error loading audit logs:', error.message);
    auditLogs = [];
  }
};

const saveAuditLogs = () => {
  try {
    // Keep only last MAX_AUDIT_LOGS entries
    if (auditLogs.length > MAX_AUDIT_LOGS) {
      auditLogs = auditLogs.slice(-MAX_AUDIT_LOGS);
    }
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(auditLogs, null, 2));
  } catch (error) {
    console.error('❌ Error saving audit logs:', error.message);
  }
};

const createAuditLog = (action, details = {}, req = null) => {
  const log = {
    id: crypto.randomUUID(),
    action,
    timestamp: new Date().toISOString(),
    userId: req?.user?.sub || details.userId || null,
    userEmail: req?.user?.email || details.userEmail || null,
    userName: req?.user?.name || details.userName || null,
    ip: req?.ip || req?.headers?.['x-forwarded-for'] || details.ip || 'unknown',
    userAgent: req?.headers?.['user-agent'] || details.userAgent || null,
    details: {
      ...details,
      // Remove sensitive info
      password: undefined,
      passwordHash: undefined,
      passwordSalt: undefined,
      token: undefined,
      refreshToken: undefined,
      apiKey: undefined,
    },
    success: details.success !== false,
  };
  
  auditLogs.push(log);
  
  // Save asynchronously (don't block the request)
  setImmediate(saveAuditLogs);
  
  // Also log to console for monitoring
  const emoji = log.success ? '✅' : '❌';
  console.log(`${emoji} [AUDIT] ${action} by ${log.userEmail || 'anonymous'} - ${JSON.stringify(details.message || details.target || '')}`);
  
  // Check for security alerts
  setImmediate(() => checkSecurityAlerts(log));
  
  return log;
};

loadAuditLogs();

// ============================================
// Security Alerts System
// ============================================
let securityAlerts = [];

const ALERT_TYPES = {
  BRUTE_FORCE: 'brute_force',
  MULTIPLE_FAILED_LOGINS: 'multiple_failed_logins',
  ADMIN_ACTION: 'admin_action',
  USER_DELETED: 'user_deleted',
  APIKEY_DELETED: 'apikey_deleted',
  MASS_DELETION: 'mass_deletion',
  UNUSUAL_ACTIVITY: 'unusual_activity',
  NEW_ADMIN: 'new_admin',
};

const ALERT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const loadAlerts = () => {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = fs.readFileSync(ALERTS_FILE, 'utf8');
      securityAlerts = JSON.parse(data);
      console.log(`🚨 Loaded ${securityAlerts.length} security alert(s)`);
    }
  } catch (error) {
    console.error('❌ Error loading alerts:', error.message);
    securityAlerts = [];
  }
};

const saveAlerts = () => {
  try {
    if (securityAlerts.length > MAX_ALERTS) {
      securityAlerts = securityAlerts.slice(-MAX_ALERTS);
    }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(securityAlerts, null, 2));
  } catch (error) {
    console.error('❌ Error saving alerts:', error.message);
  }
};

const createAlert = (type, severity, title, description, details = {}) => {
  const alert = {
    id: crypto.randomUUID(),
    type,
    severity,
    title,
    description,
    details,
    timestamp: new Date().toISOString(),
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
  };
  
  securityAlerts.push(alert);
  setImmediate(saveAlerts);
  
  // Log to console with severity indicator
  const severityEmoji = {
    [ALERT_SEVERITY.LOW]: '🔵',
    [ALERT_SEVERITY.MEDIUM]: '🟡',
    [ALERT_SEVERITY.HIGH]: '🟠',
    [ALERT_SEVERITY.CRITICAL]: '🔴',
  };
  console.log(`${severityEmoji[severity] || '⚠️'} [ALERT] ${severity.toUpperCase()}: ${title} - ${description}`);
  
  return alert;
};

// Check for security patterns that should trigger alerts
const checkSecurityAlerts = (log) => {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Check for brute force / multiple failed logins
  if (log.action === AUDIT_ACTIONS.LOGIN_FAILED) {
    const recentFailedLogins = auditLogs.filter(l => 
      l.action === AUDIT_ACTIONS.LOGIN_FAILED &&
      new Date(l.timestamp).getTime() >= fiveMinutesAgo &&
      l.ip === log.ip
    );
    
    if (recentFailedLogins.length >= 5) {
      // Check if we already have an alert for this
      const existingAlert = securityAlerts.find(a => 
        a.type === ALERT_TYPES.BRUTE_FORCE &&
        a.details.ip === log.ip &&
        new Date(a.timestamp).getTime() >= fiveMinutesAgo
      );
      
      if (!existingAlert) {
        createAlert(
          ALERT_TYPES.BRUTE_FORCE,
          ALERT_SEVERITY.HIGH,
          'Tentativa de Força Bruta Detectada',
          `${recentFailedLogins.length} tentativas de login falhadas do IP ${log.ip} nos últimos 5 minutos`,
          { ip: log.ip, attempts: recentFailedLogins.length, targetEmail: log.userEmail }
        );
      }
    } else if (recentFailedLogins.length >= 3) {
      const existingAlert = securityAlerts.find(a => 
        a.type === ALERT_TYPES.MULTIPLE_FAILED_LOGINS &&
        a.details.ip === log.ip &&
        new Date(a.timestamp).getTime() >= fiveMinutesAgo
      );
      
      if (!existingAlert) {
        createAlert(
          ALERT_TYPES.MULTIPLE_FAILED_LOGINS,
          ALERT_SEVERITY.MEDIUM,
          'Múltiplas Falhas de Login',
          `${recentFailedLogins.length} tentativas de login falhadas do IP ${log.ip}`,
          { ip: log.ip, attempts: recentFailedLogins.length, targetEmail: log.userEmail }
        );
      }
    }
  }
  
  // Check for user deletion
  if (log.action === AUDIT_ACTIONS.USER_DELETE) {
    createAlert(
      ALERT_TYPES.USER_DELETED,
      ALERT_SEVERITY.HIGH,
      'Usuário Deletado',
      `Usuário foi deletado por ${log.userEmail || 'desconhecido'}`,
      { deletedUser: log.details?.target, deletedBy: log.userEmail }
    );
  }
  
  // Check for API key deletion
  if (log.action === AUDIT_ACTIONS.APIKEY_DELETE) {
    createAlert(
      ALERT_TYPES.APIKEY_DELETED,
      ALERT_SEVERITY.MEDIUM,
      'API Key Deletada',
      `API Key foi deletada por ${log.userEmail || 'desconhecido'}`,
      { keyName: log.details?.target, deletedBy: log.userEmail }
    );
  }
  
  // Check for new admin creation
  if (log.action === AUDIT_ACTIONS.USER_CREATE && log.details?.role === 'admin') {
    createAlert(
      ALERT_TYPES.NEW_ADMIN,
      ALERT_SEVERITY.HIGH,
      'Novo Administrador Criado',
      `Novo admin ${log.details?.target || 'desconhecido'} criado por ${log.userEmail}`,
      { newAdmin: log.details?.target, createdBy: log.userEmail }
    );
  }
  
  // Check for mass deletion (multiple deletes in short time)
  const recentDeletes = auditLogs.filter(l => 
    (l.action === AUDIT_ACTIONS.USER_DELETE || 
     l.action === AUDIT_ACTIONS.APIKEY_DELETE ||
     l.action === AUDIT_ACTIONS.CONFERENCE_DELETE) &&
    new Date(l.timestamp).getTime() >= fiveMinutesAgo &&
    l.userId === log.userId
  );
  
  if (recentDeletes.length >= 3) {
    const existingAlert = securityAlerts.find(a => 
      a.type === ALERT_TYPES.MASS_DELETION &&
      a.details.userId === log.userId &&
      new Date(a.timestamp).getTime() >= fiveMinutesAgo
    );
    
    if (!existingAlert) {
      createAlert(
        ALERT_TYPES.MASS_DELETION,
        ALERT_SEVERITY.CRITICAL,
        'Deleção em Massa Detectada',
        `${recentDeletes.length} itens deletados por ${log.userEmail} nos últimos 5 minutos`,
        { userId: log.userId, userEmail: log.userEmail, count: recentDeletes.length }
      );
    }
  }
};

loadAlerts();

// ============================================
// User Management
// ============================================
let users = [];

const loadUsers = () => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(data);
      console.log(`👤 Loaded ${users.length} user(s) from file`);
      return;
    }
    
    // Create default admin user if no users exist
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(defaultPassword, salt, 100000, 64, 'sha512').toString('hex');
    
    users = [{
      id: crypto.randomUUID(),
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@local.dev',
      name: 'Administrador',
      role: 'admin',
      passwordHash: hash,
      passwordSalt: salt,
      active: true,
      createdAt: new Date().toISOString(),
    }];
    
    saveUsers();
    console.log(`👤 Created default admin user: ${users[0].email}`);
  } catch (error) {
    console.error('❌ Error loading users:', error.message);
  }
};

const saveUsers = () => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('❌ Error saving users:', error.message);
  }
};

const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
};

const verifyPassword = (password, hash, salt) => {
  const hashVerify = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashVerify));
};

loadUsers();

// ============================================
// API Keys Management (kept for backward compatibility)
// ============================================
const API_KEYS_FILE = process.env.API_KEYS_FILE || './api-keys.json';
const API_KEY_HEADER = 'x-api-key';

const PERMISSIONS = {
  READ: 'read',
  FULL: 'full',
  ADMIN: 'admin',
};

const ENDPOINT_PERMISSIONS = {
  // Public endpoints (no auth required)
  'GET:/api/health': null,
  'GET:/api/health/live': null,
  'GET:/metrics': null,
  
  // Auth endpoints (no auth required)
  'POST:/api/auth/login': null,
  'POST:/api/auth/register': null,
  
  // Read-only endpoints
  'GET:/api/health/detailed': PERMISSIONS.READ,
  'GET:/api/health/ready': PERMISSIONS.READ,
  'GET:/api/test-smtp': PERMISSIONS.READ,
  'GET:/api/keys': PERMISSIONS.READ,
  'GET:/api/auth/me': PERMISSIONS.READ,
  'GET:/api/users': PERMISSIONS.READ,
  
  // Full access endpoints
  'POST:/api/send-email': PERMISSIONS.FULL,
  
  // Admin endpoints
  'POST:/api/keys': PERMISSIONS.ADMIN,
  'DELETE:/api/keys': PERMISSIONS.ADMIN,
  'PUT:/api/keys': PERMISSIONS.ADMIN,
  'POST:/api/users': PERMISSIONS.ADMIN,
  'PUT:/api/users': PERMISSIONS.ADMIN,
  'DELETE:/api/users': PERMISSIONS.ADMIN,
};

let apiKeys = [];

const loadApiKeys = () => {
  try {
    if (fs.existsSync(API_KEYS_FILE)) {
      const data = fs.readFileSync(API_KEYS_FILE, 'utf8');
      apiKeys = JSON.parse(data);
      console.log(`🔑 Loaded ${apiKeys.length} API key(s) from file`);
      return;
    }
    
    const envKeys = process.env.API_KEYS;
    if (envKeys) {
      apiKeys = JSON.parse(envKeys);
      console.log(`🔑 Loaded ${apiKeys.length} API key(s) from environment`);
      return;
    }
    
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
    
    console.log('ℹ️ No API keys configured - JWT authentication is primary');
  } catch (error) {
    console.error('❌ Error loading API keys:', error.message);
  }
};

const saveApiKeys = () => {
  try {
    if (process.env.API_KEYS || process.env.API_KEY) {
      return;
    }
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
  } catch (error) {
    console.error('❌ Error saving API keys:', error.message);
  }
};

loadApiKeys();

const hasPermission = (keyPermission, requiredPermission) => {
  if (!requiredPermission) return true;
  
  const hierarchy = [PERMISSIONS.READ, PERMISSIONS.FULL, PERMISSIONS.ADMIN];
  const keyLevel = hierarchy.indexOf(keyPermission);
  const requiredLevel = hierarchy.indexOf(requiredPermission);
  
  return keyLevel >= requiredLevel;
};

// ============================================
// Authentication Middleware (JWT + API Key)
// ============================================
const authenticate = (req, res, next) => {
  const endpoint = `${req.method}:${req.path}`;
  const requiredPermission = ENDPOINT_PERMISSIONS[endpoint];
  
  // Check for public endpoints
  if (requiredPermission === null) {
    return next();
  }
  
  // Check for public endpoint patterns
  if (req.path.startsWith('/api/health') && req.method === 'GET' && 
      !req.path.includes('detailed') && !req.path.includes('ready')) {
    return next();
  }
  if (req.path === '/metrics' && req.method === 'GET') {
    return next();
  }
  if ((req.path === '/api/auth/login' || req.path === '/api/auth/register') && req.method === 'POST') {
    return next();
  }
  
  const effectivePermission = requiredPermission !== undefined ? requiredPermission : 
    (req.method === 'GET' ? PERMISSIONS.READ : PERMISSIONS.FULL);
  
  if (effectivePermission === null) {
    return next();
  }

  // Try JWT authentication first (Authorization: Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyJwt(token);
    
    if (payload) {
      // Map user role to permission level
      const roleToPermission = {
        'admin': PERMISSIONS.ADMIN,
        'colaborador': PERMISSIONS.FULL,
        'viewer': PERMISSIONS.READ,
      };
      
      const userPermission = roleToPermission[payload.role] || PERMISSIONS.READ;
      
      if (!hasPermission(userPermission, effectivePermission)) {
        metrics.requests.unauthorized++;
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Insufficient permissions. Required: ${effectivePermission}, Your level: ${userPermission}`,
        });
      }
      
      req.user = payload;
      req.authMethod = 'jwt';
      return next();
    }
    
    // Invalid token
    metrics.requests.unauthorized++;
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }

  // Try API Key authentication (x-api-key header)
  const providedKey = req.headers[API_KEY_HEADER];
  
  if (providedKey) {
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

    if (keyInfo.active === false) {
      metrics.requests.unauthorized++;
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'API key is disabled.',
      });
    }

    if (!hasPermission(keyInfo.permission, effectivePermission)) {
      metrics.requests.unauthorized++;
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Insufficient permissions. Required: ${effectivePermission}, Your level: ${keyInfo.permission}`,
      });
    }

    keyInfo.lastUsedAt = new Date().toISOString();
    keyInfo.usageCount = (keyInfo.usageCount || 0) + 1;
    
    req.apiKeyInfo = keyInfo;
    req.authMethod = 'apikey';
    return next();
  }

  // No authentication provided
  metrics.requests.unauthorized++;
  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Authentication required. Use Bearer token or API key.',
  });
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

// Apply authentication to all routes
app.use(authenticate);

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
// Authentication Endpoints
// ============================================

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email e senha são obrigatórios',
    });
  }
  
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    createAuditLog(AUDIT_ACTIONS.LOGIN_FAILED, {
      success: false,
      userEmail: email,
      message: 'User not found',
    }, req);
    return res.status(401).json({
      success: false,
      message: 'Email ou senha inválidos',
    });
  }
  
  if (!user.active) {
    createAuditLog(AUDIT_ACTIONS.LOGIN_FAILED, {
      success: false,
      userId: user.id,
      userEmail: user.email,
      message: 'User disabled',
    }, req);
    return res.status(401).json({
      success: false,
      message: 'Usuário desativado',
    });
  }
  
  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    createAuditLog(AUDIT_ACTIONS.LOGIN_FAILED, {
      success: false,
      userId: user.id,
      userEmail: user.email,
      message: 'Invalid password',
    }, req);
    return res.status(401).json({
      success: false,
      message: 'Email ou senha inválidos',
    });
  }
  
  // Update last login
  user.lastLoginAt = new Date().toISOString();
  saveUsers();
  
  // Create access token (short-lived)
  const accessToken = createJwt({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }, JWT_SECRET, JWT_EXPIRY);
  
  // Create refresh token (long-lived)
  const refreshToken = createRefreshToken(user.id);
  
  createAuditLog(AUDIT_ACTIONS.LOGIN_SUCCESS, {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    message: 'Login successful',
  }, req);
  
  res.json({
    success: true,
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRY,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// Register (can be disabled in production)
app.post('/api/auth/register', (req, res) => {
  // Check if registration is enabled
  if (process.env.DISABLE_REGISTRATION === 'true') {
    return res.status(403).json({
      success: false,
      message: 'Registro desabilitado. Contate o administrador.',
    });
  }
  
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: 'Email, senha e nome são obrigatórios',
    });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Email inválido',
    });
  }
  
  // Password strength
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'A senha deve ter pelo menos 6 caracteres',
    });
  }
  
  // Check if user exists
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({
      success: false,
      message: 'Este email já está cadastrado',
    });
  }
  
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  
  const newUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name: name.trim(),
    role: 'colaborador', // New users are always colaborador
    passwordHash: hash,
    passwordSalt: salt,
    active: true,
    createdAt: new Date().toISOString(),
  };
  
  users.push(newUser);
  saveUsers();
  
  const accessToken = createJwt({
    sub: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
  }, JWT_SECRET, JWT_EXPIRY);
  
  const refreshToken = createRefreshToken(newUser.id);
  
  createAuditLog(AUDIT_ACTIONS.REGISTER, {
    userId: newUser.id,
    userEmail: newUser.email,
    userName: newUser.name,
    target: newUser.email,
    message: 'User registered',
  }, req);
  
  res.status(201).json({
    success: true,
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRY,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    },
  });
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }
  
  const user = users.find(u => u.id === req.user.sub);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
});

// Refresh token endpoint
app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token é obrigatório',
    });
  }
  
  const tokenData = verifyRefreshToken(refreshToken);
  
  if (!tokenData) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token inválido ou expirado',
    });
  }
  
  const user = users.find(u => u.id === tokenData.userId);
  
  if (!user || !user.active) {
    revokeRefreshToken(refreshToken);
    return res.status(401).json({
      success: false,
      message: 'Usuário não encontrado ou desativado',
    });
  }
  
  // Create new access token
  const accessToken = createJwt({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }, JWT_SECRET, JWT_EXPIRY);
  
  console.log(`🔄 Token refreshed for: ${user.email}`);
  
  res.json({
    success: true,
    accessToken,
    expiresIn: JWT_EXPIRY,
  });
});

// Logout endpoint (revoke refresh token)
app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.body;
  
  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }
  
  // Also revoke all tokens if requested
  if (req.body.revokeAll && req.user) {
    revokeAllUserTokens(req.user.sub);
  }
  
  res.json({
    success: true,
    message: 'Logout realizado com sucesso',
  });
});

// ============================================
// User Management Endpoints (Admin only)
// ============================================

// List users
app.get('/api/users', (req, res) => {
  const userList = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));
  
  res.json({
    success: true,
    users: userList,
  });
});

// Create user (admin only)
app.post('/api/users', (req, res) => {
  const { email, password, name, role = 'colaborador' } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: 'Email, senha e nome são obrigatórios',
    });
  }
  
  if (!['admin', 'colaborador', 'viewer'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Role inválido. Use: admin, colaborador ou viewer',
    });
  }
  
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({
      success: false,
      message: 'Este email já está cadastrado',
    });
  }
  
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  
  const newUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name: name.trim(),
    role,
    passwordHash: hash,
    passwordSalt: salt,
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.email || 'system',
  };
  
  users.push(newUser);
  saveUsers();
  
  console.log(`👤 User created by ${req.user?.email}: ${newUser.email} (${role})`);
  
  res.status(201).json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    },
  });
});

// Update user (admin only)
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, role, active, password } = req.body;
  
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Usuário não encontrado',
    });
  }
  
  // Prevent modifying own admin status
  if (req.user?.sub === id && (role !== undefined || active !== undefined)) {
    return res.status(400).json({
      success: false,
      message: 'Você não pode modificar seu próprio status ou role',
    });
  }
  
  if (name) users[userIndex].name = name.trim();
  if (role && ['admin', 'colaborador', 'viewer'].includes(role)) {
    users[userIndex].role = role;
  }
  if (active !== undefined) users[userIndex].active = active;
  if (password && password.length >= 6) {
    const salt = crypto.randomBytes(16).toString('hex');
    users[userIndex].passwordHash = hashPassword(password, salt);
    users[userIndex].passwordSalt = salt;
  }
  
  users[userIndex].updatedAt = new Date().toISOString();
  saveUsers();
  
  res.json({
    success: true,
    user: {
      id: users[userIndex].id,
      email: users[userIndex].email,
      name: users[userIndex].name,
      role: users[userIndex].role,
      active: users[userIndex].active,
    },
  });
});

// Delete user (admin only)
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  if (req.user?.sub === id) {
    return res.status(400).json({
      success: false,
      message: 'Você não pode deletar sua própria conta',
    });
  }
  
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Usuário não encontrado',
    });
  }
  
  const deletedUser = users.splice(userIndex, 1)[0];
  saveUsers();
  
  console.log(`🗑️ User deleted: ${deletedUser.email}`);
  
  res.json({
    success: true,
    message: 'Usuário deletado',
  });
});

// ============================================
// Health Check Endpoints (Public)
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
    authMethods: ['jwt', 'apikey'],
    usersCount: users.length,
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
    authMethod: req.authMethod || 'none',
    yourPermission: req.user ? (req.user.role === 'admin' ? 'admin' : req.user.role === 'colaborador' ? 'full' : 'read') : (req.apiKeyInfo?.permission || 'none'),
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

# HELP email_backend_users_total Number of registered users
# TYPE email_backend_users_total gauge
email_backend_users_total ${users.length}

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
// API Key Management Endpoints (backward compatibility)
// ============================================

app.get('/api/keys', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === PERMISSIONS.ADMIN;
  
  const keys = apiKeys.map(k => ({
    id: k.id,
    name: k.name,
    permission: k.permission,
    active: k.active !== false,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    usageCount: k.usageCount || 0,
    keyPreview: isAdmin ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : undefined,
  }));
  
  res.json({
    success: true,
    keys,
    yourPermission: req.user?.role || req.apiKeyInfo?.permission,
  });
});

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
    createdBy: req.user?.email || req.apiKeyInfo?.name || 'Unknown',
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
      key: newKey.key,
      permission: newKey.permission,
      createdAt: newKey.createdAt,
    },
    warning: 'Esta chave só será exibida uma vez. Guarde em local seguro!',
  });
});

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

app.delete('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  
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
      key: newKeyValue,
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
  const { to, subject, html, text, conferenceId, conferenceName } = req.body;

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
    
    createAuditLog(AUDIT_ACTIONS.EMAIL_SENT, {
      target: to,
      subject,
      messageId: info.messageId,
      conferenceId,
      conferenceName,
      message: `Email sent to ${to}`,
    }, req);
    
    res.json({ 
      success: true, 
      message: 'Email enviado com sucesso',
      messageId: info.messageId 
    });
  } catch (error) {
    metrics.emails.failed++;
    
    createAuditLog(AUDIT_ACTIONS.EMAIL_FAILED, {
      success: false,
      target: to,
      subject,
      conferenceId,
      conferenceName,
      error: error.message,
      message: `Failed to send email to ${to}`,
    }, req);
    
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// Audit Log Endpoints
// ============================================

// Get audit logs (admin only)
app.get('/api/audit-logs', (req, res) => {
  // Check admin permission
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem visualizar logs de auditoria',
    });
  }
  
  const { 
    action, 
    userId, 
    userEmail,
    startDate, 
    endDate, 
    success: successFilter,
    limit = 100,
    offset = 0,
    search,
  } = req.query;
  
  let filteredLogs = [...auditLogs];
  
  // Apply filters
  if (action) {
    filteredLogs = filteredLogs.filter(log => log.action.includes(action));
  }
  if (userId) {
    filteredLogs = filteredLogs.filter(log => log.userId === userId);
  }
  if (userEmail) {
    filteredLogs = filteredLogs.filter(log => 
      log.userEmail?.toLowerCase().includes(userEmail.toLowerCase())
    );
  }
  if (startDate) {
    const start = new Date(startDate).getTime();
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() >= start);
  }
  if (endDate) {
    const end = new Date(endDate).getTime();
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() <= end);
  }
  if (successFilter !== undefined) {
    const isSuccess = successFilter === 'true';
    filteredLogs = filteredLogs.filter(log => log.success === isSuccess);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log.action.toLowerCase().includes(searchLower) ||
      log.userEmail?.toLowerCase().includes(searchLower) ||
      log.userName?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.details).toLowerCase().includes(searchLower)
    );
  }
  
  // Sort by timestamp descending (newest first)
  filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Pagination
  const total = filteredLogs.length;
  const paginatedLogs = filteredLogs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    logs: paginatedLogs,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < total,
    },
    actions: Object.values(AUDIT_ACTIONS),
  });
});

// Get audit log summary/stats (admin only)
app.get('/api/audit-logs/stats', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem visualizar estatísticas',
    });
  }
  
  const { days = 7 } = req.query;
  const cutoff = Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000);
  
  const recentLogs = auditLogs.filter(log => new Date(log.timestamp).getTime() >= cutoff);
  
  // Group by action
  const byAction = {};
  recentLogs.forEach(log => {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
  });
  
  // Group by user
  const byUser = {};
  recentLogs.forEach(log => {
    if (log.userEmail) {
      byUser[log.userEmail] = (byUser[log.userEmail] || 0) + 1;
    }
  });
  
  // Success/failure rate
  const successCount = recentLogs.filter(log => log.success).length;
  const failureCount = recentLogs.filter(log => !log.success).length;
  
  // Activity by day
  const byDay = {};
  recentLogs.forEach(log => {
    const day = new Date(log.timestamp).toISOString().split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  });
  
  res.json({
    success: true,
    stats: {
      total: recentLogs.length,
      success: successCount,
      failure: failureCount,
      byAction,
      byUser,
      byDay,
      periodDays: parseInt(days),
    },
  });
});

// Log action from frontend (for conference actions)
app.post('/api/audit-logs', (req, res) => {
  const { action, details } = req.body;
  
  // Validate action is allowed from frontend
  const allowedActions = [
    AUDIT_ACTIONS.CONFERENCE_CREATE,
    AUDIT_ACTIONS.CONFERENCE_UPDATE,
    AUDIT_ACTIONS.CONFERENCE_DELETE,
    AUDIT_ACTIONS.CONFERENCE_COMPLETE,
    AUDIT_ACTIONS.SETTINGS_UPDATE,
  ];
  
  if (!action || !allowedActions.includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Ação inválida ou não permitida',
    });
  }
  
  const log = createAuditLog(action, details || {}, req);
  
  res.json({
    success: true,
    logId: log.id,
  });
});

// ============================================
// Security Alerts Endpoints
// ============================================

// Get security alerts (admin only)
app.get('/api/alerts', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem visualizar alertas',
    });
  }
  
  const { 
    severity, 
    type,
    acknowledged,
    limit = 50,
    offset = 0,
  } = req.query;
  
  let filteredAlerts = [...securityAlerts];
  
  // Apply filters
  if (severity) {
    filteredAlerts = filteredAlerts.filter(a => a.severity === severity);
  }
  if (type) {
    filteredAlerts = filteredAlerts.filter(a => a.type === type);
  }
  if (acknowledged !== undefined) {
    const isAcknowledged = acknowledged === 'true';
    filteredAlerts = filteredAlerts.filter(a => a.acknowledged === isAcknowledged);
  }
  
  // Sort by timestamp descending
  filteredAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Count unacknowledged
  const unacknowledgedCount = securityAlerts.filter(a => !a.acknowledged).length;
  
  // Pagination
  const total = filteredAlerts.length;
  const paginatedAlerts = filteredAlerts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    alerts: paginatedAlerts,
    unacknowledgedCount,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < total,
    },
    types: Object.values(ALERT_TYPES),
    severities: Object.values(ALERT_SEVERITY),
  });
});

// Get unacknowledged alert count (for polling)
app.get('/api/alerts/count', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem visualizar alertas',
    });
  }
  
  const unacknowledgedCount = securityAlerts.filter(a => !a.acknowledged).length;
  const criticalCount = securityAlerts.filter(a => !a.acknowledged && a.severity === ALERT_SEVERITY.CRITICAL).length;
  const highCount = securityAlerts.filter(a => !a.acknowledged && a.severity === ALERT_SEVERITY.HIGH).length;
  
  // Get latest unacknowledged alerts for notification
  const latestAlerts = securityAlerts
    .filter(a => !a.acknowledged)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
  
  res.json({
    success: true,
    count: unacknowledgedCount,
    critical: criticalCount,
    high: highCount,
    latest: latestAlerts,
  });
});

// Acknowledge alert
app.put('/api/alerts/:id/acknowledge', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem gerenciar alertas',
    });
  }
  
  const { id } = req.params;
  const alertIndex = securityAlerts.findIndex(a => a.id === id);
  
  if (alertIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Alerta não encontrado',
    });
  }
  
  securityAlerts[alertIndex].acknowledged = true;
  securityAlerts[alertIndex].acknowledgedBy = req.user?.email || 'Unknown';
  securityAlerts[alertIndex].acknowledgedAt = new Date().toISOString();
  
  saveAlerts();
  
  res.json({
    success: true,
    message: 'Alerta reconhecido',
    alert: securityAlerts[alertIndex],
  });
});

// Acknowledge all alerts
app.put('/api/alerts/acknowledge-all', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem gerenciar alertas',
    });
  }
  
  const now = new Date().toISOString();
  let count = 0;
  
  securityAlerts.forEach(alert => {
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = req.user?.email || 'Unknown';
      alert.acknowledgedAt = now;
      count++;
    }
  });
  
  saveAlerts();
  
  res.json({
    success: true,
    message: `${count} alertas reconhecidos`,
    count,
  });
});

// Delete old alerts (admin only)
app.delete('/api/alerts/old', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.apiKeyInfo?.permission === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem gerenciar alertas',
    });
  }
  
  const { days = 30 } = req.query;
  const cutoff = Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000);
  
  const originalCount = securityAlerts.length;
  securityAlerts = securityAlerts.filter(a => 
    new Date(a.timestamp).getTime() >= cutoff || !a.acknowledged
  );
  
  const deletedCount = originalCount - securityAlerts.length;
  saveAlerts();
  
  res.json({
    success: true,
    message: `${deletedCount} alertas antigos removidos`,
    deletedCount,
  });
});

// ============================================
// Graceful Shutdown
// ============================================
const shutdown = (signal) => {
  console.log(`🛑 ${signal} received, saving data and closing connections...`);
  saveApiKeys();
  saveUsers();
  saveAuditLogs();
  saveAlerts();
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
  console.log(`🔐 Autenticação: JWT + API Keys`);
  console.log(`👤 Usuários cadastrados: ${users.length}`);
  console.log(`🔑 API Keys configuradas: ${apiKeys.length}`);
  console.log(`📊 Métricas Prometheus: http://localhost:${PORT}/metrics`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health/detailed`);
});
