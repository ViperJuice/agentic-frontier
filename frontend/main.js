// Enhanced Phaser.js Frontend with Code Structure Visualization
// File: frontend/src/main.js

import Phaser from 'phaser';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class CivilizationScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CivilizationScene' });
        
        // Map configuration
        this.mapWidth = 50;
        this.mapHeight = 50;
        this.tileSize = 64;
        
        // Game state
        this.tiles = [];
        this.agents = new Map();
        this.settlements = new Map();
        this.districts = new Map();  // Classes within settlements
        this.buildings = new Map();  // Methods/functions within districts
        this.tradeRoutes = new Map(); // Dependencies between settlements
        this.fogOfWar = [];
        this.selectedUnit = null;
        this.selectedSettlement = null;
        this.selectedBuilding = null;
        
        // Camera controls
        this.cameraSpeed = 10;
        
        // SSE connection
        this.eventSource = null;
        
        // UI elements
        this.statsText = null;
        this.selectionInfo = null;
        
        // Visual layers
        this.terrainLayer = null;
        this.routeLayer = null;
        this.settlementLayer = null;
        this.districtLayer = null;
        this.buildingLayer = null;
        this.unitLayer = null;
        this.effectLayer = null;
        this.uiLayer = null;
    }

    preload() {
        // Load tile sprites
        this.load.image('tile_grass', 'assets/tiles/grass.png');
        this.load.image('tile_ocean', 'assets/tiles/ocean.png');
        this.load.image('tile_desert', 'assets/tiles/desert.png');
        this.load.image('tile_forest', 'assets/tiles/forest.png');
        this.load.image('tile_mountain', 'assets/tiles/mountain.png');
        
        // Load unit sprites
        this.load.image('unit_worker', 'assets/units/worker.png');
        this.load.image('unit_explorer', 'assets/units/explorer.png');
        this.load.image('unit_builder', 'assets/units/builder.png');
        
        // Load settlement sprites
        this.load.image('settlement_small', 'assets/buildings/settlement_small.png');
        this.load.image('settlement_medium', 'assets/buildings/settlement_medium.png');
        this.load.image('settlement_large', 'assets/buildings/settlement_large.png');
        
        // Load district sprites (for classes)
        this.load.image('district_wall', 'assets/buildings/district_wall.png');
        this.load.image('district_gate', 'assets/buildings/gate.png');
        
        // Load building sprites (for methods/functions)
        this.load.image('building_public', 'assets/buildings/public.png');
        this.load.image('building_private', 'assets/buildings/private.png');
        this.load.image('building_static', 'assets/buildings/monument.png');
        this.load.image('building_async', 'assets/buildings/dock.png');
        this.load.image('building_constructor', 'assets/buildings/gateway.png');
        
        // Use colored rectangles as fallback if images don't exist
        this.load.on('loaderror', (file) => {
            console.warn(`Failed to load: ${file.src}, using fallback`);
            this.createFallbackTexture(file.key);
        });
    }

    create() {
        // Create visual layers
        this.terrainLayer = this.add.container(0, 0);
        this.routeLayer = this.add.container(0, 0);
        this.settlementLayer = this.add.container(0, 0);
        this.districtLayer = this.add.container(0, 0);
        this.buildingLayer = this.add.container(0, 0);
        this.unitLayer = this.add.container(0, 0);
        this.effectLayer = this.add.container(0, 0);
        this.uiLayer = this.add.container(0, 0);
        
        // Generate map
        this.generateMap();
        
        // Setup camera
        this.cameras.main.setBounds(0, 0, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
        this.cameras.main.setZoom(1);
        this.cameras.main.centerOn(this.mapWidth * this.tileSize / 2, this.mapHeight * this.tileSize / 2);
        
        // Setup controls
        this.setupControls();
        
        // Setup UI
        this.setupUI();
        
        // Load initial data
        this.loadInitialData();
        
        // Setup real-time connections
        this.setupRealtimeConnections();
        
        // Setup SSE for backend events
        this.setupSSE();
        
        // Hide loading screen
        document.getElementById('loading-screen').style.display = 'none';
    }

    update() {
        // Handle camera movement
        this.handleCameraMovement();
        
        // Update agent animations
        this.updateAgentAnimations();
        
        // Update trade route animations
        this.updateTradeRoutes();
        
        // Update UI
        this.updateUI();
    }

    generateMap() {
        for (let y = 0; y < this.mapHeight; y++) {
            this.tiles[y] = [];
            this.fogOfWar[y] = [];
            
            for (let x = 0; x < this.mapWidth; x++) {
                // Generate terrain
                const terrainType = this.getTerrainType(x, y);
                const tile = this.add.sprite(x * this.tileSize, y * this.tileSize, terrainType);
                tile.setOrigin(0, 0);
                tile.setInteractive();
                
                // Store tile data
                this.tiles[y][x] = {
                    sprite: tile,
                    type: terrainType,
                    x: x,
                    y: y,
                    settlement: null,
                    district: null,
                    building: null,
                    unit: null
                };
                
                // Add to terrain layer
                this.terrainLayer.add(tile);
                
                // Setup tile interaction
                tile.on('pointerdown', () => this.onTileClick(x, y));
                tile.on('pointerover', () => this.onTileHover(x, y));
                
                // Initialize fog of war
                this.fogOfWar[y][x] = true;
                const fog = this.add.rectangle(
                    x * this.tileSize,
                    y * this.tileSize,
                    this.tileSize,
                    this.tileSize,
                    0x000000,
                    0.5
                );
                fog.setOrigin(0, 0);
                this.uiLayer.add(fog);
            }
        }
    }

    getTerrainType(x, y) {
        // Use Perlin noise or simple random for terrain generation
        const rand = Phaser.Math.FloatBetween(0, 1);
        
        // Create some structure to the map
        const centerDist = Math.sqrt(Math.pow(x - 25, 2) + Math.pow(y - 25, 2));
        
        if (centerDist > 20) {
            if (rand < 0.3) return 'tile_ocean';
        }
        
        if (rand < 0.1) return 'tile_mountain';
        if (rand < 0.3) return 'tile_forest';
        if (rand < 0.4) return 'tile_desert';
        
        return 'tile_grass';
    }

    async loadInitialData() {
        try {
            // Load agent sessions
            const { data: agents } = await supabase
                .from('agent_sessions')
                .select('*')
                .eq('status', 'active');
            
            if (agents) {
                agents.forEach(agent => this.createAgent(agent));
            }
            
            // Load files as settlements
            const { data: files } = await supabase
                .from('files')
                .select('*');
            
            if (files) {
                files.forEach(file => this.createSettlement(file));
            }
            
            // Load code structures
            await this.loadCodeStructures();
            
            // Load dependencies as trade routes
            await this.loadDependencies();
            
            // Update stats
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadCodeStructures() {
        try {
            const { data: structures } = await supabase
                .from('code_structures')
                .select('*')
                .order('depth', { ascending: true });
            
            if (structures && structures.length > 0) {
                // Group structures by file
                const fileStructures = new Map();
                
                structures.forEach(struct => {
                    if (!fileStructures.has(struct.file_id)) {
                        fileStructures.set(struct.file_id, []);
                    }
                    fileStructures.get(struct.file_id).push(struct);
                });
                
                // Create districts and buildings for each file
                fileStructures.forEach((structs, fileId) => {
                    const settlement = this.getSettlementByFileId(fileId);
                    if (settlement) {
                        this.createStructuresInSettlement(settlement, structs);
                    }
                });
            } else {
                // No structures yet - this is expected until TreeSitter integration
                console.log('No code structures available - awaiting TreeSitter integration');
                this.showParsingLimitedNotification();
            }
        } catch (error) {
            console.error('Error loading code structures:', error);
        }
    }
    
    showParsingLimitedNotification() {
        // Show a notification that structure parsing is limited
        const notification = this.add.text(
            this.cameras.main.width / 2,
            50,
            '⚠️ Code structure visualization limited - Full parsing coming with TreeSitter integration',
            {
                fontSize: '14px',
                color: '#FFD700',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 }
            }
        );
        notification.setOrigin(0.5, 0.5);
        notification.setScrollFactor(0);
        notification.setDepth(200);
        
        // Fade out after 5 seconds
        this.tweens.add({
            targets: notification,
            alpha: 0,
            duration: 1000,
            delay: 5000,
            onComplete: () => notification.destroy()
        });
    }

    createStructuresInSettlement(settlement, structures) {
        // Group by parent structure
        const grouped = new Map();
        
        structures.forEach(struct => {
            const parent = struct.parent_structure_id || 'root';
            if (!grouped.has(parent)) {
                grouped.set(parent, []);
            }
            grouped.get(parent).push(struct);
        });
        
        // Create districts for classes
        const classes = structures.filter(s => s.type === 'class');
        classes.forEach(cls => {
            this.createDistrict(settlement, cls);
        });
        
        // Create buildings for methods/functions
        structures.forEach(struct => {
            if (struct.type !== 'class') {
                this.createBuilding(settlement, struct);
            }
        });
    }

    createDistrict(settlement, classStructure) {
        const x = settlement.x + classStructure.district_x;
        const y = settlement.y + classStructure.district_y;
        
        // Create district walls
        const wall = this.add.graphics();
        wall.lineStyle(2, parseInt(classStructure.building_color.replace('#', '0x')), 0.8);
        wall.strokeRect(
            x * this.tileSize - this.tileSize / 2,
            y * this.tileSize - this.tileSize / 2,
            this.tileSize * 3,
            this.tileSize * 3
        );
        
        // Create district gate (constructor)
        const gate = this.add.sprite(x * this.tileSize, y * this.tileSize, 'district_gate');
        gate.setTint(parseInt(classStructure.building_color.replace('#', '0x')));
        
        const district = {
            id: classStructure.id,
            name: classStructure.name,
            wall: wall,
            gate: gate,
            x: x,
            y: y,
            settlement: settlement,
            buildings: []
        };
        
        this.districts.set(classStructure.id, district);
        this.districtLayer.add(wall);
        this.districtLayer.add(gate);
        
        // Add district label
        const label = this.add.text(
            x * this.tileSize,
            (y - 1) * this.tileSize,
            classStructure.name,
            {
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 4, y: 2 }
            }
        );
        label.setOrigin(0.5, 0.5);
        this.uiLayer.add(label);
    }

    createBuilding(settlement, structure) {
        const x = settlement.x + structure.district_x;
        const y = settlement.y + structure.district_y;
        
        // Determine building sprite based on type
        let spriteKey = 'building_public';
        if (structure.type === 'constructor') {
            spriteKey = 'building_constructor';
        } else if (structure.is_async) {
            spriteKey = 'building_async';
        } else if (structure.is_static) {
            spriteKey = 'building_static';
        } else if (structure.visibility === 'private') {
            spriteKey = 'building_private';
        }
        
        const building = this.add.sprite(x * this.tileSize, y * this.tileSize, spriteKey);
        building.setTint(parseInt(structure.building_color.replace('#', '0x')));
        building.setScale(0.5 + structure.building_size * 0.1);
        building.setInteractive();
        
        const buildingData = {
            id: structure.id,
            name: structure.name,
            type: structure.type,
            sprite: building,
            x: x,
            y: y,
            settlement: settlement,
            structure: structure
        };
        
        this.buildings.set(structure.id, buildingData);
        this.buildingLayer.add(building);
        
        // Add building interaction
        building.on('pointerdown', () => this.onBuildingClick(buildingData));
        building.on('pointerover', () => this.onBuildingHover(buildingData));
        
        // Add tooltip
        building.on('pointerover', () => {
            this.showTooltip(x * this.tileSize, y * this.tileSize, 
                `${structure.name}\n${structure.type}\nLines: ${structure.end_line - structure.start_line}`);
        });
        building.on('pointerout', () => this.hideTooltip());
    }

    async loadDependencies() {
        try {
            const { data: dependencies } = await supabase
                .from('dependencies')
                .select('*');
            
            if (dependencies) {
                dependencies.forEach(dep => this.createTradeRoute(dep));
            }
        } catch (error) {
            console.error('Error loading dependencies:', error);
        }
    }

    createTradeRoute(dependency) {
        const sourceSettlement = this.getSettlementByFileId(dependency.source_file_id);
        const targetSettlement = this.getSettlementByFileId(dependency.target_file_id);
        
        if (sourceSettlement && targetSettlement) {
            // Create animated trade route line
            const line = this.add.graphics();
            const color = parseInt(dependency.route_color?.replace('#', '0x') || '0x4169E1');
            
            line.lineStyle(dependency.route_strength || 1, color, 0.6);
            line.strokeLineShape(new Phaser.Geom.Line(
                sourceSettlement.x * this.tileSize,
                sourceSettlement.y * this.tileSize,
                targetSettlement.x * this.tileSize,
                targetSettlement.y * this.tileSize
            ));
            
            this.routeLayer.add(line);
            
            // Store trade route for animation
            this.tradeRoutes.set(dependency.id, {
                line: line,
                source: sourceSettlement,
                target: targetSettlement,
                strength: dependency.route_strength,
                particles: []
            });
            
            // Create moving particles along route
            this.createRouteParticles(dependency.id);
        }
    }

    createRouteParticles(routeId) {
        const route = this.tradeRoutes.get(routeId);
        if (!route) return;
        
        // Create particles that move along the route
        for (let i = 0; i < route.strength; i++) {
            const particle = this.add.circle(
                route.source.x * this.tileSize,
                route.source.y * this.tileSize,
                3,
                0xFFD700
            );
            
            this.effectLayer.add(particle);
            route.particles.push(particle);
            
            // Animate particle along route
            this.tweens.add({
                targets: particle,
                x: route.target.x * this.tileSize,
                y: route.target.y * this.tileSize,
                duration: 5000 + i * 1000,
                repeat: -1,
                delay: i * 1000
            });
        }
    }

    createAgent(agentData) {
        const x = agentData.position_x || 25;
        const y = agentData.position_y || 25;
        
        const agent = this.add.sprite(x * this.tileSize, y * this.tileSize, 'unit_worker');
        agent.setOrigin(0.5, 0.5);
        agent.setInteractive();
        agent.setDepth(10);
        
        // Add status indicator
        const statusColors = {
            'idle': 0xFFD700,
            'working': 0xFF8C00,
            'thinking': 0x00CED1,
            'error': 0xFF0000
        };
        
        const statusIndicator = this.add.circle(
            x * this.tileSize,
            y * this.tileSize - 20,
            5,
            statusColors[agentData.status] || 0xFFD700
        );
        
        const agentObj = {
            id: agentData.session_id,
            sprite: agent,
            statusIndicator: statusIndicator,
            x: x,
            y: y,
            status: agentData.status,
            data: agentData,
            path: [],
            targetBuilding: null
        };
        
        this.agents.set(agentData.session_id, agentObj);
        this.unitLayer.add(agent);
        this.unitLayer.add(statusIndicator);
        
        // Reveal fog of war around agent
        this.revealFog(x, y, 2);
        
        // Setup agent interaction
        agent.on('pointerdown', () => this.onAgentClick(agentObj));
        
        // Animate idle bounce
        this.tweens.add({
            targets: agent,
            y: agent.y - 5,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createSettlement(fileData) {
        const x = fileData.position_x || 25;
        const y = fileData.position_y || 25;
        
        // Determine settlement size based on file
        let size = 'small';
        if (fileData.lines_of_code > 500) size = 'large';
        else if (fileData.lines_of_code > 100) size = 'medium';
        
        const settlement = this.add.sprite(x * this.tileSize, y * this.tileSize, `settlement_${size}`);
        settlement.setOrigin(0.5, 0.5);
        settlement.setTint(parseInt(fileData.building_color?.replace('#', '0x') || '0x808080'));
        settlement.setInteractive();
        
        // Add parsing status indicator
        let statusIcon = '';
        let statusColor = '#808080';
        if (fileData.has_structures) {
            statusIcon = '✓';
            statusColor = '#00FF00';
        } else if (fileData.needs_parsing) {
            statusIcon = '⏳';
            statusColor = '#FFD700';
        }
        
        const settlementObj = {
            id: fileData.id,
            sprite: settlement,
            x: x,
            y: y,
            data: fileData,
            districts: [],
            buildings: [],
            parsingStatus: fileData.has_structures ? 'complete' : 
                          fileData.needs_parsing ? 'pending' : 'not_started'
        };
        
        this.settlements.set(fileData.id, settlementObj);
        this.settlementLayer.add(settlement);
        
        // Add settlement name with parsing status
        const nameText = fileData.file_name + (statusIcon ? ` ${statusIcon}` : '');
        const name = this.add.text(
            x * this.tileSize,
            (y + 1) * this.tileSize,
            nameText,
            {
                fontSize: '10px',
                color: statusColor,
                backgroundColor: '#000000',
                padding: { x: 2, y: 1 }
            }
        );
        name.setOrigin(0.5, 0);
        this.uiLayer.add(name);
        
        settlementObj.nameText = name;
        
        // Reveal fog around settlement
        this.revealFog(x, y, 3);
        
        // Setup interaction
        settlement.on('pointerdown', () => this.onSettlementClick(settlementObj));
        settlement.on('pointerover', () => this.onSettlementHover(settlementObj));
        settlement.on('pointerout', () => this.onSettlementOut(settlementObj));
    }
    
    onSettlementHover(settlement) {
        // Show parsing status tooltip
        let statusText = 'File: ' + settlement.data.file_name;
        if (settlement.parsingStatus === 'complete') {
            statusText += '\n✓ Structures parsed';
        } else if (settlement.parsingStatus === 'pending') {
            statusText += '\n⏳ Parsing pending (need file content)';
        } else {
            statusText += '\n○ Not yet parsed';
        }
        
        this.showTooltip(
            settlement.x * this.tileSize,
            settlement.y * this.tileSize,
            statusText
        );
    }
    
    onSettlementOut(settlement) {
        this.hideTooltip();
    }

    getSettlementByFileId(fileId) {
        for (let [id, settlement] of this.settlements) {
            if (settlement.data.id === fileId) {
                return settlement;
            }
        }
        return null;
    }

    moveAgent(agent, targetX, targetY, targetBuilding = null) {
        // Store target building if moving to specific method/function
        agent.targetBuilding = targetBuilding;
        
        // Calculate path (simplified - straight line for now)
        const path = this.calculatePath(agent.x, agent.y, targetX, targetY);
        agent.path = path;
        
        // Animate movement
        this.animateAgentMovement(agent);
    }

    calculatePath(startX, startY, endX, endY) {
        // Simple straight line path for now
        // TODO: Implement A* pathfinding
        const path = [];
        const dx = endX - startX;
        const dy = endY - startY;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        for (let i = 0; i <= steps; i++) {
            path.push({
                x: Math.round(startX + (dx * i / steps)),
                y: Math.round(startY + (dy * i / steps))
            });
        }
        
        return path;
    }

    animateAgentMovement(agent) {
        if (agent.path.length === 0) {
            // Reached destination
            if (agent.targetBuilding) {
                this.onAgentReachBuilding(agent, agent.targetBuilding);
            }
            return;
        }
        
        const nextPos = agent.path.shift();
        agent.x = nextPos.x;
        agent.y = nextPos.y;
        
        // Reveal fog as agent moves
        this.revealFog(nextPos.x, nextPos.y, 2);
        
        // Animate to next position
        this.tweens.add({
            targets: [agent.sprite, agent.statusIndicator],
            x: nextPos.x * this.tileSize,
            y: {
                value: nextPos.y * this.tileSize,
                offset: (target) => target === agent.statusIndicator ? -20 : 0
            },
            duration: 200,
            onComplete: () => {
                this.animateAgentMovement(agent);
            }
        });
    }

    onAgentReachBuilding(agent, building) {
        // Show activity at building
        this.showActivityEffect(building.x, building.y, 'construction');
        
        // Update agent status
        agent.status = 'working';
        agent.statusIndicator.setFillStyle(0xFF8C00);
        
        // Add activity to feed
        this.addActivityFeedItem({
            icon: '🔨',
            text: `Agent working on ${building.name}`,
            time: new Date().toLocaleTimeString()
        });
    }

    showActivityEffect(x, y, type) {
        let effect;
        
        switch (type) {
            case 'construction':
                // Orange particles for construction
                for (let i = 0; i < 10; i++) {
                    const particle = this.add.circle(
                        x * this.tileSize,
                        y * this.tileSize,
                        2,
                        0xFF8C00
                    );
                    
                    this.effectLayer.add(particle);
                    
                    this.tweens.add({
                        targets: particle,
                        x: x * this.tileSize + Phaser.Math.Between(-30, 30),
                        y: y * this.tileSize + Phaser.Math.Between(-30, 30),
                        alpha: 0,
                        duration: 1000,
                        onComplete: () => particle.destroy()
                    });
                }
                break;
            
            case 'exploration':
                // Green expanding circle for exploration
                effect = this.add.circle(x * this.tileSize, y * this.tileSize, 10, 0x00FF00, 0.5);
                this.effectLayer.add(effect);
                
                this.tweens.add({
                    targets: effect,
                    scaleX: 5,
                    scaleY: 5,
                    alpha: 0,
                    duration: 1500,
                    onComplete: () => effect.destroy()
                });
                break;
            
            case 'command':
                // Lightning effect for commands
                const lightning = this.add.graphics();
                lightning.lineStyle(2, 0xFFFF00, 1);
                
                // Draw jagged line
                const points = [];
                for (let i = 0; i <= 5; i++) {
                    points.push({
                        x: x * this.tileSize + Phaser.Math.Between(-20, 20),
                        y: (y - 2) * this.tileSize + i * 20
                    });
                }
                
                for (let i = 0; i < points.length - 1; i++) {
                    lightning.strokeLineShape(new Phaser.Geom.Line(
                        points[i].x, points[i].y,
                        points[i + 1].x, points[i + 1].y
                    ));
                }
                
                this.effectLayer.add(lightning);
                
                this.tweens.add({
                    targets: lightning,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => lightning.destroy()
                });
                break;
        }
    }

    revealFog(centerX, centerY, radius) {
        for (let y = Math.max(0, centerY - radius); y <= Math.min(this.mapHeight - 1, centerY + radius); y++) {
            for (let x = Math.max(0, centerX - radius); x <= Math.min(this.mapWidth - 1, centerX + radius); x++) {
                const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                if (dist <= radius) {
                    this.fogOfWar[y][x] = false;
                    // Update fog visual
                    // This would need proper fog management
                }
            }
        }
    }

    setupControls() {
        // Keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Mouse controls
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            const zoom = this.cameras.main.zoom;
            this.cameras.main.setZoom(Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.5, 2));
        });
        
        // Drag to pan
        let dragStart = null;
        this.input.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                dragStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
            }
        });
        
        this.input.on('pointermove', (pointer) => {
            if (dragStart && pointer.rightButtonDown()) {
                const dx = (dragStart.x - pointer.x) / this.cameras.main.zoom;
                const dy = (dragStart.y - pointer.y) / this.cameras.main.zoom;
                this.cameras.main.setScroll(dragStart.scrollX + dx, dragStart.scrollY + dy);
            }
        });
        
        this.input.on('pointerup', () => {
            dragStart = null;
        });
        
        // ESC to deselect
        this.input.keyboard.on('keydown-ESC', () => {
            this.selectedUnit = null;
            this.selectedSettlement = null;
            this.selectedBuilding = null;
            this.updateSelectionInfo();
        });
    }

    handleCameraMovement() {
        const cam = this.cameras.main;
        let scrollX = cam.scrollX;
        let scrollY = cam.scrollY;
        
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            scrollX -= this.cameraSpeed;
        }
        if (this.cursors.right.isDown || this.wasd.D.isDown) {
            scrollX += this.cameraSpeed;
        }
        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            scrollY -= this.cameraSpeed;
        }
        if (this.cursors.down.isDown || this.wasd.S.isDown) {
            scrollY += this.cameraSpeed;
        }
        
        cam.setScroll(scrollX, scrollY);
    }

    onTileClick(x, y) {
        const tile = this.tiles[y][x];
        
        if (this.selectedUnit) {
            // Move selected unit to tile
            if (tile.building) {
                this.moveAgent(this.selectedUnit, x, y, tile.building);
            } else {
                this.moveAgent(this.selectedUnit, x, y);
            }
        } else if (tile.unit) {
            // Select unit on tile
            this.selectedUnit = this.agents.get(tile.unit);
            this.updateSelectionInfo();
        } else if (tile.building) {
            // Select building
            this.selectedBuilding = tile.building;
            this.updateSelectionInfo();
        } else if (tile.settlement) {
            // Select settlement
            this.selectedSettlement = tile.settlement;
            this.updateSelectionInfo();
        }
    }

    onTileHover(x, y) {
        // Show tile info in UI
    }

    onAgentClick(agent) {
        this.selectedUnit = agent;
        this.updateSelectionInfo();
    }

    onSettlementClick(settlement) {
        this.selectedSettlement = settlement;
        this.selectedUnit = null;
        this.updateSelectionInfo();
    }

    onBuildingClick(building) {
        this.selectedBuilding = building;
        this.selectedUnit = null;
        this.selectedSettlement = null;
        this.updateSelectionInfo();
        
        // Show building details
        this.showBuildingDetails(building);
    }

    onBuildingHover(building) {
        // Highlight building
        building.sprite.setScale(building.sprite.scaleX * 1.1);
    }

    showBuildingDetails(building) {
        // Could show source code or details in a panel
        console.log('Building details:', building.structure);
    }

    showTooltip(x, y, text) {
        if (this.tooltip) {
            this.tooltip.destroy();
        }
        
        this.tooltip = this.add.text(x, y - 30, text, {
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 }
        });
        this.tooltip.setOrigin(0.5, 1);
        this.tooltip.setDepth(100);
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }

    setupUI() {
        // Stats text
        this.statsText = this.add.text(10, 10, '', {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 5 }
        });
        this.statsText.setScrollFactor(0);
        this.statsText.setDepth(100);
        
        // Selection info panel
        this.selectionInfo = this.add.text(10, 100, '', {
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 5 }
        });
        this.selectionInfo.setScrollFactor(0);
        this.selectionInfo.setDepth(100);
    }

    updateUI() {
        // Update stats
        const agentCount = this.agents.size;
        const settlementCount = this.settlements.size;
        const buildingCount = this.buildings.size;
        
        this.statsText.setText([
            `Agents: ${agentCount}`,
            `Settlements: ${settlementCount}`,
            `Buildings: ${buildingCount}`,
            `FPS: ${Math.round(this.game.loop.actualFps)}`
        ]);
    }

    updateSelectionInfo() {
        if (this.selectedUnit) {
            this.selectionInfo.setText([
                'Selected: Agent',
                `ID: ${this.selectedUnit.id.slice(0, 8)}`,
                `Status: ${this.selectedUnit.status}`,
                `Position: (${this.selectedUnit.x}, ${this.selectedUnit.y})`
            ]);
        } else if (this.selectedBuilding) {
            this.selectionInfo.setText([
                'Selected: Building',
                `Name: ${this.selectedBuilding.name}`,
                `Type: ${this.selectedBuilding.type}`,
                `Lines: ${this.selectedBuilding.structure.end_line - this.selectedBuilding.structure.start_line}`
            ]);
        } else if (this.selectedSettlement) {
            this.selectionInfo.setText([
                'Selected: Settlement',
                `File: ${this.selectedSettlement.data.file_name}`,
                `Buildings: ${this.selectedSettlement.buildings.length}`,
                `Position: (${this.selectedSettlement.x}, ${this.selectedSettlement.y})`
            ]);
        } else {
            this.selectionInfo.setText('');
        }
    }

    updateStats() {
        // Update HTML stats
        document.getElementById('active-agents').textContent = this.agents.size;
        document.getElementById('total-files').textContent = this.settlements.size;
        document.getElementById('events-count').textContent = this.buildings.size;
    }

    updateAgentAnimations() {
        // Update agent status indicators
        this.agents.forEach(agent => {
            // Pulse effect for active agents
            if (agent.status === 'working') {
                const scale = 1 + Math.sin(this.time.now / 200) * 0.1;
                agent.sprite.setScale(scale);
            }
        });
    }

    updateTradeRoutes() {
        // Animate trade route particles
        // Already handled by tweens
    }

    setupRealtimeConnections() {
        // Subscribe to Supabase real-time updates
        supabase
            .channel('agent-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'agent_sessions'
            }, (payload) => {
                this.handleAgentUpdate(payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'files'
            }, (payload) => {
                this.handleFileUpdate(payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'code_structures'
            }, (payload) => {
                this.handleStructureUpdate(payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'dependencies'
            }, (payload) => {
                this.handleDependencyUpdate(payload);
            })
            .subscribe();
    }

    setupSSE() {
        this.eventSource = new EventSource(`${API_URL}/api/events/stream`);
        
        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleSSEUpdate(data);
        };
        
        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            this.updateConnectionStatus(false);
        };
        
        this.eventSource.onopen = () => {
            this.updateConnectionStatus(true);
        };
    }

    handleSSEUpdate(data) {
        switch (data.type) {
            case 'activity':
                this.handleActivityUpdate(data);
                break;
            
            case 'structures_updated':
                this.handleStructuresUpdated(data);
                break;
            
            case 'connected':
                console.log('SSE connected');
                break;
        }
    }

    handleActivityUpdate(data) {
        const { hookType, sessionId, activity } = data;
        
        // Get agent
        const agent = this.agents.get(sessionId);
        if (!agent) return;
        
        // Update agent status based on activity
        if (activity.category === 'code') {
            agent.status = 'working';
            agent.statusIndicator.setFillStyle(0xFF8C00);
            
            // Move agent to file if editing
            if (activity.details.file) {
                // Find settlement for file
                this.settlements.forEach(settlement => {
                    if (settlement.data.file_path === activity.details.file) {
                        this.moveAgent(agent, settlement.x, settlement.y);
                        this.showActivityEffect(settlement.x, settlement.y, 'construction');
                    }
                });
            }
        } else if (activity.category === 'exploration') {
            agent.status = 'exploring';
            agent.statusIndicator.setFillStyle(0x00CED1);
            this.showActivityEffect(agent.x, agent.y, 'exploration');
        } else if (activity.category === 'command') {
            this.showActivityEffect(agent.x, agent.y, 'command');
        }
        
        // Add to activity feed
        this.addActivityFeedItem({
            icon: activity.icon,
            text: `${activity.action}: ${JSON.stringify(activity.details).slice(0, 50)}`,
            time: new Date().toLocaleTimeString()
        });
    }

    handleStructuresUpdated(data) {
        // Reload structures for the updated file
        this.loadCodeStructures();
        
        // Show update effect
        this.settlements.forEach(settlement => {
            if (settlement.data.file_path === data.file_path) {
                this.showActivityEffect(settlement.x, settlement.y, 'construction');
            }
        });
    }

    handleAgentUpdate(payload) {
        if (payload.eventType === 'INSERT') {
            this.createAgent(payload.new);
        } else if (payload.eventType === 'UPDATE') {
            const agent = this.agents.get(payload.new.session_id);
            if (agent) {
                agent.status = payload.new.status;
                // Update status indicator color
            }
        }
    }

    handleFileUpdate(payload) {
        if (payload.eventType === 'INSERT') {
            this.createSettlement(payload.new);
        }
    }

    handleStructureUpdate(payload) {
        // Reload structures for affected file
        this.loadCodeStructures();
    }

    handleDependencyUpdate(payload) {
        if (payload.eventType === 'INSERT') {
            this.createTradeRoute(payload.new);
        }
    }

    addActivityFeedItem(item) {
        const feedList = document.getElementById('activity-list');
        const activityDiv = document.createElement('div');
        activityDiv.className = 'activity-item';
        activityDiv.innerHTML = `
            <span class="activity-icon">${item.icon}</span>
            <span class="activity-text">${item.text}</span>
            <div class="activity-time">${item.time}</div>
        `;
        
        feedList.insertBefore(activityDiv, feedList.firstChild);
        
        // Keep only last 20 items
        while (feedList.children.length > 20) {
            feedList.removeChild(feedList.lastChild);
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Disconnected';
        }
    }

    createFallbackTexture(key) {
        // Create colored rectangles as fallback textures
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        
        const colors = {
            'tile_grass': 0x90EE90,
            'tile_ocean': 0x4682B4,
            'tile_desert': 0xF4A460,
            'tile_forest': 0x228B22,
            'tile_mountain': 0x808080,
            'unit_worker': 0xFFD700,
            'unit_explorer': 0x4169E1,
            'unit_builder': 0xFF8C00,
            'settlement_small': 0x8B4513,
            'settlement_medium': 0xA0522D,
            'settlement_large': 0x654321,
            'district_wall': 0x696969,
            'district_gate': 0xDAA520,
            'building_public': 0x32CD32,
            'building_private': 0xDC143C,
            'building_static': 0x708090,
            'building_async': 0x00CED1,
            'building_constructor': 0xFFD700
        };
        
        graphics.fillStyle(colors[key] || 0x808080);
        graphics.fillRect(0, 0, this.tileSize, this.tileSize);
        graphics.generateTexture(key, this.tileSize, this.tileSize);
        graphics.destroy();
    }
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#2d2d2d',
    scene: CivilizationScene,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

// Create game
const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});