import {
  HookType,
  BaseHookData,
  SessionStartData,
  ToolUseData,
  UserPromptData,
  StopData,
  NotificationData,
  CompactData,
  Activity,
  AgentType,
  WorkingScope,
  ToolName
} from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { FileService } from '../services/FileService';
import { SSEService } from '../services/SSEService';
import { TreeSitterService } from '../services/TreeSitterService';
import { logWithTimestamp } from '../utils';

export class HookProcessor {
  private databaseService: DatabaseService;
  private fileService: FileService;
  private sseService: SSEService;
  private treeService: TreeSitterService;

  constructor(
    databaseService: DatabaseService,
    fileService: FileService,
    sseService: SSEService,
    treeService: TreeSitterService
  ) {
    this.databaseService = databaseService;
    this.fileService = fileService;
    this.sseService = sseService;
    this.treeService = treeService;
  }

  async processHook(hookType: HookType, data: BaseHookData): Promise<Activity | null> {
    logWithTimestamp(`Processing ${hookType} hook`);
    
    const sessionId = data.session_id || 'unknown';
    
    // Track session
    await this.trackSession(sessionId, hookType, data);
    
    // Process based on hook type
    const activity = await this.processHookType(hookType, data);
    
    // Store activity event
    if (activity) {
      await this.databaseService.storeActivityEvent(sessionId, hookType, activity, data);
      
      // Track file operations
      if (hookType === 'PostToolUse') {
        const toolData = data as ToolUseData;
        if (['Write', 'Edit', 'MultiEdit'].includes(toolData.tool_name)) {
          await this.handleFileOperation(toolData, sessionId);
        }
      }
      
      // Broadcast to SSE clients
      this.sseService.broadcastUpdate({
        type: 'activity',
        hookType,
        sessionId,
        activity
      });
    }
    
    return activity;
  }

  private async processHookType(hookType: HookType, data: BaseHookData): Promise<Activity | null> {
    switch (hookType) {
      case 'SessionStart':
        return await this.handleSessionStart(data as SessionStartData);
      
      case 'PreToolUse':
      case 'PostToolUse':
        return await this.handleToolUse(hookType, data as ToolUseData);
      
      case 'UserPromptSubmit':
        return this.handleUserPrompt(data as UserPromptData);
      
      case 'Stop':
      case 'SubagentStop':
        return this.handleStop(hookType, data as StopData);
      
      case 'Notification':
        return this.handleNotification(data as NotificationData);
      
      case 'PreCompact':
        return this.handleCompact(data as CompactData);
      
      default:
        return {
          category: 'unknown',
          action: hookType,
          icon: '❓',
          details: {}
        };
    }
  }

  private async handleSessionStart(data: SessionStartData): Promise<Activity> {
    const sessionId = data.session_id!;
    
    // Create or update agent session
    const agent = await this.databaseService.upsertAgentSession({
      session_id: sessionId,
      status: 'active',
      started_at: new Date().toISOString(),
      transcript_path: data.transcript_path,
      source: data.source || 'startup'
    });
    
    if (agent) {
      // Create agent character for visualization
      await this.databaseService.createAgentCharacter(sessionId);
    }
    
    return {
      category: 'lifecycle',
      action: 'session_start',
      icon: '🚀',
      details: {
        source: data.source,
        transcript: data.transcript_path
      }
    };
  }

  private async handleToolUse(hookType: HookType, data: ToolUseData): Promise<Activity> {
    const toolName = data.tool_name;
    const toolInput = data.tool_input || {};
    const isPost = hookType === 'PostToolUse';
    
    let activity: Activity = {
      category: 'tool',
      action: toolName.toLowerCase(),
      icon: this.getToolIcon(toolName),
      details: {}
    };
    
    switch (toolName) {
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
        activity.category = 'code';
        activity.action = isPost ? 'modified' : 'modifying';
        activity.details = {
          file: toolInput.file_path || toolInput.files,
          lines: null
        };
        
        if (isPost && data.session_id) {
          await this.fileService.updateFile(toolInput.file_path, data.session_id);
        }
        break;
      
      case 'Read':
      case 'Glob':
      case 'Grep':
        activity.category = 'exploration';
        activity.action = isPost ? 'explored' : 'exploring';
        activity.details = {
          target: toolInput.file_path || toolInput.pattern || toolInput.query
        };
        
        if (isPost && toolInput.file_path && data.session_id) {
          await this.fileService.markFileExplored(toolInput.file_path, data.session_id);
        }
        break;
      
      case 'Bash':
        activity.category = 'command';
        activity.action = isPost ? 'executed' : 'executing';
        activity.details = {
          command: toolInput.command,
          description: toolInput.description
        };
        break;
      
      case 'Task':
        activity.category = 'delegation';
        activity.action = isPost ? 'completed' : 'delegating';
        activity.details = {
          task: toolInput.prompt || toolInput.description || 'Subagent task',
          subagent_type: toolInput.subagent_type || this.determineAgentType(toolInput)
        };
        
        if (!isPost && data.session_id) {
          const subagentData = {
            session_id: data.session_id,
            agent_type: this.determineAgentType(toolInput),
            working_scope: this.determineScope(toolInput),
            scope_target: toolInput.file_path || toolInput.search_path || null,
            task_description: toolInput.prompt || toolInput.description
          };
          
          this.sseService.broadcastUpdate({
            type: 'subagent_spawned',
            data: subagentData
          });
        }
        break;
    }
    
    return activity;
  }

