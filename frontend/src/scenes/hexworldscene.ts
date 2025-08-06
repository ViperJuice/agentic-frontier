import Phaser from 'phaser';

const TILE_W = 128;
const TILE_H = 128;
const MAP_W  = 1000;          // 1000 hex columns
const MAP_H  = 1000;          // 1000 hex rows

export default class HexWorldScene extends Phaser.Scene {
  private controls!: Phaser.Cameras.Controls.SmoothedKeyControl;

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