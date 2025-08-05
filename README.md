# Agentic Frontier

A real-time visualization platform that transforms Claude Code agent workflows into an interactive metropolitan development environment. Watch AI coding agents work as characters in a city-building inspired interface.

## 🎯 Vision

Agentic Frontier reimagines AI development monitoring by creating a game-like visualization where:
- **Claude Code agents** appear as characters working in a virtual metropolitan area
- **Projects** are districts with unique architectural styles
- **Files and modules** become buildings that agents construct and maintain
- **Code operations** translate into character actions, animations, and city development
- **Multiple concurrent agents** can be monitored across different projects simultaneously

## 🚀 Current Status

**Phase I: Foundation** ✅ (Completed)
- Real-time Claude Code hook integration via lightweight cURL commands
- Server-side event processing and classification
- REST API for event monitoring and dashboard views
- Support for all 8 Claude Code hook types

## 🏗️ What's Working Now

### Hook Integration
Captures all Claude Code events in real-time:
- **PreToolUse** / **PostToolUse** - Tool preparation and completion
- **UserPromptSubmit** - User interactions
- **SessionStart** / **Stop** / **SubagentStop** - Agent lifecycle events
- **Notification** - System notifications
- **PreCompact** - Memory management operations

### Backend API
- Event processing and classification
- Session tracking across multiple agent instances
- Dashboard endpoint with activity statistics
- Real-time event streaming capability

### Current Architecture
```
Claude Code → cURL Hooks → Node.js Backend → Event Processing → API Endpoints
```

## 📋 Quick Start

### Prerequisites
- Node.js 16+
- Claude Code installed
- cURL (standard on most systems)

### Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd agentic-frontier
   cd backend
   npm install
   ```

2. **Start the backend:**
   ```bash
   npm start
   ```
   Server will run on `http://localhost:3001`

3. **Configure Claude Code hooks:**
   Copy `.claude/settings.json` to your Claude Code project root:
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "*",
           "hooks": [
             {
               "type": "command",
               "command": "curl -X POST http://localhost:3001/api/webhooks/claude/PreToolUse -H 'Content-Type: application/json' -H 'Authorization: Bearer dev-key-123' -d @- --max-time 2 --silent",
               "timeout": 3
             }
           ]
         }
       ],
       // ... (all 8 hook types configured)
     }
   }
   ```

4. **Test the integration:**
   ```bash
   # In your Claude Code project directory
   claude --help
   ```
   
   You should see hook events appear in the backend console.

### API Endpoints

- **Dashboard:** `GET /api/dashboard` - Recent events and statistics
- **Events:** `GET /api/events` - All captured events (latest 50)
- **Session Events:** `GET /api/events/session/:sessionId` - Events for specific session
- **Health Check:** `GET /api/health` - Server status and uptime

## 🗺️ Development Roadmap

### Phase II: Database & Cloud Infrastructure (Next)
- [ ] Supabase database integration for persistent storage
- [ ] Vercel deployment for production API
- [ ] Real-time WebSocket/SSE for live updates
- [ ] Session management and agent tracking

### Phase III: Basic Visualization (Upcoming)
- [ ] Phaser.js game engine integration
- [ ] Agent character system with basic animations
- [ ] Simple world map for agent positioning
- [ ] Speech bubble system for showing agent activities
- [ ] Multi-project support with district visualization

### Phase IV: Metropolitan Features (Future)
- [ ] File-to-building mapping system
- [ ] Project health and dependency visualization
- [ ] Interactive code exploration through city interface
- [ ] Team collaboration features
- [ ] Historical project evolution views

### Phase V: Advanced Analytics (Future)
- [ ] AI-powered development insights
- [ ] Code architecture visualization
- [ ] Performance metrics and optimization suggestions
- [ ] Integration with GitHub, VS Code, and other dev tools

## 🛠️ Technical Stack

### Current
- **Backend:** Node.js with Express
- **Hook Integration:** cURL commands (zero local dependencies)
- **Data Storage:** In-memory (development only)

### Planned
- **Database:** Supabase (PostgreSQL with real-time features)
- **API Hosting:** Vercel Edge Functions
- **Visualization:** Phaser.js game engine
- **Real-time:** Server-Sent Events (SSE)
- **Frontend:** React with modern CSS

## 🔧 Development

### Project Structure
```
agentic-frontier/
├── backend/
│   ├── server.js           # Current API server
│   └── package.json
├── .claude/
│   └── settings.json       # Claude Code hooks configuration
├── frontend/               # (Future: Phaser.js visualization)
└── README.md
```

### Adding New Hook Processing
Event classification happens in the `HookProcessor` class. To add new tool types or improve activity classification:

```javascript
// In backend/server.js
classifyActivity(hookType, data) {
  switch (hookType) {
    case 'PreToolUse':
      // Add new tool classification logic here
      if (data.tool_name === 'NewTool') {
        return { category: 'new_category', action: 'new_action', icon: '🆕' };
      }
      // ...
  }
}
```

## 🤝 Contributing

This project is in early development. Current focus areas:
- Improving event classification accuracy
- Adding more detailed activity metadata
- Preparing for database integration
- Planning visualization architecture

## 📄 License

MIT License - See LICENSE file for details

## 🏙️ Vision Statement

*"Every line of code tells a story. Every agent action builds the future. Agentic Frontier makes that story visible, turning the abstract world of AI development into a living, breathing metropolitan landscape where progress is measured not just in commits, but in the growth of a digital civilization."*

---

**Current Phase:** Foundation ✅  
**Next Milestone:** Database Integration & Cloud Deployment  
**Ultimate Goal:** Interactive AI Development Metropolis