# Deploy com Docker

Este documento explica como fazer deploy da aplicação usando Docker.

## Estrutura

```
├── Dockerfile              # Frontend (React/Vite + Nginx)
├── docker-compose.yml      # Desenvolvimento
├── docker-compose.prod.yml # Produção
├── nginx.conf              # Configuração Nginx
├── .dockerignore           # Arquivos ignorados no build
├── .env.example            # Exemplo de variáveis de ambiente
└── backend/
    ├── Dockerfile          # Backend Node.js
    ├── server.js           # Servidor Express
    ├── package.json        # Dependências
    ├── .env.example        # Exemplo de variáveis
    └── .dockerignore       # Arquivos ignorados
```

## Requisitos

- Docker 20.10+
- Docker Compose 2.0+

## Deploy Rápido (Desenvolvimento)

```bash
# 1. Clone o repositório
git clone <seu-repo>
cd <seu-repo>

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações SMTP

# 3. Inicie os containers
docker-compose up -d

# 4. Acesse a aplicação
# Frontend: http://localhost
# Backend API: http://localhost:3001
```

## Deploy em Produção

```bash
# 1. Configure as variáveis de ambiente
cp .env.example .env
cp backend/.env.example backend/.env
# Edite ambos com suas configurações

# 2. Build e start com configuração de produção
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Verificar logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Comandos Úteis

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Logs de um serviço específico
docker-compose logs -f frontend
docker-compose logs -f backend

# Reiniciar serviços
docker-compose restart

# Parar todos os containers
docker-compose down

# Rebuild após mudanças no código
docker-compose up -d --build

# Limpar imagens não utilizadas
docker system prune -a
```

## Configuração HTTPS (Produção)

Para habilitar HTTPS, você precisa:

1. Obter certificados SSL (Let's Encrypt recomendado)
2. Criar pasta `ssl/` na raiz do projeto
3. Copiar os certificados:
   ```bash
   mkdir ssl
   cp /path/to/fullchain.pem ssl/
   cp /path/to/privkey.pem ssl/
   ```
4. Atualizar `nginx.conf` para HTTPS (veja exemplo abaixo)

### Exemplo nginx.conf com HTTPS

```nginx
server {
    listen 80;
    server_name seudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # ... resto da configuração
}
```

## Variáveis de Ambiente

### Frontend (via build args ou runtime)
Não há variáveis específicas - URLs da API são configuradas no código.

### Backend (.env)
| Variável | Descrição | Padrão |
|----------|-----------|--------|
| PORT | Porta do servidor | 3001 |
| CORS_ORIGIN | Origem permitida para CORS | * |
| SMTP_HOST | Host do servidor SMTP | localhost |
| SMTP_PORT | Porta SMTP | 587 |
| SMTP_SECURE | Usar TLS | false |
| SMTP_USER | Usuário SMTP | - |
| SMTP_PASS | Senha SMTP | - |
| SMTP_FROM | Email remetente | noreply@localhost |
| SMTP_FROM_NAME | Nome do remetente | Sistema |

## Health Checks

Os containers possuem health checks configurados:

- **Frontend**: `http://localhost/health`
- **Backend**: `http://localhost:3001/api/health`

Verificar saúde dos containers:
```bash
docker-compose ps
# STATUS deve mostrar "(healthy)"
```

## Troubleshooting

### Container não inicia
```bash
# Ver logs detalhados
docker-compose logs backend
docker-compose logs frontend
```

### Problemas de conexão SMTP
```bash
# Testar conexão SMTP
curl http://localhost:3001/api/test-smtp
```

### Rebuild limpo
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Recursos dos Containers

Os containers de produção têm limites configurados:
- CPU: 0.5 cores (máx)
- Memória: 256MB (máx)

Ajuste em `docker-compose.prod.yml` conforme necessário.
