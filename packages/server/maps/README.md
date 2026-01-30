# AstroParty Maps

This directory contains map files for the AstroParty game.

## Map Format

Maps use a simple text format with optional metadata header:

**File Extension:** `.map.txt`

```
- Map Name | Author Name | WIDTHxHEIGHT
<grid data>
```

### Example (`empty_arena.map.txt`)
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

4. Export as `.map.txt` file

5. Copy the exported file to this directory

6. Restart the server: `docker compose restart astroparty`

### Manual Creation

1. Create a `.map.txt` file in this directory

2. Add header line: `- Name | Author | WidthxHeight`

3. Add grid data:
   - `#` = Wall block
   - Any other character = Empty space

4. Ensure grid matches declared dimensions

## Current Maps

All maps are automatically discovered by scanning for `.map.txt` files:

- **empty_arena.map.txt** - Simple bordered arena (32x18)
- **pillars.map.txt** - Arena with scattered pillar obstacles (32x18)
- **four_corners.map.txt** - Bunkers in each corner (32x18)
- **crossroads.map.txt** - Cross-shaped walls (32x18)
- **bunkers.map.txt** - Multiple defensive positions (32x18)

## Adding New Maps

**With Docker (Volume Mount):**

Simply add your `.map.txt` file to this directory and restart:
```bash
docker compose restart astroparty
```

The server automatically scans this directory and loads all `.map.txt` files.

**File Naming:**
- Use descriptive names: `my_awesome_map.map.txt`
- Avoid spaces (use underscores): `cool_arena.map.txt`
- Must end with `.map.txt` extension

## Volume Mounting

The docker-compose.yml mounts this directory into the container:

```yaml
volumes:
  - ./maps:/app/packages/server/maps
```

This allows you to add/edit maps without rebuilding the Docker image.
