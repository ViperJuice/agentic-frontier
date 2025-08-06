# Tile Revision: mountain.png

## Source File
`/home/jenner/code/agentic-frontier/frontend/public/assets/tiles/mountain.png`

## Current Image Description
A 3D isometric scene (1024x1024 pixels) with:
- Multiple gray rocky mountain peaks rising vertically
- Snow-capped peaks with white highlights
- Rocky, craggy texture throughout
- Significant vertical height extending well above the base
- Dark gray/slate colored stone
- Multiple peaks creating a mountain range effect

## Required Conversion
Transform this 3D mountain scene into a flat, diamond-shaped tile suitable for Phaser 3's isometric tilemap system. Since mountains have significant vertical elements, we need to create a base terrain tile that suggests mountainous/rocky terrain without the vertical peaks.

## Specific Requirements

### Dimensions and Shape
- **Output size**: 256x128 pixels
- **Shape**: Perfect diamond (rhombus) with 2:1 width-to-height ratio
- **Background**: Fully transparent outside the diamond shape
- **File format**: PNG with alpha channel

### Visual Transformation
1. **Create a rocky ground texture** instead of vertical peaks:
   - Extract the rocky/stone texture from the base
   - Create a rough, uneven rocky surface
   - No vertical mountain peaks (save those for 3D feature sprites)

2. **Remove vertical elements**:
   - No tall peaks extending upward
   - No significant height variation
   - Create a relatively flat but rough rocky surface

3. **Suggested texture details**:
   - Rocky, craggy ground texture
   - Mix of lighter and darker gray stones
   - Possible small rocks and rubble
   - Rough, uneven surface suggesting difficult terrain
   - Could include patches of snow if at high elevation

### Color and Texture
- Gray/slate color palette from the original
- Varied stone textures (rough, angular)
- High contrast between light and dark rocks
- Should clearly read as "mountainous terrain" even without peaks
- Possible subtle white specs suggesting snow or minerals

### Special Consideration
The vertical mountain peaks from the original image should be preserved as separate 3D sprite features that can be placed selectively on top of this base tile for important mountain locations, maintaining performance while adding visual interest where needed.

### Technical Specifications
- The diamond should be oriented with points at top, bottom, left, and right
- The longest diagonal (left to right) should be 256 pixels
- The shortest diagonal (top to bottom) should be 128 pixels
- Anti-aliased edges for smooth appearance
- Optimized for web (compressed PNG)

## Purpose
This flat rocky/mountain base tile will be used in a Phaser 3 isometric tilemap for efficient rendering on low-powered devices. The dramatic mountain peaks will be reserved for selective 3D sprite placement to maintain visual impact without sacrificing performance.