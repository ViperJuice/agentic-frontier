const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Store events in memory with enhanced structure
const events = [];
const sessions = new Map();
const projects = new Map();

// Enhanced Hook event processor
class EnhancedHookProcessor {
  constructor() {
    this.startTime = Date.now();
  }

  processEvent(hookType, rawData) {
    const event = {
      id: events.length + 1,
      hook_type: hookType,
      timestamp: new Date().toISOString(),
      session_id: rawData.session_id,
      project_dir: rawData.cwd,
      transcript_path: rawData.transcript_path,
      raw_data: rawData,
      
      // Enhanced processing
      activity: this.classifyActivity(hookType, rawData),
      file_context: this.extractFileContext(hookType, rawData),
      command_context: this.extractCommandContext(hookType, rawData),
      session_context: this.updateSessionContext(rawData),
      project_context: this.updateProjectContext(rawData)
    };
    
    events.push(event);
    this.logEvent(event);
    
    return event;
  }

  extractFileContext(hookType, data) {
    if (!['PreToolUse', 'PostToolUse'].includes(hookType)) return null;
    
    const toolName = data.tool_name;
    const toolInput = data.tool_input || {};
    
    if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(toolName)) {
      const filePath = toolInput.file_path || '';
      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      const dirPath = path.dirname(filePath);
      
      return {
        file_path: filePath,
        file_name: fileName,
        file_extension: fileExt,
        directory: dirPath,
        file_type: this.classifyFileType(fileExt),
        content_size: toolInput.content ? toolInput.content.length : null,
        is_new_file: hookType === 'PreToolUse' && toolName === 'Write',
        line_count: toolInput.content ? toolInput.content.split('\n').length : null
      };
    }
    
