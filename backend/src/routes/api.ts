import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { FileService } from '../services/FileService';
import { SSEService } from '../services/SSEService';
import { getCurrentTimestamp } from '../utils';

export function createApiRoutes(
  databaseService: DatabaseService,
  _fileService: FileService,
  sseService: SSEService
): Router {
  const router = Router();

  /**
   * Health check endpoint
   * GET /health
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: getCurrentTimestamp(),
      parsing_status: 'limited',
      treesitter_ready: false
    });
  });

  /**
   * SSE endpoint for real-time updates
   * GET /api/events/stream
   */
  router.get('/events/stream', (req: Request, res: Response) => {
    sseService.addClient(res);
    
    req.on('close', () => {
      sseService.removeClient(res);
    });
  });

  /**
   * Get code structures for a file
   * GET /api/structures/:fileId
   */
  router.get('/structures/:fileId', async (req: Request, res: Response) => {
    const { fileId } = req.params;
    
    try {
      const structures = await databaseService.getCodeStructures(fileId);
      
      if (!structures || structures.length === 0) {
        res.json({ 
          structures: [],
          message: 'Structure parsing pending - awaiting content access',
          parsing_available: false
        });
      } else {
        res.json({ 
          structures,
          parsing_available: true
        });
      }
    } catch (error) {
      console.error('Error fetching structures:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * Get files with parsing status
   * GET /api/files/:projectId
   */
  router.get('/files/:projectId', async (req: Request, res: Response) => {
    const { projectId } = req.params;
    
    try {
      const files = await databaseService.getFilesByProject(projectId);
      
      const filesWithStatus = files.map(file => ({
        ...file,
        parsing_status: file.has_structures ? 'complete' : 
                       file.needs_parsing ? 'pending' : 'not_started'
      }));
      
      res.json({ files: filesWithStatus });
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * Endpoint for TreeSitter structure updates (future)
   * POST /api/structures/update
   */
  router.post('/structures/update', async (_req: Request, res: Response) => {
    res.json({ 
      success: false, 
      message: 'TreeSitter integration pending',
      expected_payload: {
        file_path: 'string',
        structures: 'array of TreeSitter nodes',
        session_id: 'string'
      }
    });
  });

  /**
   * Get dependencies for a project
   * GET /api/dependencies/:projectId
   */
  router.get('/dependencies/:projectId', async (req: Request, res: Response) => {
    const { projectId } = req.params;
    
    try {
      const dependencies = await databaseService.getDependencies(projectId);
      
      res.json({ 
        dependencies: dependencies || [],
        parsing_limited: true,
        message: 'Import parsing requires full file content access'
      });
    } catch (error) {
      console.error('Error fetching dependencies:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * Dashboard endpoint with parsing status
   * GET /api/dashboard
   */
  router.get('/dashboard', async (_req: Request, res: Response) => {
    try {
      const stats = await databaseService.getDashboardStats();
      const recentEvents = await databaseService.getRecentActivityEvents(50);
      
      res.json({
        stats: {
          ...stats,
          recent_events: recentEvents
        },
        capabilities: {
          file_tracking: true,
          structure_parsing: 'limited',
          dependency_tracking: 'limited',
          treesitter_ready: false
        },
        timestamp: getCurrentTimestamp()
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  return router;
}