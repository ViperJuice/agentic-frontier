# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agentic Frontier is a real-time visualization platform that monitors Claude Code agent workflows through webhook integration. The system captures all Claude Code events and displays them as an interactive hexagonal world visualization using Phaser.js.

## Development Commands

### Backend (TypeScript)
```bash
# Start development server with hot reload
cd backend && npm run dev

# Build TypeScript
cd backend && npm run build

# Run production build
cd backend && npm start

# Type checking
cd backend && npm run typecheck

# Test database connection
cd backend && npm run test-db
```

### Frontend (TypeScript + Vite)
```bash
# Start development server
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Preview production build
cd frontend && npm run preview
```

### Supabase Database
```bash
# Start local Supabase
supabase start

# Check status
supabase status

# Run migrations
cd backend && npm run migrate

# Generate TypeScript types from schema
cd backend && npm run types
```

## Architecture

### Backend Structure (TypeScript)
The backend has been refactored from a monolithic 915-line server.js into modular TypeScript:

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

### Frontend Structure (TypeScript + Phaser)
```
frontend/src/
├── scenes/
│   └── hexworldscene.ts     # Main hexagonal world visualization
├── utils/
│   └── device-detect.ts     # Device capability detection
└── main.ts                   # Application entry point
```

### Hook Processing Flow
1. Claude Code triggers hooks → POST to `/api/webhooks/claude/{HookType}`
2. `HookProcessor` classifies events into semantic activities
3. `DatabaseService` persists to Supabase
4. `SSEService` broadcasts real-time updates
5. Frontend receives SSE events and updates visualization

### Database Schema (Supabase)
**Core Tables:**
- `projects` - Project metadata
- `agent_sessions` - Claude Code sessions
- `activity_events` - All captured events
- `agent_characters` - Virtual agents for visualization
- `files` - File-to-building mapping

**Extended Tables (Phase IV):**
- `code_structures` - Classes, methods, functions (pending TreeSitter)
- `dependencies` - Import relationships
- `call_graph` - Function call relationships

## Key Implementation Details

### Event Classification
The `HookProcessor.determineAgentType()` method maps activities to agent types:
- **Scout**: Search, find, explore operations
- **Builder**: Create, write, implement operations
- **Warrior**: Fix, refactor, debug operations
- **Settler**: Setup, initialize, configure operations

### Hexagonal World Visualization
- 1000x1000 hex tile map using Phaser.js
- Terrain generation based on position hash
- Camera controls with arrow keys/WASD
- Optimized for different device capabilities (Raspberry Pi, mobile, desktop)

### Real-time Updates
SSE connection established in `main.ts`:
- Auto-reconnects on failure
- Handles activity events and structure updates
- Updates UI statistics in real-time

## Current Limitations & Status

### Working Features
- ✅ Full TypeScript migration complete
- ✅ Webhook processing and event classification
- ✅ Supabase database persistence
- ✅ Real-time SSE broadcasting
- ✅ Hexagonal world visualization (1000x1000 tiles fully implemented)
- ✅ Device capability detection
- ✅ Camera controls and terrain generation

### Pending Implementation
- ⏳ TreeSitter integration for code parsing (framework ready, awaiting hook data)
- ⏳ Code structure visualization (files marked for parsing when available)
- ⏳ Agent movement in visualization
- ⏳ Interactive building selection

## Environment Configuration

### Backend (.env.local)
```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
PORT=3001
NODE_ENV=development
ENABLE_REALTIME=true
```

### Frontend (.env.local)
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3001
```

**Note**: Example environment files are provided as `.env.local.example` in both backend and frontend directories

## Hook Configuration for Claude Code Projects

Copy to `.claude/settings.json` in any project you want to monitor:
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

## TypeScript Best Practices in This Codebase

- Strict mode enabled with comprehensive type checking
- Service classes use dependency injection pattern
- Unused parameters prefixed with underscore
- Interfaces defined for all data structures in `types/index.ts`
- Async/await used consistently for database operations