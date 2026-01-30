import type { MapData, Block } from '@astroparty/shared';
import { GRID_WIDTH, GRID_HEIGHT } from '@astroparty/shared';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MapManager {
  private maps: Map<string, MapData> = new Map();
  private availableMapNames: string[] = [
    'empty_arena',
    'pillars',
    'four_corners',
    'crossroads',
    'bunkers',
  ];

  constructor() {
    this.loadAllMaps();
  }

  private loadAllMaps(): void {
    const mapsDir = path.join(__dirname, '../../maps');

    for (const mapName of this.availableMapNames) {
      const mapPath = path.join(mapsDir, `${mapName}.txt`);
      
      try {
        const mapData = this.loadMapFromFile(mapPath, mapName);
        this.maps.set(mapName, mapData);
        console.log(`[MapManager] Loaded map: ${mapName} (${mapData.blocks.length} blocks)`);
      } catch (error) {
        console.error(`[MapManager] Failed to load map ${mapName}:`, error);
      }
    }
  }

  private loadMapFromFile(filePath: string, name: string): MapData {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.replace('\r', ''));
    
    const blocks: Block[] = [];

    // Parse ASCII map
    for (let y = 0; y < lines.length && y < GRID_HEIGHT; y++) {
      const line = lines[y];
      for (let x = 0; x < line.length && x < GRID_WIDTH; x++) {
        if (line[x] === '#') {
          blocks.push({ gridX: x, gridY: y });
        }
      }
    }

    return {
      name,
      blocks,
    };
  }

  getRandomMap(): MapData {
    const mapNames = Array.from(this.maps.keys());
    if (mapNames.length === 0) {
      throw new Error('[MapManager] No maps loaded!');
    }

    const randomName = mapNames[Math.floor(Math.random() * mapNames.length)];
    const map = this.maps.get(randomName)!;
    
    console.log(`[MapManager] Selected map: ${randomName}`);
    return map;
  }

  getMapByName(name: string): MapData | undefined {
    return this.maps.get(name);
  }

  getAllMapNames(): string[] {
    return Array.from(this.maps.keys());
  }
}