  private async handleFileOperation(data: ToolUseData, sessionId: string): Promise<void> {
    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path;

    if (!filePath) return;

    const file = await this.fileService.updateFile(filePath, sessionId);

    if (!file) {
      console.error(`[File Operation] Failed to update file record for ${filePath}`);
      return;
    }

    // Parse file structures with TreeSitter
    try {
      const structures = await this.treeService.parseFile(file);

      if (structures && structures.length > 0) {
        // Store structures in database
        const structuresForDB = structures.map(s => ({
          file_id: file.id,
          project_id: file.project_id,
          session_id: sessionId,
          name: s.name,
          type: s.type,
          visibility: s.visibility,
          is_async: s.is_async,
          is_static: s.is_static,
          is_abstract: s.is_abstract,
          start_line: s.start_line,
          end_line: s.end_line,
          start_column: s.start_column,
          end_column: s.end_column,
          parameters: s.parameters as any,
          return_type: s.return_type,
          decorators: s.decorators as any,
          docstring: s.docstring,
          complexity_score: s.complexity_score,
          parent_structure_id: s.parent_id,
          depth: s.depth,
          district_x: s.district_x,
          district_y: s.district_y,
          building_type: s.building_type,
          building_color: s.building_color,
          building_size: s.building_size
        }));

        await this.databaseService.storeCodeStructures(structuresForDB, file.id);

        // Broadcast to frontend via SSE
        this.sseService.broadcastUpdate({
          type: 'structures_updated',
          file: file,
          structures: structures
        });

        logWithTimestamp(`[TreeSitter] Parsed ${filePath}: ${structures.length} structures found`);
      } else {
        // No structures found or unsupported file type - mark as parsed anyway
        await this.fileService.markFileNeedsStructureUpdate(file.id);
        logWithTimestamp(`[TreeSitter] No structures found in ${filePath}`);
      }
    } catch (error) {
      console.error(`[TreeSitter] Error parsing ${filePath}:`, error);
      await this.fileService.markFileNeedsStructureUpdate(file.id);
    }
  }

  private handleUserPrompt(data: UserPromptData): Activity {
    return {
      category: 'interaction',
      action: 'prompt_submitted',
      icon: '💬',
      details: {
        prompt: data.prompt?.slice(0, 100) + '...'
      }
    };
  }

  private handleStop(hookType: HookType, data: StopData): Activity {
    return {
      category: 'lifecycle',
      action: hookType.toLowerCase(),
      icon: hookType === 'Stop' ? '🏁' : '🔚',
      details: {
        stop_hook_active: data.stop_hook_active
      }
    };
  }

  private handleNotification(data: NotificationData): Activity {
    return {
      category: 'system',
      action: 'notification',
      icon: '🔔',
      details: {
        message: data.message
      }
    };
  }

  private handleCompact(data: CompactData): Activity {
    return {
      category: 'system',
      action: 'memory_compact',
      icon: '🗜️',
      details: {
        trigger: data.trigger,
        custom_instructions: data.custom_instructions
      }
    };
  }

  private async trackSession(sessionId: string, hookType: HookType, _data: BaseHookData): Promise<void> {
    await this.databaseService.updateSessionActivity(
      sessionId,
      hookType === 'Stop' ? 'completed' : 'active'
    );
  }

  private determineAgentType(toolInput: any): AgentType {
    const prompt = (toolInput.prompt || '').toLowerCase();
    const description = (toolInput.description || '').toLowerCase();
    const combined = prompt + ' ' + description;
    
    if (combined.includes('search') || combined.includes('find') || 
        combined.includes('explore') || combined.includes('understand') ||
        combined.includes('locate') || combined.includes('identify')) {
      return 'scout';
    }
    if (combined.includes('create') || combined.includes('write') || 
        combined.includes('implement') || combined.includes('add') ||
        combined.includes('build') || combined.includes('generate')) {
      return 'builder';
    }
    if (combined.includes('fix') || combined.includes('refactor') || 
        combined.includes('debug') || combined.includes('repair') ||
        combined.includes('resolve') || combined.includes('correct')) {
      return 'warrior';
    }
    if (combined.includes('setup') || combined.includes('initialize') || 
        combined.includes('configure') || combined.includes('install')) {
      return 'settler';
    }
    
    return 'scout';
  }
  
  private determineScope(toolInput: any): WorkingScope {
    const prompt = (toolInput.prompt || '').toLowerCase();
    const description = (toolInput.description || '').toLowerCase();
    const combined = prompt + ' ' + description;
    
    if (combined.includes('method') || combined.includes('function')) {
      return 'method';
    }
    if (combined.includes('class') || combined.includes('component')) {
      return 'class';
    }
    if (combined.includes('file') || combined.includes('module')) {
      return 'file';
    }
    if (combined.includes('repository') || combined.includes('codebase') || 
        combined.includes('project')) {
      return 'repository';
    }
    
    if (toolInput.file_path && toolInput.file_path.includes('#')) {
      return 'method';
    }
    if (toolInput.file_path) {
      return 'file';
    }
    
    return 'repository';
  }

  private getToolIcon(toolName: ToolName): string {
    const icons: Record<ToolName, string> = {
      'Write': '✏️',
      'Edit': '📝',
      'MultiEdit': '📑',
      'Read': '👁️',
      'Bash': '⚡',
      'Glob': '🔍',
      'Grep': '🔎',
      'Task': '🤖',
      'WebSearch': '🌐',
      'WebFetch': '🔗'
    };
    return icons[toolName] || '🔧';
  }
}