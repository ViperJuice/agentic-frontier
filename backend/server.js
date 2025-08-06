// Enhanced Backend Server with Code Structure Support (Refactored)
// File: backend/server.js

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// SSE clients tracking
const sseClients = new Set();

// Code structure cache (for future use when we have content)
const structureCache = new Map();

class HookProcessor {
    constructor() {
        this.sessionData = new Map();
        this.activeAgents = new Map();
        this.projectCache = new Map();
        
        // Future: TreeSitter parser instance will be initialized here
        this.treeSitterParser = null;
    }

    async processHook(hookType, data) {
        console.log(`[${new Date().toISOString()}] Processing ${hookType} hook`);
        
        // Extract session ID
        const sessionId = data.session_id || 'unknown';
        
        // Track session
        await this.trackSession(sessionId, hookType, data);
        
        // Process based on hook type
        const activity = await this.processHookType(hookType, data);
        
        // Store activity event
        if (activity) {
            await this.storeActivityEvent(sessionId, hookType, activity, data);
            
            // Track file operations
            if (hookType === 'PostToolUse' && ['Write', 'Edit', 'MultiEdit'].includes(data.tool_name)) {
                await this.handleFileOperation(data, sessionId);
            }
            
            // Broadcast to SSE clients
            this.broadcastUpdate({
                type: 'activity',
                hookType,
                sessionId,
                activity,
                timestamp: new Date().toISOString()
            });
        }
        
        return activity;
    }

    async processHookType(hookType, data) {
        switch (hookType) {
            case 'SessionStart':
                return await this.handleSessionStart(data);
            
            case 'PreToolUse':
            case 'PostToolUse':
                return await this.handleToolUse(hookType, data);
            
            case 'UserPromptSubmit':
                return this.handleUserPrompt(data);
            
            case 'Stop':
            case 'SubagentStop':
                return this.handleStop(hookType, data);
            
            case 'Notification':
                return this.handleNotification(data);
            
            case 'PreCompact':
                return this.handleCompact(data);
            
            default:
                return {
                    category: 'unknown',
                    action: hookType,
                    icon: '❓',
                    details: {}
                };
        }
    }

