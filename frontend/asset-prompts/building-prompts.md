# Building Sprite Prompts for Agentic Frontier

## Art Style Guidelines
- **Perspective**: Isometric view showing individual structures
- **Size**: 64x64 pixels
- **Style**: Futuristic buildings representing code structures (methods/functions)
- **Theme**: Each building type reflects its code visibility/purpose
- **Detail**: More detailed than settlements, as these are zoomed-in views

---

## 1. Public Building (`building_public.png`)
**Prompt:**
"Create a 64x64 pixel isometric sprite of an open, accessible public building representing a public method/function. Design a modern glass and steel structure with transparent walls showing the interior workspace. The building should be primarily green (#32CD32) with large windows, multiple open entrances, wide stairs/ramps for easy access, and a welcoming plaza area. Include holographic signs indicating 'PUBLIC ACCESS' and data streams flowing in/out freely. Rooftop should have communication arrays showing connectivity. Low-poly style with emphasis on openness and accessibility."

**Key Features:**
- Primary color: #32CD32 (lime green)
- Glass panels: Semi-transparent with #E0FFFF (light cyan) tint
- Multiple entrances: Wide, inviting
- Special: "PUBLIC" holographic signage
- Mood: Open, welcoming, accessible

---

## 2. Private Building (`building_private.png`)
**Prompt:**
"Design a 64x64 pixel isometric sprite of a secure, restricted building representing a private method. Create a fortress-like structure with solid walls, minimal windows (small and high up), and a single secured entrance with visible access control systems. Use red tones (#DC143C) with reinforced corners and security features like cameras, laser grids, and warning signs. The building should look important but clearly restricted. Include a data firewall visualization around the perimeter. Low-poly aesthetic emphasizing security and restriction."

**Key Features:**
- Primary color: #DC143C (crimson)
- Walls: Solid, reinforced
- Windows: Minimal, small, high placement
- Security: Visible cameras, barriers
- Special: Firewall/barrier visualization

---

## 3. Static Monument (`building_static.png`)
**Prompt:**
"Create a 64x64 pixel isometric sprite of a monumental structure representing a static method. Design a grand monument or statue-like building in gray stone (#708090) that appears permanent and immutable. The structure should be a tall obelisk or classical building with columns, elevated on a platform with ceremonial steps. Include carved data patterns on the surface, a beacon light at the top, and smaller memorial plaques around the base. The building should convey permanence and importance without being interactive. Low-poly style with architectural grandeur."

**Key Features:**
- Primary color: #708090 (slate gray)
- Material: Stone/marble texture
- Design: Monumental, classical elements
- Special: Beacon at top, carved patterns
- Mood: Permanent, important, unchanging

---

## 4. Async Dock (`building_async.png`)
**Prompt:**
"Design a 64x64 pixel isometric sprite of a futuristic dock/port building representing an async function. Create a waterfront or space-dock structure in cyan (#00CED1) with multiple loading bays, cranes, and conveyor systems. Show cargo containers (data packets) being loaded/unloaded, with some in transit and others waiting. Include animated loading indicators, progress bars on the building sides, and ships/vessels at different stages of docking. The building should convey parallel processing and waiting states. Low-poly style with industrial port aesthetic."

**Key Features:**
- Primary color: #00CED1 (dark turquoise)
- Loading bays: Multiple, with activity
- Cargo/data packets: Visible in various states
- Special: Progress indicators, waiting areas
- Mood: Busy, processing, time-conscious

---

## 5. Constructor Gateway (`building_constructor.png`)
**Prompt:**
"Create a 64x64 pixel isometric sprite of an ornate gateway structure representing a constructor method. Design a grand entrance gate or portal in gold (#FFD700) that serves as the entry point to a district. The gateway should have twin towers connected by an arch, with energy flowing through the portal creating new data structures. Include initialization chambers on either side, blueprint projections above the arch, and a materialization platform in the center. The structure should convey creation and initialization. Low-poly style with magical/technological fusion aesthetic."

**Key Features:**
- Primary color: #FFD700 (gold)
- Portal: Active with energy flow
- Towers: Twin structures flanking entrance
- Special: Creation particles, blueprint holograms
- Mood: Creative, initializing, birthing point

---

## District Elements

## 6. District Wall (`district_wall.png`)
**Prompt:**
"Create a 64x64 pixel tileable isometric wall segment for enclosing class districts. Design a modular fortification wall in brown (#696969) that's 2 stories tall with a walkway on top. Include defensive positions, data shield projectors, and connection points for gates. The wall should clearly define district boundaries while allowing visibility. Must tile seamlessly for creating enclosed areas. Low-poly style with technical fortress aesthetic."

**Key Features:**
- Primary color: #696969 (dim gray)
- Height: 2 stories with walkway
- Features: Shield projectors, defensive positions
- Tiling: Seamless connection points

---

## 7. District Gate (`district_gate.png`)
**Prompt:**
"Design a 64x64 pixel isometric gate structure for district entrances. Create an entry checkpoint in bronze (#DAA520) with automated doors, scanning systems, and guard posts. The gate should control access between districts with visible authentication systems, turnstiles, and a control room above. Include holographic district identification signs and traffic flow indicators. Low-poly style emphasizing controlled access point."

**Key Features:**
- Primary color: #DAA520 (goldenrod)
- Systems: Scanners, authentication panels
- Control: Guard posts, control room
- Special: District ID holograms
- Function: Controlled entry/exit point

---

## Technical Consistency:
- **Lighting**: Consistent top-left light source
- **Scale**: Buildings sized appropriately within 64x64
- **Shadows**: Consistent drop shadows
- **Tech Level**: Futuristic but understandable
- **Animation Ready**: Design supports simple animations (lights, particles)