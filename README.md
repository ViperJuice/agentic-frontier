# Agentic Frontier 🗺️

A real-time visualization platform that monitors Claude Code agent workflows through webhook integration. The system captures all Claude Code events and displays them as an interactive hexagonal world visualization using Phaser.js.

## 🎯 Project Status: TypeScript Migration Complete ✅

**✅ Current Implementation:**
- **Full TypeScript Codebase**: 100% TypeScript for both frontend and backend
- **Hexagonal World Map**: Fully implemented 1000x1000 hex tile visualization
- **Real-time Hook Processing**: All Claude Code events captured and classified
- **Supabase Integration**: Complete database persistence with 8 tables
- **Server-Sent Events**: Live updates to connected clients
- **Modular Architecture**: Clean separation of concerns with TypeScript modules
- **Device Optimization**: Adaptive quality settings for different hardware

**🚧 Pending Features:**
- TreeSitter integration for code structure parsing (framework ready)
- Agent movement visualization in the hex world
- Interactive building/settlement selection
- Code-level granularity visualization

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Vite + Phaser.js + TypeScript  
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Server-Sent Events (SSE)
- **Visualization**: Hexagonal tile map with Phaser.js

### Backend Structure (TypeScript)
```
backend/src/
├── processors/
│   └── HookProcessor.ts      # Core webhook processing logic
├── services/
│   ├── DatabaseService.ts    # Supabase operations
│   ├── FileService.ts        # File management utilities
│   └── SSEService.ts         # Server-sent events handling
├── routes/
│   ├── webhooks.ts           # Claude webhook endpoints
│   └── api.ts                # API endpoints
├── types/
│   └── index.ts              # All TypeScript definitions
├── utils/
│   └── index.ts              # Shared utilities
└── app.ts                    # Main application entry
```

### Frontend Structure (TypeScript)
```
frontend/src/
├── scenes/
│   └── hexworldscene.ts     # Main hexagonal world visualization
├── utils/
│   └── device-detect.ts     # Device capability detection
└── main.ts                   # Application entry point
```

### Database Schema (Supabase)
- **projects**: Project metadata and tracking
- **agent_sessions**: Claude Code session management  
- **activity_events**: All captured events with full context
- **agent_characters**: Virtual agents for visualization
- **files**: File-to-building mapping for city visualization
- **code_structures**: Classes, methods, functions (pending TreeSitter)
- **dependencies**: Import relationships and trade routes
- **call_graph**: Function call relationships

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- Docker (for local Supabase)
- Claude Code CLI
- TypeScript 5.x

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/agentic-frontier.git
   cd agentic-frontier
   ```

2. **Install dependencies**
   ```bash
   # Backend dependencies
   cd backend && npm install
   
   # Frontend dependencies
   cd ../frontend && npm install
   ```

3. **Start Supabase locally**
   ```bash
   supabase start
   ```

4. **Configure environment**
   ```bash
   # Backend environment
   cp backend/.env.local.example backend/.env.local
   # Edit backend/.env.local with your Supabase credentials
   
   # Frontend environment
   cp frontend/.env.local.example frontend/.env.local
   # Edit frontend/.env.local with your configuration
   ```

5. **Build and start the backend**
   ```bash
   cd backend
   npm run build    # Compile TypeScript
   npm run dev      # Start development server with hot reload
   ```

6. **Start the frontend**
   ```bash
   cd frontend
   npm run dev      # Start Vite dev server
   ```

7. **Configure Claude Code hooks**
   Copy `.claude/settings.json` to your Claude Code projects to enable monitoring.

## 📡 API Endpoints

### Core Endpoints
- **Dashboard**: `GET /api/dashboard` - Overview statistics and recent events
- **Real-time Stream**: `GET /api/events/stream` - SSE endpoint for live updates
- **Health Check**: `GET /api/health` - System status and diagnostics

### Webhook Endpoint
- **Claude Hooks**: `POST /api/webhooks/claude/{HookType}`
  - Supported types: SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStop, Notification, PreCompact

### Data Endpoints
- **Structures**: `GET /api/structures/:fileId` - Code structures (when available)
- **Files**: `GET /api/files/:projectId` - Project files with parsing status
- **Dependencies**: `GET /api/dependencies/:projectId` - Import relationships

## 🎮 Hexagonal World Visualization

### Current Implementation
- **1000x1000 hex tile map** with terrain generation
- **Camera controls**: Arrow keys/WASD for panning, scroll for zoom
- **Terrain types**: Grass, ocean, desert, forest, mountain, lava
- **Performance optimization**: Adaptive quality based on device capabilities
- **Responsive design**: Automatically adjusts to window size

### Visual Assets
The project includes AI-generated prompts for creating game assets:
- Terrain tiles (5 types)
- Unit sprites (3 types: worker, explorer, builder)
- Settlement sprites (3 sizes)
- Building sprites (5 types for different code structures)

Assets are stored in `frontend/public/assets/` with organized subdirectories.

## 🔄 Hook Integration Flow

1. Claude Code triggers hooks during operation
2. Hooks send POST requests to `http://localhost:3001/api/webhooks/claude/{HookType}`
3. `HookProcessor` classifies events into semantic activities
4. `DatabaseService` persists to Supabase
5. `SSEService` broadcasts to connected clients
6. Frontend updates hexagonal world visualization

