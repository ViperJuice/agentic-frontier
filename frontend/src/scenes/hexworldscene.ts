import Phaser from 'phaser';

const TILE_W = 128;
const TILE_H = 128;
const MAP_W  = 1000;          // 1000 hex columns
const MAP_H  = 1000;          // 1000 hex rows

// Agent sprite configuration
interface AgentSprite {
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  activityIcon?: Phaser.GameObjects.Text;
  targetPosition?: { x: number; y: number };
}

// File/district configuration
interface FileDistrict {
  fileId: string;
  filePath: string;
  position: { x: number; y: number };
  buildings: Map<string, Phaser.GameObjects.Container>;
  hasStructures: boolean;
}

// Code structure building
interface StructureBuilding {
  structureId: string;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  label?: Phaser.GameObjects.Text;
  type: string; // 'class' | 'method' | 'function' | 'file'
}

export default class HexWorldScene extends Phaser.Scene {
  private controls!: Phaser.Cameras.Controls.SmoothedKeyControl;

  // Agent management
  private agents = new Map<string, AgentSprite>();

  // File and code structure management
  private fileDistricts = new Map<string, FileDistrict>();
  private codeStructures = new Map<string, StructureBuilding>();

  // Dependencies and call graph visualization
  private dependencyLines = new Map<string, Phaser.GameObjects.Graphics>();

  constructor () {
    super('HexWorld');
  }

  preload () {
    // pick ONE of the flat sheets; swap filename to change outline style
    this.load.image(
      'terrainFlat',
      '/assets/tiles/hex-tiles/Flat/Terrain 1 - Flat - Black Outline 1px - 128x128.png'
    );
  }

  create () {
    // --------- 1. generate raw data  ----------------------------------
    // 1‑D array (Phaser expects either 2‑D or 1‑D); we'll use 2‑D for clarity.
    const data: number[][] = new Array(MAP_H);
    for (let r = 0; r < MAP_H; r++) {
      const row: number[] = new Array(MAP_W);
      for (let q = 0; q < MAP_W; q++) {
        row[q] = chooseTerrain(q, r);        // 0‑11
      }
      data[r] = row;
    }

    // --------- 2. create map & layer ----------------------------------
    const map = this.make.tilemap({
      data,
      tileWidth:  TILE_W,
      tileHeight: TILE_H
    } as any);
    
    // Set hexagonal properties after creation (workaround for TypeScript)
    (map as any).orientation = 'hexagonal';
    (map as any).staggerAxis = 'y';          // flat‑top layout
    (map as any).staggerIndex = 'odd';
    (map as any).hexSideLength = TILE_W / 2;  // ≈64 px, adjust if needed

    const tileset = map.addTilesetImage('terrainFlat');
    if (!tileset) {
      console.error('Failed to add tileset image');
      return;
    }
    
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) {
      console.error('Failed to create layer');
      return;
    }

    // optional: camera controls
    const cursors = this.input.keyboard?.createCursorKeys();
    if (!cursors) {
      console.error('Failed to create cursor keys');
      return;
    }
    
    this.cameras.main.setZoom(0.5).centerOn(0, 0);

