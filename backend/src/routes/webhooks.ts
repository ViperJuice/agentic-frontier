import { Router, Request, Response } from 'express';
import { HookProcessor } from '../processors/HookProcessor';
import { HookType } from '../types';

export function createWebhookRoutes(processor: HookProcessor): Router {
  const router = Router();

  /**
   * Claude Code webhook endpoint
   * POST /api/webhooks/claude/:hookType
   */
  router.post('/claude/:hookType', async (req: Request, res: Response) => {
    const { hookType } = req.params;
    const data = req.body;
    
    try {
      const activity = await processor.processHook(hookType as HookType, data);
      res.json({ success: true, activity });
    } catch (error) {
      console.error(`Error processing ${hookType}:`, error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    }
  });

  return router;
}