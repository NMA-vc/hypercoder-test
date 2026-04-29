# BentoBoard

A high-performance real-time dashboard application built with Rust (Axum + Tokio), SurrealDB, and SvelteKit. Features bento-grid layout, authentication, live data updates, and dark/light theming.

## Features

- 🔐 **Secure Authentication** - Email/password with JWT sessions
- 📊 **Bento Grid Dashboard** - Responsive widget-based layout
- ⚡ **Real-time Updates** - WebSocket-powered live data
- 🎨 **Dark/Light Theme** - System-aware with smooth transitions
- 📱 **Mobile Responsive** - Adaptive design for all devices
- 🔒 **Security-First** - OWASP ASVS Level 2 compliance

## Tech Stack

### Backend
- **Rust** with Axum web framework
- **SurrealDB** for data persistence
- **Tokio** async runtime
- **JWT** authentication
- **WebSockets** for real-time updates

### Frontend
- **SvelteKit** with TypeScript
- **Vite** build tooling
- **CSS Grid** for bento layout
- **System fonts** only (no web fonts)

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Rust 1.70+ (for local development)
- Node.js 18+ (for local development)

### Using Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bentoboard
   ```

2. Start all services:
   ```bash
   docker-compose up
   ```

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - SurrealDB: http://localhost:8000

### Local Development

1. Start SurrealDB:
   ```bash
   docker-compose up surrealdb
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Start the backend:
   ```bash
   cd backend
   cargo run
   ```

4. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Configuration

### Environment Variables

Backend (`.env`):
```
DATABASE_URL=ws://localhost:8000
DATABASE_NS=bentoboard
DATABASE_DB=main
DATABASE_USER=root
DATABASE_PASS=root
JWT_SECRET=your-256-bit-secret-here
FRONTEND_URL=http://localhost:5173
RUST_LOG=info
```

Frontend:
```
PUBLIC_API_URL=http://localhost:3000
PUBLIC_WS_URL=ws://localhost:3000
```

## API Reference

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/me` - Get current user

### Widgets
- `GET /api/widgets` - List user widgets
- `POST /api/widgets` - Create widget
- `PATCH /api/widgets/:id` - Update widget
- `DELETE /api/widgets/:id` - Delete widget

### Dashboards
- `GET /api/dashboards` - List user dashboards

### WebSocket
- `WS /ws` - Real-time updates (authenticated)

## Testing

### Backend Tests
```bash
cd backend
cargo test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### E2E Tests
```bash
cd frontend
npm run test:e2e
```

## Security

BentoBoard follows security best practices:

- **OWASP ASVS Level 2** compliance
- **Argon2** password hashing
- **HS256 JWT** with proper validation
- **Rate limiting** on auth endpoints
- **CORS** protection
- **Security headers** (CSP, HSTS, etc.)
- **Input validation** with typed schemas

## Performance

### Targets
- Backend: p95 < 50ms for most endpoints
- Frontend: Lighthouse score ≥ 90
- WebSocket: < 100ms message latency
- Capacity: 2,000+ RPS, 1,000+ concurrent WS

## Architecture

### Backend Structure
```
backend/
├── src/
│   ├── auth/          # Authentication domain
│   ├── widgets/       # Widget CRUD operations
│   ├── ws/           # WebSocket handling
│   ├── db/           # Database layer
│   ├── config.rs     # Configuration
│   ├── router.rs     # Route definitions
│   └── main.rs       # Application entry
└── tests/            # Integration tests
```

### Frontend Structure
```
frontend/
├── src/
│   ├── routes/       # SvelteKit pages
│   ├── lib/
│   │   ├── components/   # Reusable components
│   │   ├── stores/      # Svelte stores
│   │   ├── api.ts       # API client
│   │   ├── ws.ts        # WebSocket client
│   │   └── theme.ts     # Theme system
│   └── app.css       # Global styles
└── tests/            # E2E tests
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Standards
- Backend: `cargo fmt` and `cargo clippy`
- Frontend: `npm run format` and `npm run lint`
- All code must pass tests and security checks

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check existing GitHub issues
- Create a new issue with detailed description
- Include steps to reproduce for bugs