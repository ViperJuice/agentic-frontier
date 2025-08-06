-- Migration: Add code-level structure tables for Phase IV
-- File: supabase/migrations/20250806000000_code_structures.sql

-- Table for storing code structures (classes, functions, methods)
CREATE TABLE IF NOT EXISTS code_structures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    session_id TEXT,
    
    -- Structure identification
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('class', 'function', 'method', 'constructor', 'property', 'interface', 'enum', 'type')),
    visibility TEXT CHECK (visibility IN ('public', 'private', 'protected', 'static')),
    is_async BOOLEAN DEFAULT FALSE,
    is_static BOOLEAN DEFAULT FALSE,
    is_abstract BOOLEAN DEFAULT FALSE,
    
    -- Location in file
    start_line INTEGER,
    end_line INTEGER,
    start_column INTEGER,
    end_column INTEGER,
    
    -- Structure metadata
    parameters JSONB,  -- Array of parameter definitions
    return_type TEXT,
    decorators JSONB,  -- Array of decorators/annotations
    docstring TEXT,
    complexity_score INTEGER,
    
    -- Hierarchy
    parent_structure_id UUID REFERENCES code_structures(id) ON DELETE CASCADE,
    depth INTEGER DEFAULT 0,  -- Nesting depth (0 = top-level)
    
    -- Visualization data (position within settlement)
    district_x INTEGER,  -- X position within file settlement
    district_y INTEGER,  -- Y position within file settlement
    building_type TEXT,  -- Visual representation type
    building_color TEXT,  -- Color based on structure type
    building_size INTEGER DEFAULT 1,  -- Size based on lines of code
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for tracking dependencies between files
CREATE TABLE IF NOT EXISTS dependencies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Source and target
    source_file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    target_file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    
    -- Dependency details
    import_statement TEXT NOT NULL,
    import_type TEXT CHECK (import_type IN ('default', 'named', 'namespace', 'side-effect', 'dynamic')),
    imported_items JSONB,  -- Array of imported functions/classes
    is_external BOOLEAN DEFAULT FALSE,  -- External package vs internal
    package_name TEXT,  -- For external dependencies
    
    -- Visualization as trade routes
    route_strength INTEGER DEFAULT 1,  -- Based on usage frequency
    route_color TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for tracking function calls between structures
CREATE TABLE IF NOT EXISTS call_graph (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    session_id TEXT,
    
    -- Caller and callee
    caller_structure_id UUID REFERENCES code_structures(id) ON DELETE CASCADE,
    callee_structure_id UUID REFERENCES code_structures(id) ON DELETE CASCADE,
    
    -- Call context
    call_type TEXT CHECK (call_type IN ('direct', 'callback', 'promise', 'event', 'recursive')),
    call_count INTEGER DEFAULT 1,
    
    -- Visualization
    path_color TEXT,
    animation_type TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_called_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_code_structures_file_id ON code_structures(file_id);
CREATE INDEX idx_code_structures_project_id ON code_structures(project_id);
CREATE INDEX idx_code_structures_parent ON code_structures(parent_structure_id);
CREATE INDEX idx_code_structures_type ON code_structures(type);

CREATE INDEX idx_dependencies_source ON dependencies(source_file_id);
CREATE INDEX idx_dependencies_target ON dependencies(target_file_id);
CREATE INDEX idx_dependencies_project ON dependencies(project_id);

CREATE INDEX idx_call_graph_caller ON call_graph(caller_structure_id);
CREATE INDEX idx_call_graph_callee ON call_graph(callee_structure_id);
CREATE INDEX idx_call_graph_session ON call_graph(session_id);

-- Add columns to existing files table for structure metadata
ALTER TABLE files ADD COLUMN IF NOT EXISTS has_structures BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS structure_count INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN IF NOT EXISTS max_depth INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN IF NOT EXISTS last_parsed_at TIMESTAMPTZ;
ALTER TABLE files ADD COLUMN IF NOT EXISTS needs_parsing BOOLEAN DEFAULT TRUE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS last_explored_at TIMESTAMPTZ;
ALTER TABLE files ADD COLUMN IF NOT EXISTS explored_by TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS parsing_error TEXT;

-- Function to update file structure metadata
CREATE OR REPLACE FUNCTION update_file_structure_metadata()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE files
    SET 
        has_structures = TRUE,
        structure_count = (
            SELECT COUNT(*) FROM code_structures 
            WHERE file_id = NEW.file_id
        ),
        max_depth = (
            SELECT COALESCE(MAX(depth), 0) FROM code_structures 
            WHERE file_id = NEW.file_id
        ),
        last_parsed_at = NOW()
    WHERE id = NEW.file_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update file metadata when structures change
CREATE TRIGGER update_file_on_structure_change
AFTER INSERT OR UPDATE OR DELETE ON code_structures
FOR EACH ROW
EXECUTE FUNCTION update_file_structure_metadata();

-- Real-time subscriptions for code structures
ALTER PUBLICATION supabase_realtime ADD TABLE code_structures;
ALTER PUBLICATION supabase_realtime ADD TABLE dependencies;
ALTER PUBLICATION supabase_realtime ADD TABLE call_graph;