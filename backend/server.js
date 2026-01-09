require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// SMTP Transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  // Connection pool for better performance
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// Verify SMTP connection on startup
transporter.verify()
  .then(() => console.log('✅ SMTP connection verified'))
  .catch((err) => console.error('❌ SMTP connection failed:', err.message));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Test SMTP connection endpoint
app.get('/api/test-smtp', async (req, res) => {
  try {
    await transporter.verify();
    res.json({ success: true, message: 'Conexão SMTP OK' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send email endpoint
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

    console.log('📧 Email enviado:', info.messageId, 'para:', to);
    
    res.json({ 
      success: true, 
      message: 'Email enviado com sucesso',
      messageId: info.messageId 
    });
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, closing connections...');
  transporter.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend de email rodando na porta ${PORT}`);
});
