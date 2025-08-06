import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import {
  DatabaseConfig,
  Project,
  File,
  CodeStructure,
  AgentSession,
  ActivityEvent,
  Dependency,
  Position,
  HookType,
  Activity
} from '../types';
import { generateUUID, getCurrentTimestamp } from '../utils';

export class DatabaseService {
  private supabase: SupabaseClient;
  private projectCache: Map<string, Project>;

  constructor(config: DatabaseConfig) {
    this.supabase = createClient(config.url, config.key);
    this.projectCache = new Map();
  }

  // Project Management
  async upsertProject(projectPath: string): Promise<Project | null> {
    // Check cache first
    if (this.projectCache.has(projectPath)) {
      return this.projectCache.get(projectPath)!;
    }

    const projectName = path.basename(projectPath);
    const { data, error } = await this.supabase
      .from('projects')
      .upsert({
        name: projectName,
        path: projectPath
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting project:', error);
      return null;
    }

    // Cache the project
    if (data) {
      this.projectCache.set(projectPath, data as Project);
    }

    return data as Project;
  }

  // File Management
  async upsertFile(filePath: string, projectId: string, position: Position): Promise<File | null> {
    const { data, error } = await this.supabase
      .from('files')
      .upsert({
        project_id: projectId,
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        position: { x: position.x, y: position.y },
        building_type: this.getBuildingType(filePath),
        building_height: 1,
        last_modified_at: getCurrentTimestamp()
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting file:', error);
      return null;
    }

    return data as File;
  }

  async markFileNeedsStructureUpdate(fileId: string): Promise<void> {
    await this.supabase
      .from('files')
      .update({
        has_structures: false,
        needs_parsing: true,
        last_modified_at: getCurrentTimestamp()
      })
      .eq('id', fileId);
  }

  async markFileExplored(fileId: string, sessionId: string): Promise<void> {
    await this.supabase
      .from('files')
      .update({
        last_explored_at: getCurrentTimestamp(),
        explored_by: sessionId
      })
      .eq('id', fileId);
  }

  async getFilesByProject(projectId: string): Promise<File[]> {
    const { data, error } = await this.supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('last_modified_at', { ascending: false });

    if (error) {
      console.error('Error fetching files:', error);
      return [];
    }

    return data as File[];
  }

  async calculateFilePosition(projectId: string): Promise<Position> {
    const { data: files } = await this.supabase
      .from('files')
      .select('position')
      .eq('project_id', projectId);

    let x = 25, y = 25;
    let dx = 1, dy = 0;
    let steps = 1, stepCount = 0;
    let turnCount = 0;

    while (files?.some(f => f.position?.x === x && f.position?.y === y)) {
      x += dx * 3;
      y += dy * 3;
      stepCount++;

      if (stepCount === steps) {
        stepCount = 0;
        turnCount++;

        const temp = dx;
        dx = -dy;
        dy = temp;

        if (turnCount === 2) {
          turnCount = 0;
          steps++;
        }
      }
    }

    return { x, y };
  }

  // Code Structure Management
  async storeCodeStructures(structures: Omit<CodeStructure, 'id'>[], fileId: string): Promise<void> {
    // Delete existing structures
    await this.supabase
      .from('code_structures')
      .delete()
      .eq('file_id', fileId);

    // Insert new structures
    const structuresWithIds = structures.map(struct => ({
      ...struct,
      id: generateUUID()
    }));

    const { error } = await this.supabase
      .from('code_structures')
      .insert(structuresWithIds);

    if (!error) {
      await this.supabase
        .from('files')
        .update({
          has_structures: true,
          structure_count: structures.length,
          last_parsed_at: getCurrentTimestamp()
        })
        .eq('id', fileId);
    }
  }

  async getCodeStructures(fileId: string): Promise<CodeStructure[]> {
    const { data, error } = await this.supabase
      .from('code_structures')
      .select('*')
      .eq('file_id', fileId)
      .order('depth', { ascending: true })
      .order('start_line', { ascending: true });

    if (error) {
      console.error('Error fetching code structures:', error);
      return [];
    }

    return data as CodeStructure[];
  }

  // Session Management
  async upsertAgentSession(sessionData: Partial<AgentSession>): Promise<AgentSession | null> {
    const { data, error } = await this.supabase
      .from('agent_sessions')
      .upsert({
        ...sessionData,
        last_activity: getCurrentTimestamp()
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting agent session:', error);
      return null;
    }

    return data as AgentSession;
  }

  async updateSessionActivity(sessionId: string, status?: 'active' | 'completed'): Promise<void> {
    const updateData: any = {
      last_activity: getCurrentTimestamp()
    };

    if (status) {
      updateData.status = status;
    }

    await this.supabase
      .from('agent_sessions')
      .update(updateData)
      .eq('session_id', sessionId);
  }

  // Agent Character Management
  async createAgentCharacter(sessionId: string): Promise<void> {
    const x = 23 + Math.floor(Math.random() * 5);
    const y = 23 + Math.floor(Math.random() * 5);

    await this.supabase
      .from('agent_characters')
      .upsert({
        session_id: sessionId,
        name: `Agent-${sessionId.slice(0, 6)}`,
        position_x: x,
        position_y: y,
        status: 'idle',
        sprite_type: 'worker'
      });
  }

  // Activity Event Management
  async storeActivityEvent(
    sessionId: string,
    hookType: HookType,
    activity: Activity,
    rawData: any
  ): Promise<void> {
    await this.supabase
      .from('activity_events')
      .insert({
        session_id: sessionId,
        hook_type: hookType,
        category: activity.category,
        action: activity.action,
        icon: activity.icon,
        details: activity.details,
        raw_data: rawData
      });
  }

  async getRecentActivityEvents(limit: number = 50): Promise<ActivityEvent[]> {
    const { data, error } = await this.supabase
      .from('activity_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching activity events:', error);
      return [];
    }

    return data as ActivityEvent[];
  }

  // Dependency Management
  async storeDependencies(dependencies: Partial<Dependency>[], fileId: string, projectId: string): Promise<void> {
    for (const dep of dependencies) {
      let targetFileId: string | null = null;

      if (dep.target_file_id) {
        const { data: targetFile } = await this.supabase
          .from('files')
          .select('id')
          .eq('file_path', dep.target_file_id)
          .eq('project_id', projectId)
          .single();

        targetFileId = targetFile?.id || null;
      }

      await this.supabase
        .from('dependencies')
        .upsert({
          ...dep,
          project_id: projectId,
          source_file_id: fileId,
          target_file_id: targetFileId
        });
    }
  }

  async getDependencies(projectId: string): Promise<Dependency[]> {
    const { data, error } = await this.supabase
      .from('dependencies')
      .select(`
        *,
        source_file:files!source_file_id(file_path, file_name),
        target_file:files!target_file_id(file_path, file_name)
      `)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error fetching dependencies:', error);
      return [];
    }

    return data as Dependency[];
  }

  // Statistics
  async getDashboardStats(): Promise<{
    active_sessions: number;
    total_files: number;
    total_structures: number;
    files_pending_parsing: number;
  }> {
    const [sessions, files, structures, needsParsing] = await Promise.all([
      this.supabase.from('agent_sessions').select('*', { count: 'exact', head: true }),
      this.supabase.from('files').select('*', { count: 'exact', head: true }),
      this.supabase.from('code_structures').select('*', { count: 'exact', head: true }),
      this.supabase.from('files').select('*', { count: 'exact', head: true }).eq('needs_parsing', true)
    ]);

    return {
      active_sessions: sessions.count || 0,
      total_files: files.count || 0,
      total_structures: structures.count || 0,
      files_pending_parsing: needsParsing.count || 0
    };
  }

  // Helper method to determine building type from file extension
  private getBuildingType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const types: { [key: string]: string } = {
      '.js': 'commercial',
      '.jsx': 'commercial_modern',
      '.ts': 'industrial',
      '.tsx': 'industrial_modern',
      '.py': 'laboratory',
      '.json': 'datacenter',
      '.md': 'library',
      '.css': 'artstudio',
      '.html': 'monument'
    };
    return types[ext] || 'residential';
  }
}