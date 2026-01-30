# AstroParty Maps

This directory contains map files for the AstroParty game.

## Map Format

Maps use a simple text format with optional metadata header:

```
- Map Name | Author Name | WIDTHxHEIGHT
<grid data>
```

### Example
```
- Empty Arena | Unknown | 32x18
################################
#                              #
#                              #
################################
```

## Creating Maps

### Using Map Editor (Recommended)

1. Start the map editor:
   ```bash
   docker compose up map-editor
   ```

2. Open http://localhost:3002 in your browser

3. Design your map using the visual editor

4. Export as `.txt` file

5. Copy the exported file to this directory

6. Restart the server to load new map

### Manual Creation

1. Create a `.txt` file in this directory

2. Add header line: `- Name | Author | WidthxHeight`

3. Add grid data:
   - `#` = Wall block
   - Any other character = Empty space

4. Ensure grid matches declared dimensions

## Current Maps

- **empty_arena.txt** - Simple bordered arena (32x18)
- **pillars.txt** - Arena with scattered pillar obstacles (32x18)
- **four_corners.txt** - Bunkers in each corner (32x18)
- **crossroads.txt** - Cross-shaped walls (32x18)
- **bunkers.txt** - Multiple defensive positions (32x18)

## Volume Mounting

When using Docker, you can mount this directory to add/remove maps without rebuilding:

```yaml
volumes:
  - ./maps:/app/packages/server/maps
```

Add new map files to the `./maps` directory and restart the container.
