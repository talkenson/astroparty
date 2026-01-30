# AstroParty Map Editor 🎨

Visual grid-based editor for creating and editing AstroParty game maps.

## Quick Start

```bash
npm run dev
```

Open **http://localhost:3002** in your browser.

## Features

- ✅ Visual 48×27 grid editor
- ✅ Click to draw/erase walls
- ✅ Export to `.txt` format (game-compatible)
- ✅ Import existing maps
- ✅ Live ASCII preview
- ✅ Quick actions (Clear, Fill, Add Border)
- ✅ Real-time statistics

## Usage

### Creating a Map

1. Draw walls by clicking (or dragging) on the grid
2. Right-click to erase
3. Enter a map name
4. Click "Export .txt"

### Installing a Map

1. Export your map
2. Copy `.txt` file to `packages/server/maps/`
3. Restart server
4. Map appears in rotation

### Editing Existing Maps

1. Click "Import .txt"
2. Select map from `packages/server/maps/`
3. Edit and re-export

## File Format

Exported files are plain text:
- `#` = Wall block
- `.` = Empty space
- 48 characters wide × 27 lines tall

Example:
```
################################################
#..............................................#
#..............................................#
################################################
```

## Controls

| Action | Control |
|--------|---------|
| Draw wall | Left click |
| Erase | Right click |
| Paint multiple | Drag mouse |

## Scripts

```bash
npm run dev      # Start development server (port 3002)
npm run build    # Build for production
npm run preview  # Preview production build
```

## Integration

Uses `@astroparty/shared` for game constants:
- `GRID_WIDTH` (48)
- `GRID_HEIGHT` (27)
- `BLOCK_SIZE` (40px)

## Tips

- **Coverage**: Aim for 20-40% for balanced gameplay
- **Borders**: Use "Add Border" for enclosed arenas
- **Testing**: Always test spawns and collisions in-game
- **Preview**: ASCII preview shows exactly what server will load

---

For detailed documentation, see [Map Editor Guide](../../.gemini/antigravity/brain/.../map_editor_guide.md)
