// Enhanced Agentic Frontier Backend with Supabase Integration & Real-time
// Builds upon the existing Phase I foundation with persistent storage and SSE

require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Initialize Supabase client
const supabase = process.env.SUPABASE_URL ? createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
) : null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.API_KEY || 'dev-key-123';
  
  if (req.path.startsWith('/api/webhooks/claude/') && authHeader !== `Bearer ${expectedKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use(authenticate);

// In-memory cache (kept for performance and fallback)
const memoryStore = {
  events: [],
  sessions: new Map(),
  projects: new Map()
};

// SSE clients management
const sseClients = new Set();

// Server statistics
const serverStats = {
  startTime: new Date(),
  eventsProcessed: 0,
  dbWrites: 0,
  dbErrors: 0,
  lastEventTime: null
};

// =====================================================
// ENHANCED HOOK PROCESSOR WITH SUPABASE
// =====================================================

class EnhancedHookProcessor {
  constructor() {
    this.startTime = Date.now();
    this.eventQueue = [];
    this.processing = false;
  }

  async processEvent(hookType, rawData) {
    // Create base event structure (keeping your existing logic)
    const event = {
      id: memoryStore.events.length + 1,
      hook_type: hookType,
      timestamp: new Date().toISOString(),
      session_id: rawData.session_id,
      project_dir: rawData.cwd || rawData.project_dir,  // Handle both field names
      transcript_path: rawData.transcript_path,
      raw_data: rawData,
      
      // Enhanced processing (keeping all your existing classification logic)
      activity: this.classifyActivity(hookType, rawData),
      file_context: this.extractFileContext(hookType, rawData),
      command_context: this.extractCommandContext(hookType, rawData),
      session_context: await this.updateSessionContext(rawData),
      project_context: await this.updateProjectContext(rawData)
    };
    
    // Store in memory (immediate response)
    memoryStore.events.push(event);
    
    // Queue for async database storage
    this.queueDatabaseWrite(event);
    
    // Broadcast to SSE clients
    this.broadcastToSSE(event);
    
    // Log the event
    this.logEvent(event);
    
    serverStats.eventsProcessed++;
    serverStats.lastEventTime = new Date();
    
    return event;
  }

  async queueDatabaseWrite(event) {
    if (!supabase) return;
    
    this.eventQueue.push(event);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.processing = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      
      try {
        await this.persistToDatabase(event);
        serverStats.dbWrites++;
      } catch (error) {
        console.error('Database write error:', error);
        serverStats.dbErrors++;
        // Re-queue on error (with limit to prevent infinite loop)
        if (!event.retryCount || event.retryCount < 3) {
          event.retryCount = (event.retryCount || 0) + 1;
          this.eventQueue.push(event);
        }
      }
    }
    
    this.processing = false;
  }

  async persistToDatabase(event) {
    if (!supabase) return;

    try {
      // Ensure project exists
      const project = await this.ensureProject(event);
      
      // Ensure session exists
      const session = await this.ensureSession(event, project);
      
      // Check if session and project exist
      if (!session || !session.id) {
        console.warn("Session not found or invalid, skipping database write");
        return;
      }
      if (!project || !project.id) {
        console.warn("Project not found or invalid, skipping database write");
        return;
      }

      // Store the event
      const { data: activityEvent, error: eventError } = await supabase
        .from('activity_events')
        .insert({
          session_id: session.id,
          project_id: project.id,
          event_type: event.hook_type,
          tool_name: event.raw_data.tool_name,
          activity_type: event.activity.category,
          activity_description: event.activity.description,
          priority: event.activity.priority || 'normal',
          status: event.activity.success === false ? 'failure' : 'success',
          raw_input: event.raw_data,
          tool_input: event.raw_data.tool_input,
          tool_response: event.raw_data.tool_response,
          file_context: event.file_context,
          command_context: event.command_context,
          error_context: event.activity.error ? { error: event.activity.error } : null
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Update agent character if needed
      if (event.activity.icon && session) {
        await this.updateAgentCharacter(session.id, event);
      }

      // Update file records for file operations
      if (event.file_context && project) {
        await this.updateFileRecord(project.id, event.file_context, session.id);
      }

    } catch (error) {
      console.error('Database persistence error:', error);
      throw error;
    }
  }

  async ensureProject(event) {
    // Get the project path from either cwd or project_dir
    const projectPath = event.project_dir || event.cwd || event.raw_data?.cwd || event.raw_data?.project_dir;
    
    // Check if we have required data
    if (!supabase || !projectPath) {
      return null;
    }

    const projectName = path.basename(projectPath);

    // Check cache first
    if (memoryStore.projects.has(projectPath)) {
      const cachedProject = memoryStore.projects.get(projectPath);
      
      // Only return cached project if it has database ID
      if (cachedProject.id) {
        return cachedProject;
      }
      // If no database ID, continue to database lookup/creation
    }

    try {
      // Check if project exists in database
      let { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('path', projectPath)
        .single();

      if (error && error.code === 'PGRST116') {
        // Project doesn't exist, create it
        const { data: newProject, error: createError } = await supabase
          .from('projects')
          .insert({
            name: projectName,
            path: projectPath,
            description: `Claude Code project at ${projectPath}`
          })
          .select()
          .single();

        if (createError) throw createError;
        project = newProject;
      } else if (error) {
        throw error;
      }

      // Cache the project - merge with existing memory properties
      const existingProject = memoryStore.projects.get(projectPath);
      if (existingProject) {
        // Preserve memory-only properties, update database fields
        Object.assign(existingProject, project);
        // Ensure required memory properties exist
        if (!existingProject.active_sessions) existingProject.active_sessions = new Set();
        if (!existingProject.file_operations) existingProject.file_operations = { read: 0, write: 0, edit: 0 };
        if (existingProject.command_operations === undefined) existingProject.command_operations = 0;
      } else {
        // First time - add expected memory properties
        memoryStore.projects.set(projectPath, {
          ...project,
          active_sessions: new Set(),
          file_operations: { read: 0, write: 0, edit: 0 },
          command_operations: 0,
          total_events: 0,
          first_seen: new Date().toISOString(),
          last_activity: new Date().toISOString()
        });
      }
      
      return project;

    } catch (error) {
      console.error('Error ensuring project:', error);
      return null;
    }
  }

  async ensureSession(event, project) {
    if (!supabase || !event.session_id) {
      return null;
    }

    const sessionId = event.session_id;

    // Check cache first
    if (memoryStore.sessions.has(sessionId)) {
      const cachedSession = memoryStore.sessions.get(sessionId);
      
      // Only return cached dbRecord if it actually exists
      if (cachedSession.dbRecord) {
        return cachedSession.dbRecord;
      }
      // If no dbRecord, continue to database lookup/creation
    }

    try {
      // Check if session exists in database
      let { data: session, error } = await supabase
        .from('agent_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Session doesn't exist, create it
        const { data: newSession, error: createError } = await supabase
          .from('agent_sessions')
          .insert({
            session_id: sessionId,
            project_id: project?.id,
            transcript_path: event.transcript_path,
            agent_type: 'main'
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }
        
        session = newSession;

        // Create agent character for visualization
        if (session) {
          await this.createAgentCharacter(session.id);
        }
      } else if (error) {
        throw error;
      }

      // Update cache
      if (!memoryStore.sessions.has(sessionId)) {
        memoryStore.sessions.set(sessionId, {
          id: sessionId,
          dbRecord: session,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          event_count: 0,
          status: 'active',
          project_dir: event.project_dir || event.cwd || event.raw_data?.cwd || event.raw_data?.project_dir,
          transcript_path: event.transcript_path,
          tools_used: new Set(),
          files_modified: new Set(),
          commands_executed: []
        });
      } else {
        memoryStore.sessions.get(sessionId).dbRecord = session;
      }

      return session;

    } catch (error) {
      console.error('Error ensuring session:', error);
      return null;
    }
  }

  async createAgentCharacter(sessionId) {
    if (!supabase) return;

    try {
      const names = ['Claude', 'Agent', 'Dev', 'Coder', 'Builder'];
      const randomName = names[Math.floor(Math.random() * names.length)];

      await supabase
        .from('agent_characters')
        .insert({
          session_id: sessionId,
          name: randomName,
          avatar_type: 'default',
          position: { x: Math.random() * 1000, y: 0, z: Math.random() * 1000 },
          status: 'idle'
        });
    } catch (error) {
      console.error('Error creating agent character:', error);
    }
  }

  async updateAgentCharacter(sessionId, event) {
    if (!supabase) return;

    try {
      await supabase
        .from('agent_characters')
        .update({
          current_action: event.activity.action,
          status: event.activity.category === 'tool_completion' ? 'working' : 'thinking',
          speech_bubble: event.activity.description,
          last_updated: new Date().toISOString()
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error updating agent character:', error);
    }
  }

  async updateFileRecord(projectId, fileContext, sessionId) {
    if (!supabase || !fileContext.file_path) return;

    try {
      const { data: existingFile } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .eq('path', fileContext.file_path)
        .single();

      if (existingFile) {
        // Update existing file
        await supabase
          .from('files')
          .update({
            size_bytes: fileContext.content_size || existingFile.size_bytes,
            lines_count: fileContext.line_count || existingFile.lines_count,
            last_modified_at: new Date().toISOString(),
            last_modified_by: sessionId
          })
          .eq('id', existingFile.id);
      } else {
        // Create new file record
        await supabase
          .from('files')
          .insert({
            project_id: projectId,
            path: fileContext.file_path,
            name: fileContext.file_name,
            extension: fileContext.file_extension,
            size_bytes: fileContext.content_size || 0,
            lines_count: fileContext.line_count || 0,
            building_type: this.determineBuildingType(fileContext.file_extension),
            building_height: Math.floor(Math.random() * 10) + 1,
            position: { 
              x: Math.random() * 500 - 250, 
              y: Math.random() * 500 - 250 
            },
            last_modified_by: sessionId
          });
      }
    } catch (error) {
      console.error('Error updating file record:', error);
    }
  }

  determineBuildingType(extension) {
    const buildingTypes = {
      '.js': 'skyscraper',
      '.ts': 'skyscraper',
      '.py': 'factory',
      '.html': 'house',
      '.css': 'house',
      '.json': 'warehouse',
      '.md': 'library',
      '.yaml': 'warehouse',
      '.yml': 'warehouse'
    };
    return buildingTypes[extension] || 'office';
  }

  broadcastToSSE(event) {
    const message = JSON.stringify({
      type: 'new_event',
      data: event
    });

    sseClients.forEach(client => {
      client.write(`data: ${message}\n\n`);
    });
  }

  // Keep all existing classification methods from your original code
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
        working_directory: data.cwd || data.project_dir
      };
    }
    
    return null;
  }

  async updateSessionContext(data) {
    const sessionId = data.session_id;
    if (!sessionId) return null;

    if (!memoryStore.sessions.has(sessionId)) {
      memoryStore.sessions.set(sessionId, {
        id: sessionId,
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        event_count: 0,
        status: 'active',
        project_dir: data.project_dir || data.cwd || data.raw_data?.cwd || data.raw_data?.project_dir,
        transcript_path: data.transcript_path,
        tools_used: new Set(),
        files_modified: new Set(),
        commands_executed: []
      });
    }

    const session = memoryStore.sessions.get(sessionId);
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

  async updateProjectContext(data) {
    // Use same path resolution logic as ensureProject
    const projectDir = data.project_dir || data.cwd || data.raw_data?.cwd || data.raw_data?.project_dir;
    if (!projectDir) return null;

    const projectName = path.basename(projectDir);
    
    if (!memoryStore.projects.has(projectDir)) {
      memoryStore.projects.set(projectDir, {
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

    const project = memoryStore.projects.get(projectDir);
    
    // Safety check to ensure project exists
    if (!project) {
      console.error('Project not found in cache:', { projectDir });
      return null;
    }
    
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

  // Include all classification methods from your original code
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
    
    if (supabase) {
      console.log(`   └─ 💾 Queued for database`);
    }
  }
}

const processor = new EnhancedHookProcessor();

// =====================================================
// HOOK ENDPOINTS (keeping your existing structure)
// =====================================================

const hookTypes = [
  'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 
  'Stop', 'SubagentStop', 'SessionStart', 
  'Notification', 'PreCompact'
];

hookTypes.forEach(hookType => {
  app.post(`/api/webhooks/claude/${hookType}`, async (req, res) => {
    try {
      const event = await processor.processEvent(hookType, req.body);
      res.json({ success: true, event_id: event.id });
    } catch (error) {
      console.error(`Error processing ${hookType}:`, error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
});

// =====================================================
// REAL-TIME SSE ENDPOINT
// =====================================================

app.get('/api/events/stream', (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Add client to set
  sseClients.add(res);

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// =====================================================
// ENHANCED API ENDPOINTS WITH DATABASE SUPPORT
// =====================================================

// Get events (from memory or database)
app.get('/api/events', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  
  if (supabase && req.query.from === 'db') {
    try {
      const { data: events, error } = await supabase
        .from('activity_events')
        .select(`
          *,
          agent_sessions(session_id, status),
          projects(name, path)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      res.json({ events, total: events.length, source: 'database' });
    } catch (error) {
      console.error('Database query error:', error);
      res.status(500).json({ error: 'Database query failed' });
    }
  } else {
    // Fallback to memory
    res.json({ 
      events: memoryStore.events.slice(-limit),
      total: memoryStore.events.length,
      source: 'memory'
    });
  }
});

