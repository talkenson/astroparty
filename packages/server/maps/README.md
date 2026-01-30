# Maps Directory (Legacy)

**⚠️ This directory is no longer used.**

Maps are now stored in `../../maps/` at the project root.

The server loads maps via volume mount in Docker:
```yaml
volumes:
  - ./maps:/app/packages/server/maps
```

For local development, the MapManager reads from this mounted location.

**To add or edit maps:**
1. Go to `./maps/` directory (project root)
2. Add/edit `.map.txt` files
3. Restart server

See `./maps/README.md` for full documentation.
