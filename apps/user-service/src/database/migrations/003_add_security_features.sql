-- Migration: Add security features (MFA and audit logging)
-- Date: 2024-01-09
-- Description: Adds MFA fields to users table and creates audit log table

-- Add MFA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT; -- JSON array of encrypted backup codes
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_used TIMESTAMP;

-- Create audit_logs table for comprehensive security logging
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details TEXT, -- Encrypted JSON details
    ip_address INET NOT NULL,
    user_agent TEXT,
    session_id VARCHAR(255),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    metadata TEXT, -- Encrypted JSON metadata
    integrity_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_logs table for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_risk ON audit_logs(timestamp, risk_level);

-- Create security_events table for real-time security monitoring
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    user_id VARCHAR(255),
    ip_address INET,
    description TEXT NOT NULL,
    details TEXT, -- Encrypted JSON details
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for security_events table
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Create encryption_keys table for key management
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name VARCHAR(100) NOT NULL UNIQUE,
    key_version INTEGER NOT NULL DEFAULT 1,
    encrypted_key TEXT NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    rotated_at TIMESTAMP
);

-- Create indexes for encryption_keys table
CREATE INDEX IF NOT EXISTS idx_encryption_keys_name ON encryption_keys(key_name);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(active);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_expires_at ON encryption_keys(expires_at);

-- Create session_security table for enhanced session management
CREATE TABLE IF NOT EXISTS session_security (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    mfa_verified BOOLEAN DEFAULT FALSE,
    mfa_verified_at TIMESTAMP,
    risk_score INTEGER DEFAULT 0,
    last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    invalidated BOOLEAN DEFAULT FALSE,
    invalidated_at TIMESTAMP,
    invalidation_reason VARCHAR(100)
);

-- Create indexes for session_security table
CREATE INDEX IF NOT EXISTS idx_session_security_user_id ON session_security(user_id);
CREATE INDEX IF NOT EXISTS idx_session_security_expires_at ON session_security(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_security_invalidated ON session_security(invalidated);
CREATE INDEX IF NOT EXISTS idx_session_security_last_activity ON session_security(last_activity);

-- Create function to automatically clean up old audit logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    -- Delete audit logs older than 7 years (2555 days)
    DELETE FROM audit_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2555 days';
    
    -- Delete resolved security events older than 1 year
    DELETE FROM security_events 
    WHERE resolved = TRUE 
    AND resolved_at < CURRENT_TIMESTAMP - INTERVAL '365 days';
    
    -- Delete expired sessions
    DELETE FROM session_security 
    WHERE expires_at < CURRENT_TIMESTAMP 
    OR invalidated = TRUE AND invalidated_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to update session last activity
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id VARCHAR(255))
RETURNS void AS $$
BEGIN
    UPDATE session_security 
    SET last_activity = CURRENT_TIMESTAMP 
    WHERE session_id = p_session_id 
    AND invalidated = FALSE 
    AND expires_at > CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate session risk score
CREATE OR REPLACE FUNCTION calculate_session_risk(
    p_user_id VARCHAR(255),
    p_ip_address INET,
    p_user_agent TEXT
) RETURNS INTEGER AS $$
DECLARE
    risk_score INTEGER := 0;
    ip_count INTEGER;
    agent_count INTEGER;
    recent_failures INTEGER;
BEGIN
    -- Check for multiple IPs for same user in last 24 hours
    SELECT COUNT(DISTINCT ip_address) INTO ip_count
    FROM session_security 
    WHERE user_id = p_user_id 
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    IF ip_count > 3 THEN
        risk_score := risk_score + 30;
    ELSIF ip_count > 1 THEN
        risk_score := risk_score + 10;
    END IF;
    
    -- Check for multiple user agents for same user in last 24 hours
    SELECT COUNT(DISTINCT user_agent) INTO agent_count
    FROM session_security 
    WHERE user_id = p_user_id 
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    IF agent_count > 2 THEN
        risk_score := risk_score + 20;
    END IF;
    
    -- Check for recent failed login attempts
    SELECT COUNT(*) INTO recent_failures
    FROM audit_logs 
    WHERE user_id = p_user_id 
    AND action = 'login' 
    AND success = FALSE 
    AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour';
    
    risk_score := risk_score + (recent_failures * 15);
    
    -- Cap risk score at 100
    IF risk_score > 100 THEN
        risk_score := 100;
    END IF;
    
    RETURN risk_score;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit logging for security compliance and forensic analysis';
COMMENT ON TABLE security_events IS 'Real-time security event monitoring and alerting';
COMMENT ON TABLE encryption_keys IS 'Centralized encryption key management with rotation support';
COMMENT ON TABLE session_security IS 'Enhanced session security tracking with risk scoring';

COMMENT ON COLUMN users.mfa_enabled IS 'Whether multi-factor authentication is enabled for the user';
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret for MFA';
COMMENT ON COLUMN users.mfa_backup_codes IS 'JSON array of encrypted backup codes for MFA recovery';
COMMENT ON COLUMN users.mfa_enabled_at IS 'Timestamp when MFA was first enabled';
COMMENT ON COLUMN users.mfa_last_used IS 'Timestamp of last successful MFA verification';

COMMENT ON COLUMN audit_logs.details IS 'Encrypted JSON containing sensitive operation details';
COMMENT ON COLUMN audit_logs.integrity_hash IS 'Cryptographic hash for tamper detection';
COMMENT ON COLUMN audit_logs.risk_level IS 'Calculated risk level: low, medium, high, critical';

-- Grant appropriate permissions
GRANT SELECT, INSERT ON audit_logs TO ltet_user;
GRANT SELECT, INSERT, UPDATE ON security_events TO ltet_user;
GRANT SELECT ON encryption_keys TO ltet_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_security TO ltet_user;

-- Create a view for audit log analysis (without sensitive details)
CREATE OR REPLACE VIEW audit_summary AS
SELECT 
    DATE_TRUNC('day', timestamp) as log_date,
    user_role,
    action,
    resource,
    risk_level,
    success,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM audit_logs 
GROUP BY DATE_TRUNC('day', timestamp), user_role, action, resource, risk_level, success
ORDER BY log_date DESC;

GRANT SELECT ON audit_summary TO ltet_user;

-- Insert initial encryption keys (these should be rotated in production)
INSERT INTO encryption_keys (key_name, key_type, algorithm, encrypted_key) 
VALUES 
    ('mfa_encryption', 'symmetric', 'AES-256-GCM', 'encrypted_key_placeholder_change_in_production'),
    ('audit_encryption', 'symmetric', 'AES-256-GCM', 'encrypted_key_placeholder_change_in_production'),
    ('session_encryption', 'symmetric', 'AES-256-GCM', 'encrypted_key_placeholder_change_in_production')
ON CONFLICT (key_name) DO NOTHING;