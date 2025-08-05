# Agentic Frontier

A real-time visualization platform that monitors Claude Code agent workflows through webhook integration. The system captures all Claude Code events and displays them as an interactive city-building visualization.

## 🎯 Project Status: Phase II Complete

**✅ Completed Features:**
- Real-time Claude Code hook processing
- Supabase database persistence
- Server-Sent Events (SSE) for real-time updates
- Session and project tracking
- Agent character visualization support
- File-to-building mapping system
- Production-ready error handling and logging

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Enhanced Hook Processor**: Sophisticated event classification and processing
- **Real-time SSE**: Server-Sent Events for live updates
- **Dual Storage**: In-memory cache + Supabase persistence
- **API Endpoints**: Comprehensive data access layer

### Database (Supabase)
- **5 Core Tables**: projects, agent_sessions, activity_events, agent_characters, files
- **Migration System**: Complete database structure for persistent storage
- **Visualization Support**: Agent characters and file-to-building mapping

### Infrastructure
- **Vercel Deployment**: Configured for production deployment
- **Environment Variables**: Local and production configurations
- **Authentication**: Bearer token system for webhook security

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- Docker (for local Supabase)
- Claude Code CLI

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ViperJuice/agentic-frontier.git
   cd agentic-frontier
   ```

2. **Install dependencies**
   ```bash
   cd backend && npm install
   ```

3. **Start Supabase locally**
   ```bash
   supabase start
   ```

4. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

5. **Start the backend server**
   ```bash
   cd backend && npm start
   ```

6. **Configure Claude Code hooks**
   Copy `.claude/settings.json` to your Claude Code projects to enable monitoring.

## 📡 API Endpoints

- **Dashboard**: `GET /api/dashboard` - Overview statistics and recent events
- **Events**: `GET /api/events` - Paginated event history
- **Detailed Events**: `GET /api/events/detailed` - Events with full context
- **Real-time Stream**: `GET /api/events/stream` - SSE endpoint for live updates
- **Sessions**: `GET /api/sessions` - Active and historical sessions
- **Projects**: `GET /api/projects` - Project tracking data
- **Health Check**: `GET /api/health` - System status and diagnostics

## 🔄 Hook Integration Flow

1. Claude Code triggers hooks during operation
2. Hooks send POST requests via cURL to `http://localhost:3001/api/webhooks/claude/{HookType}`
3. Backend `HookProcessor` processes and classifies events
4. Events are stored in both memory and Supabase
5. Real-time broadcast via SSE to connected clients

## 🎮 Event Classification

The system maps tool usage to semantic activities:
- **File operations** → 🔍 exploring, 📝 editing, ✏️ writing
- **Code execution** → 🏃 executing, 🧪 testing
- **Web operations** → 🌐 fetching, 🔎 searching
- **Task management** → 📋 planning

## 📊 Database Schema

### Core Tables
- **projects**: Project metadata and tracking
- **agent_sessions**: Claude Code session management
- **activity_events**: All captured events with full context
- **agent_characters**: Virtual agents for visualization
- **files**: File-to-building mapping for city visualization

## 🎨 Visualization Features (Planned)

- **Phase III**: Phaser.js visualization engine
- **Phase IV**: Full metropolitan visualization
- **Agent Characters**: Virtual agents with names, positions, and actions  
- **Building System**: Files mapped to different building types
- **Real-time Updates**: Live city changes as development happens

## 🛠️ Development

### Backend Commands
```bash
cd backend
npm start          # Start production server
npm run dev        # Start with nodemon (development)
npm run test-db    # Test database connection
npm run migrate    # Run Supabase migrations
npm run types      # Generate TypeScript types
```

### Supabase Commands
```bash
supabase start     # Start local instance
supabase status    # Check service status
supabase stop      # Stop local instance
supabase reset     # Reset database
```

## 🔧 Configuration

### Environment Variables (.env.local)
```bash
# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=your_service_key

# API Configuration
API_PORT=3001
API_KEY=dev-key-123
NODE_ENV=development

# Real-time Configuration
ENABLE_REALTIME=true
```

### Claude Code Hook Configuration
Place in `.claude/settings.json` of projects you want to monitor:
```json
{
  "hooks": {
    "SessionStart": "curl -X POST http://localhost:3001/api/webhooks/claude/SessionStart -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-",
    "UserPromptSubmit": "curl -X POST http://localhost:3001/api/webhooks/claude/UserPromptSubmit -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-",
    "PreToolUse": "curl -X POST http://localhost:3001/api/webhooks/claude/PreToolUse -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-",
    "PostToolUse": "curl -X POST http://localhost:3001/api/webhooks/claude/PostToolUse -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-",
    "Stop": "curl -X POST http://localhost:3001/api/webhooks/claude/Stop -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-",
    "SubagentStop": "curl -X POST http://localhost:3001/api/webhooks/claude/SubagentStop -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-",
    "Notification": "curl -X POST http://localhost:3001/api/webhooks/claude/Notification -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-",
    "PreCompact": "curl -X POST http://localhost:3001/api/webhooks/claude/PreCompact -H 'Authorization: Bearer dev-key-123' -H 'Content-Type: application/json' -d @-"
  }
}
```

## 🚀 Deployment

### Vercel Deployment
```bash
# Deploy to Vercel
vercel deploy --prod

# Environment variables need to be set in Vercel dashboard:
# - SUPABASE_URL (production)
# - SUPABASE_SERVICE_KEY (production)
# - API_KEY (production)
```

## 📈 Roadmap

### Phase III: Visualization Engine
- [ ] Phaser.js integration
- [ ] Agent character system
- [ ] Basic city visualization
- [ ] Real-time visual updates

### Phase IV: Full Metropolitan System
- [ ] Advanced building types
- [ ] Neighborhood organization
- [ ] Interactive city exploration
- [ ] Performance analytics dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Claude Code](https://claude.ai/code)
- Database powered by [Supabase](https://supabase.com)
- Visualization planned with [Phaser.js](https://phaser.io)
- Deployed on [Vercel](https://vercel.com)

---

**Status**: Phase II Complete - Database persistence fully functional and production-ready! 🎉