    return null;
  }

  extractCommandContext(hookType, data) {
    if (!['PreToolUse', 'PostToolUse'].includes(hookType)) return null;
    
    const toolName = data.tool_name;
    const toolInput = data.tool_input || {};
    
    if (toolName === 'Bash') {
      const command = toolInput.command || '';
      const parts = command.trim().split(/\s+/);
      const baseCommand = parts[0];
      const args = parts.slice(1);
      
      return {
        full_command: command,
        base_command: baseCommand,
        arguments: args,
        command_type: this.classifyCommandType(baseCommand),
        is_dangerous: this.isDangerousCommand(command),
        estimated_duration: this.estimateCommandDuration(baseCommand),
        working_directory: data.cwd
      };
    }
    
    return null;
  }

  updateSessionContext(data) {
    const sessionId = data.session_id;
    if (!sessionId) return null;

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        id: sessionId,
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        event_count: 0,
        status: 'active',
        project_dir: data.cwd,
        transcript_path: data.transcript_path,
        tools_used: new Set(),
        files_modified: new Set(),
        commands_executed: []
      });
    }

    const session = sessions.get(sessionId);
    session.last_activity_at = new Date().toISOString();
    session.event_count++;

    // Track tools used
    if (data.tool_name) {
      session.tools_used.add(data.tool_name);
    }

    // Track files modified
    if (data.tool_input?.file_path) {
      session.files_modified.add(data.tool_input.file_path);
    }

    // Track commands
    if (data.tool_name === 'Bash' && data.tool_input?.command) {
      session.commands_executed.push({
        command: data.tool_input.command,
        timestamp: new Date().toISOString()
      });
    }

    return {
      session_duration_ms: Date.now() - new Date(session.started_at).getTime(),
      events_in_session: session.event_count,
      tools_used_count: session.tools_used.size,
      files_modified_count: session.files_modified.size,
      commands_executed_count: session.commands_executed.length
    };
  }

  updateProjectContext(data) {
    const projectDir = data.cwd;
    if (!projectDir) return null;

    const projectName = path.basename(projectDir);
    
    if (!projects.has(projectDir)) {
      projects.set(projectDir, {
        name: projectName,
        path: projectDir,
        first_seen: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        total_events: 0,
        active_sessions: new Set(),
        file_operations: { read: 0, write: 0, edit: 0 },
        command_operations: 0
      });
    }

    const project = projects.get(projectDir);
    project.last_activity = new Date().toISOString();
    project.total_events++;
    
    if (data.session_id) {
      project.active_sessions.add(data.session_id);
    }

    // Track operation types
    if (data.tool_name === 'Bash') {
      project.command_operations++;
    } else if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(data.tool_name)) {
      const opType = data.tool_name.toLowerCase();
      if (project.file_operations[opType] !== undefined) {
        project.file_operations[opType]++;
      }
    }

    return {
      project_name: projectName,
      total_events_in_project: project.total_events,
      active_sessions_in_project: project.active_sessions.size,
      project_age_ms: Date.now() - new Date(project.first_seen).getTime()
    };
  }

  classifyActivity(hookType, data) {
    switch (hookType) {
      case 'PreToolUse':
        return this.classifyPreToolUse(data);
      case 'PostToolUse':
        return this.classifyPostToolUse(data);
      case 'UserPromptSubmit':
        return this.classifyUserPrompt(data);
      case 'SessionStart':
        return this.classifySessionStart(data);
      case 'Stop':
      case 'SubagentStop':
        return this.classifyStop(hookType, data);
      case 'Notification':
        return this.classifyNotification(data);
      case 'PreCompact':
        return this.classifyPreCompact(data);
      default:
        return this.classifyUnknown(hookType, data);
    }
  }

  classifyPreToolUse(data) {
    const toolName = data.tool_name;
    const toolInput = data.tool_input || {};
    
    const base = {
      category: 'tool_preparation',
      tool_name: toolName,
      priority: 'high',
      can_block: true
    };

    switch (toolName) {
      case 'Read':
        return {
          ...base,
          action: 'preparing_to_read_file',
          icon: '📖',
          description: `About to read ${path.basename(toolInput.file_path || 'unknown file')}`,
          file_path: toolInput.file_path
        };
        
      case 'Write':
        return {
          ...base,
          action: 'preparing_to_write_file',
          icon: '✏️',
          description: `About to write ${path.basename(toolInput.file_path || 'unknown file')}`,
          file_path: toolInput.file_path,
          content_size: toolInput.content ? toolInput.content.length : 0
        };
        
      case 'Edit':
      case 'MultiEdit':
        return {
          ...base,
          action: 'preparing_to_edit_file',
          icon: '📝',
          description: `About to edit ${path.basename(toolInput.file_path || 'unknown file')}`,
          file_path: toolInput.file_path
        };
        
      case 'Bash':
        const command = toolInput.command || '';
        return {
          ...base,
          action: 'preparing_to_execute_command',
          icon: '⚡',
          description: `About to run: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`,
          command: command,
          command_type: this.classifyCommandType(command.split(' ')[0])
        };
        
      case 'WebFetch':
        return {
          ...base,
          action: 'preparing_to_fetch_url',
          icon: '🌐',
          description: `About to fetch ${toolInput.url || 'unknown URL'}`,
          url: toolInput.url
        };
        
      case 'WebSearch':
        return {
          ...base,
          action: 'preparing_to_search_web',
          icon: '🔍',
          description: `About to search for "${toolInput.query || 'unknown'}"`,
          query: toolInput.query
        };
        
      default:
        return {
          ...base,
          action: 'preparing_unknown_tool',
          icon: '🔧',
          description: `About to use ${toolName}`
        };
    }
  }

  classifyPostToolUse(data) {
    const toolName = data.tool_name;
    const toolResponse = data.tool_response || {};
    const success = toolResponse.success !== false;
    
    const base = {
      category: 'tool_completion',
      tool_name: toolName,
      success: success,
      priority: success ? 'high' : 'critical'
    };

    if (!success) {
      return {
        ...base,
        action: 'tool_failed',
        icon: '❌',
        description: `Failed to complete ${toolName}`,
        error: toolResponse.error || 'Unknown error'
      };
    }

    switch (toolName) {
      case 'Read':
        return {
          ...base,
          action: 'completed_file_read',
          icon: '✅',
          description: `Successfully read file`,
          content_size: toolResponse.content ? toolResponse.content.length : 0
        };
        
      case 'Write':
        return {
          ...base,
          action: 'completed_file_write',
          icon: '💾',
          description: `Successfully wrote file`,
          file_path: toolResponse.filePath
        };
        
      case 'Edit':
      case 'MultiEdit':
        return {
          ...base,
          action: 'completed_file_edit',
          icon: '📝',
          description: `Successfully edited file`,
          file_path: toolResponse.filePath
        };
        
      case 'Bash':
        return {
          ...base,
          action: 'completed_command_execution',
          icon: '⚡',
          description: `Command completed`,
          exit_code: toolResponse.exitCode || 0,
          output_size: toolResponse.stdout ? toolResponse.stdout.length : 0
        };
        
      default:
        return {
          ...base,
          action: 'completed_unknown_tool',
          icon: '✅',
          description: `Completed ${toolName}`
        };
    }
  }

  classifyUserPrompt(data) {
    const prompt = data.prompt || '';
    const wordCount = prompt.split(/\s+/).length;
    
    return {
      category: 'user_interaction',
      action: 'submit_prompt',
      icon: '💬',
      description: `User submitted prompt (${wordCount} words)`,
      prompt_length: prompt.length,
      word_count: wordCount,
      priority: 'high',
      contains_code: /```/.test(prompt),
      contains_file_mention: /\.(js|py|ts|html|css|md|json|yaml|yml)/.test(prompt)
    };
  }

  classifySessionStart(data) {
    const source = data.source || 'unknown';
    
    return {
      category: 'session_lifecycle',
      action: `session_start_${source}`,
      icon: source === 'startup' ? '🚀' : '🔄',
      description: `Session started (${source})`,
      source: source,
      priority: 'high'
    };
  }

  classifyStop(hookType, data) {
    return {
      category: hookType === 'SubagentStop' ? 'subagent_lifecycle' : 'agent_lifecycle',
      action: hookType === 'SubagentStop' ? 'subagent_stop' : 'agent_stop',
      icon: hookType === 'SubagentStop' ? '🤖' : '⏹️',
      description: `${hookType === 'SubagentStop' ? 'Subagent' : 'Agent'} stopped`,
      priority: 'medium',
      stop_hook_active: data.stop_hook_active
    };
  }

  classifyNotification(data) {
    const message = data.message || '';
    
    return {
      category: 'system_notification',
      action: 'notify',
      icon: '🔔',
      description: message,
      message: message,
      priority: 'low',
      notification_type: this.classifyNotificationType(message)
    };
  }

  classifyPreCompact(data) {
    const trigger = data.trigger || 'unknown';
    
    return {
      category: 'memory_management',
      action: `compact_${trigger}`,
      icon: '🗜️',
      description: `Memory compaction (${trigger})`,
      trigger: trigger,
      priority: 'medium',
      custom_instructions: data.custom_instructions
    };
  }

  classifyUnknown(hookType, data) {
    return {
      category: 'unknown',
      action: 'unknown_hook',
      icon: '❓',
      description: `Unknown hook: ${hookType}`,
      priority: 'low'
    };
  }

  // Utility classification methods
  classifyFileType(extension) {
    const types = {
      '.js': 'javascript',
      '.ts': 'typescript', 
      '.py': 'python',
      '.html': 'html',
      '.css': 'css',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.txt': 'text',
      '.log': 'log'
    };
    return types[extension] || 'unknown';
  }

  classifyCommandType(command) {
    const types = {
      'git': 'version_control',
      'npm': 'package_manager',
      'pip': 'package_manager',
      'yarn': 'package_manager',
      'docker': 'containerization',
      'kubectl': 'kubernetes',
      'terraform': 'infrastructure',
      'ls': 'file_system',
      'cd': 'navigation',
      'mkdir': 'file_system',
      'rm': 'file_system',
      'cp': 'file_system',
      'mv': 'file_system',
      'cat': 'file_system',
      'grep': 'search',
      'find': 'search',
      'curl': 'network',
      'wget': 'network'
    };
    return types[command] || 'unknown';
  }

  isDangerousCommand(command) {
    const dangerous = ['rm -rf', 'sudo rm', 'format', 'del /f', '> /dev/null'];
    return dangerous.some(pattern => command.includes(pattern));
  }

  estimateCommandDuration(command) {
    const durations = {
      'npm install': 'long',
      'pip install': 'medium',
      'git clone': 'medium',
      'docker build': 'long',
      'terraform apply': 'long',
      'ls': 'instant',
      'cd': 'instant',
      'cat': 'instant'
    };
    return durations[command] || 'short';
  }

  classifyNotificationType(message) {
    if (message.includes('permission')) return 'permission_request';
    if (message.includes('waiting')) return 'waiting_for_input';
    if (message.includes('error')) return 'error';
    return 'general';
  }

  logEvent(event) {
    const session = event.session_id ? event.session_id.substring(0, 8) : 'unknown';
    const project = event.project_context?.project_name || 'unknown';
    
    console.log(`📨 ${event.hook_type} | ${event.activity.action} | ${project} | Session: ${session}`);
    
    if (event.activity.description) {
      console.log(`   └─ ${event.activity.description}`);
    }
  }
}

const processor = new EnhancedHookProcessor();

// Hook endpoints remain the same
const hookTypes = [
  'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 
  'Stop', 'SubagentStop', 'SessionStart', 
  'Notification', 'PreCompact'
];

hookTypes.forEach(hookType => {
  app.post(`/api/webhooks/claude/${hookType}`, (req, res) => {
    try {
      const event = processor.processEvent(hookType, req.body);
      res.json({ success: true, event_id: event.id });
    } catch (error) {
      console.error(`Error processing ${hookType}:`, error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
});

// Enhanced API endpoints
app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ 
    events: events.slice(-limit),
    total: events.length
  });
});

app.get('/api/events/detailed', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const detailedEvents = events.slice(-limit).map(event => ({
    ...event,
    // Convert Sets to Arrays for JSON serialization
    session_summary: sessions.get(event.session_id) ? {
      ...Object.fromEntries(
        Object.entries(sessions.get(event.session_id)).map(([k, v]) => 
          [k, v instanceof Set ? Array.from(v) : v]
        )
      )
    } : null
  }));
  
  res.json({ 
    events: detailedEvents,
    total: events.length
  });
});

app.get('/api/sessions', (req, res) => {
  const sessionArray = Array.from(sessions.values()).map(session => ({
    ...session,
    tools_used: Array.from(session.tools_used),
    files_modified: Array.from(session.files_modified)
  }));
  
  res.json({ 
    sessions: sessionArray,
    active_count: sessionArray.filter(s => s.status === 'active').length
  });
});

app.get('/api/projects', (req, res) => {
  const projectArray = Array.from(projects.values()).map(project => ({
    ...project,
    active_sessions: Array.from(project.active_sessions)
  }));
  
  res.json({ 
    projects: projectArray,
    total_projects: projectArray.length
  });
});

app.get('/api/dashboard', (req, res) => {
  const recentEvents = events.slice(-10);
  const activeSessions = Array.from(sessions.values()).filter(s => s.status === 'active');
  const activeProjects = Array.from(projects.values()).filter(p => p.active_sessions.size > 0);
  
  res.json({
    recent_events: recentEvents,
    stats: {
      total_events: events.length,
      active_sessions: activeSessions.length,
      active_projects: activeProjects.length,
      hook_types: [...new Set(events.map(e => e.hook_type))],
      tools_used: [...new Set(events.map(e => e.activity.tool_name).filter(Boolean))],
      file_operations: events.filter(e => e.file_context).length,
      command_operations: events.filter(e => e.command_context).length
    },
    active_sessions: activeSessions.map(s => ({
      ...s,
      tools_used: Array.from(s.tools_used),
      files_modified: Array.from(s.files_modified)
    })),
    active_projects: activeProjects.map(p => ({
      ...p,
      active_sessions: Array.from(p.active_sessions)
    }))
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    events_received: events.length,
    active_sessions: Array.from(sessions.values()).filter(s => s.status === 'active').length,
    uptime: process.uptime(),
    memory_usage: process.memoryUsage()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Agentic Frontier - Enhanced Hook Processing API',
    endpoints: {
      dashboard: '/api/dashboard',
      events: '/api/events',
      detailed_events: '/api/events/detailed',
      sessions: '/api/sessions',
      projects: '/api/projects',
      health: '/api/health'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Agentic Frontier Enhanced API running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`🔍 Detailed Events: http://localhost:${PORT}/api/events/detailed`);
  console.log(`📋 Sessions: http://localhost:${PORT}/api/sessions`);
  console.log(`🏗️ Projects: http://localhost:${PORT}/api/projects`);
  console.log(`💓 Health: http://localhost:${PORT}/api/health`);
  console.log(`🎯 Ready to receive enhanced Claude Code hooks!`);
});