    async handleSessionStart(data) {
        const sessionId = data.session_id;
        
        // Create or update agent session
        const { data: agent, error } = await supabase
            .from('agent_sessions')
            .upsert({
                session_id: sessionId,
                status: 'active',
                started_at: new Date().toISOString(),
                transcript_path: data.transcript_path,
                source: data.source || 'startup'
            })
            .select()
            .single();
        
        if (!error && agent) {
            // Create agent character for visualization
            await this.createAgentCharacter(agent);
        }
        
        // FUTURE: When TreeSitter is integrated, we could potentially
        // request a full project scan here if we have access to the codebase
        // await this.requestProjectScan(sessionId);
        
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

    async handleToolUse(hookType, data) {
        const toolName = data.tool_name;
        const toolInput = data.tool_input || {};
        const isPost = hookType === 'PostToolUse';
        
        let activity = {
            category: 'tool',
            action: toolName.toLowerCase(),
            icon: this.getToolIcon(toolName),
            details: {}
        };
        
        // Process based on tool type
        switch (toolName) {
            case 'Write':
            case 'Edit':
            case 'MultiEdit':
                activity.category = 'code';
                activity.action = isPost ? 'modified' : 'modifying';
                activity.details = {
                    file: toolInput.file_path || toolInput.files,
                    // Note: We don't have reliable line counts without content
                    // This will be populated when TreeSitter integration is complete
                    lines: null
                };
                
                if (isPost) {
                    // Update file in database
                    await this.updateFile(toolInput.file_path, data.session_id);
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
                
                // FUTURE: Read operations could potentially cache file content
                // for subsequent parsing when TreeSitter is ready
                if (isPost && toolInput.file_path) {
                    await this.markFileExplored(toolInput.file_path, sessionId);
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
                    task: toolInput.task || 'Subagent task'
                };
                break;
        }
        
        return activity;
    }

    async handleFileOperation(data, sessionId) {
        const toolInput = data.tool_input || {};
        const filePath = toolInput.file_path;
        
        if (!filePath) return;
        
        // Update file record
        const file = await this.updateFile(filePath, sessionId);
        
        // Check if we have full content (only for Write operations)
        if (data.tool_name === 'Write' && toolInput.content) {
            // We might have full content for new files
            await this.attemptStructureParsing(filePath, toolInput.content, file, sessionId);
        } else {
            // For Edit/MultiEdit, we definitely don't have full content
            // Mark file as needing structure update
            await this.markFileNeedsStructureUpdate(file.id);
            
            // Log what we would parse if we had content
            console.log(`[Structure Parse Pending] ${filePath} - Awaiting full content access`);
        }
        
        // FUTURE: This is where TreeSitter hook data would be processed
        // if (data.treesitter_structures) {
        //     await this.processTreeSitterStructures(data.treesitter_structures, file, sessionId);
        // }
    }

    async attemptStructureParsing(filePath, content, file, sessionId) {
        // Only attempt parsing if we're confident we have full content
        // This is mainly for new files created with Write
        
        const ext = path.extname(filePath);
        const parseableExts = ['.py', '.js', '.jsx', '.ts', '.tsx'];
        
        if (!parseableExts.includes(ext)) {
            console.log(`[Structure Parse Skip] ${filePath} - Unsupported extension`);
            return;
        }
        
        // Check if content looks complete (basic heuristic)
        const looksComplete = content.includes('\n') && 
                            (content.includes('function') || 
                             content.includes('class') || 
                             content.includes('const') ||
                             content.includes('def'));
        
        if (!looksComplete) {
            console.log(`[Structure Parse Skip] ${filePath} - Content appears incomplete`);
            await this.markFileNeedsStructureUpdate(file.id);
            return;
        }
        
        try {
            // Attempt to parse with existing parser
            const parseResult = await this.runCodeParser(filePath, content);
            
            if (!parseResult.error) {
                await this.storeCodeStructures(parseResult, file, sessionId);
                console.log(`[Structure Parse Success] ${filePath} - ${parseResult.structures?.length || 0} structures found`);
            } else {
                console.log(`[Structure Parse Error] ${filePath} - ${parseResult.error}`);
                await this.markFileNeedsStructureUpdate(file.id);
            }
        } catch (error) {
            console.error(`[Structure Parse Failed] ${filePath}:`, error);
            await this.markFileNeedsStructureUpdate(file.id);
        }
    }

    async runCodeParser(filePath, content) {
        // Existing parser implementation
        // This will be replaced/enhanced with TreeSitter
        return new Promise((resolve) => {
            const parser = spawn('python3', [
                path.join(__dirname, 'code_parser.py')
            ]);
            
            let output = '';
            let error = '';
            
            parser.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            parser.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            parser.on('close', (code) => {
                if (code !== 0) {
                    resolve({ error: error || 'Parser failed' });
                } else {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (e) {
                        resolve({ error: 'Failed to parse output' });
                    }
                }
            });
            
            // Send input to parser
            const input = JSON.stringify({ file_path: filePath, content });
            parser.stdin.write(input);
            parser.stdin.end();
        });
    }

    async storeCodeStructures(parseResult, file, sessionId) {
        // Store parsed structures in database
        // This is ready for when we have reliable parsing
        
        if (!parseResult.structures || parseResult.structures.length === 0) {
            return;
        }
        
        // Delete existing structures for this file
        await supabase
            .from('code_structures')
            .delete()
            .eq('file_id', file.id);
        
        // Insert new structures
        const structures = parseResult.structures.map(struct => ({
            ...struct,
            file_id: file.id,
            project_id: file.project_id,
            session_id: sessionId,
            id: this.generateUUID()
        }));
        
        const { error } = await supabase
            .from('code_structures')
            .insert(structures);
        
        if (!error) {
            // Update file metadata
            await supabase
                .from('files')
                .update({
                    has_structures: true,
                    structure_count: structures.length,
                    last_parsed_at: new Date().toISOString()
                })
                .eq('id', file.id);
        }
        
        // Store dependencies if available
        if (parseResult.dependencies && parseResult.dependencies.length > 0) {
            await this.storeDependencies(parseResult.dependencies, file, sessionId);
        }
        
        // Broadcast update
        this.broadcastUpdate({
            type: 'structures_updated',
            file_id: file.id,
            file_path: file.file_path,
            structure_count: structures.length,
            sessionId,
            timestamp: new Date().toISOString()
        });
    }

    async markFileNeedsStructureUpdate(fileId) {
        // Mark that we need to parse this file when we have access to content
        await supabase
            .from('files')
            .update({
                has_structures: false,
                needs_parsing: true,
                last_modified_at: new Date().toISOString()
            })
            .eq('id', fileId);
    }

    async markFileExplored(filePath, sessionId) {
        // Track that a file has been explored (Read operation)
        // FUTURE: Could cache content here for later parsing
        
        const file = await this.updateFile(filePath, sessionId);
        
        await supabase
            .from('files')
            .update({
                last_explored_at: new Date().toISOString(),
                explored_by: sessionId
            })
            .eq('id', file.id);
    }

    async storeDependencies(dependencies, file, sessionId) {
        const projectId = file.project_id;
        
        for (const dep of dependencies) {
            // Try to find target file
            const { data: targetFile } = await supabase
                .from('files')
                .select('id')
                .eq('file_path', dep.target_file)
                .eq('project_id', projectId)
                .single();
            
            if (targetFile || dep.is_external) {
                await supabase
                    .from('dependencies')
                    .upsert({
                        project_id: projectId,
                        source_file_id: file.id,
                        target_file_id: targetFile?.id || null,
                        import_statement: dep.import_statement,
                        import_type: dep.import_type,
                        imported_items: dep.imported_items,
                        is_external: dep.is_external,
                        package_name: dep.package_name,
                        route_strength: dep.route_strength,
                        route_color: dep.route_color
                    });
            }
        }
    }

    async updateFile(filePath, sessionId) {
        if (!filePath) return;
        
        // Get or create project
        const projectPath = this.extractProjectPath(filePath);
        const { data: project } = await supabase
            .from('projects')
            .upsert({
                name: path.basename(projectPath),
                path: projectPath
            })
            .select()
            .single();
        
        if (!project) return;
        
        // Calculate position for new files
        const position = await this.calculateFilePosition(project.id);
        
        // Update or create file
        const { data: file } = await supabase
            .from('files')
            .upsert({
                project_id: project.id,
                file_path: filePath,
                file_name: path.basename(filePath),
                extension: path.extname(filePath),
                last_modified_by: sessionId,
                position_x: position.x,
                position_y: position.y,
                building_type: this.getBuildingType(filePath),
                building_color: this.getBuildingColor(filePath),
                // Structure parsing status
                has_structures: false,  // Default to false since we don't have content
                needs_parsing: true      // Flag for future parsing
            })
            .select()
            .single();
        
        return file;
    }

    async calculateFilePosition(projectId) {
        // Get existing files to avoid overlap
        const { data: files } = await supabase
            .from('files')
            .select('position_x, position_y')
            .eq('project_id', projectId);
        
        // Simple spiral pattern for positioning
        let x = 25, y = 25;
        let dx = 1, dy = 0;
        let steps = 1, stepCount = 0;
        let turnCount = 0;
        
        while (files?.some(f => f.position_x === x && f.position_y === y)) {
            x += dx * 3;
            y += dy * 3;
            stepCount++;
            
            if (stepCount === steps) {
                stepCount = 0;
                turnCount++;
                
                // Turn
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

    async createAgentCharacter(agentSession) {
        // Random starting position near center
        const x = 23 + Math.floor(Math.random() * 5);
        const y = 23 + Math.floor(Math.random() * 5);
        
        await supabase
            .from('agent_characters')
            .upsert({
                session_id: agentSession.session_id,
                name: `Agent-${agentSession.session_id.slice(0, 6)}`,
                position_x: x,
                position_y: y,
                status: 'idle',
                sprite_type: 'worker'
            });
    }

    async trackSession(sessionId, hookType, data) {
        // Update session activity
        await supabase
            .from('agent_sessions')
            .update({
                last_activity: new Date().toISOString(),
                status: hookType === 'Stop' ? 'completed' : 'active'
            })
            .eq('session_id', sessionId);
    }

    async storeActivityEvent(sessionId, hookType, activity, rawData) {
        await supabase
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

    handleUserPrompt(data) {
        return {
            category: 'interaction',
            action: 'prompt_submitted',
            icon: '💬',
            details: {
                prompt: data.prompt?.slice(0, 100) + '...'
            }
        };
    }

    handleStop(hookType, data) {
        return {
            category: 'lifecycle',
            action: hookType.toLowerCase(),
            icon: hookType === 'Stop' ? '🏁' : '🔚',
            details: {
                stop_hook_active: data.stop_hook_active
            }
        };
    }

    handleNotification(data) {
        return {
            category: 'system',
            action: 'notification',
            icon: '🔔',
            details: {
                message: data.message
            }
        };
    }

    handleCompact(data) {
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

    getToolIcon(toolName) {
        const icons = {
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

    getBuildingType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const types = {
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

    getBuildingColor(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const colors = {
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

    extractProjectPath(filePath) {
        // Extract project root from file path
        const parts = filePath.split('/');
        const projectMarkers = ['src', 'lib', 'app', 'components', 'pages'];
        
        for (let i = parts.length - 1; i >= 0; i--) {
            if (projectMarkers.includes(parts[i])) {
                return parts.slice(0, i).join('/');
            }
        }
        
        // Default to parent directory
        return path.dirname(filePath);
    }

    broadcastUpdate(data) {
        const message = JSON.stringify(data);
        sseClients.forEach(client => {
            client.write(`data: ${message}\n\n`);
        });
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Initialize processor
const processor = new HookProcessor();

// Routes
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        parsing_status: 'limited',  // Indicates we're in file-only mode
        treesitter_ready: false     // Will be true when TreeSitter is integrated
    });
});

// SSE endpoint for real-time updates
app.get('/api/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial connection message
    res.write('data: {"type":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n');
    
    // Add client to set
    sseClients.add(res);
    
    // Remove client on disconnect
    req.on('close', () => {
        sseClients.delete(res);
    });
});

// Claude Code webhook endpoint
app.post('/api/webhooks/claude/:hookType', async (req, res) => {
    const { hookType } = req.params;
    const data = req.body;
    
    try {
        const activity = await processor.processHook(hookType, data);
        res.json({ success: true, activity });
    } catch (error) {
        console.error(`Error processing ${hookType}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get code structures for a file
// NOTE: This will return empty until we have reliable parsing
app.get('/api/structures/:fileId', async (req, res) => {
    const { fileId } = req.params;
    
    try {
        const { data: structures, error } = await supabase
            .from('code_structures')
            .select('*')
            .eq('file_id', fileId)
            .order('depth', { ascending: true })
            .order('start_line', { ascending: true });
        
        if (error) throw error;
        
        if (!structures || structures.length === 0) {
            // Return placeholder message
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
        res.status(500).json({ error: error.message });
    }
});

// Get files with parsing status
app.get('/api/files/:projectId', async (req, res) => {
    const { projectId } = req.params;
    
    try {
        const { data: files, error } = await supabase
            .from('files')
            .select('*')
            .eq('project_id', projectId)
            .order('last_modified_at', { ascending: false });
        
        if (error) throw error;
        
        // Add parsing status to response
        const filesWithStatus = files.map(file => ({
            ...file,
            parsing_status: file.has_structures ? 'complete' : 
                           file.needs_parsing ? 'pending' : 'not_started'
        }));
        
        res.json({ files: filesWithStatus });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: error.message });
    }
});

// FUTURE: Endpoint for TreeSitter structure updates
// This will be called when we have TreeSitter integration
app.post('/api/structures/update', async (req, res) => {
    const { file_path, structures, session_id } = req.body;
    
    // Stub for future TreeSitter integration
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

// Get dependencies for a project
app.get('/api/dependencies/:projectId', async (req, res) => {
    const { projectId } = req.params;
    
    try {
        const { data: dependencies, error } = await supabase
            .from('dependencies')
            .select(`
                *,
                source_file:files!source_file_id(file_path, file_name),
                target_file:files!target_file_id(file_path, file_name)
            `)
            .eq('project_id', projectId);
        
        if (error) throw error;
        
        // Note: Dependencies will be limited until we can parse imports
        res.json({ 
            dependencies: dependencies || [],
            parsing_limited: true,
            message: 'Import parsing requires full file content access'
        });
    } catch (error) {
        console.error('Error fetching dependencies:', error);
        res.status(500).json({ error: error.message });
    }
});

// Dashboard endpoint with parsing status
app.get('/api/dashboard', async (req, res) => {
    try {
        // Get stats
        const [sessions, files, structures, events] = await Promise.all([
            supabase.from('agent_sessions').select('*', { count: 'exact' }),
            supabase.from('files').select('*', { count: 'exact' }),
            supabase.from('code_structures').select('*', { count: 'exact' }),
            supabase.from('activity_events').select('*').order('created_at', { ascending: false }).limit(50)
        ]);
        
        // Count files needing parsing
        const { count: needsParsing } = await supabase
            .from('files')
            .select('*', { count: 'exact', head: true })
            .eq('needs_parsing', true);
        
        res.json({
            stats: {
                active_sessions: sessions.count || 0,
                total_files: files.count || 0,
                total_structures: structures.count || 0,
                files_pending_parsing: needsParsing || 0,
                recent_events: events.data || []
            },
            capabilities: {
                file_tracking: true,
                structure_parsing: 'limited',  // Only for new files with Write
                dependency_tracking: 'limited',
                treesitter_ready: false
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Agentic Frontier backend running on http://localhost:${PORT}`);
    console.log(`📡 SSE stream available at http://localhost:${PORT}/api/events/stream`);
    console.log(`🔧 Webhook endpoint: http://localhost:${PORT}/api/webhooks/claude/:hookType`);
    console.log('\n⚠️  Phase IV: File-level visualization active');
    console.log('   - Tracking file modifications and agent activity');
    console.log('   - Code structure parsing: LIMITED (only new files)');
    console.log('   - Awaiting TreeSitter integration for full parsing');
    console.log('\n📋 Files will be marked for parsing when content becomes available');
});