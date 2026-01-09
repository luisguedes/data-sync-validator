# Configuração do Backend Local para Envio de Emails

Este documento explica como configurar um backend Node.js simples para envio de emails via SMTP na sua VPS.

## Pré-requisitos

- Node.js 18+ instalado na VPS
- Servidor SMTP configurado (Postfix, Sendmail, ou provedor externo)

## Instalação

1. Crie uma pasta para o backend:

```bash
mkdir email-backend && cd email-backend
npm init -y
npm install express nodemailer cors dotenv
```

2. Crie o arquivo `.env`:

```env
PORT=3001
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
SMTP_FROM=noreply@seudominio.com
SMTP_FROM_NAME=Sistema de Migração
```

3. Crie o arquivo `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do transporter SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

// Endpoint para envio de email
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html, text } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ 
      success: false, 
      message: 'Campos obrigatórios: to, subject, html' 
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
      text: text || '',
    });

    console.log('Email enviado:', info.messageId);
    res.json({ 
      success: true, 
      message: 'Email enviado com sucesso',
      messageId: info.messageId 
    });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Testar conexão SMTP
app.get('/api/test-smtp', async (req, res) => {
  try {
    await transporter.verify();
    res.json({ success: true, message: 'Conexão SMTP OK' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend de email rodando na porta ${PORT}`);
});
```

4. Inicie o servidor:

```bash
node server.js
```

## Usando com PM2 (Produção)

```bash
npm install -g pm2
pm2 start server.js --name email-backend
pm2 save
pm2 startup
```

## Configuração no Frontend

Na página de Configurações do sistema, defina a URL do backend:

- **URL do Backend**: `http://seu-servidor:3001`

## Testando

```bash
# Testar se o servidor está rodando
curl http://localhost:3001/api/health

# Testar conexão SMTP
curl http://localhost:3001/api/test-smtp

# Enviar email de teste
curl -X POST http://localhost:3001/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "teste@exemplo.com",
    "subject": "Teste",
    "html": "<h1>Teste de Email</h1>"
  }'
```

## Configuração com Postfix (SMTP Local)

Se usar Postfix na VPS:

```env
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@seudominio.com
```

## Segurança

- Use HTTPS em produção (configure nginx como proxy reverso)
- Adicione autenticação ao backend se exposto externamente
- Configure firewall para permitir apenas conexões internas
