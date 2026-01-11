-- Migration: Create backup and disaster recovery tracking tables
-- Version: 003
-- Description: Add tables for tracking backup operations and disaster recovery events

-- Create backup schema
CREATE SCHEMA IF NOT EXISTS backup;

-- Set search path
SET search_path TO backup, public;

-- Create enum types for backup operations
CREATE TYPE backup_type AS ENUM ('full', 'incremental', 'differential');
CREATE TYPE backup_status AS ENUM ('in_progress', 'completed', 'failed');
CREATE TYPE recovery_status AS ENUM ('initiated', 'in_progress', 'completed', 'failed', 'rolled_back');
CREATE TYPE health_status AS ENUM ('healthy', 'unhealthy', 'degraded');

-- Backup metadata table
CREATE TABLE backup.backup_metadata (
    backup_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_name VARCHAR(255) NOT NULL UNIQUE,
    backup_type backup_type NOT NULL DEFAULT 'full',
    status backup_status NOT NULL DEFAULT 'in_progress',
    
    -- File information
    file_path VARCHAR(500),
    file_size BIGINT,
    checksum VARCHAR(64),
    
    -- Storage information
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(500),
    
    -- Backup configuration
    encrypted BOOLEAN DEFAULT false,
    compressed BOOLEAN DEFAULT true,
    compression_level INTEGER DEFAULT 6,
    
    -- Timing information
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    created_by UUID REFERENCES users.users(user_id),
    retention_until DATE,
    tags JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backup components table (tracks what was included in each backup)
CREATE TABLE backup.backup_components (
    component_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_id UUID NOT NULL REFERENCES backup.backup_metadata(backup_id) ON DELETE CASCADE,
    
    component_type VARCHAR(100) NOT NULL, -- 'database', 'documents', 'configuration', etc.
    component_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT,
    checksum VARCHAR(64),
    
    -- Component-specific metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disaster recovery events table
CREATE TABLE backup.disaster_recovery_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL, -- 'failover', 'recovery', 'health_check', etc.
    status recovery_status NOT NULL DEFAULT 'initiated',
    
    -- Event details
    reason TEXT NOT NULL,
    from_region VARCHAR(100),
    to_region VARCHAR(100),
    
    -- Timing information
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    
    -- Affected services
    affected_services JSONB DEFAULT '[]'::jsonb,
    
    -- Event metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    
    -- Audit fields
    initiated_by UUID REFERENCES users.users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health check results table
CREATE TABLE backup.health_check_results (
    check_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Service information
    service_name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    region VARCHAR(100) NOT NULL,
    
    -- Check results
    status health_status NOT NULL,
    response_time_ms INTEGER,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timing
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recovery plans table
CREATE TABLE backup.recovery_plans (
    plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Plan configuration
    estimated_duration_ms BIGINT,
    dependencies JSONB DEFAULT '[]'::jsonb,
    
    -- Plan steps (stored as JSON for flexibility)
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    rollback_steps JSONB DEFAULT '[]'::jsonb,
    
    -- Plan metadata
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_by UUID REFERENCES users.users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recovery executions table
CREATE TABLE backup.recovery_executions (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES backup.recovery_plans(plan_id),
    backup_id UUID REFERENCES backup.backup_metadata(backup_id),
    
    -- Execution details
    status recovery_status NOT NULL DEFAULT 'initiated',
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL,
    
    -- Timing information
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    
    -- Configuration
    dry_run BOOLEAN DEFAULT false,
    target_database VARCHAR(500),
    restore_documents BOOLEAN DEFAULT true,
    restore_configuration BOOLEAN DEFAULT true,
    
    -- Results
    steps_completed INTEGER DEFAULT 0,
    steps_failed INTEGER DEFAULT 0,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    
    -- Audit fields
    executed_by UUID REFERENCES users.users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recovery step executions table
CREATE TABLE backup.recovery_step_executions (
    step_execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES backup.recovery_executions(execution_id) ON DELETE CASCADE,
    
    -- Step information
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(100) NOT NULL,
    
    -- Execution details
    status recovery_status NOT NULL DEFAULT 'initiated',
    
    -- Timing information
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    
    -- Results
    command_executed TEXT,
    output TEXT,
    
    -- Error information
    error_message TEXT,
    error_details JSONB,
    
    -- Retry information
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_backup_metadata_status ON backup.backup_metadata(status);
CREATE INDEX idx_backup_metadata_created_at ON backup.backup_metadata(created_at);
CREATE INDEX idx_backup_metadata_backup_type ON backup.backup_metadata(backup_type);
CREATE INDEX idx_backup_metadata_retention ON backup.backup_metadata(retention_until);

CREATE INDEX idx_backup_components_backup_id ON backup.backup_components(backup_id);
CREATE INDEX idx_backup_components_type ON backup.backup_components(component_type);

CREATE INDEX idx_dr_events_event_type ON backup.disaster_recovery_events(event_type);
CREATE INDEX idx_dr_events_status ON backup.disaster_recovery_events(status);
CREATE INDEX idx_dr_events_created_at ON backup.disaster_recovery_events(created_at);

CREATE INDEX idx_health_check_service ON backup.health_check_results(service_name);
CREATE INDEX idx_health_check_status ON backup.health_check_results(status);
CREATE INDEX idx_health_check_checked_at ON backup.health_check_results(checked_at);
CREATE INDEX idx_health_check_region ON backup.health_check_results(region);

CREATE INDEX idx_recovery_plans_active ON backup.recovery_plans(is_active);
CREATE INDEX idx_recovery_plans_name ON backup.recovery_plans(plan_name);

CREATE INDEX idx_recovery_executions_plan_id ON backup.recovery_executions(plan_id);
CREATE INDEX idx_recovery_executions_status ON backup.recovery_executions(status);
CREATE INDEX idx_recovery_executions_started_at ON backup.recovery_executions(started_at);

CREATE INDEX idx_recovery_step_executions_execution_id ON backup.recovery_step_executions(execution_id);
CREATE INDEX idx_recovery_step_executions_status ON backup.recovery_step_executions(status);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_backup_metadata_updated_at 
    BEFORE UPDATE ON backup.backup_metadata 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dr_events_updated_at 
    BEFORE UPDATE ON backup.disaster_recovery_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recovery_plans_updated_at 
    BEFORE UPDATE ON backup.recovery_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recovery_executions_updated_at 
    BEFORE UPDATE ON backup.recovery_executions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE VIEW backup.backup_summary AS
SELECT 
    backup_type,
    status,
    COUNT(*) as count,
    SUM(file_size) as total_size,
    AVG(duration_ms) as avg_duration_ms,
    MIN(created_at) as oldest_backup,
    MAX(created_at) as newest_backup
FROM backup.backup_metadata
GROUP BY backup_type, status;

CREATE VIEW backup.recent_health_checks AS
SELECT DISTINCT ON (service_name, region)
    service_name,
    region,
    status,
    response_time_ms,
    error_message,
    checked_at
FROM backup.health_check_results
ORDER BY service_name, region, checked_at DESC;

CREATE VIEW backup.active_recovery_plans AS
SELECT 
    plan_id,
    plan_name,
    description,
    estimated_duration_ms,
    version,
    created_at,
    updated_at
FROM backup.recovery_plans
WHERE is_active = true
ORDER BY plan_name;

-- Grant permissions
GRANT USAGE ON SCHEMA backup TO ltet_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA backup TO ltet_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA backup TO ltet_user;

-- Insert default recovery plan
INSERT INTO backup.recovery_plans (
    plan_name,
    description,
    estimated_duration_ms,
    steps
) VALUES (
    'Standard Full Recovery',
    'Complete system recovery from full backup including database, documents, and configuration',
    14400000, -- 4 hours
    '[
        {
            "stepId": "1",
            "name": "Verify Backup Integrity",
            "description": "Verify backup file integrity using checksum",
            "type": "validation",
            "timeout": 300000,
            "retryCount": 1,
            "dependencies": []
        },
        {
            "stepId": "2", 
            "name": "Restore Database",
            "description": "Restore PostgreSQL database from backup",
            "type": "database",
            "timeout": 3600000,
            "retryCount": 3,
            "dependencies": ["1"]
        },
        {
            "stepId": "3",
            "name": "Restore Documents",
            "description": "Restore document storage from backup",
            "type": "service",
            "timeout": 1800000,
            "retryCount": 2,
            "dependencies": ["1"]
        },
        {
            "stepId": "4",
            "name": "Restore Configuration",
            "description": "Restore system configuration from backup",
            "type": "configuration",
            "timeout": 300000,
            "retryCount": 2,
            "dependencies": ["1"]
        },
        {
            "stepId": "5",
            "name": "Start Services",
            "description": "Start all application services",
            "type": "service",
            "timeout": 900000,
            "retryCount": 3,
            "dependencies": ["2", "3", "4"]
        },
        {
            "stepId": "6",
            "name": "Validate Recovery",
            "description": "Validate system functionality after recovery",
            "type": "validation",
            "timeout": 600000,
            "retryCount": 1,
            "dependencies": ["5"]
        }
    ]'::jsonb
);

-- Add comments for documentation
COMMENT ON SCHEMA backup IS 'Schema for backup and disaster recovery operations';
COMMENT ON TABLE backup.backup_metadata IS 'Tracks backup operations and metadata';
COMMENT ON TABLE backup.backup_components IS 'Tracks individual components included in each backup';
COMMENT ON TABLE backup.disaster_recovery_events IS 'Tracks disaster recovery events and failovers';
COMMENT ON TABLE backup.health_check_results IS 'Stores health check results for monitoring';
COMMENT ON TABLE backup.recovery_plans IS 'Defines recovery procedures and steps';
COMMENT ON TABLE backup.recovery_executions IS 'Tracks recovery plan executions';
COMMENT ON TABLE backup.recovery_step_executions IS 'Tracks individual recovery step executions';