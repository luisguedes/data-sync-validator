# API Keys do Backend de Email

## Níveis de Permissão

| Nível | Descrição | Endpoints Permitidos |
|-------|-----------|---------------------|
| `read` | Somente leitura | Health checks, testar SMTP, listar keys |
| `full` | Acesso completo | Tudo de read + enviar emails |
| `admin` | Administrador | Tudo de full + gerenciar API keys |

## Configuração Inicial

### 1. Gerar uma chave admin

```bash
# Gerar chave segura
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Criar arquivo de chaves

```bash
cd backend
cp api-keys.example.json api-keys.json
```

Edite `api-keys.json`:

```json
[
  {
    "id": "admin-key-1",
    "name": "Admin Master Key",
    "key": "sua-chave-gerada-aqui",
    "permission": "admin",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 3. Iniciar o servidor

```bash
npm start
```

## Gerenciamento via API

### Listar chaves

```bash
curl -H "x-api-key: SUA_ADMIN_KEY" http://localhost:3001/api/keys
```

### Criar nova chave

```bash
curl -X POST \
  -H "x-api-key: SUA_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Frontend App", "permission": "full"}' \
  http://localhost:3001/api/keys
```

### Atualizar chave

```bash
curl -X PUT \
  -H "x-api-key: SUA_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Novo Nome", "permission": "read", "active": false}' \
  http://localhost:3001/api/keys/KEY_ID
```

### Regenerar chave

```bash
curl -X POST \
  -H "x-api-key: SUA_ADMIN_KEY" \
  http://localhost:3001/api/keys/KEY_ID/regenerate
```

### Deletar chave

```bash
curl -X DELETE \
  -H "x-api-key: SUA_ADMIN_KEY" \
  http://localhost:3001/api/keys/KEY_ID
```

## Uso no Frontend

Configure a API Key nas configurações do sistema:

1. Acesse **Configurações** > **Backend Local**
2. Insira a URL do backend
3. Insira a API Key (com permissão `full` para enviar emails)
4. Salve as configurações

## Endpoints por Permissão

### Públicos (sem autenticação)
- `GET /api/health` - Health check básico
- `GET /api/health/live` - Liveness probe
- `GET /metrics` - Métricas Prometheus

### Read (somente leitura)
- `GET /api/health/detailed` - Health check detalhado
- `GET /api/health/ready` - Readiness probe
- `GET /api/test-smtp` - Testar conexão SMTP
- `GET /api/keys` - Listar chaves (sem valores)

### Full (acesso completo)
- `POST /api/send-email` - Enviar email

### Admin (administrador)
- `POST /api/keys` - Criar chave
- `PUT /api/keys/:id` - Atualizar chave
- `DELETE /api/keys/:id` - Deletar chave
- `POST /api/keys/:id/regenerate` - Regenerar chave

## Segurança

- As chaves são armazenadas em arquivo local (não commite no git!)
- Use comparação timing-safe para prevenir ataques de timing
- Chaves são validadas com hash, não texto plano
- Métricas de uso por chave são coletadas
- Rate limiting por IP (30 req/min padrão)

## Docker

Para usar com Docker, configure as chaves via variável de ambiente:

```yaml
environment:
  - API_KEYS=[{"id":"key1","name":"Admin","key":"...","permission":"admin","active":true}]
```

Ou monte o arquivo de chaves:

```yaml
volumes:
  - ./api-keys.json:/app/api-keys.json:ro
```
