# Tile Revision: forest.png

## Source File
`/home/jenner/code/agentic-frontier/frontend/public/assets/tiles/forest.png`

## Current Image Description
A 3D isometric cube block (1024x1024 pixels) with:
- Dark green forest floor texture on the top face
- Small white and yellow flowers similar to grass tile but in forest setting
- Deeper green color suggesting forest canopy shade
- Visible 3D sides showing the cube's depth
- Forest floor vegetation details

## Required Conversion
Transform this 3D cube into a flat, diamond-shaped tile suitable for Phaser 3's isometric tilemap system.

## Specific Requirements

### Dimensions and Shape
- **Output size**: 256x128 pixels
- **Shape**: Perfect diamond (rhombus) with 2:1 width-to-height ratio
- **Background**: Fully transparent outside the diamond shape
- **File format**: PNG with alpha channel

### Visual Transformation
1. **Extract only the top face** of the cube - the forest floor surface
2. **Remove all 3D elements**:
   - No side faces of the cube
   - No depth/height
   - No shadows cast by the cube
   - No 3D perspective effects

3. **Preserve surface details**:
   - Keep the darker forest green texture
   - Maintain the small flowers and vegetation
   - Preserve the forest floor appearance
   - Keep the shaded/darker green tones that suggest tree cover
   - Maintain organic textures suggesting fallen leaves or moss

### Color and Texture
- Preserve the deeper, richer green tones (darker than grass tile)
- Keep the forest floor texture that suggests shade and moisture
- Maintain contrast between vegetation elements
- The color should clearly distinguish this as "forest" vs regular grassland

### Style Differentiation
- Should be visually distinct from the grass tile
- Darker, more saturated greens
- Could include subtle hints of brown (tree roots, dirt) if present
- More varied texture suggesting forest undergrowth

### Technical Specifications
- The diamond should be oriented with points at top, bottom, left, and right
- The longest diagonal (left to right) should be 256 pixels
- The shortest diagonal (top to bottom) should be 128 pixels
- Anti-aliased edges for smooth appearance
- Optimized for web (compressed PNG)

## Purpose
This flat tile will be used in a Phaser 3 isometric tilemap for efficient rendering on low-powered devices while maintaining the visual distinction of forested areas versus open grassland.