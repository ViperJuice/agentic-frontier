# TreeSitter Integration Specification
**Version:** 1.0
**Date:** 2025-01-12
**Status:** Planning
**Author:** Agentic Frontier Team

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Context](#architecture-context)
3. [Database Schema](#database-schema)
4. [Parsing Workflow](#parsing-workflow)
5. [Language Support](#language-support)
6. [Code Structure Extraction](#code-structure-extraction)
7. [Visualization Integration](#visualization-integration)
8. [Implementation Plan](#implementation-plan)
9. [Performance Considerations](#performance-considerations)
10. [Testing Strategy](#testing-strategy)
11. [Future Enhancements](#future-enhancements)

---

## 1. Overview

### Purpose
Integrate TreeSitter AST parsing into Agentic Frontier to extract code-level structures (classes, methods, functions, properties) from files and visualize them as individual buildings within file districts on the hexagonal world map.

### Goals
- **Parse code structures** from TypeScript, JavaScript, Python, Rust, Go, and other languages
- **Store hierarchical structures** in the `code_structures` database table
- **Visualize code graphs** as buildings in the Phaser.js frontend
- **Enable granular agent targeting** - agents move to specific methods/functions, not just files
- **Support real-time updates** via SSE when files change
- **Build dependency graph** from import/export statements

### Current State
- ✅ Database schema exists (`code_structures`, `dependencies`, `call_graph` tables)
- ✅ Frontend rendering system ready to display code structures
- ✅ Agents can move to specific structures
- ✅ File-level visualization working
- ⏳ **TreeSitter parsing NOT implemented** - files marked as `needs_parsing=true`

---

## 2. Architecture Context

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE CODE AGENT                     │
│                  (generates webhooks)                    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP POST
                     ▼
┌─────────────────────────────────────────────────────────┐
│               BACKEND (Node.js/TypeScript)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ HookProcessor                                     │  │
│  │  - Receives webhook events                        │  │
│  │  - Detects file operations (Write/Edit/MultiEdit)│  │
│  │  - Marks files for parsing                        │  │
│  └────────────┬─────────────────────────────────────┘  │
│               ▼                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ TreeSitterService (NEW)                          │  │
│  │  - Parses file AST                                │  │
│  │  - Extracts code structures                       │  │
│  │  - Calculates positions                           │  │
│  │  - Stores to database                             │  │
│  └────────────┬─────────────────────────────────────┘  │
│               ▼                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ DatabaseService                                   │  │
│  │  - Stores code_structures                         │  │
│  │  - Stores dependencies                            │  │
│  │  - Updates files.has_structures = true            │  │
│  └────────────┬─────────────────────────────────────┘  │
│               ▼                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ SSEService                                        │  │
│  │  - Broadcasts structures_updated event            │  │
│  └────────────┬─────────────────────────────────────┘  │
└───────────────┼──────────────────────────────────────────┘
                │ SSE Stream
                ▼
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (Vite/TypeScript/Phaser)           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ main.ts                                           │  │
│  │  - Receives structures_updated event              │  │
│  │  - Calls scene.onStructureUpdate()                │  │
│  └────────────┬─────────────────────────────────────┘  │
│               ▼                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ HexWorldScene                                     │  │
│  │  - Renders file districts                         │  │
│  │  - Creates structure buildings                    │  │
│  │  - Displays agents moving to structures           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Current File Operation Flow

**When Claude Code writes/edits a file:**

1. `POST /api/webhooks/claude/PostToolUse` → Backend receives webhook
2. `HookProcessor.processHook()` → Classifies activity
3. `HookProcessor.handleFileOperation()` → Detects file change
4. `FileService.updateFile()` → Creates/updates file record in database
5. `FileService.markFileNeedsStructureUpdate()` → Sets `needs_parsing=true`
6. **MISSING:** TreeSitter parsing step
7. Frontend receives `activity` event but NO `structures_updated` event

**What needs to happen:**

1. Steps 1-5 same as above
2. **NEW:** `TreeSitterService.parseFile()` → Extract code structures
3. **NEW:** `DatabaseService.storeCodeStructures()` → Store in `code_structures` table
4. **NEW:** `SSEService.broadcast({ type: 'structures_updated', file, structures })` → Notify frontend
5. Frontend receives `structures_updated` event
6. `scene.onStructureUpdate()` → Renders buildings

---

## 3. Database Schema

### Tables Overview

#### `files` Table (Existing)
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    extension TEXT,
    position JSONB DEFAULT '{"x": 0, "y": 0}',  -- Hex grid coordinates
    building_type TEXT,                          -- File-level building type
    building_height INTEGER DEFAULT 1,
    has_structures BOOLEAN DEFAULT FALSE,        -- TRUE when parsed
    structure_count INTEGER DEFAULT 0,           -- Count of structures
    needs_parsing BOOLEAN DEFAULT TRUE,          -- TRUE until parsed
    last_parsed_at TIMESTAMPTZ,
    last_modified_at TIMESTAMPTZ DEFAULT NOW(),
    ...
);
```

#### `code_structures` Table (Existing - Ready for Data)
```sql
CREATE TABLE code_structures (
    id UUID PRIMARY KEY,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    session_id TEXT,

    -- Structure identification
    name TEXT NOT NULL,                         -- e.g., "HexWorldScene"
    type TEXT NOT NULL CHECK (type IN (
        'class', 'function', 'method', 'constructor',
        'property', 'interface', 'enum', 'type'
    )),
    visibility TEXT CHECK (visibility IN ('public', 'private', 'protected', 'static')),
    is_async BOOLEAN DEFAULT FALSE,
    is_static BOOLEAN DEFAULT FALSE,
    is_abstract BOOLEAN DEFAULT FALSE,

    -- Location in file
    start_line INTEGER,                         -- Line number where structure starts
    end_line INTEGER,                           -- Line number where structure ends
    start_column INTEGER,
    end_column INTEGER,

    -- Structure metadata
    parameters JSONB,                           -- Array of parameter definitions
    return_type TEXT,                           -- Return type annotation
    decorators JSONB,                           -- Array of decorators/annotations
    docstring TEXT,                             -- JSDoc/docstring content
    complexity_score INTEGER,                   -- Cyclomatic complexity

    -- Hierarchy
    parent_structure_id UUID REFERENCES code_structures(id),
    depth INTEGER DEFAULT 0,                    -- Nesting depth (0 = top-level)

    -- Visualization data (calculated by TreeSitterService)
    district_x INTEGER,                         -- X position within file district (0-10)
    district_y INTEGER,                         -- Y position within file district (0-10)
    building_type TEXT,                         -- Visual type
    building_color TEXT,                        -- Color hex code
    building_size INTEGER DEFAULT 1,            -- Size 1-10 based on lines

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `dependencies` Table (Existing)
```sql
CREATE TABLE dependencies (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    source_file_id UUID REFERENCES files(id),
    target_file_id UUID REFERENCES files(id),

    import_statement TEXT NOT NULL,            -- e.g., "import { HexWorldScene } from './scenes/hexworldscene'"
    import_type TEXT CHECK (import_type IN (
        'default', 'named', 'namespace', 'side-effect', 'dynamic'
    )),
    imported_items JSONB,                      -- ["HexWorldScene"]
    is_external BOOLEAN DEFAULT FALSE,         -- true for npm packages
    package_name TEXT,                         -- e.g., "phaser"

    route_strength INTEGER DEFAULT 1,          -- Usage frequency
    route_color TEXT,                          -- Visualization color
    ...
);
```

#### `call_graph` Table (Future Use)
```sql
CREATE TABLE call_graph (
    id UUID PRIMARY KEY,
    caller_structure_id UUID REFERENCES code_structures(id),
    callee_structure_id UUID REFERENCES code_structures(id),
    call_type TEXT CHECK (call_type IN ('direct', 'callback', 'promise', 'event', 'recursive')),
    call_count INTEGER DEFAULT 1,
    ...
);
```

---

## 4. Parsing Workflow

### 4.1 File Detection

**Trigger:** `PostToolUse` webhook with `tool_name` = `Write`, `Edit`, or `MultiEdit`

**Location:** `backend/src/processors/HookProcessor.ts:handleFileOperation()`

**Current Implementation:**
```typescript
private async handleFileOperation(data: ToolUseData, sessionId: string) {
    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path;

    if (!filePath) return;

    const file = await this.fileService.updateFile(filePath, sessionId);

    if (!file) {
        console.error(`[File Operation] Failed to update file record for ${filePath}`);
        return;
    }

    // Mark for parsing
    await this.fileService.markFileNeedsStructureUpdate(file.id);

    // TODO: Trigger TreeSitter parsing here
    logWithTimestamp(`[File Operation] ${filePath} - Marked for future parsing when TreeSitter available`);
}
```

**What to Add:**
```typescript
// After marking file for parsing:
const structures = await this.treeService.parseFile(file);

if (structures && structures.length > 0) {
    // Store structures in database
    await this.databaseService.storeCodeStructures(file.id, structures);

    // Broadcast to frontend
    this.sseService.broadcastUpdate({
        type: 'structures_updated',
        file: file,
        structures: structures
    });
}
```

### 4.2 TreeSitter Service Architecture

**New Service:** `backend/src/services/TreeSitterService.ts`

```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import Go from 'tree-sitter-go';

interface ParsedStructure {
    name: string;
    type: 'class' | 'function' | 'method' | 'constructor' | 'property' | 'interface' | 'enum' | 'type';
    visibility?: 'public' | 'private' | 'protected' | 'static';
    is_async: boolean;
    is_static: boolean;
    is_abstract: boolean;
    start_line: number;
    end_line: number;
    start_column: number;
    end_column: number;
    parameters?: Array<{ name: string; type?: string; default_value?: string }>;
    return_type?: string;
    decorators?: string[];
    docstring?: string;
    complexity_score: number;
    parent_id?: string;
    depth: number;
    children: ParsedStructure[];
}

export class TreeSitterService {
    private parsers: Map<string, Parser> = new Map();

    constructor() {
        this.initializeParsers();
    }

    private initializeParsers() {
        // TypeScript
        const tsParser = new Parser();
        tsParser.setLanguage(TypeScript.typescript);
        this.parsers.set('ts', tsParser);
        this.parsers.set('tsx', tsParser);

        // JavaScript
        const jsParser = new Parser();
        jsParser.setLanguage(JavaScript);
        this.parsers.set('js', jsParser);
        this.parsers.set('jsx', jsParser);

        // Python
        const pyParser = new Parser();
        pyParser.setLanguage(Python);
        this.parsers.set('py', pyParser);

        // Rust
        const rsParser = new Parser();
        rsParser.setLanguage(Rust);
        this.parsers.set('rs', rsParser);

        // Go
        const goParser = new Parser();
        goParser.setLanguage(Go);
        this.parsers.set('go', goParser);
    }

    async parseFile(file: File): Promise<ParsedStructure[]> {
        const extension = file.extension || file.path.split('.').pop();
        const parser = this.parsers.get(extension);

        if (!parser) {
            console.warn(`[TreeSitter] No parser for extension: ${extension}`);
            return [];
        }

        try {
            // Read file content
            const fileContent = await fs.readFile(file.path, 'utf-8');

            // Parse AST
            const tree = parser.parse(fileContent);

            // Extract structures
            const structures = this.extractStructures(tree.rootNode, fileContent, extension);

            // Calculate visualization metadata
            const enrichedStructures = this.enrichWithVisualizationData(structures, file);

            return enrichedStructures;

        } catch (error) {
            console.error(`[TreeSitter] Error parsing ${file.path}:`, error);
            return [];
        }
    }

    private extractStructures(
        node: Parser.SyntaxNode,
        sourceCode: string,
        language: string,
        parentId?: string,
        depth: number = 0
    ): ParsedStructure[] {
        const structures: ParsedStructure[] = [];

        // Language-specific extraction
        if (language === 'ts' || language === 'tsx' || language === 'js' || language === 'jsx') {
            structures.push(...this.extractTypeScriptStructures(node, sourceCode, parentId, depth));
        } else if (language === 'py') {
            structures.push(...this.extractPythonStructures(node, sourceCode, parentId, depth));
        } else if (language === 'rs') {
            structures.push(...this.extractRustStructures(node, sourceCode, parentId, depth));
        } else if (language === 'go') {
            structures.push(...this.extractGoStructures(node, sourceCode, parentId, depth));
        }

        return structures;
    }

    private extractTypeScriptStructures(
        node: Parser.SyntaxNode,
        sourceCode: string,
        parentId?: string,
        depth: number = 0
    ): ParsedStructure[] {
        const structures: ParsedStructure[] = [];

        const traverse = (n: Parser.SyntaxNode, currentParentId?: string, currentDepth: number = 0) => {
            // Class declarations
            if (n.type === 'class_declaration') {
                const structure = this.extractClass(n, sourceCode, currentParentId, currentDepth);
                structures.push(structure);

                // Recursively extract methods
                n.children.forEach(child => {
                    if (child.type === 'class_body') {
                        traverse(child, structure.id, currentDepth + 1);
                    }
                });
            }

            // Method definitions
            else if (n.type === 'method_definition') {
                const structure = this.extractMethod(n, sourceCode, currentParentId, currentDepth);
                structures.push(structure);
            }

            // Function declarations
            else if (n.type === 'function_declaration' || n.type === 'arrow_function') {
                const structure = this.extractFunction(n, sourceCode, currentParentId, currentDepth);
                structures.push(structure);
            }

            // Interface declarations
            else if (n.type === 'interface_declaration') {
                const structure = this.extractInterface(n, sourceCode, currentParentId, currentDepth);
                structures.push(structure);
            }

            // Enum declarations
            else if (n.type === 'enum_declaration') {
                const structure = this.extractEnum(n, sourceCode, currentParentId, currentDepth);
                structures.push(structure);
            }

            // Type aliases
            else if (n.type === 'type_alias_declaration') {
                const structure = this.extractTypeAlias(n, sourceCode, currentParentId, currentDepth);
                structures.push(structure);
            }

            // Recurse to children
            else {
                n.children.forEach(child => traverse(child, currentParentId, currentDepth));
            }
        };

        traverse(node, parentId, depth);
        return structures;
    }

    private extractClass(
        node: Parser.SyntaxNode,
        sourceCode: string,
        parentId?: string,
        depth: number = 0
    ): ParsedStructure {
        const nameNode = node.childForFieldName('name');
        const name = nameNode ? sourceCode.substring(nameNode.startIndex, nameNode.endIndex) : 'Anonymous';

        // Extract decorators
        const decorators: string[] = [];
        node.children.forEach(child => {
            if (child.type === 'decorator') {
                decorators.push(sourceCode.substring(child.startIndex, child.endIndex));
            }
        });

        // Extract JSDoc
        const docstring = this.extractJSDoc(node, sourceCode);

        // Calculate complexity
        const complexity = this.calculateComplexity(node);

        return {
            id: this.generateId(),
            name,
            type: 'class',
            visibility: this.extractVisibility(node, sourceCode),
            is_async: false,
            is_static: false,
            is_abstract: this.isAbstract(node, sourceCode),
            start_line: node.startPosition.row + 1,
            end_line: node.endPosition.row + 1,
            start_column: node.startPosition.column,
            end_column: node.endPosition.column,
            decorators,
            docstring,
            complexity_score: complexity,
            parent_id: parentId,
            depth,
            children: []
        };
    }

    private extractMethod(
        node: Parser.SyntaxNode,
        sourceCode: string,
        parentId?: string,
        depth: number = 0
    ): ParsedStructure {
        // Similar extraction logic for methods
        // Extract: name, parameters, return type, async, static, visibility
        // ...
    }

    private extractFunction(
        node: Parser.SyntaxNode,
        sourceCode: string,
        parentId?: string,
        depth: number = 0
    ): ParsedStructure {
        // Similar extraction logic for functions
        // ...
    }

    private enrichWithVisualizationData(
        structures: ParsedStructure[],
        file: File
    ): ParsedStructure[] {
        // Calculate district_x, district_y for each structure
        // Layout algorithm: grid-based positioning within file district

        structures.forEach((structure, index) => {
            const gridSize = Math.ceil(Math.sqrt(structures.length));

            structure.district_x = index % gridSize;
            structure.district_y = Math.floor(index / gridSize);

            // Building size based on lines of code
            const linesOfCode = structure.end_line - structure.start_line;
            structure.building_size = Math.min(Math.max(1, Math.ceil(linesOfCode / 10)), 10);

            // Building color based on type
            structure.building_color = this.getBuildingColorForType(structure.type);

            // Building type
            structure.building_type = this.getBuildingTypeForStructure(structure);
        });

        return structures;
    }

    private getBuildingColorForType(type: string): string {
        const colorMap = {
            'class': '#3498db',      // Blue
            'interface': '#3498db',  // Blue
            'method': '#e74c3c',     // Red
            'constructor': '#e74c3c',// Red
            'function': '#2ecc71',   // Green
            'property': '#f39c12',   // Orange
            'enum': '#9b59b6',       // Purple
            'type': '#1abc9c'        // Teal
        };
        return colorMap[type] || '#95a5a6';
    }

    private getBuildingTypeForStructure(structure: ParsedStructure): string {
        if (structure.type === 'class' || structure.type === 'interface') {
            return 'commercial_modern';
        } else if (structure.type === 'function') {
            return 'industrial';
        } else if (structure.type === 'method') {
            return 'residential';
        }
        return 'commercial';
    }

    private calculateComplexity(node: Parser.SyntaxNode): number {
        // Cyclomatic complexity calculation
        // Count: if, while, for, case, &&, ||, catch, ?
        let complexity = 1; // Base complexity

        const traverse = (n: Parser.SyntaxNode) => {
            if (['if_statement', 'while_statement', 'for_statement', 'switch_case',
                 'catch_clause', 'ternary_expression'].includes(n.type)) {
                complexity++;
            }
            n.children.forEach(traverse);
        };

        traverse(node);
        return complexity;
    }

    private extractJSDoc(node: Parser.SyntaxNode, sourceCode: string): string | undefined {
        // Look for JSDoc comment before node
        const previousSibling = node.previousSibling;
        if (previousSibling && previousSibling.type === 'comment') {
            const commentText = sourceCode.substring(previousSibling.startIndex, previousSibling.endIndex);
            if (commentText.startsWith('/**')) {
                return commentText;
            }
        }
        return undefined;
    }

    // Similar methods for Python, Rust, Go...
    private extractPythonStructures(...) { ... }
    private extractRustStructures(...) { ... }
    private extractGoStructures(...) { ... }
}
```

---

## 5. Language Support

### Priority Languages

#### Tier 1 (MVP)
- **TypeScript** (.ts, .tsx) - Primary language for this project
- **JavaScript** (.js, .jsx) - Common in web development

#### Tier 2 (Phase 2)
- **Python** (.py) - Popular in ML/data science
- **Rust** (.rs) - Systems programming
- **Go** (.go) - Backend services

#### Tier 3 (Future)
- Java, C++, C#, Ruby, PHP, etc.

### Language-Specific Node Types

**TypeScript/JavaScript:**
- `class_declaration`
- `method_definition`
- `function_declaration`
- `arrow_function`
- `interface_declaration`
- `type_alias_declaration`
- `enum_declaration`
- `export_statement`
- `import_statement`

**Python:**
- `class_definition`
- `function_definition`
- `decorated_definition`
- `import_statement`
- `import_from_statement`

**Rust:**
- `struct_item`
- `impl_item`
- `function_item`
- `trait_item`
- `enum_item`
- `use_declaration`

**Go:**
- `type_declaration`
- `function_declaration`
- `method_declaration`
- `interface_type`
- `struct_type`
- `import_declaration`

---

## 6. Code Structure Extraction

### 6.1 Class Extraction

**Input:** TypeScript class
```typescript
/**
 * Main hexagonal world scene
 */
export default class HexWorldScene extends Phaser.Scene {
  private controls!: Phaser.Cameras.Controls.SmoothedKeyControl;

  constructor() {
    super('HexWorld');
  }

  private createOrUpdateAgent(sessionId: string, agentType: string): void {
    // Implementation...
  }

  async loadInitialState(files: any[]): Promise<void> {
    // Implementation...
  }
}
```

**Output:** Database records
```json
{
  "name": "HexWorldScene",
  "type": "class",
  "visibility": "public",
  "is_async": false,
  "is_static": false,
  "is_abstract": false,
  "start_line": 3,
  "end_line": 20,
  "start_column": 0,
  "end_column": 1,
  "docstring": "/**\n * Main hexagonal world scene\n */",
  "complexity_score": 1,
  "depth": 0,
  "district_x": 0,
  "district_y": 0,
  "building_size": 2,
  "building_color": "#3498db",
  "building_type": "commercial_modern"
}
```

**Child structures:**
```json
[
  {
    "name": "controls",
    "type": "property",
    "visibility": "private",
    "parent_structure_id": "<HexWorldScene-id>",
    "depth": 1,
    "district_x": 1,
    "district_y": 0
  },
  {
    "name": "constructor",
    "type": "constructor",
    "visibility": "public",
    "parent_structure_id": "<HexWorldScene-id>",
    "depth": 1,
    "district_x": 2,
    "district_y": 0
  },
  {
    "name": "createOrUpdateAgent",
    "type": "method",
    "visibility": "private",
    "parameters": [
      {"name": "sessionId", "type": "string"},
      {"name": "agentType", "type": "string"}
    ],
    "return_type": "void",
    "parent_structure_id": "<HexWorldScene-id>",
    "depth": 1,
    "district_x": 0,
    "district_y": 1
  },
  {
    "name": "loadInitialState",
    "type": "method",
    "visibility": "public",
    "is_async": true,
    "parameters": [
      {"name": "files", "type": "any[]"}
    ],
    "return_type": "Promise<void>",
    "parent_structure_id": "<HexWorldScene-id>",
    "depth": 1,
    "district_x": 1,
    "district_y": 1
  }
]
```

### 6.2 Function Extraction

**Input:** Top-level function
```typescript
/**
 * Determine agent type from activity
 */
function determineAgentTypeFromActivity(activity: any): string {
  if (!activity) return 'scout';

  const action = activity.action?.toLowerCase() || '';

  if (action.includes('search')) return 'scout';
  if (action.includes('create')) return 'builder';
  if (action.includes('fix')) return 'warrior';

  return 'scout';
}
```

**Output:**
```json
{
  "name": "determineAgentTypeFromActivity",
  "type": "function",
  "visibility": "public",
  "is_async": false,
  "parameters": [
    {"name": "activity", "type": "any"}
  ],
  "return_type": "string",
  "start_line": 4,
  "end_line": 14,
  "docstring": "/**\n * Determine agent type from activity\n */",
  "complexity_score": 5,
  "depth": 0,
  "district_x": 3,
  "district_y": 0
}
```

### 6.3 Interface Extraction

**Input:**
```typescript
interface AgentSprite {
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  activityIcon?: Phaser.GameObjects.Text;
  targetPosition?: { x: number; y: number };
}
```

**Output:**
```json
{
  "name": "AgentSprite",
  "type": "interface",
  "visibility": "public",
  "start_line": 1,
  "end_line": 7,
  "complexity_score": 1,
  "depth": 0
}
```

---

## 7. Visualization Integration

### 7.1 Frontend Rendering

**HexWorldScene receives structures:**

```typescript
// frontend/src/scenes/hexworldscene.ts

onStructureUpdate(data: any) {
    const { file, structures } = data;

    if (file) {
        this.createOrUpdateFileDistrict(file, structures || []);
    }
}

private createCodeStructureBuildings(district: FileDistrict, structures: any[]) {
    structures.forEach((structure, index) => {
        const offsetX = (structure.district_x * 50) - 100;
        const offsetY = (structure.district_y * 50) - 100;

        const buildingPos = {
            x: district.position.x + offsetX,
            y: district.position.y + offsetY
        };

        this.createStructureBuilding(district, structure, buildingPos);
    });
}
```

### 7.2 Building Layout

**Grid-based layout within file district:**

```
File District (center at hex position)
┌────────────────────────────────────┐
│                                    │
│  Class (blue)        Method (red)  │
│     ██                  ██         │
│                                    │
│  Method (red)      Function (green)│
│     ██                  ██         │
│                                    │
│  Property (orange)  Method (red)   │
│     ██                  ██         │
│                                    │
└────────────────────────────────────┘
```

**Positioning formula:**
- District center: `hexToPixel(file.position.x, file.position.y)`
- Structure offset: `(structure.district_x * 50px, structure.district_y * 50px)`
- Final position: `(center.x + offset.x - 100, center.y + offset.y - 100)`

### 7.3 Visual Hierarchy

**Size mapping:**
- Lines of code 1-10: Small building (20px)
- Lines of code 11-50: Medium building (30px)
- Lines of code 51-100: Large building (40px)
- Lines of code 100+: Very large building (50px)

**Color mapping:**
- Class/Interface: Blue `#3498db`
- Method/Constructor: Red `#e74c3c`
- Function: Green `#2ecc71`
- Property: Orange `#f39c12`
- Enum: Purple `#9b59b6`
- Type: Teal `#1abc9c`

**Building type mapping:**
- Class → Commercial Modern
- Function → Industrial
- Method → Residential
- Interface → Laboratory

---

## 8. Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

**Tasks:**
1. ✅ Install TreeSitter dependencies
   ```bash
   cd backend
   npm install tree-sitter tree-sitter-typescript tree-sitter-javascript
   ```

2. ✅ Create `TreeSitterService.ts`
   - Initialize parsers
   - Implement `parseFile()` method
   - Implement `extractTypeScriptStructures()`

3. ✅ Create database methods in `DatabaseService.ts`
   - `storeCodeStructures(fileId, structures)`
   - `getCodeStructuresByFile(fileId)`
   - `updateFileStructureMetadata(fileId)`

4. ✅ Integrate into `HookProcessor.ts`
   - Call `treeService.parseFile()` after file operations
   - Store structures
   - Broadcast SSE event

5. ✅ Test with TypeScript files
   - Parse `hexworldscene.ts`
   - Verify database storage
   - Verify frontend rendering

### Phase 2: Language Expansion (Week 2)

**Tasks:**
1. Add JavaScript support
   - Install `tree-sitter-javascript`
   - Implement `extractJavaScriptStructures()`

2. Add Python support
   - Install `tree-sitter-python`
   - Implement `extractPythonStructures()`

3. Add Rust support
   - Install `tree-sitter-rust`
   - Implement `extractRustStructures()`

4. Add Go support
   - Install `tree-sitter-go`
   - Implement `extractGoStructures()`

### Phase 3: Dependency Extraction (Week 3)

**Tasks:**
1. Extract import statements
   - Parse `import_statement` nodes
   - Resolve local vs external imports
   - Store in `dependencies` table

2. Build dependency graph
   - Calculate import relationships
   - Determine route strength (usage frequency)
   - Visualize as lines between districts

3. Extract exports
   - Track what each file exports
   - Enable "who uses this?" queries

### Phase 4: Advanced Features (Week 4)

**Tasks:**
1. Call graph extraction
   - Parse function call expressions
   - Build `call_graph` table
   - Visualize intra-file calls

2. Complexity analysis
   - Implement cyclomatic complexity
   - Visual heatmaps (redder = more complex)
   - Highlight refactoring targets

3. Documentation extraction
   - Parse JSDoc/docstrings
   - Display in detail panel
   - Show parameter types/descriptions

4. Real-time incremental parsing
   - Parse only changed functions
   - Diff ASTs to detect changes
   - Faster updates for large files

---

## 9. Performance Considerations

### 9.1 Parsing Performance

**Benchmarks (expected):**
- Small file (< 100 lines): < 10ms
- Medium file (100-500 lines): 10-50ms
- Large file (500-2000 lines): 50-200ms
- Very large file (2000+ lines): 200-500ms

**Optimization strategies:**
1. **Async parsing** - Don't block webhook response
2. **Queue system** - Process files in background
3. **Caching** - Store AST, only re-parse on changes
4. **Incremental parsing** - TreeSitter supports editing existing trees
5. **Batch processing** - Parse multiple files in parallel

### 9.2 Database Performance

**Indexes (already exist):**
```sql
CREATE INDEX idx_code_structures_file_id ON code_structures(file_id);
CREATE INDEX idx_code_structures_type ON code_structures(type);
CREATE INDEX idx_code_structures_parent ON code_structures(parent_structure_id);
```

**Query optimization:**
- Use `SELECT * FROM code_structures WHERE file_id = ?` (indexed)
- Fetch structures with file in single query: `LEFT JOIN`
- Limit depth for recursive queries

### 9.3 Frontend Performance

**Rendering optimization:**
- Render structures only when visible (camera bounds check)
- Use object pooling for building sprites
- Limit rendered structures per frame
- Progressive loading (load file districts first, then structures)

### 9.4 Memory Management

**Backend:**
- Don't keep parsed ASTs in memory
- Extract data and discard tree
- Use streaming for large files

**Frontend:**
- Destroy off-screen buildings
- Limit total rendered objects (< 1000)
- Use texture atlases for building sprites

---

## 10. Testing Strategy

### 10.1 Unit Tests

**TreeSitterService:**
```typescript
describe('TreeSitterService', () => {
    it('should parse TypeScript class', () => {
        const code = `
            class TestClass {
                method() {}
            }
        `;
        const structures = service.parse(code, 'ts');
        expect(structures).toHaveLength(2); // Class + method
        expect(structures[0].name).toBe('TestClass');
        expect(structures[0].type).toBe('class');
    });

    it('should extract method parameters', () => {
        const code = `
            function test(a: string, b: number): void {}
        `;
        const structures = service.parse(code, 'ts');
        expect(structures[0].parameters).toEqual([
            { name: 'a', type: 'string' },
            { name: 'b', type: 'number' }
        ]);
    });

    it('should calculate complexity', () => {
        const code = `
            function complex(x: number): number {
                if (x > 0) {
                    if (x > 10) {
                        return x * 2;
                    }
                    return x;
                }
                return 0;
            }
        `;
        const structures = service.parse(code, 'ts');
        expect(structures[0].complexity_score).toBe(3); // Base 1 + 2 ifs
    });
});
```

### 10.2 Integration Tests

**End-to-end parsing flow:**
```typescript
describe('File Parsing Flow', () => {
    it('should parse file and store structures', async () => {
        // 1. Trigger webhook
        const response = await request(app)
            .post('/api/webhooks/claude/PostToolUse')
            .send({
                session_id: 'test',
                tool_name: 'Write',
                tool_input: { file_path: './test.ts' }
            });

        expect(response.status).toBe(200);

        // 2. Wait for parsing
        await sleep(100);

        // 3. Check database
        const structures = await db.from('code_structures')
            .select('*')
            .eq('file_id', fileId);

        expect(structures.data).not.toBeEmpty();

        // 4. Check SSE broadcast
        expect(mockSSEService.broadcastUpdate).toHaveBeenCalledWith({
            type: 'structures_updated',
            file: expect.any(Object),
            structures: expect.any(Array)
        });
    });
});
```

### 10.3 Visual Testing

**Frontend rendering:**
1. Load test file with known structures
2. Verify buildings appear at correct positions
3. Verify correct colors and sizes
4. Verify click interaction works
5. Verify agent movement to structures

**Test files:**
- `test/fixtures/simple-class.ts` - Single class
- `test/fixtures/nested-structures.ts` - Class with methods
- `test/fixtures/functions.ts` - Top-level functions
- `test/fixtures/mixed.ts` - Classes, functions, interfaces

---

## 11. Future Enhancements

### 11.1 Real-time Collaboration

**Multi-agent coordination:**
- Multiple Claude Code sessions working on same project
- See other agents' work in real-time
- Conflict detection (two agents editing same function)

### 11.2 Code Metrics Dashboard

**Visualization:**
- Complexity heatmap (redder = more complex)
- Test coverage overlay (green = tested, red = untested)
- Change frequency (frequently changed = yellow)
- "Hot spots" - most-edited code structures

### 11.3 Semantic Search

**Search capabilities:**
- "Find all async functions"
- "Show classes with > 10 methods"
- "List functions with complexity > 15"
- "Find unused exports"

### 11.4 Architectural Insights

**Analysis:**
- Dependency cycles detection
- "God class" detection (classes with too many methods)
- Dead code detection (unreferenced functions)
- Architectural smell detection

### 11.5 AI-Powered Refactoring

**Integration with Claude:**
- Click structure → "Suggest refactoring"
- Complexity warning → "Help me simplify this"
- Dependency cycle → "How can I break this cycle?"

### 11.6 Call Graph Visualization

**Advanced rendering:**
- Animate function calls between structures
- Show call frequency with thicker lines
- Highlight recursive calls with special color
- Visualize async call chains

### 11.7 Documentation Generation

**Auto-generate from structures:**
- API documentation from exported functions
- Class diagrams from structure hierarchy
- Dependency diagrams
- README sections for main components

---

## Appendix A: TreeSitter Resources

### Documentation
- TreeSitter docs: https://tree-sitter.github.io/tree-sitter/
- Node.js bindings: https://github.com/tree-sitter/node-tree-sitter
- Query syntax: https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries

### Language Grammars
- TypeScript: https://github.com/tree-sitter/tree-sitter-typescript
- JavaScript: https://github.com/tree-sitter/tree-sitter-javascript
- Python: https://github.com/tree-sitter/tree-sitter-python
- Rust: https://github.com/tree-sitter/tree-sitter-rust
- Go: https://github.com/tree-sitter/tree-sitter-go

### Tools
- TreeSitter playground: https://tree-sitter.github.io/tree-sitter/playground
- AST explorer: https://astexplorer.net/

---

## Appendix B: Database Migration

**Migration file:** `supabase/migrations/YYYYMMDD_enable_treesitter.sql`

```sql
-- Update existing files to be parsed
UPDATE files SET needs_parsing = TRUE WHERE extension IN ('ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go');

-- Add trigger to auto-mark files for re-parsing on update
CREATE OR REPLACE FUNCTION mark_file_for_reparsing()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_modified_at > OLD.last_modified_at THEN
        NEW.needs_parsing := TRUE;
        NEW.has_structures := FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER file_modified_trigger
BEFORE UPDATE ON files
FOR EACH ROW
EXECUTE FUNCTION mark_file_for_reparsing();
```

---

## Appendix C: Example SSE Event

**Broadcast when structures are parsed:**

```json
{
  "type": "structures_updated",
  "timestamp": "2025-01-12T15:30:00Z",
  "file": {
    "id": "file-uuid",
    "path": "frontend/src/scenes/hexworldscene.ts",
    "name": "hexworldscene.ts",
    "position": { "x": 500, "y": 500 },
    "has_structures": true,
    "structure_count": 25
  },
  "structures": [
    {
      "id": "struct-uuid-1",
      "name": "HexWorldScene",
      "type": "class",
      "start_line": 34,
      "end_line": 556,
      "complexity_score": 10,
      "district_x": 0,
      "district_y": 0,
      "building_size": 5,
      "building_color": "#3498db"
    },
    {
      "id": "struct-uuid-2",
      "name": "createOrUpdateAgent",
      "type": "method",
      "parent_structure_id": "struct-uuid-1",
      "start_line": 157,
      "end_line": 200,
      "complexity_score": 3,
      "district_x": 1,
      "district_y": 0,
      "building_size": 2,
      "building_color": "#e74c3c"
    }
    // ... more structures
  ]
}
```

---

## Document History

| Version | Date       | Changes                                    |
|---------|------------|--------------------------------------------|
| 1.0     | 2025-01-12 | Initial specification created              |

---

**End of Specification**
