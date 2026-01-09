# Guia Completo do Sistema

Este documento explica toda a arquitetura, fluxo de dados, segurança e como configurar o sistema corretamente.

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Componentes do Sistema](#componentes-do-sistema)
3. [Fluxo de Segurança](#fluxo-de-segurança)
4. [Guia de Configuração Passo a Passo](#guia-de-configuração-passo-a-passo)
5. [Perguntas Frequentes sobre Segurança](#perguntas-frequentes-sobre-segurança)

---

## 🏗️ Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SEU SERVIDOR (VPS)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    NGINX (Proxy Reverso)                   │  │
│  │                    Porta 80/443 (HTTPS)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                    │                      │                      │
│                    ▼                      ▼                      │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │     FRONTEND (React)    │  │    BACKEND (Node.js)        │  │
│  │     Arquivos estáticos  │  │    API de Emails            │  │
│  │     Servido pelo Nginx  │  │    Porta 3001 (interna)     │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                           │                      │
│                                           ▼                      │
│                               ┌─────────────────────┐           │
│                               │   SMTP (Postfix)    │           │
│                               │   ou SMTP Externo   │           │
│                               └─────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### O que cada componente faz:

| Componente | Função | Onde Roda |
|------------|--------|-----------|
| **Frontend** | Interface do usuário (React) | Navegador do usuário |
| **Nginx** | Proxy reverso, SSL, roteamento | Seu servidor |
| **Backend** | API para envio de emails | Seu servidor (porta 3001) |
| **SMTP** | Servidor de email | Seu servidor ou serviço externo |

---

## 🔧 Componentes do Sistema

### 1. Frontend (Este Projeto)

O frontend é uma aplicação React que roda **no navegador do usuário**. Ele:
- Exibe a interface de conferências, templates, conexões
- Armazena configurações no `localStorage` do navegador
- Faz requisições HTTP para o backend

**Arquivos importantes:**
- `src/services/emailService.ts` - Comunicação com o backend
- `src/pages/Settings.tsx` - Configurações do sistema
- `src/components/settings/ApiKeyManager.tsx` - Gerenciamento de API Keys

### 2. Backend (Pasta `/backend`)

O backend é um servidor Node.js separado que você precisa hospedar. Ele:
- Recebe requisições do frontend
- Valida API Keys
- Envia emails via SMTP

**Arquivos importantes:**
- `backend/server.js` - Servidor principal
- `backend/api-keys.json` - Chaves de API (você cria)
- `backend/.env` - Configurações SMTP

### 3. Monitoramento (Opcional)

Stack de monitoramento com Prometheus e Grafana:
- `monitoring/docker-compose.monitoring.yml` - Containers de monitoramento
- `monitoring/prometheus.yml` - Configuração de métricas
- `monitoring/alertmanager.yml` - Alertas (Slack/Email)

---

## 🔐 Fluxo de Segurança

### Como funciona a autenticação por API Key:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │────────▶│    Nginx     │────────▶│   Backend    │
│  (Navegador) │         │ (Seu Server) │         │ (Seu Server) │
└──────────────┘         └──────────────┘         └──────────────┘
       │                                                  │
       │  1. Usuário configura                           │
       │     API Key no frontend                         │
       │                                                  │
       │  2. Frontend envia requisição:                  │
       │     Header: x-api-key: abc123...                │
       │                                                  │
       │                                                  ▼
       │                                    3. Backend valida a key
       │                                       no arquivo api-keys.json
       │                                                  │
       │                                                  ▼
       │                                    4. Se válida, processa
       │                                       Se inválida, retorna 403
```

### ⚠️ Preocupação de Segurança: API Key no Frontend

**Sua preocupação é válida!** A API Key é visível no navegador. Veja o que isso significa:

#### Cenários de Risco:

| Cenário | Risco | Mitigação |
|---------|-------|-----------|
| Alguém acessa o computador do usuário | Pode ver a API Key no localStorage | Use senhas no computador, logout |
| Desenvolvedor inspeciona o código | Pode ver a key nas requisições | Normal - é o operador do sistema |
| Ataque XSS (script malicioso) | Pode roubar a key | Mantenha o frontend atualizado |
| Interceptação de rede | Pode ver a key em trânsito | **USE HTTPS!** |

#### Camadas de Proteção Implementadas:

1. **HTTPS** (obrigatório em produção) - Criptografa toda comunicação
2. **Rate Limiting** - Limita 30 requisições/minuto por IP
3. **Níveis de Permissão** - Keys com acesso limitado (read/full/admin)
4. **Validação Timing-Safe** - Previne ataques de timing
5. **Logs de Uso** - Monitora uso de cada key

#### Modelo de Ameaça:

Este sistema é projetado para **uso interno/administrativo**, onde:
- ✅ Apenas funcionários autorizados acessam o sistema
- ✅ O frontend roda em ambiente controlado
- ✅ A comunicação é sempre via HTTPS
- ❌ **NÃO** é para expor diretamente a clientes externos

### Alternativas Mais Seguras (se necessário):

Se você precisa de segurança máxima, considere:

1. **Autenticação OAuth/JWT** - Tokens temporários ao invés de API Keys fixas
2. **Backend BFF** - Backend intermediário que guarda as credenciais
3. **VPN** - Acesso ao sistema apenas via VPN corporativa

---

## 📚 Guia de Configuração Passo a Passo

### Passo 1: Preparar o Servidor

```bash
# Requisitos mínimos:
# - Ubuntu 20.04+ ou similar
# - 2GB RAM, 20GB disco
# - Node.js 18+
# - Docker (opcional, para monitoramento)

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node --version  # Deve mostrar v20.x.x
npm --version   # Deve mostrar 10.x.x
```

### Passo 2: Configurar o Backend

```bash
# 1. Criar pasta do backend
mkdir -p /opt/email-backend
cd /opt/email-backend

# 2. Copiar arquivos do projeto
# (copie a pasta backend/ do projeto para /opt/email-backend/)

# 3. Instalar dependências
npm install

# 4. Criar arquivo de configuração
cp .env.example .env
nano .env
```

**Configure o `.env`:**

```env
# Servidor
PORT=3001
CORS_ORIGIN=https://seu-dominio.com

# SMTP (exemplo com Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app    # Use "Senha de App", não sua senha normal!
SMTP_FROM=seu-email@gmail.com
SMTP_FROM_NAME=Sistema de Migração

# Rate Limiting
RATE_LIMIT_MAX=30
```

### Passo 3: Criar a Primeira API Key

```bash
# 1. Gerar uma chave segura
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Exemplo de saída: a1b2c3d4e5f6...

# 2. Criar arquivo de chaves
cp api-keys.example.json api-keys.json
nano api-keys.json
```

**Configure o `api-keys.json`:**

```json
[
  {
    "id": "admin-key-1",
    "name": "Chave Administrativa",
    "key": "COLE_AQUI_A_CHAVE_GERADA_NO_PASSO_ANTERIOR",
    "permission": "admin",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Passo 4: Iniciar o Backend

```bash
# Teste rápido
node server.js

# Para produção, use PM2
npm install -g pm2
pm2 start server.js --name email-backend
pm2 save
pm2 startup  # Configura para iniciar com o servidor
```

### Passo 5: Configurar Nginx (Proxy Reverso)

```bash
sudo nano /etc/nginx/sites-available/migracao
```

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com;
    
    # Certificados SSL (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    
    # Frontend (arquivos estáticos)
    root /var/www/migracao/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Ativar configuração
sudo ln -s /etc/nginx/sites-available/migracao /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Passo 6: Configurar SSL (HTTPS)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seu-dominio.com

# Renovação automática
sudo certbot renew --dry-run
```

### Passo 7: Fazer Deploy do Frontend

```bash
# No seu computador local
npm run build

# Copiar para o servidor
scp -r dist/* usuario@seu-servidor:/var/www/migracao/dist/
```

### Passo 8: Configurar o Frontend

1. Acesse `https://seu-dominio.com`
2. Vá em **Configurações** > **Backend Local**
3. Configure:
   - **URL do Backend**: `https://seu-dominio.com` (o Nginx faz o proxy)
   - **API Key**: Cole a chave que você criou no Passo 3
4. Clique em **Salvar Configurações**
5. Clique em **Testar SMTP** para verificar

### Passo 9: Criar Chaves Adicionais (Opcional)

1. Vá em **Configurações** > **API Keys**
2. Clique em **Nova Chave**
3. Configure:
   - **Nome**: Identificador (ex: "Frontend Produção")
   - **Permissão**: 
     - `read` = Apenas verificar status
     - `full` = Enviar emails
     - `admin` = Gerenciar tudo
4. **IMPORTANTE**: Copie a chave gerada imediatamente!

---

## ❓ Perguntas Frequentes sobre Segurança

### P: A API Key no frontend é segura?

**R**: É segura **se você seguir as práticas recomendadas**:
- ✅ Sempre use HTTPS
- ✅ Limite o acesso ao sistema a pessoas autorizadas
- ✅ Use chaves com permissão mínima necessária
- ✅ Monitore o uso das chaves
- ❌ Não exponha o sistema publicamente sem autenticação adicional

### P: Alguém pode interceptar a API Key?

**R**: Com HTTPS, **não**. A comunicação é criptografada. Sem HTTPS, **sim**, qualquer um na rede pode ver.

### P: E se alguém roubar a API Key?

**R**: Você pode:
1. Desativar a chave imediatamente (Configurações > API Keys > Toggle)
2. Regenerar a chave (gera uma nova, invalida a antiga)
3. Deletar a chave comprometida
4. Verificar logs para ver o que foi acessado

### P: Por que não usar apenas usuário/senha?

**R**: API Keys são mais adequadas para comunicação máquina-máquina:
- Não expiram por inatividade
- Podem ter permissões granulares
- Fáceis de revogar individualmente
- Não precisam de fluxo de login

### P: Como tornar ainda mais seguro?

**R**: Opções adicionais:
1. **Firewall**: Bloquear porta 3001 externamente (só Nginx acessa)
2. **VPN**: Exigir VPN para acessar o sistema
3. **IP Whitelist**: Aceitar requisições apenas de IPs conhecidos
4. **2FA**: Adicionar autenticação de dois fatores no frontend

### P: Os dados ficam onde?

**R**: 
| Dado | Onde Fica | Quem Acessa |
|------|-----------|-------------|
| Configurações do usuário | localStorage (navegador) | Apenas o navegador do usuário |
| API Keys | Arquivo no servidor | Apenas o backend |
| Logs de email | Memória do backend | Resetam ao reiniciar |
| Conferências | localStorage | Navegador do usuário |

---

## 📊 Diagrama de Fluxo: Envio de Email

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE ENVIO DE EMAIL                        │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │ Usuário  │
    │ clica em │
    │ "Enviar" │
    └────┬─────┘
         │
         ▼
    ┌──────────────────────────────────────────────────────────────┐
    │ 1. Frontend monta a requisição                                │
    │    - Lê API Key do localStorage                               │
    │    - Monta body: { to, subject, html }                        │
    │    - Adiciona header: x-api-key                               │
    └────┬─────────────────────────────────────────────────────────┘
         │
         │  HTTPS (criptografado)
         ▼
    ┌──────────────────────────────────────────────────────────────┐
    │ 2. Nginx recebe a requisição                                  │
    │    - Verifica SSL                                             │
    │    - Roteia /api/* para backend:3001                          │
    └────┬─────────────────────────────────────────────────────────┘
         │
         │  HTTP interno (localhost)
         ▼
    ┌──────────────────────────────────────────────────────────────┐
    │ 3. Backend valida a requisição                                │
    │    - Verifica API Key no header                               │
    │    - Compara com api-keys.json                                │
    │    - Verifica permissão (precisa de "full" ou "admin")        │
    │    - Verifica rate limit                                      │
    └────┬─────────────────────────────────────────────────────────┘
         │
         │  Se válido
         ▼
    ┌──────────────────────────────────────────────────────────────┐
    │ 4. Backend envia email                                        │
    │    - Conecta ao SMTP configurado no .env                      │
    │    - Envia email com nodemailer                               │
    │    - Registra em métricas                                     │
    └────┬─────────────────────────────────────────────────────────┘
         │
         │  Resposta
         ▼
    ┌──────────────────────────────────────────────────────────────┐
    │ 5. Frontend recebe resposta                                   │
    │    - { success: true, messageId: "..." }                      │
    │    - Exibe toast de sucesso                                   │
    │    - Registra no histórico                                    │
    └──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Checklist de Produção

Antes de ir para produção, verifique:

- [ ] HTTPS configurado e funcionando
- [ ] API Keys geradas e guardadas em local seguro
- [ ] Backend rodando com PM2 (não `node server.js` direto)
- [ ] Nginx configurado como proxy reverso
- [ ] Porta 3001 bloqueada no firewall (só localhost acessa)
- [ ] SMTP testado e funcionando
- [ ] Backup do arquivo `api-keys.json`
- [ ] Monitoramento configurado (opcional mas recomendado)
- [ ] Logs funcionando (`pm2 logs email-backend`)

---

## 📞 Suporte

Se tiver dúvidas:
1. Verifique os logs: `pm2 logs email-backend`
2. Teste o SMTP: `curl http://localhost:3001/api/test-smtp`
3. Verifique o health: `curl http://localhost:3001/api/health`

