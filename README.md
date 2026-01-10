# AI Sheet Backend

> Next.js 16.1 API server for AISheeter - Multi-AI Agent for Google Sheets

**Build Status:** ✅ Passing  
**Last Build:** January 10, 2026  
**Version:** 2.0.0

---

## Tech Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Next.js | 16.1.1 | Turbopack, App Router |
| React | 19.2.3 | Latest stable |
| Tailwind CSS | 4.1.18 | CSS-native config |
| Vercel AI SDK | 6.0.26 | Unified multi-provider |
| TypeScript | 5.x | Strict mode |
| ESLint | 9.x | Next.js config |

---

## API Routes (18 endpoints)

### Core AI
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | Main AI query endpoint |
| `/api/generate-image` | POST | DALL-E / Imagen image generation |
| `/api/models` | GET | List available models |

### User Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/get-or-create-user` | POST | Get or create user by email |
| `/api/get-user-settings` | GET | Fetch user settings |
| `/api/save-all-settings` | POST | Save all user settings |
| `/api/save-api-key` | POST | Save individual API key |
| `/api/save-default-model` | POST | Set default model |

### Prompts
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prompts` | GET/POST/PUT/DELETE | Saved prompts CRUD |

### Async Jobs (Bulk Processing)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | POST | Create bulk job |
| `/api/jobs` | GET | List/get job status |
| `/api/jobs` | DELETE | Cancel job |
| `/api/jobs/worker` | POST | Background worker (Cron) |

### Payments (Stripe)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stripe/checkout` | POST | Create checkout session |
| `/api/stripe/webhook` | POST | Handle Stripe webhooks |
| `/api/stripe/portal` | POST | Customer portal link |

### Other
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/contact` | POST | Contact form |
| `/api/join-waitlist` | POST | Waitlist signup |
| `/api/test` | GET | Health check |

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes (18 endpoints)
│   │   ├── query/              # Main AI query
│   │   ├── jobs/               # Async job queue
│   │   ├── stripe/             # Payment integration
│   │   └── ...
│   ├── globals.css             # Tailwind v4 theme
│   └── layout.tsx              # Root layout
├── lib/
│   ├── ai/
│   │   └── models.ts           # Unified AI model factory
│   ├── auth/
│   │   └── gating.ts           # Feature gating, credits
│   ├── cache/
│   │   └── index.ts            # Response caching
│   ├── prompts/
│   │   └── index.ts            # System prompts (context engineering)
│   ├── stripe/
│   │   └── index.ts            # Stripe client & pricing
│   └── supabase.ts             # Database client
├── components/                 # React components
└── pages/                      # Pages (legacy)
```

---

## Environment Variables

```bash
# Supabase (REQUIRED)
SUPABASE_URL=https://mewcmybmlcupfjnfomvb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx  # From Supabase Dashboard > Settings > API

# NOTE: Anon key is NOT needed - we use service role for all server-side operations

# Encryption (KEEP EXISTING!)
ENCRYPTION_SALT=xxx

# AWS S3 (images)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=xxx

# Stripe (optional until launch)
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Cron
CRON_SECRET=xxx
NEXT_PUBLIC_APP_URL=https://aisheet.vercel.app
```

---

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

---

## Build Output

```
▲ Next.js 16.1.1 (Turbopack)
✓ Compiled successfully in 3.3s
✓ 18 API routes
✓ 5 static pages
✓ 0 vulnerabilities
```

---

## Documentation

- [MASTERPLAN](../docs/MASTERPLAN.md) - Project status
- [Architecture](../docs/architecture/overview.md) - System design
- [Context Engineering](../docs/architecture/context-engineering.md) - Prompt optimization
- [Models Reference](../docs/research/models.md) - AI model pricing
- [Changelog](../docs/project/changelog/v2.0.0.md) - Recent changes

---

## License

Proprietary - All rights reserved
