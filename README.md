# Agentic Frontier

A real-time visualization platform that monitors Claude Code agent workflows through webhook integration. The system captures all Claude Code events and displays them as an interactive city-building visualization.

## 🎯 Project Status: Phase II Complete ✅

**✅ Completed Features (Phase II):**
- Real-time Claude Code hook processing
- Supabase database persistence
- Server-Sent Events (SSE) for real-time updates
- Session and project tracking
- Agent character visualization support
- File-to-building mapping system
- Production-ready error handling and logging

**🚧 In Development (Phase IV - Code-Level Visualization):**
- Enhanced backend with code structure parsing capabilities
- TreeSitter integration framework (pending full implementation)
- Extended database schema for code structures, dependencies, and call graphs
- Advanced visualization hierarchy: Projects → Files → Classes → Methods/Functions

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Enhanced Hook Processor**: Sophisticated event classification and processing
- **Code Structure Parser**: Python AST & JavaScript parsing with TreeSitter framework
- **Real-time SSE**: Server-Sent Events for live updates
- **Dual Storage**: In-memory cache + Supabase persistence
- **API Endpoints**: Comprehensive data access layer with structure support

### Database (Supabase)
**Phase II Core Tables (5):**
- **projects**: Project metadata and tracking
- **agent_sessions**: Claude Code session management  
- **activity_events**: All captured events with full context
- **agent_characters**: Virtual agents for visualization
- **files**: File-to-building mapping for city visualization

**Phase IV Extended Tables (3 additional):**
- **code_structures**: Classes, methods, functions with visualization data
- **dependencies**: Import relationships and trade routes
- **call_graph**: Function call relationships and execution paths

### Infrastructure
- **Vercel Deployment**: Configured for production deployment
- **Environment Variables**: Local and production configurations
- **Authentication**: Bearer token system for webhook security

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- Python 3.8+ (for code structure parsing)
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
   # Backend dependencies
   cd backend && npm install
   
   # Python dependencies for code parsing
   pip install ast  # For Python parsing (built-in)
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

### Core Endpoints (Phase II)
- **Dashboard**: `GET /api/dashboard` - Overview statistics and recent events
- **Events**: `GET /api/events` - Paginated event history  
- **Detailed Events**: `GET /api/events/detailed` - Events with full context
- **Real-time Stream**: `GET /api/events/stream` - SSE endpoint for live updates
- **Sessions**: `GET /api/sessions` - Active and historical sessions
- **Projects**: `GET /api/projects` - Project tracking data
- **Health Check**: `GET /api/health` - System status and diagnostics

### Code Structure Endpoints (Phase IV)
- **Structures**: `GET /api/structures/:fileId` - Code structures for a file
- **Files**: `GET /api/files/:projectId` - Files with parsing status
- **Dependencies**: `GET /api/dependencies/:projectId` - Import relationships
- **Structure Update**: `POST /api/structures/update` - TreeSitter integration endpoint

## 🔄 Hook Integration Flow

1. Claude Code triggers hooks during operation
2. Hooks send POST requests via cURL to `http://localhost:3001/api/webhooks/claude/{HookType}`
3. Backend `HookProcessor` processes and classifies events
4. Events are stored in both memory and Supabase
5. Real-time broadcast via SSE to connected clients

## 🎮 Event Classification & Visualization

### Activity Classification (Phase II)
The system maps tool usage to semantic activities:
- **File operations** → 🔍 exploring, 📝 editing, ✏️ writing
- **Code execution** → 🏃 executing, 🧪 testing
- **Web operations** → 🌐 fetching, 🔎 searching
- **Task management** → 📋 planning

### Visualization Hierarchy (Phase IV)
```
Project (Territory/Civilization)
└── Files (Settlements/Cities)
    └── Classes (Districts with walls)
        └── Methods/Functions (Buildings)
            └── Variables (Resources)
```

### Visual Mapping
| Code Structure | Building Type | Visual Style | Color |
|---------------|--------------|--------------|-------|
| Class | District | Walled area | Brown |
| Constructor | Gateway | Entry building | Gold |
| Public Method | Public Building | Open access | Green |
| Private Method | Internal Building | No roads | Red |
| Static Method | Monument | Statue-like | Gray |
| Async Function | Dock | Loading area | Cyan |

## 📊 Database Schema

### Phase II Core Tables (5)
- **projects**: Project metadata and tracking
- **agent_sessions**: Claude Code session management
- **activity_events**: All captured events with full context
- **agent_characters**: Virtual agents for visualization
- **files**: File-to-building mapping for city visualization

### Phase IV Extended Tables (3)
- **code_structures**: Parsed code elements (classes, methods, functions)
  - Position within file (line numbers)
  - Visualization data (district position, building type)
  - Hierarchy relationships (parent structures)
- **dependencies**: Import relationships and trade routes
  - Source and target files
  - Import types and imported items
  - Visualization as animated trade routes
- **call_graph**: Function call relationships
  - Caller and callee structures
  - Call frequency and types
  - Visualization paths between buildings

## 🎨 Visualization Features

### Phase II (✅ Complete)
- **Agent Characters**: Virtual agents with names, positions, and actions
- **File-to-Building Mapping**: Files represented as different building types
- **Real-time Updates**: Live city changes as development happens

### Phase III (📋 Planned)
- **Phaser.js Integration**: Game engine for complex visualizations
- **Basic City Visualization**: Interactive 2D city view
- **Agent Movement**: Agents move between buildings during operations

### Phase IV (🚧 In Development)
- **Code-Level Granularity**: Classes as districts, methods as buildings
- **Enhanced Agent Behavior**: Agents work within specific code structures
- **Trade Routes**: Dependencies visualized as animated connections
- **Construction/Excavation**: Visual feedback for code creation/deletion
- **Interactive Development**: Click buildings to view source code

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

### Phase IV: Code-Level Visualization (🚧 In Progress)
- [x] Enhanced backend architecture
- [x] Extended database schema
- [x] Code structure parsing framework
- [ ] TreeSitter integration completion
- [ ] Full dependency analysis
- [ ] Interactive code visualization
- [ ] Real-time structure updates

### Phase V: Advanced Features (📋 Planned)
- [ ] Interactive Development (click-to-edit)
- [ ] Real-time debugging visualization
- [ ] Team collaboration features
- [ ] Performance analytics and heat maps
- [ ] Test coverage visualization
- [ ] Code complexity metrics

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

**Current Status**: 
- ✅ **Phase II Complete** - Database persistence fully functional and production-ready!
- 🚧 **Phase IV In Development** - Code-level visualization architecture implemented, TreeSitter integration pending

*"Every function is a building, every class a district, every file a city. Welcome to your code civilization."* 🏗️