    this.controls = new Phaser.Cameras.Controls.SmoothedKeyControl({
      camera: this.cameras.main,
      left:  cursors.left,
      right: cursors.right,
      up:    cursors.up,
      down:  cursors.down,
      acceleration: 0.05,
      drag:         0.0005,
      maxSpeed:     1.5
    });
  }

  update (_time: number, delta: number) {
    this.controls.update(delta);

    // Update agent movements
    this.agents.forEach((agent, sessionId) => {
      if (agent.targetPosition) {
        // Smooth movement towards target
        const dx = agent.targetPosition.x - agent.container.x;
        const dy = agent.targetPosition.y - agent.container.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 2) {
          agent.container.x += (dx / distance) * 2;
          agent.container.y += (dy / distance) * 2;
        } else {
          // Reached target
          agent.targetPosition = undefined;
        }
      }
    });
  }

  // ==================== PUBLIC API FOR MAIN.TS ====================

  /**
   * Called when an activity event is received via SSE
   */
  onActivityEvent(data: any) {
    console.log('[HexWorldScene] Activity event received:', data);

    const { sessionId, activity, agentType } = data;

    if (!sessionId) {
      console.warn('[HexWorldScene] Activity event missing sessionId');
      return;
    }

    // Create or update agent
    if (agentType) {
      this.createOrUpdateAgent(sessionId, agentType, activity);
    }

    // If activity involves a file, move agent to that file/structure
    if (activity?.details?.file_path) {
      this.moveAgentToFile(sessionId, activity.details.file_path, activity.details.structure_id);
    }
  }

  /**
   * Called when a structure update event is received via SSE
   */
  onStructureUpdate(data: any) {
    console.log('[HexWorldScene] Structure update received:', data);

    const { file, structures } = data;

    if (file) {
      this.createOrUpdateFileDistrict(file, structures || []);
    }
  }

  /**
   * Load initial files and structures from the database
   */
  async loadInitialState(files: any[], structures: any[]) {
    console.log(`[HexWorldScene] Loading ${files.length} files and ${structures.length} structures`);

    // Create file districts
    files.forEach(file => {
      const fileStructures = structures.filter(s => s.file_id === file.id);
      this.createOrUpdateFileDistrict(file, fileStructures);
    });
  }

  // ==================== AGENT MANAGEMENT ====================

  private createOrUpdateAgent(sessionId: string, agentType: string, activity?: any) {
    if (this.agents.has(sessionId)) {
      // Update existing agent
      const agent = this.agents.get(sessionId)!;

      // Update activity icon if provided
      if (activity?.icon && agent.activityIcon) {
        agent.activityIcon.setText(activity.icon);
      }

      return;
    }

    // Create new agent
    const startX = Phaser.Math.Between(500, 1500);
    const startY = Phaser.Math.Between(500, 1500);

    const color = this.getAgentColor(agentType);
    const circle = this.add.circle(0, 0, 20, color);
    circle.setStrokeStyle(3, 0xffffff);

    const label = this.add.text(0, -35, agentType.toUpperCase(), {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5);

    const activityIcon = this.add.text(0, 35, activity?.icon || '⚡', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const container = this.add.container(startX, startY, [circle, label, activityIcon]);

    this.agents.set(sessionId, {
      container,
      circle,
      label,
      activityIcon
    });

    console.log(`[HexWorldScene] Created ${agentType} agent at (${startX}, ${startY})`);
  }

  private getAgentColor(type: string): number {
    const typeMap: { [key: string]: number } = {
      'scout': 0x00AAFF,    // Blue - explorers
      'builder': 0xFF9900,  // Orange - creators
      'warrior': 0xFF0000,  // Red - fixers
      'settler': 0x00FF00   // Green - configurers
    };
    return typeMap[type.toLowerCase()] || 0xFFFFFF;
  }

  private moveAgentToFile(sessionId: string, filePath: string, structureId?: string) {
    const agent = this.agents.get(sessionId);
    if (!agent) {
      console.warn(`[HexWorldScene] Agent ${sessionId} not found for movement`);
      return;
    }

    // Find target position
    let targetPos: { x: number; y: number } | undefined;

    // Try to find specific code structure first
    if (structureId) {
      const structure = this.codeStructures.get(structureId);
      if (structure) {
        targetPos = {
          x: structure.sprite.x,
          y: structure.sprite.y
        };
      }
    }

    // Fall back to file district
    if (!targetPos) {
      this.fileDistricts.forEach(district => {
        if (district.filePath === filePath) {
          targetPos = district.position;
        }
      });
    }

    if (targetPos) {
      agent.targetPosition = targetPos;
      console.log(`[HexWorldScene] Agent ${sessionId} moving to ${filePath}`);
    } else {
      console.warn(`[HexWorldScene] Target not found for file: ${filePath}`);
    }
  }

  // ==================== FILE & CODE STRUCTURE MANAGEMENT ====================

  private createOrUpdateFileDistrict(file: any, structures: any[]) {
    const fileId = file.id;
    const filePath = file.path;
    const position = file.position || { x: 500, y: 500 };
    const hasStructures = file.has_structures || false;

    // Convert hex grid position to pixel position
    const pixelPos = this.hexToPixel(position.x, position.y);

    if (this.fileDistricts.has(fileId)) {
      // Update existing district
      const district = this.fileDistricts.get(fileId)!;
      district.position = pixelPos;
      district.hasStructures = hasStructures;

      // Update structures if provided
      if (structures.length > 0) {
        this.updateDistrictStructures(district, structures);
      }

      return;
    }

    // Create new district
    const district: FileDistrict = {
      fileId,
      filePath,
      position: pixelPos,
      buildings: new Map(),
      hasStructures
    };

    this.fileDistricts.set(fileId, district);

    if (hasStructures && structures.length > 0) {
      // Render code structures as individual buildings
      this.createCodeStructureBuildings(district, structures);
    } else {
      // Render file as single building
      this.createFileBuilding(district, file);
    }

    console.log(`[HexWorldScene] Created district for ${filePath} at (${pixelPos.x}, ${pixelPos.y})`);
  }

  private createFileBuilding(district: FileDistrict, file: any) {
    const { position } = district;
    const buildingHeight = file.building_height || 1;
    const buildingType = file.building_type || 'residential';

    // Create simple building representation (colored rectangle)
    const size = 30 + (buildingHeight * 10);
    const color = this.getBuildingColor(buildingType);

    const building = this.add.rectangle(position.x, position.y, size, size, color);
    building.setStrokeStyle(2, 0xffffff);

    // Add file name label
    const fileName = file.name || file.path.split('/').pop();
    const label = this.add.text(position.x, position.y + size/2 + 10, fileName, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 0);

    const container = this.add.container(0, 0, [building, label]);
    district.buildings.set('file', container);

    // Make interactive
    building.setInteractive();
    building.on('pointerdown', () => {
      console.log('[HexWorldScene] File clicked:', file.path);
      this.onBuildingClicked(file, null);
    });
  }

  private createCodeStructureBuildings(district: FileDistrict, structures: any[]) {
    const { position } = district;

    // Layout structures in a grid around the district center
    structures.forEach((structure, index) => {
      const offsetX = ((structure.district_x || index) * 50) - 100;
      const offsetY = ((structure.district_y || Math.floor(index / 3)) * 50) - 100;

      const buildingPos = {
        x: position.x + offsetX,
        y: position.y + offsetY
      };

      this.createStructureBuilding(district, structure, buildingPos);
    });
  }

  private createStructureBuilding(district: FileDistrict, structure: any, position: { x: number; y: number }) {
    const structureId = structure.id;
    const structureType = structure.type; // 'class' | 'method' | 'function' etc.
    const structureName = structure.name;
    const buildingSize = structure.building_size || 1;

    // Size and color based on structure type
    let size: number;
    let color: number;

    switch (structureType) {
      case 'class':
      case 'interface':
        size = 40 + (buildingSize * 5);
        color = 0x3498db; // Blue
        break;
      case 'method':
      case 'constructor':
        size = 25 + (buildingSize * 3);
        color = 0xe74c3c; // Red
        break;
      case 'function':
        size = 30 + (buildingSize * 3);
        color = 0x2ecc71; // Green
        break;
      case 'property':
        size = 15;
        color = 0xf39c12; // Orange
        break;
      default:
        size = 20;
        color = 0x95a5a6; // Gray
    }

    const building = this.add.rectangle(position.x, position.y, size, size, color);
    building.setStrokeStyle(2, 0xffffff);

    // Add structure name label
    const label = this.add.text(position.x, position.y + size/2 + 8, structureName, {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5, 0);

    const container = this.add.container(0, 0, [building, label]);
    district.buildings.set(structureId, container);

    // Store in code structures map
    this.codeStructures.set(structureId, {
      structureId,
      sprite: building,
      label,
      type: structureType
    });

    // Make interactive
    building.setInteractive();
    building.on('pointerdown', () => {
      console.log('[HexWorldScene] Structure clicked:', structureName);
      this.onBuildingClicked(null, structure);
    });
  }

  private updateDistrictStructures(district: FileDistrict, structures: any[]) {
    // Clear old buildings (except main file building)
    district.buildings.forEach((building, key) => {
      if (key !== 'file') {
        building.destroy();
        this.codeStructures.delete(key);
      }
    });

    // Create new structure buildings
    this.createCodeStructureBuildings(district, structures);
  }

  private getBuildingColor(buildingType: string): number {
    const colorMap: { [key: string]: number } = {
      'commercial': 0x3498db,
      'commercial_modern': 0x2980b9,
      'industrial': 0x95a5a6,
      'industrial_modern': 0x7f8c8d,
      'laboratory': 0x9b59b6,
      'datacenter': 0x34495e,
      'library': 0xe67e22,
      'artstudio': 0xe91e63,
      'monument': 0xf1c40f,
      'residential': 0x2ecc71
    };
    return colorMap[buildingType] || 0x7f8c8d;
  }

  // ==================== COORDINATE CONVERSION ====================

  /**
   * Convert hex grid coordinates (q, r) to pixel coordinates
   * Uses flat-top hexagon layout
   */
  private hexToPixel(q: number, r: number): { x: number; y: number } {
    // Flat-top hex math
    const x = TILE_W * (q + 0.5 * (r & 1));
    const y = TILE_H * 0.75 * r;
    return { x, y };
  }

  /**
   * Convert pixel coordinates to hex grid coordinates (q, r)
   */
  private pixelToHex(x: number, y: number): { q: number; r: number } {
    // Approximate inverse of hexToPixel
    const r = Math.round(y / (TILE_H * 0.75));
    const q = Math.round((x - (TILE_W * 0.5 * (r & 1))) / TILE_W);
    return { q, r };
  }

  // ==================== DEPENDENCY & CALL GRAPH VISUALIZATION ====================

  /**
   * Draw a dependency line between two file districts
   */
  drawDependency(sourceFileId: string, targetFileId: string, strength: number, color: string) {
    const sourceDistrict = this.fileDistricts.get(sourceFileId);
    const targetDistrict = this.fileDistricts.get(targetFileId);

    if (!sourceDistrict || !targetDistrict) {
      console.warn('[HexWorldScene] Cannot draw dependency - district not found');
      return;
    }

    const lineId = `${sourceFileId}-${targetFileId}`;

    // Remove old line if exists
    if (this.dependencyLines.has(lineId)) {
      this.dependencyLines.get(lineId)?.destroy();
    }

    // Create new line
    const graphics = this.add.graphics();
    const lineColor = parseInt(color.replace('#', ''), 16);
    const lineWidth = 2 + (strength || 1);

    graphics.lineStyle(lineWidth, lineColor, 0.6);
    graphics.beginPath();
    graphics.moveTo(sourceDistrict.position.x, sourceDistrict.position.y);
    graphics.lineTo(targetDistrict.position.x, targetDistrict.position.y);
    graphics.strokePath();

    this.dependencyLines.set(lineId, graphics);
  }

  /**
   * Clear all dependency lines
   */
  clearDependencies() {
    this.dependencyLines.forEach(line => line.destroy());
    this.dependencyLines.clear();
  }

  // ==================== INTERACTION HANDLERS ====================

  private onBuildingClicked(file: any, structure: any) {
    // Emit custom event that main.ts can listen to
    const detail = {
      file,
      structure,
      type: structure ? 'structure' : 'file'
    };

    console.log('[HexWorldScene] Building clicked:', detail);

    // Dispatch to window for UI updates
    window.dispatchEvent(new CustomEvent('buildingSelected', { detail }));
  }

  // ==================== PUBLIC UTILITY METHODS ====================

  /**
   * Center camera on a specific file or structure
   */
  centerOnFile(fileId: string) {
    const district = this.fileDistricts.get(fileId);
    if (district) {
      this.cameras.main.pan(district.position.x, district.position.y, 1000, 'Power2');
    }
  }

  /**
   * Remove an agent from the scene
   */
  removeAgent(sessionId: string) {
    const agent = this.agents.get(sessionId);
    if (agent) {
      agent.container.destroy();
      this.agents.delete(sessionId);
      console.log(`[HexWorldScene] Removed agent ${sessionId}`);
    }
  }

  /**
   * Get stats for UI display
   */
  getSceneStats() {
    return {
      activeAgents: this.agents.size,
      settlements: this.fileDistricts.size,
      codeStructures: this.codeStructures.size,
      dependencies: this.dependencyLines.size
    };
  }
}

/**
 * Simple terrain selector.
 *  – even rows/cols near edges -> water
 *  – band of noise / stripes for demo purposes
 * Replace with Perlin noise or data‑driven map generation.
 */
function chooseTerrain (q: number, r: number): number {
  // edges ocean
  if (q < 5 || r < 5 || q > MAP_W - 6 || r > MAP_H - 6) return 11;

  // cheap hash to vary tiles
  const h = (q * 928371 + r * 3643) & 0xffff;

  if (h % 97 < 4)  return 10;              // occasional lava
  if (h % 17 < 3)  return 8;               // forest
  if (h % 29 < 2)  return 6;               // hills
  if (h % 13 < 2)  return 4;               // dirt/plains
  if (h & 1)       return 1;               // sand
  return 0;                                // default grass
}