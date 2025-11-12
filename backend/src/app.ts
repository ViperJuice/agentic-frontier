import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Services
import { DatabaseService } from './services/DatabaseService';
import { FileService } from './services/FileService';
import { SSEService } from './services/SSEService';
import { TreeSitterService } from './services/TreeSitterService';

// Processors
import { HookProcessor } from './processors/HookProcessor';

// Routes
import { createWebhookRoutes } from './routes/webhooks';
import { createApiRoutes } from './routes/api';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '../../.env.local') });
}

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize services
const databaseConfig = {
  url: process.env.SUPABASE_URL || 'http://localhost:54321',
  key: process.env.SUPABASE_SERVICE_KEY || 
       process.env.SUPABASE_ANON_KEY || 
       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
};

const databaseService = new DatabaseService(databaseConfig);
const fileService = new FileService(databaseService);
const sseService = new SSEService();
const treeService = new TreeSitterService();

// Initialize processor
const hookProcessor = new HookProcessor(databaseService, fileService, sseService, treeService);

// Mount routes
app.use('/api/webhooks', createWebhookRoutes(hookProcessor));
app.use('/api', createApiRoutes(databaseService, fileService, sseService));
app.use('/', createApiRoutes(databaseService, fileService, sseService)); // For /health endpoint

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Agentic Frontier backend running on http://localhost:${PORT}`);
  console.log(`📡 SSE stream available at http://localhost:${PORT}/api/events/stream`);
  console.log(`🔧 Webhook endpoint: http://localhost:${PORT}/api/webhooks/claude/:hookType`);
  console.log('\n✨ Phase 1: TreeSitter Integration ACTIVE');
  console.log('   - Code structure parsing: ENABLED');
  console.log(`   - Supported languages: ${treeService.getStats().supportedLanguages.join(', ')}`);
  console.log('   - Real-time structure extraction and visualization');
  console.log('\n🌳 Files will be automatically parsed when modified via Claude Code');
});

export default app;