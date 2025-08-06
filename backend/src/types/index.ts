import { Response } from 'express';

// Hook Types
export type HookType = 
  | 'SessionStart' 
  | 'PreToolUse' 
  | 'PostToolUse' 
  | 'UserPromptSubmit' 
  | 'Stop' 
  | 'SubagentStop' 
  | 'Notification' 
  | 'PreCompact';

export type ToolName = 
  | 'Write' 
  | 'Edit' 
  | 'MultiEdit' 
  | 'Read' 
  | 'Bash' 
  | 'Glob' 
  | 'Grep' 
  | 'Task' 
  | 'WebSearch' 
  | 'WebFetch';

export type AgentType = 'scout' | 'builder' | 'warrior' | 'settler';
export type WorkingScope = 'method' | 'class' | 'file' | 'repository';
export type BuildingType = 
  | 'commercial' 
  | 'commercial_modern' 
  | 'industrial' 
  | 'industrial_modern' 
  | 'laboratory' 
  | 'datacenter' 
  | 'library' 
  | 'artstudio' 
  | 'monument' 
  | 'residential';

// Hook Data Interfaces
export interface BaseHookData {
  session_id?: string;
  timestamp?: string;
  cwd?: string;
  project_dir?: string;
}

export interface SessionStartData extends BaseHookData {
  transcript_path?: string;
  source?: string;
}

export interface ToolUseData extends BaseHookData {
  tool_name: ToolName;
  tool_input?: any;
  tool_output?: any;
  treesitter_structures?: any; // Future: TreeSitter AST nodes
}

export interface UserPromptData extends BaseHookData {
  prompt?: string;
}

export interface StopData extends BaseHookData {
  stop_hook_active?: boolean;
}

export interface NotificationData extends BaseHookData {
  message?: string;
}

export interface CompactData extends BaseHookData {
  trigger?: string;
  custom_instructions?: string;
}

// Activity Types
export interface Activity {
  category: 'lifecycle' | 'tool' | 'code' | 'exploration' | 'command' | 'delegation' | 'interaction' | 'system' | 'unknown';
  action: string;
  icon: string;
  details: Record<string, any>;
}

// Database Models
export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  project_id: string;
  path: string;
  name: string;
  extension: string;
  position: { x: number; y: number };
  building_type: BuildingType;
  building_height: number;
  has_structures: boolean;
  structure_count?: number;
  needs_parsing?: boolean;
  last_modified_at: string;
  last_modified_by?: string;
  last_explored_at?: string;
  explored_by?: string;
  last_parsed_at?: string;
}

export interface CodeStructure {
  id: string;
  file_id: string;
  project_id: string;
  session_id: string;
  name: string;
  type: string;
  start_line: number;
  end_line: number;
  depth: number;
  parent_id?: string;
}

export interface AgentSession {
  session_id: string;
  status: 'active' | 'completed';
  started_at: string;
  transcript_path?: string;
  source?: string;
  last_activity?: string;
}

export interface AgentCharacter {
  session_id: string;
  name: string;
  position_x: number;
  position_y: number;
  status: 'idle' | 'moving' | 'working';
  sprite_type: string;
}

export interface ActivityEvent {
  id: string;
  session_id: string;
  hook_type: HookType;
  category: string;
  action: string;
  icon: string;
  details: Record<string, any>;
  raw_data: any;
  created_at: string;
}

export interface Dependency {
  id: string;
  project_id: string;
  source_file_id: string;
  target_file_id?: string;
  import_statement: string;
  import_type: string;
  imported_items?: string[];
  is_external: boolean;
  package_name?: string;
  route_strength?: number;
  route_color?: string;
}

// SSE Types
export interface SSEClient extends Response {
  id?: string;
}

export interface SSEMessage {
  type: string;
  data?: any;
  timestamp: string;
}

// Service Configuration
export interface DatabaseConfig {
  url: string;
  key: string;
}

export interface ServerConfig {
  port: number;
  corsOptions?: any;
}

// Utility Types
export type Position = {
  x: number;
  y: number;
};

export type FileExtensionMap<T> = {
  [key: string]: T;
};

// Hook Processing Result
export interface HookProcessingResult {
  success: boolean;
  activity?: Activity;
  error?: string;
}