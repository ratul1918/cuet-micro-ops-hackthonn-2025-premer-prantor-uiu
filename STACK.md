# 🛠️ Technology Stack

## CUET Micro-Ops Hackathon 2025 - Premer Prantor UIU

---

## 📦 Application Layer

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 24.x | Runtime with native TypeScript support |
| **Hono** | 4.x | Ultra-fast web framework |
| **Zod** | 4.x | Schema validation with OpenAPI integration |
| **TypeScript** | 5.x | Type-safe JavaScript |

## 🗄️ Data Layer

| Technology | Version | Purpose |
|------------|---------|---------|
| **MinIO** | Latest | S3-compatible object storage |
| **Redis** | 7.x | Job queue & caching |
| **AWS S3 SDK** | 3.x | S3 client library |

## 📊 Observability Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Grafana** | Latest | Dashboards & visualization |
| **Prometheus** | Latest | Metrics collection & alerting |
| **Loki** | 2.9.0 | Log aggregation |
| **Promtail** | 2.9.0 | Log shipping to Loki |
| **Jaeger** | Latest | Distributed tracing |
| **OpenTelemetry** | 0.208.0 | Telemetry standard |
| **Sentry** | Latest | Error tracking |

## 📝 API Documentation

| Technology | Purpose |
|------------|---------|
| **Scalar OpenAPI UI** | Interactive API documentation |
| **OpenAPI 3.0** | API specification standard |

## 🐳 Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| **Docker** | 24.x+ | Containerization |
| **Docker Compose** | 2.x+ | Multi-container orchestration |

## 🔄 CI/CD

| Technology | Purpose |
|------------|---------|
| **GitHub Actions** | Continuous Integration/Deployment |
| **ESLint** | Code linting |
| **Prettier** | Code formatting |

---

## 🌐 Service Ports

| Service | Port | URL |
|---------|------|-----|
| **Hono API** | 3000 | http://localhost:3000 |
| **API Docs** | 3000 | http://localhost:3000/docs |
| **OpenAPI Spec** | 3000 | http://localhost:3000/openapi |
| **Grafana** | 3001 | http://localhost:3001 |
| **MinIO API** | 9000 | http://localhost:9000 |
| **MinIO Console** | 9001 | http://localhost:9001 |
| **Prometheus** | 9090 | http://localhost:9090 |
| **Loki** | 3100 | http://localhost:3100 |
| **Jaeger UI** | 16686 | http://localhost:16686 |
| **Redis** | 6379 | localhost:6379 |

---

## 🔐 Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| **Grafana** | admin | admin |
| **MinIO** | minioadmin | minioadmin |

---

## 📚 Documentation Links

- [Hono Documentation](https://hono.dev)
- [Zod Documentation](https://zod.dev)
- [MinIO Documentation](https://min.io/docs)
- [Grafana Documentation](https://grafana.com/docs)
- [Prometheus Documentation](https://prometheus.io/docs)
- [Loki Documentation](https://grafana.com/docs/loki)
- [Jaeger Documentation](https://www.jaegertracing.io/docs)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs)
- [Sentry Documentation](https://docs.sentry.io)

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Hono API Server (Node.js 24)                │    │
│  │  • Scalar OpenAPI UI (/docs)                             │    │
│  │  • OpenTelemetry Instrumentation                         │    │
│  │  • Sentry Error Tracking                                 │    │
│  │  • Rate Limiting & Security Headers                      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│     MinIO       │ │     Redis       │ │    Jaeger       │
│  (S3 Storage)   │ │  (Job Queue)    │ │   (Tracing)     │
└─────────────────┘ └─────────────────┘ └────────┬────────┘
                                                  │
┌─────────────────────────────────────────────────┼───────────────┐
│                   OBSERVABILITY LAYER           │               │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┴─────┐         │
│  │ Prometheus  │  │    Loki     │  │                 │         │
│  │  (Metrics)  │  │   (Logs)    │  │                 │         │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────┘         │
│         │                │                                      │
│         └────────────────┼──────────────────────────────────┐  │
│                          ▼                                   │  │
│                 ┌─────────────────┐                          │  │
│                 │    Grafana      │◀─────────────────────────┘  │
│                 │  (Dashboards)   │                             │
│                 └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

*Last Updated: December 12, 2025*
