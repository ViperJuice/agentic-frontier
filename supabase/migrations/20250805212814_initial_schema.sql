-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    statistics JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active'
);

-- Agent Sessions table
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL UNIQUE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active',
    agent_type TEXT DEFAULT 'main',
    parent_session_id UUID REFERENCES agent_sessions(id),
    transcript_path TEXT,
    metadata JSONB DEFAULT '{}',
    statistics JSONB DEFAULT '{}'
);

-- Activity Events table
CREATE TABLE activity_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    tool_name TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    activity_type TEXT,
    activity_description TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'success',
    raw_input JSONB NOT NULL,
    tool_input JSONB,
    tool_response JSONB,
    file_context JSONB,
    command_context JSONB,
    error_context JSONB,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Characters table
CREATE TABLE agent_characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_type TEXT DEFAULT 'default',
    position JSONB DEFAULT '{"x": 0, "y": 0, "z": 0}',
    current_action TEXT,
    status TEXT DEFAULT 'idle',
    speech_bubble TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    extension TEXT,
    size_bytes INTEGER DEFAULT 0,
    lines_count INTEGER DEFAULT 0,
    building_type TEXT,
    building_height INTEGER DEFAULT 1,
    position JSONB DEFAULT '{"x": 0, "y": 0}',
    last_modified_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified_by UUID REFERENCES agent_sessions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(project_id, path)
);

-- Create indexes
CREATE INDEX idx_activity_events_session_id ON activity_events(session_id);
CREATE INDEX idx_activity_events_project_id ON activity_events(project_id);
CREATE INDEX idx_activity_events_timestamp ON activity_events(timestamp DESC);
CREATE INDEX idx_agent_sessions_project_id ON agent_sessions(project_id);
CREATE INDEX idx_files_project_id ON files(project_id);
