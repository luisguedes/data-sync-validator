require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

// ============================================
// Metrics Collection
// ============================================
const metrics = {
  requests: { total: 0, success: 0, error: 0 },
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
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

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

// Periodic SMTP health check
setInterval(verifySMTP, 60000); // Check every minute

// ============================================
// Health Check Endpoints
// ============================================

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
  });
});

// Detailed health check for monitoring
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

// Kubernetes/Docker liveness probe
app.get('/api/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Kubernetes/Docker readiness probe
app.get('/api/health/ready', async (req, res) => {
  if (metrics.smtp.status === 'connected') {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready', reason: 'SMTP disconnected' });
  }
});

// ============================================
// Prometheus Metrics Endpoint
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

# HELP email_backend_emails_total Total number of emails processed
# TYPE email_backend_emails_total counter
email_backend_emails_total{status="sent"} ${metrics.emails.sent}
email_backend_emails_total{status="failed"} ${metrics.emails.failed}

# HELP email_backend_smtp_status SMTP connection status (1=connected, 0=disconnected)
# TYPE email_backend_smtp_status gauge
email_backend_smtp_status ${metrics.smtp.status === 'connected' ? 1 : 0}

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
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

// ============================================
// SMTP Test Endpoint
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

// ============================================
// Send Email Endpoint
// ============================================
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
  console.log(`📊 Métricas Prometheus: http://localhost:${PORT}/metrics`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health/detailed`);
});
