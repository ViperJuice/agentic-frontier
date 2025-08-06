# Tile Revision: ocean.png

## Source File
`/home/jenner/code/agentic-frontier/frontend/public/assets/tiles/ocean.png`

## Important Note
**The current file labeled "ocean.png" actually contains mountain/rocky peak graphics, not water.** This appears to be a naming error. For this revision, we need to create an actual ocean/water tile.

## Required Creation
Create a new ocean/water tile from scratch suitable for Phaser 3's isometric tilemap system.

## Specific Requirements

### Dimensions and Shape
- **Output size**: 256x128 pixels
- **Shape**: Perfect diamond (rhombus) with 2:1 width-to-height ratio
- **Background**: Fully transparent outside the diamond shape
- **File format**: PNG with alpha channel

### Visual Design
1. **Water appearance**:
   - Deep blue base color (#1E5B8C or similar ocean blue)
   - Subtle wave patterns or ripples
   - Slight color variation to suggest depth
   - Minor highlights to suggest water movement

2. **Texture details**:
   - Gentle wave patterns (not too busy)
   - Possible foam or whitecap accents (minimal)
   - Subtle gradient from slightly darker at edges to lighter in center
   - Semi-glossy appearance suggesting water surface

3. **Style consistency**:
   - Match the art style of the other tiles (clean, slightly stylized)
   - Not photorealistic but not overly cartoonish
   - Should blend well with grass and desert tiles at borders

### Technical Specifications
- The diamond should be oriented with points at top, bottom, left, and right
- The longest diagonal (left to right) should be 256 pixels
- The shortest diagonal (top to bottom) should be 128 pixels
- Anti-aliased edges for smooth appearance
- Optimized for web (compressed PNG)
- Consider adding very subtle transparency (95% opacity) to suggest water depth

## Alternative Option
If you need to work with the existing mountain image instead of creating water, please extract just the rocky base texture (gray stone) as a flat diamond tile, removing the vertical peak elements. However, an actual water tile is preferred for the "ocean.png" filename.

## Purpose
This flat water tile will be used in a Phaser 3 isometric tilemap to represent ocean/water areas efficiently on low-powered devices.