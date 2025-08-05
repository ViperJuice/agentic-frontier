# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agentic Frontier is a real-time visualization platform that monitors Claude Code agent workflows through webhook integration. The system captures all Claude Code events and will eventually display them as an interactive city-building visualization.

## Development Commands

### Backend Server
```bash
# Install dependencies
cd backend && npm install

# Start the server (runs on port 3001)
cd backend && node server.js

# The server provides:
# - Webhook endpoints at /api/webhooks/claude/{HookType}
# - Event retrieval at /api/events
# - Dashboard data at /api/dashboard
```

### Testing
No test framework is currently implemented. The test script in package.json is a placeholder.

## Architecture

### Hook Integration Flow
1. Claude Code triggers hooks during operation
2. Hooks send POST requests via cURL to `http://localhost:3001/api/webhooks/claude/{HookType}`
3. Backend `HookProcessor` class processes and classifies events
4. Events are stored in memory (temporary - will migrate to Supabase)

### Key Components

**backend/server.js**
- `HookProcessor` class: Event processing and classification engine
- Supported hook types: PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, Stop, SubagentStop, Notification, PreCompact
- API endpoints serve processed events and dashboard statistics

### Event Classification
The `classifyActivity()` method in HookProcessor maps tool usage to semantic activities:
- File operations → 🔍 exploring, 📝 editing, ✏️ writing
- Code execution → 🏃 executing, 🧪 testing
- Web operations → 🌐 fetching, 🔎 searching
- Task management → 📋 planning

### API Response Format
Events include:
- `id`: Unique identifier
- `timestamp`: ISO 8601 format
- `hookType`: Original Claude Code hook type
- `activity`: Classified activity with category, action, and icon
- `sessionId`: Session tracking identifier
- `data`: Original hook payload

## Development Guidelines

### Adding New Features
1. Event classification improvements go in `HookProcessor.classifyActivity()`
2. New API endpoints follow Express.js patterns in server.js
3. Maintain backward compatibility with existing webhook format

### Current Limitations
- Events are stored in memory only (lost on restart)
- No frontend implementation yet
- Uses hardcoded dev authorization token "dev-key-123"
- No database persistence (planned for Phase II with Supabase)

### Planned Architecture Changes
- **Phase II**: Supabase database integration, Vercel deployment
- **Phase III**: Phaser.js visualization engine, agent character system
- **Phase IV**: Full metropolitan visualization with file-to-building mapping

## Hook Configuration

The `.claude/settings.json` file contains webhook configurations for all Claude Code lifecycle events. Each hook sends a cURL POST request with:
- 2-second timeout
- Authorization header with Bearer token
- JSON content type

This configuration must be copied to any Claude Code project you want to monitor.

## Error Handling

The server includes basic error handling:
- Invalid webhook data returns 400
- Server errors return 500
- All errors are logged to console

## Next Development Steps

Priority tasks for Phase II (Database & Cloud):
1. Implement Supabase database schema for event persistence
2. Add WebSocket/SSE for real-time updates
3. Deploy to Vercel Edge Functions
4. Implement proper authentication system