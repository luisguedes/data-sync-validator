# 🔄 Conferência de Migração

Sistema completo para validação de dados migrados em bancos PostgreSQL. Permite que colaboradores criem conferências de validação e clientes externos verifiquem os dados migrados através de um wizard interativo.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.3.1-61dafb.svg)

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Instalação Rápida](#-instalação-rápida)
- [Configuração](#-configuração)
- [Deploy com Docker](#-deploy-com-docker)
- [Monitoramento](#-monitoramento)
- [Segurança](#-segurança)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [API Reference](#-api-reference)
- [Contribuição](#-contribuição)

---

## 🎯 Visão Geral

O **Conferência de Migração** é uma ferramenta B2B desenvolvida para validar dados migrados entre sistemas. O fluxo principal envolve:

1. **Colaborador** cria uma conferência com queries de validação
2. **Cliente** recebe um link único e seguro (sem necessidade de login)
3. **Cliente** informa os valores esperados do sistema antigo
4. **Sistema** executa queries e valida automaticamente
5. **Cliente** confirma ou reporta divergências
6. **Relatório** final é gerado com status de cada item

### Dois Ambientes

| Ambiente | Acesso | Funcionalidades |
|----------|--------|-----------------|
| **Colaborador** | Login com credenciais | CRUD completo de conexões, templates e conferências |
| **Cliente** | Link com token temporário | Wizard de validação, sem necessidade de conta |

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                        │
│                   - SSL/TLS termination                          │
│                   - Static files serving                         │
│                   - Rate limiting                                │
└─────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│   FRONTEND (React)      │       │   BACKEND (Node.js)     │
│   - SPA em /            │       │   - API em /api         │
│   - Vite + TypeScript   │       │   - Express             │
│   - Tailwind CSS        │       │   - Nodemailer          │
└─────────────────────────┘       └─────────────────────────┘
                                              │
                                              ▼
                                  ┌─────────────────────────┐
                                  │   SMTP Server           │
                                  │   - Envio de emails     │
                                  │   - Notificações        │
                                  └─────────────────────────┘
```

---

## ✨ Funcionalidades

### 👤 Ambiente do Colaborador

- **Conexões PostgreSQL**
  - CRUD completo de conexões
  - Teste de conectividade
  - Múltiplas conexões por projeto

- **Templates de Conferência**
  - Criação via interface visual
  - Importação/Exportação JSON (v2.1)
  - Seções e itens ordenáveis (drag & drop)
  - Regras de validação configuráveis
  - Suporte a variáveis dinâmicas

- **Conferências**
  - Criação baseada em templates
  - Suporte multi-loja
  - Links com expiração configurável
  - Histórico de emails enviados
  - Acompanhamento de status em tempo real

- **Segurança**
  - Dashboard de monitoramento
  - Alertas de segurança
  - Logs de auditoria
  - Notificações push no navegador
  - Notificações por email

- **Relatórios**
  - Dashboard com métricas
  - Estatísticas de envio de emails
  - Histórico completo

### 🔗 Ambiente do Cliente (via Link)

- **Passo 0**: Informar valores esperados do sistema antigo
- **Wizard por Seções**: Navegação guiada por todas as validações
- **Validação Automática**: Queries executadas e comparadas automaticamente
- **Ações por Item**: Confirmar OK ou reportar divergência com observações
- **Anexos**: Upload de evidências quando necessário

### 📧 Sistema de Notificações

- Envio de link de conferência
- Lembretes automáticos
- Notificação de conclusão
- Alertas de segurança (email + push)

---

## 🛠 Tecnologias

### Frontend
| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| React | 18.3.1 | Biblioteca UI |
| Vite | latest | Build tool |
| TypeScript | latest | Tipagem estática |
| Tailwind CSS | latest | Estilização |
| shadcn/ui | latest | Componentes UI |
| React Router | 6.30.1 | Roteamento |
| TanStack Query | 5.83.0 | Gerenciamento de estado servidor |
| Recharts | 2.15.4 | Gráficos e visualizações |
| React Hook Form | 7.61.1 | Formulários |
| Zod | 3.25.76 | Validação de schemas |
| @dnd-kit | latest | Drag and drop |
| Framer Motion | - | Animações |

### Backend
| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| Node.js | ≥18.0.0 | Runtime |
| Express | 4.21.0 | Framework HTTP |
| Nodemailer | 6.9.14 | Envio de emails |
| CORS | 2.8.5 | Cross-Origin |
| dotenv | 16.4.5 | Variáveis de ambiente |

### Infraestrutura
| Tecnologia | Descrição |
|------------|-----------|
| Docker | Containerização |
| Docker Compose | Orquestração |
| Nginx | Proxy reverso |
| Prometheus | Coleta de métricas |
| Grafana | Dashboards |
| Alertmanager | Gestão de alertas |

---

## 🚀 Instalação Rápida

### Pré-requisitos

- Node.js ≥ 18.0.0
- npm ou bun
- Docker e Docker Compose (para deploy)

### Desenvolvimento Local

```bash
# 1. Clone o repositório
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Instale as dependências do frontend
npm install

# 3. Configure o backend
cd backend
cp .env.example .env
cp api-keys.example.json api-keys.json
npm install
cd ..

# 4. Inicie o frontend (terminal 1)
npm run dev

# 5. Inicie o backend (terminal 2)
cd backend
npm run dev
```

O frontend estará disponível em `http://localhost:8080` e o backend em `http://localhost:3001`.

---

## ⚙️ Configuração

### Frontend (.env)

```env
# Variáveis são configuradas via interface após o primeiro login
# ou através do docker-compose
VITE_BACKEND_URL=http://localhost:3001
```

### Backend (backend/.env)

```env
# Servidor
PORT=3001
CORS_ORIGIN=http://localhost:8080

# API Keys (escolha uma opção)
API_KEYS_FILE=./api-keys.json
# ou
# API_KEYS='[{"id":"key1","name":"Admin","key":"sua-chave","permission":"admin","active":true}]'

# Rate Limiting
RATE_LIMIT_MAX=30

# SMTP
SMTP_HOST=smtp.seuservidor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-usuario
SMTP_PASS=sua-senha
SMTP_FROM=noreply@seudominio.com
SMTP_FROM_NAME=Sistema de Migração
```

### API Keys (backend/api-keys.json)

```json
[
  {
    "id": "admin-key-1",
    "name": "Admin Master Key",
    "key": "gere-uma-chave-segura-com-32-bytes-hex",
    "permission": "admin",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Gerar chave segura:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Níveis de Permissão

| Permissão | Descrição |
|-----------|-----------|
| `admin` | Acesso total: enviar emails, gerenciar usuários, visualizar logs |
| `send` | Pode enviar emails e testar conexões |
| `readonly` | Apenas consultas e health checks |

---

## 🐳 Deploy com Docker

### Desenvolvimento

```bash
# Copie os arquivos de exemplo
cp .env.example .env
cp backend/.env.example backend/.env

# Inicie os containers
docker-compose up -d

# Visualize os logs
docker-compose logs -f
```

### Produção

```bash
# Configure as variáveis de produção
cp .env.example .env
# Edite .env com suas configurações de produção

# Build e deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Verifique o status
docker-compose -f docker-compose.prod.yml ps
```

### Configuração HTTPS (Produção)

1. Obtenha certificados SSL (Let's Encrypt recomendado)
2. Coloque em `ssl/cert.pem` e `ssl/key.pem`
3. Configure o `nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name seu-dominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # ... resto da configuração
}
```

### Recursos dos Containers

| Container | CPU | Memória |
|-----------|-----|---------|
| Frontend (Nginx) | 0.5 | 256MB |
| Backend | 1.0 | 512MB |

Ajuste em `docker-compose.prod.yml` conforme necessário.

---

## 📊 Monitoramento

O projeto inclui stack completa de monitoramento com Prometheus, Grafana e Alertmanager.

### Iniciar Monitoramento

```bash
# Junto com a aplicação
docker-compose -f docker-compose.prod.yml \
               -f monitoring/docker-compose.monitoring.yml \
               up -d
```

### Acessos

| Serviço | URL | Credenciais padrão |
|---------|-----|-------------------|
| Grafana | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| Alertmanager | http://localhost:9093 | - |

### Configurar Alertas

Edite `monitoring/.env`:

```env
# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx

# Email
SMTP_HOST=smtp.seuservidor.com
SMTP_FROM=alerts@seudominio.com
ALERT_EMAIL_TO=admin@seudominio.com
```

### Métricas Disponíveis

- Taxa de requisições HTTP
- Latência de endpoints
- Emails enviados/falhados
- Uso de CPU e memória
- Alertas de segurança

---

## 🔒 Segurança

### Autenticação

- **Colaboradores**: Login com email/senha
- **Clientes**: Acesso via token temporário no link
- **API**: Autenticação via API Key no header `X-API-Key`

### Camadas de Proteção

1. **HTTPS**: Obrigatório em produção
2. **Rate Limiting**: 30 req/min por IP (configurável)
3. **CORS**: Origens permitidas configuráveis
4. **API Keys**: Com níveis de permissão
5. **Tokens Temporários**: Expiração configurável para links de cliente

### Dashboard de Segurança

Disponível em **Configurações > Dashboard** (apenas admins):

- Métricas de login (sucesso/falha)
- Alertas ativos por severidade
- IPs suspeitos
- Atividade recente
- Timeline de 24 horas

### Alertas de Segurança

O sistema gera alertas automáticos para:

- Múltiplas tentativas de login falhadas
- Acessos de IPs suspeitos
- Ações administrativas sensíveis
- Erros de autenticação

### Notificações

- **Email**: Para alertas críticos e altos
- **Push no Navegador**: Tempo real, mesmo com aba em background
- Configurável em **Configurações > Notificações**

---

## 📁 Estrutura do Projeto

```
├── backend/                    # Servidor Node.js
│   ├── server.js              # Servidor Express principal
│   ├── api-keys.json          # Chaves de API (não commitado)
│   ├── package.json           # Dependências do backend
│   └── Dockerfile             # Container do backend
│
├── monitoring/                 # Stack de monitoramento
│   ├── grafana/               # Dashboards e provisioning
│   ├── prometheus.yml         # Configuração Prometheus
│   ├── alertmanager.yml       # Configuração de alertas
│   └── docker-compose.monitoring.yml
│
├── src/                        # Código fonte do frontend
│   ├── components/            # Componentes React
│   │   ├── auth/             # Autenticação
│   │   ├── conferences/      # Conferências
│   │   ├── connections/      # Conexões DB
│   │   ├── layout/           # Layout da aplicação
│   │   ├── reports/          # Relatórios
│   │   ├── settings/         # Configurações
│   │   ├── templates/        # Templates
│   │   └── ui/               # Componentes base (shadcn)
│   │
│   ├── contexts/              # React Contexts
│   │   ├── AuthContext.tsx   # Autenticação
│   │   ├── AppSettingsContext.tsx
│   │   └── NotificationContext.tsx
│   │
│   ├── hooks/                 # Custom hooks
│   │   ├── useConferences.ts
│   │   ├── useConnections.ts
│   │   ├── useTemplates.ts
│   │   ├── useEmailService.ts
│   │   └── usePushNotifications.ts
│   │
│   ├── pages/                 # Páginas da aplicação
│   │   ├── Dashboard.tsx
│   │   ├── Connections.tsx
│   │   ├── Templates.tsx
│   │   ├── Conferences.tsx
│   │   ├── ClientConference.tsx  # Ambiente do cliente
│   │   ├── Settings.tsx
│   │   └── Reports.tsx
│   │
│   ├── services/              # Serviços
│   │   ├── authService.ts
│   │   └── emailService.ts
│   │
│   └── types/                 # TypeScript types
│       └── index.ts
│
├── docker-compose.yml          # Desenvolvimento
├── docker-compose.prod.yml     # Produção
├── Dockerfile                  # Container do frontend
├── nginx.conf                  # Configuração Nginx
└── vite.config.ts             # Configuração Vite
```

---

## 📡 API Reference

### Endpoints Principais

#### Health & Status
```
GET /api/health              # Health check
GET /api/status              # Status detalhado do servidor
```

#### Emails
```
POST /api/send-email         # Enviar email (permission: send+)
POST /api/test-smtp          # Testar conexão SMTP (permission: send+)
```

#### Segurança
```
GET  /api/security/dashboard # Métricas de segurança (permission: admin)
GET  /api/alerts             # Listar alertas (permission: readonly+)
POST /api/alerts/:id/acknowledge  # Reconhecer alerta (permission: admin)
```

#### Alertas & Notificações
```
GET  /api/alerts/settings    # Configurações de notificação
PUT  /api/alerts/settings    # Atualizar configurações
GET  /api/alerts/new         # Polling de novos alertas
POST /api/push/subscribe     # Registrar push subscription
POST /api/push/unsubscribe   # Remover push subscription
```

#### Usuários (Admin)
```
GET    /api/users            # Listar usuários
POST   /api/users            # Criar usuário
PUT    /api/users/:id        # Atualizar usuário
DELETE /api/users/:id        # Remover usuário
```

#### API Keys (Admin)
```
GET    /api/api-keys         # Listar API keys
POST   /api/api-keys         # Criar API key
PUT    /api/api-keys/:id     # Atualizar API key
DELETE /api/api-keys/:id     # Remover API key
```

### Headers de Autenticação

```
X-API-Key: sua-api-key-aqui
```

### Formato de Resposta

```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada com sucesso"
}
```

### Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - API Key inválida ou ausente |
| 403 | Forbidden - Permissão insuficiente |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error |

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

## 📞 Suporte

- 📧 Email: suporte@seudominio.com
- 📖 Documentação: Ver pasta `/docs`
- 🐛 Issues: Use o GitHub Issues

---

## ✅ Checklist de Produção

Antes de ir para produção, verifique:

- [ ] HTTPS configurado com certificado válido
- [ ] API Keys geradas com chaves seguras
- [ ] Backend rodando com PM2 ou Docker
- [ ] Nginx configurado como proxy reverso
- [ ] Firewall configurado (portas 80, 443)
- [ ] SMTP testado e funcionando
- [ ] Backups configurados
- [ ] Monitoramento ativo (Prometheus + Grafana)
- [ ] Alertas configurados (Slack/Email)
- [ ] Logs sendo coletados e rotacionados

---

<p align="center">
  Feito com ❤️ usando <a href="https://lovable.dev">Lovable</a>
</p>