// Get detailed events
app.get('/api/events/detailed', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  if (supabase && req.query.from === 'db') {
    try {
      const { data: events, error } = await supabase
        .from('activity_events')
        .select(`
          *,
          agent_sessions(*),
          projects(*)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      res.json({ events, total: events.length, source: 'database' });
    } catch (error) {
      console.error('Database query error:', error);
      res.status(500).json({ error: 'Database query failed' });
    }
  } else {
    // Fallback to memory with session details
    const detailedEvents = memoryStore.events.slice(-limit).map(event => ({
      ...event,
      session_summary: memoryStore.sessions.get(event.session_id) ? {
        ...Object.fromEntries(
          Object.entries(memoryStore.sessions.get(event.session_id)).map(([k, v]) => 
            [k, v instanceof Set ? Array.from(v) : v]
          )
        )
      } : null
    }));
    
    res.json({ 
      events: detailedEvents,
      total: memoryStore.events.length,
      source: 'memory'
    });
  }
});

// Get sessions
app.get('/api/sessions', async (req, res) => {
  if (supabase && req.query.from === 'db') {
    try {
      const { data: sessions, error } = await supabase
        .from('agent_sessions')
        .select(`
          *,
          projects(name, path),
          _count:activity_events(count)
        `)
        .order('started_at', { ascending: false });

      if (error) throw error;
      res.json({ sessions, source: 'database' });
    } catch (error) {
      console.error('Database query error:', error);
      res.status(500).json({ error: 'Database query failed' });
    }
  } else {
    const sessionArray = Array.from(memoryStore.sessions.values()).map(session => ({
      ...session,
      tools_used: Array.from(session.tools_used),
      files_modified: Array.from(session.files_modified)
    }));
    
    res.json({ 
      sessions: sessionArray,
      active_count: sessionArray.filter(s => s.status === 'active').length,
      source: 'memory'
    });
  }
});

// Get projects
app.get('/api/projects', async (req, res) => {
  if (supabase && req.query.from === 'db') {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          *,
          agent_sessions(id, status),
          files(count)
        `)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      res.json({ projects, source: 'database' });
    } catch (error) {
      console.error('Database query error:', error);
      res.status(500).json({ error: 'Database query failed' });
    }
  } else {
    const projectArray = Array.from(memoryStore.projects.values()).map(project => ({
      ...project,
      active_sessions: Array.from(project.active_sessions)
    }));
    
    res.json({ 
      projects: projectArray,
      total_projects: projectArray.length,
      source: 'memory'
    });
  }
});

