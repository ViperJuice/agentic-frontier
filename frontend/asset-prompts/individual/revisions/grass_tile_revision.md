# Tile Revision: grass.png

## Source File
`/home/jenner/code/agentic-frontier/frontend/public/assets/tiles/grass.png`

## Current Image Description
A 3D isometric cube block (1024x1024 pixels) with:
- Green grass texture on the top face
- Small white and yellow flowers scattered on the surface
- Light green grass patches
- Visible 3D sides showing the cube's depth
- Soft shadows giving it a 3D appearance

## Required Conversion
Transform this 3D cube into a flat, diamond-shaped tile suitable for Phaser 3's isometric tilemap system.

## Specific Requirements

### Dimensions and Shape
- **Output size**: 256x128 pixels
- **Shape**: Perfect diamond (rhombus) with 2:1 width-to-height ratio
- **Background**: Fully transparent outside the diamond shape
- **File format**: PNG with alpha channel

### Visual Transformation
1. **Extract only the top face** of the cube - the grass surface with flowers
2. **Remove all 3D elements**:
   - No side faces
   - No depth/height
   - No shadows cast by the cube
   - No 3D perspective effects

3. **Preserve surface details**:
   - Keep the grass texture
   - Maintain the white and yellow flower decorations
   - Preserve the grass color variations
   - Keep the organic, natural feel of the surface

### Technical Specifications
- The diamond should be oriented with points at top, bottom, left, and right
- The longest diagonal (left to right) should be 256 pixels
- The shortest diagonal (top to bottom) should be 128 pixels
- Anti-aliased edges for smooth appearance
- Optimized for web (compressed PNG)

## Purpose
This flat tile will be used in a Phaser 3 isometric tilemap for efficient rendering on low-powered devices while maintaining the visual essence of the original 3D cube's grass terrain.