## 🛠️ Development Commands

### Backend (TypeScript)
```bash
cd backend
npm run dev        # Start with hot reload (tsx watch)
npm run build      # Compile TypeScript to dist/
npm start          # Run production build
npm run typecheck  # Check types without building
npm run test-db    # Test database connection
```

### Frontend (TypeScript + Vite)
```bash
cd frontend
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

### Supabase
```bash
supabase start     # Start local instance
supabase status    # Check service status
supabase stop      # Stop local instance
supabase reset     # Reset database
```

## 🔧 Configuration

### Environment Variables

Backend (`.env.local`):
```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
PORT=3001
NODE_ENV=development
ENABLE_REALTIME=true
```

Frontend (`.env.local`):
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3001
```

### Claude Code Hook Configuration
Place in `.claude/settings.json` of projects you want to monitor:
```json
{
  "hooks": {
    "SessionStart": "curl -X POST http://localhost:3001/api/webhooks/claude/SessionStart -H 'Content-Type: application/json' -d @- --max-time 2",
    "PreToolUse": "curl -X POST http://localhost:3001/api/webhooks/claude/PreToolUse -H 'Content-Type: application/json' -d @- --max-time 2",
    "PostToolUse": "curl -X POST http://localhost:3001/api/webhooks/claude/PostToolUse -H 'Content-Type: application/json' -d @- --max-time 2",
    "UserPromptSubmit": "curl -X POST http://localhost:3001/api/webhooks/claude/UserPromptSubmit -H 'Content-Type: application/json' -d @- --max-time 2",
    "Stop": "curl -X POST http://localhost:3001/api/webhooks/claude/Stop -H 'Content-Type: application/json' -d @- --max-time 2"
  }
}
```

## 🎨 Event Classification

The system maps tool usage to semantic activities and agent types:

### Activity Types
- **File operations** → 🔍 exploring, 📝 editing, ✏️ writing
- **Code execution** → 🏃 executing, 🧪 testing
- **Web operations** → 🌐 fetching, 🔎 searching
- **Task management** → 📋 planning

### Agent Types
- **Scout**: Search, find, explore operations
- **Builder**: Create, write, implement operations
- **Warrior**: Fix, refactor, debug operations
- **Settler**: Setup, initialize, configure operations

## 📈 Roadmap

### Phase III: Enhanced Visualization
- [ ] Agent movement in hexagonal world
- [ ] Interactive settlement/building selection
- [ ] Real-time construction animations
- [ ] Trade route visualizations

### Phase IV: Code-Level Visualization
- [ ] TreeSitter integration completion
- [ ] Method-level granularity
- [ ] Call graph visualization
- [ ] Dependency graph rendering

### Phase V: Advanced Features
- [ ] Multi-project support
- [ ] Team collaboration features
- [ ] Performance analytics
- [ ] Code complexity heat maps

## 🚀 Deployment

The project is configured for Vercel deployment (when ready):
```bash
# Build TypeScript first
cd backend && npm run build

# Deploy to Vercel
vercel deploy --prod

# Set environment variables in Vercel dashboard
```

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
- Visualization with [Phaser.js](https://phaser.io)
- TypeScript for type safety
- Vite for fast development

---

**Current Status**: 
- ✅ **TypeScript Migration Complete** - 100% TypeScript codebase
- ✅ **Hexagonal World Implemented** - 1000x1000 tile visualization working
- 🚧 **Code Parsing Pending** - Awaiting TreeSitter integration

*"Every function is a building, every class a district, every file a city. Welcome to your code civilization."* 🏗️