import { GRID_WIDTH, GRID_HEIGHT, BLOCK_SIZE } from '@astroparty/shared';

class MapEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid: boolean[][]; // true = wall, false = empty
  private currentTool: 'wall' | 'erase' = 'wall';
  private isDrawing = false;

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Initialize empty grid
    this.grid = Array(GRID_HEIGHT).fill(null).map(() => 
      Array(GRID_WIDTH).fill(false)
    );
    
    this.setupCanvas();
    this.setupEventListeners();
    this.render();
    this.updateStats();
    this.updatePreview();
  }

  private setupCanvas(): void {
    const width = GRID_WIDTH * BLOCK_SIZE;
    const height = GRID_HEIGHT * BLOCK_SIZE;
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
  }

  private setupEventListeners(): void {
    // Canvas mouse events
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDrawing = true;
      this.handleDraw(e);
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDrawing) this.handleDraw(e);
    });
    
    this.canvas.addEventListener('mouseup', () => {
      this.isDrawing = false;
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.isDrawing = false;
    });
    
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const prevTool = this.currentTool;
      this.currentTool = 'erase';
      this.isDrawing = true;
      this.handleDraw(e);
      // Return to previous tool after right-click
      setTimeout(() => {
        if (prevTool === 'wall') {
          this.setTool('wall');
        }
      }, 50);
    });
    
    // Tool buttons
    document.getElementById('tool-wall')!.addEventListener('click', () => {
      this.setTool('wall');
    });
    
    document.getElementById('tool-erase')!.addEventListener('click', () => {
      this.setTool('erase');
    });
    
    // Action buttons
    document.getElementById('btn-clear')!.addEventListener('click', () => {
      this.clearMap();
    });
    
    document.getElementById('btn-fill')!.addEventListener('click', () => {
      this.fillMap();
    });
    
    document.getElementById('btn-frame')!.addEventListener('click', () => {
      this.addBorder();
    });
    
    
    document.getElementById('btn-resize')!.addEventListener('click', () => {
      this.resizeGrid();
    });
    
    document.getElementById('btn-export')!.addEventListener('click', () => {
      this.exportMap();
    });
    
    document.getElementById('btn-import')!.addEventListener('click', () => {
      document.getElementById('file-input')!.click();
    });
    
    document.getElementById('file-input')!.addEventListener('change', (e) => {
      this.importMap(e as Event);
    });
  }

  private handleDraw(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = this.grid[0]?.length || GRID_WIDTH;
    const height = this.grid.length || GRID_HEIGHT;
    const x = Math.floor((e.clientX - rect.left) / BLOCK_SIZE);
    const y = Math.floor((e.clientY - rect.top) / BLOCK_SIZE);
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const newValue = this.currentTool === 'wall';
      
      // Only update if value changed
      if (this.grid[y][x] !== newValue) {
        this.grid[y][x] = newValue;
        this.render();
        this.updateStats();
        this.updatePreview();
      }
    }
  }

  private setTool(tool: 'wall' | 'erase'): void {
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`tool-${tool}`)!.classList.add('active');
  }

  private clearMap(): void {
    if (confirm('Clear entire map?')) {
      const width = this.grid[0]?.length || GRID_WIDTH;
      const height = this.grid.length || GRID_HEIGHT;
      this.grid = Array(height).fill(null).map(() => 
        Array(width).fill(false)
      );
      this.render();
      this.updateStats();
      this.updatePreview();
    }
  }

  private fillMap(): void {
    if (confirm('Fill entire map with walls?')) {
      const width = this.grid[0]?.length || GRID_WIDTH;
      const height = this.grid.length || GRID_HEIGHT;
      this.grid = Array(height).fill(null).map(() => 
        Array(width).fill(true)
      );
      this.render();
      this.updateStats();
      this.updatePreview();
    }
  }

  private addBorder(): void {
    const width = this.grid[0]?.length || GRID_WIDTH;
    const height = this.grid.length || GRID_HEIGHT;
    
    // Add 1-block border around edges
    for (let x = 0; x < width; x++) {
      this.grid[0][x] = true;
      this.grid[height - 1][x] = true;
    }
    for (let y = 0; y < height; y++) {
      this.grid[y][0] = true;
      this.grid[y][width - 1] = true;
    }
    this.render();
    this.updateStats();
    this.updatePreview();
  }

  private render(): void {
    const width = this.grid[0]?.length || GRID_WIDTH;
    const height = this.grid.length || GRID_HEIGHT;
    
    // Clear
    this.ctx.fillStyle = '#0a0a15';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid lines
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 1;
    
    for (let x = 0; x <= width; x++) {
      const px = x * BLOCK_SIZE;
      this.ctx.beginPath();
      this.ctx.moveTo(px, 0);
      this.ctx.lineTo(px, this.canvas.height);
      this.ctx.stroke();
    }
    
    for (let y = 0; y <= height; y++) {
      const py = y * BLOCK_SIZE;
      this.ctx.beginPath();
      this.ctx.moveTo(0, py);
      this.ctx.lineTo(this.canvas.width, py);
      this.ctx.stroke();
    }
    
    // Draw blocks
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.grid[y][x]) {
          // Solid block
          this.ctx.fillStyle = '#2a2a3e88';
          this.ctx.fillRect(
            x * BLOCK_SIZE + 1,
            y * BLOCK_SIZE + 1,
            BLOCK_SIZE - 2,
            BLOCK_SIZE - 2
          );
          
          // Border
          this.ctx.strokeStyle = '#1a1a2eaa';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(
            x * BLOCK_SIZE + 1,
            y * BLOCK_SIZE + 1,
            BLOCK_SIZE - 2,
            BLOCK_SIZE - 2
          );
        }
      }
    }
  }

  private updateStats(): void {
    const width = this.grid[0]?.length || GRID_WIDTH;
    const height = this.grid.length || GRID_HEIGHT;
    const blockCount = this.grid.flat().filter(b => b).length;
    const total = width * height;
    const coverage = ((blockCount / total) * 100).toFixed(1);
    
    document.getElementById('grid-size')!.textContent = `${width} x ${height}`;
    document.getElementById('block-count')!.textContent = String(blockCount);
    document.getElementById('coverage')!.textContent = coverage + '%';
  }

  private updatePreview(): void {
    const txt = this.gridToText();
    (document.getElementById('preview') as HTMLTextAreaElement).value = txt;
  }

  private gridToText(): string {
    return this.grid.map(row => 
      row.map(cell => cell ? '#' : '.').join('')
    ).join('\n');
  }

  private exportMap(): void {
    const mapName = (document.getElementById('map-name') as HTMLInputElement).value || 'Custom Map';
    const mapAuthor = (document.getElementById('map-author') as HTMLInputElement).value || 'Unknown';
    const width = this.grid[0]?.length || GRID_WIDTH;
    const height = this.grid.length || GRID_HEIGHT;
    
    // Build header in new format: - name | author | WIDTHxHEIGHT
    const header = `- ${mapName} | ${mapAuthor} | ${width}x${height}`;
    const gridData = this.gridToText();
    const fullContent = `${header}\n${gridData}`;
    
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = mapName.toLowerCase().replace(/\s+/g, '_');
    a.download = `${filename}.map.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log(`Exported map: ${mapName} (${width}x${height})`);
  }

  private async importMap(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim());
    
    // Parse header if present (new format with -)
    if (lines.length > 0 && lines[0].startsWith('-')) {
      const header = lines[0].substring(1).trim();
      const parts = header.split('|').map(p => p.trim());
      
      const name = parts[0] || file.name.replace('.map.txt', '').replace('.txt', '');
      const author = parts[1] || '';
      const gridSizeStr = parts[2] || `${GRID_WIDTH}x${GRID_HEIGHT}`;
      const [widthStr, heightStr] = gridSizeStr.split('x');
      const width = parseInt(widthStr) || GRID_WIDTH;
      const height = parseInt(heightStr) || GRID_HEIGHT;
      
      (document.getElementById('map-name') as HTMLInputElement).value = name;
      (document.getElementById('map-author') as HTMLInputElement).value = author;
      (document.getElementById('grid-width') as HTMLInputElement).value = String(width);
      (document.getElementById('grid-height')as HTMLInputElement).value = String(height);
      
      // Parse grid starting from line 1
      const gridLines = lines.slice(1).filter(l => l.length > 0);
      this.grid = this.textToGrid(gridLines.join('\n'), width, height);
    } else {
      // Old format - no header
      (document.getElementById('map-name') as HTMLInputElement).value = file.name.replace('.map.txt', '').replace('.txt', '');
      (document.getElementById('map-author') as HTMLInputElement).value = '';
      this.grid = this.textToGrid(text, GRID_WIDTH, GRID_HEIGHT);
    }
    
    this.resizeCanvas();
    this.render();
    this.updateStats();
    this.updatePreview();
    
    console.log(`Imported map: ${file.name}`);
    input.value = '';
  }
  
  private resizeGrid(): void {
    const newWidth = parseInt((document.getElementById('grid-width') as HTMLInputElement).value) || GRID_WIDTH;
    const newHeight = parseInt((document.getElementById('grid-height') as HTMLInputElement).value) || GRID_HEIGHT;
    
    // Validate
    if (newWidth < 10 || newWidth > 100 || newHeight < 10 || newHeight > 60) {
      alert('Grid size must be between 10x10 and 100x60');
      return;
    }
    
    const oldGrid = this.grid;
    const oldWidth = oldGrid[0]?.length || GRID_WIDTH;
    const oldHeight = oldGrid.length || GRID_HEIGHT;
    
    // Create new grid
    const newGrid: boolean[][] = Array(newHeight).fill(null).map(() => 
      Array(newWidth).fill(false)
    );
    
    // Copy old content (top-left aligned)
    for (let y = 0; y < Math.min(oldHeight, newHeight); y++) {
      for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
        newGrid[y][x] = oldGrid[y][x];
      }
    }
    
    this.grid = newGrid;
    this.resizeCanvas();
    this.render();
    this.updateStats();
    this.updatePreview();
    
    console.log(`Resized grid to ${newWidth}x${newHeight}`);
  }
  
  private resizeCanvas(): void {
    const width = this.grid[0]?.length || GRID_WIDTH;
    const height = this.grid.length || GRID_HEIGHT;
    
    this.canvas.width = width * BLOCK_SIZE;
    this.canvas.height = height * BLOCK_SIZE;
    this.canvas.style.width = width * BLOCK_SIZE + 'px';
    this.canvas.style.height = height * BLOCK_SIZE + 'px';
  }
  
  private textToGrid(text: string, width: number, height: number): boolean[][] {
    const lines = text.trim().split('\n');
    const grid: boolean[][] = [];
    
    for (let y = 0; y < height; y++) {
      const row: boolean[] = [];
      const line = lines[y] || '';
      
      for (let x = 0; x < width; x++) {
        row.push(line[x] === '#');
      }
      
      grid.push(row);
    }
    
    return grid;
  }
}

// Initialize editor when DOM is ready
new MapEditor();
