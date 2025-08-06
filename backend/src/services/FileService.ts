import path from 'path';
import { DatabaseService } from './DatabaseService';
import { File, BuildingType, FileExtensionMap } from '../types';
import { logWithTimestamp } from '../utils';

export class FileService {
  private databaseService: DatabaseService;
  private structureCache: Map<string, any>;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.structureCache = new Map();
  }

  /**
   * Update or create a file record
   */
  async updateFile(filePath: string, _sessionId: string): Promise<File | null> {
    if (!filePath) return null;

    const projectPath = this.extractProjectPath(filePath);
    const project = await this.databaseService.upsertProject(projectPath);
    
    if (!project) {
      logWithTimestamp(`Failed to get/create project for path: ${projectPath}`);
      return null;
    }

    const position = await this.databaseService.calculateFilePosition(project.id);
    const file = await this.databaseService.upsertFile(filePath, project.id, position);

    if (!file) {
      logWithTimestamp(`Failed to update file record for: ${filePath}`);
      return null;
    }

    return file;
  }

  /**
   * Mark a file as explored (Read operation)
   */
  async markFileExplored(filePath: string, sessionId: string): Promise<void> {
    const file = await this.updateFile(filePath, sessionId);
    
    if (file) {
      await this.databaseService.markFileExplored(file.id, sessionId);
    }
  }

  /**
   * Mark file as needing structure update
   */
  async markFileNeedsStructureUpdate(fileId: string): Promise<void> {
    await this.databaseService.markFileNeedsStructureUpdate(fileId);
    logWithTimestamp(`File ${fileId} marked for future parsing when TreeSitter available`);
  }

  /**
   * Extract project root from file path
   */
  extractProjectPath(filePath: string): string {
    const parts = filePath.split('/');
    const projectMarkers = ['src', 'lib', 'app', 'components', 'pages', 'backend', 'frontend'];
    
    for (let i = parts.length - 1; i >= 0; i--) {
      if (projectMarkers.includes(parts[i])) {
        return parts.slice(0, i).join('/');
      }
    }
    
    // Default to parent directory
    return path.dirname(filePath);
  }

  /**
   * Get building type based on file extension
   */
  getBuildingType(filePath: string): BuildingType {
    const ext = path.extname(filePath).toLowerCase();
    const types: FileExtensionMap<BuildingType> = {
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

  /**
   * Get building color based on file extension
   */
  getBuildingColor(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const colors: FileExtensionMap<string> = {
      '.js': '#F7DF1E',
      '.jsx': '#61DAFB',
      '.ts': '#3178C6',
      '.tsx': '#61DAFB',
      '.py': '#3776AB',
      '.json': '#000000',
      '.md': '#083FA1',
      '.css': '#1572B6',
      '.html': '#E34C26'
    };
    return colors[ext] || '#808080';
  }

  /**
   * Get icon for file type
   */
  getFileIcon(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const icons: FileExtensionMap<string> = {
      '.js': '📜',
      '.jsx': '⚛️',
      '.ts': '📘',
      '.tsx': '⚛️',
      '.py': '🐍',
      '.json': '📊',
      '.md': '📝',
      '.css': '🎨',
      '.html': '🌐'
    };
    return icons[ext] || '📄';
  }

  /**
   * Check if file should be parsed for structures
   */
  shouldParseFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const parsableExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.go', '.rs'];
    return parsableExtensions.includes(ext);
  }

  /**
   * Get file statistics
   */
  async getFileStats(projectId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    needsParsing: number;
  }> {
    const files = await this.databaseService.getFilesByProject(projectId);
    
    const byType: Record<string, number> = {};
    let needsParsing = 0;
    
    files.forEach(file => {
      const ext = path.extname(file.path);
      byType[ext] = (byType[ext] || 0) + 1;
      
      if (file.needs_parsing) {
        needsParsing++;
      }
    });
    
    return {
      total: files.length,
      byType,
      needsParsing
    };
  }

  /**
   * Clear structure cache for a file
   */
  clearStructureCache(filePath: string): void {
    this.structureCache.delete(filePath);
  }

  /**
   * Clear all structure caches
   */
  clearAllStructureCaches(): void {
    this.structureCache.clear();
  }
}