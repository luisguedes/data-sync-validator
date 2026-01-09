# Monitoramento com Prometheus e Grafana

Este documento explica como configurar o stack de monitoramento.

## Estrutura

```
monitoring/
├── docker-compose.monitoring.yml  # Stack de monitoramento
├── prometheus.yml                 # Configuração do Prometheus
├── alerts.yml                     # Regras de alerta
├── alertmanager.yml               # Configuração do Alertmanager
└── grafana/
    ├── provisioning/
    │   ├── datasources/          # Datasources auto-configurados
    │   └── dashboards/           # Dashboards auto-provisionados
    └── dashboards/
        └── email-backend.json    # Dashboard do backend
```

## Componentes

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| Prometheus | 9090 | Coleta e armazena métricas |
| Grafana | 3000 | Visualização e dashboards |
| Alertmanager | 9093 | Gerenciamento de alertas |
| Node Exporter | 9100 | Métricas do host |
| cAdvisor | 8080 | Métricas dos containers |

## Deploy

### 1. Iniciar a aplicação primeiro

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Iniciar o stack de monitoramento

```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Acessar os serviços

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## Endpoints de Métricas

O backend expõe os seguintes endpoints:

| Endpoint | Descrição |
|----------|-----------|
| `/api/health` | Health check básico |
| `/api/health/detailed` | Health check detalhado com stats |
| `/api/health/live` | Liveness probe (Kubernetes) |
| `/api/health/ready` | Readiness probe (Kubernetes) |
| `/metrics` | Métricas em formato Prometheus |

## Métricas Disponíveis

### Backend

```prometheus
# Uptime em segundos
email_backend_uptime_seconds

# Total de requisições por status
email_backend_requests_total{status="success|error"}

# Total de emails por status
email_backend_emails_total{status="sent|failed"}

# Status SMTP (1=conectado, 0=desconectado)
email_backend_smtp_status

# Tempo médio de resposta em ms
email_backend_response_time_avg_ms

# Uso de memória
email_backend_memory_heap_used_bytes
email_backend_memory_heap_total_bytes
email_backend_memory_rss_bytes
```

## Alertas Configurados

### Aplicação

| Alerta | Condição | Severidade |
|--------|----------|------------|
| BackendDown | Backend indisponível por 1min | Critical |
| FrontendDown | Frontend indisponível por 1min | Critical |
| SMTPDisconnected | SMTP desconectado por 2min | Warning |
| HighErrorRate | Taxa de erro > 10% por 5min | Warning |
| EmailSendingFailures | >5 falhas de email em 5min | Warning |
| HighResponseTime | Tempo de resposta > 1s por 5min | Warning |

### Infraestrutura

| Alerta | Condição | Severidade |
|--------|----------|------------|
| HighMemoryUsage | Memória > 90% por 5min | Warning |
| HighCPUUsage | CPU > 80% por 5min | Warning |
| DiskSpaceLow | Disco < 10% disponível | Critical |
| ContainerRestarted | Container reiniciou | Warning |

## Configurar Notificações

Edite `monitoring/alertmanager.yml` para configurar notificações:

### Email

```yaml
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'admin@example.com'
        send_resolved: true
```

### Slack

```yaml
receivers:
  - name: 'slack-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/xxx/xxx/xxx'
        channel: '#alerts'
        send_resolved: true
```

### Webhook

```yaml
receivers:
  - name: 'webhook-alerts'
    webhook_configs:
      - url: 'http://your-webhook-url'
```

## Dashboard Grafana

O dashboard "Email Backend Dashboard" é provisionado automaticamente e mostra:

- **Uptime**: Tempo desde o início do serviço
- **SMTP Status**: Status da conexão SMTP
- **Avg Response Time**: Tempo médio de resposta
- **Memory Usage**: Uso de memória atual
- **Request Rate**: Taxa de requisições (sucesso/erro)
- **Emails per Hour**: Emails enviados/falhos por hora
- **Memory Over Time**: Histórico de uso de memória

## Queries Úteis

### Prometheus

```promql
# Taxa de erro nos últimos 5 minutos
rate(email_backend_requests_total{status="error"}[5m])

# Emails enviados na última hora
increase(email_backend_emails_total{status="sent"}[1h])

# Uso de memória em MB
email_backend_memory_heap_used_bytes / 1024 / 1024

# CPU do container
rate(container_cpu_usage_seconds_total{name="migracao-backend"}[5m]) * 100
```

## Manutenção

### Limpar dados antigos

```bash
# Prometheus mantém 15 dias por padrão
# Para limpar manualmente:
docker exec migracao-prometheus promtool tsdb delete-series \
  --match='{__name__=~".+"}' \
  --url=http://localhost:9090
```

### Backup do Grafana

```bash
docker cp migracao-grafana:/var/lib/grafana ./grafana-backup
```

### Atualizar dashboards

Coloque novos arquivos JSON em `monitoring/grafana/dashboards/` e reinicie:

```bash
docker-compose -f docker-compose.monitoring.yml restart grafana
```