// Enhanced dashboard with database support
app.get('/api/dashboard', async (req, res) => {
  const recentEvents = memoryStore.events.slice(-10);
  const activeSessions = Array.from(memoryStore.sessions.values()).filter(s => s.status === 'active');
  const activeProjects = Array.from(memoryStore.projects.values()).filter(p => p.active_sessions.size > 0);
  
  const dashboard = {
    recent_events: recentEvents,
    stats: {
      total_events: memoryStore.events.length,
      active_sessions: activeSessions.length,
      active_projects: activeProjects.length,
      hook_types: [...new Set(memoryStore.events.map(e => e.hook_type))],
      tools_used: [...new Set(memoryStore.events.map(e => e.activity.tool_name).filter(Boolean))],
      file_operations: memoryStore.events.filter(e => e.file_context).length,
      command_operations: memoryStore.events.filter(e => e.command_context).length,
      database_connected: !!supabase,
      database_writes: serverStats.dbWrites,
      database_errors: serverStats.dbErrors
    },
    active_sessions: activeSessions.map(s => ({
      ...s,
      tools_used: Array.from(s.tools_used),
      files_modified: Array.from(s.files_modified)
    })),
    active_projects: activeProjects.map(p => ({
      ...p,
      active_sessions: Array.from(p.active_sessions)
    })),
    server: {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      events_processed: serverStats.eventsProcessed,
      last_event_time: serverStats.lastEventTime,
      sse_clients: sseClients.size
    }
  };
  
  res.json(dashboard);
});

