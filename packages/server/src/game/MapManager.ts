import type { MapData, Block } from '@astroparty/shared';
import { GRID_WIDTH, GRID_HEIGHT } from '@astroparty/shared';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MapManager {
  private maps: Map<string, MapData> = new Map();

  constructor() {
    this.loadAllMaps();
  }

  private loadAllMaps(): void {
    const mapsDir = path.join(__dirname, '../../maps');

    // Scan directory for all .map.txt files
    const files = fs.readdirSync(mapsDir);
    const mapFiles = files.filter(file => file.endsWith('.map.txt'));

    console.log(`[MapManager] Found ${mapFiles.length} map files in ${mapsDir}`);

    for (const filename of mapFiles) {
      const mapPath = path.join(mapsDir, filename);
      const mapName = filename.replace('.map.txt', '');
      
      try {
        const mapData = this.loadMapFromFile(mapPath, mapName);
        this.maps.set(mapName, mapData);
        console.log(`[MapManager] Loaded map: ${mapData.metadata.name} by ${mapData.metadata.author} (${mapData.blocks.length} blocks, ${mapData.metadata.width}x${mapData.metadata.height})`);
      } catch (error) {
        console.error(`[MapManager] Failed to load map ${mapName}:`, error);
      }
    }
  }

  private loadMapFromFile(filePath: string, fallbackName: string): MapData {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.replace('\r', '').trim()).filter(l => l.length > 0);
    
    let metadata: { name: string; author: string; width: number; height: number };
    let gridStartIndex = 0;
    
    // Check for new format (header line starting with #)
    if (lines.length > 0 && lines[0].startsWith('-')) {
      const header = lines[0].substring(1).trim(); // Remove leading '#'
      const parts = header.split('|').map(p => p.trim());
      
      const name = parts[0] || fallbackName;
      const author = parts[1] || 'Unknown';
      const gridSizeStr = parts[2] || `${GRID_WIDTH}x${GRID_HEIGHT}`;
      const [widthStr, heightStr] = gridSizeStr.split('x');
      const width = parseInt(widthStr) || GRID_WIDTH;
      const height = parseInt(heightStr) || GRID_HEIGHT;
      
      metadata = { name, author, width, height };
      gridStartIndex = 1; // Skip header line
    } else {
      // Old format - no header, use defaults
      metadata = {
        name: fallbackName,
        author: 'Unknown',
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
      };
      gridStartIndex = 0;
    }
    
    // Parse grid data
    const blocks: Block[] = [];
    for (let y = gridStartIndex; y < lines.length && (y - gridStartIndex) < metadata.height; y++) {
      const line = lines[y];
      for (let x = 0; x < Math.min(line.length, metadata.width); x++) {
        if (line[x] === '#') {
          blocks.push({
            gridX: x,
            gridY: y - gridStartIndex,
          });
        }
      }
    }

    return {
      metadata,
      blocks,
    };
  }

  getRandomMap(): MapData {
    const mapNames = Array.from(this.maps.keys());
    if (mapNames.length === 0) {
      throw new Error('[MapManager] No maps loaded!');
    }

    const randomName = mapNames[Math. floor(Math.random() * mapNames.length)];
    console.log(mapNames)
    const map = this.maps.get(randomName)!;
    
    console.log(`[MapManager] Selected map: ${map.metadata.name}`);
    return map;
  }

  getMapByName(name: string): MapData | undefined {
    return this.maps.get(name);
  }

  getAllMapNames(): string[] {
    return Array.from(this.maps.keys());
  }
}
