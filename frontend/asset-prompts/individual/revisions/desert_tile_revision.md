# Tile Revision: desert.png

## Source File
`/home/jenner/code/agentic-frontier/frontend/public/assets/tiles/desert.png`

## Current Image Description
A 3D isometric cube block (1024x1024 pixels) with:
- Sandy/orange desert texture on the top face
- Wavy sand dune patterns across the surface
- Small rocks or pebbles scattered on the sand
- Desert plant/shrub decoration
- Visible 3D sides showing the cube's depth
- Warm orange/tan coloring throughout

## Required Conversion
Transform this 3D cube into a flat, diamond-shaped tile suitable for Phaser 3's isometric tilemap system.

## Specific Requirements

### Dimensions and Shape
- **Output size**: 256x128 pixels
- **Shape**: Perfect diamond (rhombus) with 2:1 width-to-height ratio
- **Background**: Fully transparent outside the diamond shape
- **File format**: PNG with alpha channel

### Visual Transformation
1. **Extract only the top face** of the cube - the sandy desert surface
2. **Remove all 3D elements**:
   - No side faces of the cube
   - No depth/height
   - No shadows cast by the cube
   - No 3D perspective effects

3. **Preserve surface details**:
   - Keep the sand dune wave patterns
   - Maintain the scattered rocks/pebbles
   - Preserve the desert plant decoration
   - Keep the warm sandy color palette
   - Maintain the organic dune textures

### Color and Texture
- Preserve the warm orange/tan desert colors
- Keep subtle shading that suggests dune contours (but flat, not 3D)
- Maintain the contrast between sand and rock elements
- Ensure the sandy texture is visible but not overwhelming

### Technical Specifications
- The diamond should be oriented with points at top, bottom, left, and right
- The longest diagonal (left to right) should be 256 pixels
- The shortest diagonal (top to bottom) should be 128 pixels
- Anti-aliased edges for smooth appearance
- Optimized for web (compressed PNG)

## Purpose
This flat tile will be used in a Phaser 3 isometric tilemap for efficient rendering on low-powered devices while maintaining the visual essence of the original 3D cube's desert terrain.