// Health check with database status
app.get('/api/health', async (req, res) => {
  let dbStatus = 'not_configured';
  
  if (supabase) {
    try {
      const { count, error } = await supabase
        .from('activity_events')
        .select('*', { count: 'exact', head: true });
      
      dbStatus = error ? 'error' : 'connected';
    } catch {
      dbStatus = 'error';
    }
  }
  
  res.json({ 
    status: 'healthy',
    events_received: memoryStore.events.length,
    active_sessions: Array.from(memoryStore.sessions.values()).filter(s => s.status === 'active').length,
    uptime: process.uptime(),
    memory_usage: process.memoryUsage(),
    database: {
      status: dbStatus,
      writes: serverStats.dbWrites,
      errors: serverStats.dbErrors
    },
    realtime: {
      sse_clients: sseClients.size
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Agentic Frontier - Enhanced Hook Processing API with Supabase',
    version: '2.0.0',
    features: [
      'Real-time Claude Code hook processing',
      'Supabase database persistence',
      'Server-Sent Events (SSE) for real-time updates',
      'Session and project tracking',
      'Agent character visualization support',
      'File-to-building mapping'
    ],
    endpoints: {
      dashboard: '/api/dashboard',
      events: '/api/events',
      detailed_events: '/api/events/detailed',
      event_stream: '/api/events/stream (SSE)',
      sessions: '/api/sessions',
      projects: '/api/projects',
      health: '/api/health'
    },
    database: {
      connected: !!supabase,
      status: supabase ? 'Check /api/health for details' : 'Not configured'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Agentic Frontier Enhanced API v2.0 running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`🔍 Detailed Events: http://localhost:${PORT}/api/events/detailed`);
  console.log(`📋 Sessions: http://localhost:${PORT}/api/sessions`);
  console.log(`🏗️ Projects: http://localhost:${PORT}/api/projects`);
  console.log(`📡 Real-time Stream: http://localhost:${PORT}/api/events/stream`);
  console.log(`💓 Health: http://localhost:${PORT}/api/health`);
  
  if (supabase) {
    console.log(`✅ Supabase database connected`);
    console.log(`💾 Events will be persisted to database`);
  } else {
    console.log(`⚠️ Supabase not configured - using in-memory storage only`);
    console.log(`   Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local`);
  }
  
  console.log(`🎯 Ready to receive enhanced Claude Code hooks!`);
});