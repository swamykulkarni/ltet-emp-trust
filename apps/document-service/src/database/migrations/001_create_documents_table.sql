-- Create documents schema
CREATE SCHEMA IF NOT EXISTS documents;

-- Create documents table
CREATE TABLE documents.documents (
    document_id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    validation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    validation_results JSONB,
    ocr_data JSONB,
    confidence_score DECIMAL(3,2),
    uploaded_by VARCHAR(36) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Constraints
    CONSTRAINT chk_validation_status CHECK (validation_status IN ('pending', 'validated', 'failed', 'processing')),
    CONSTRAINT chk_file_size CHECK (file_size > 0 AND file_size <= 5242880), -- 5MB limit
    CONSTRAINT chk_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT chk_version CHECK (version > 0)
);

-- Create indexes for better performance
CREATE INDEX idx_documents_application_id ON documents.documents(application_id);
CREATE INDEX idx_documents_document_type ON documents.documents(document_type);
CREATE INDEX idx_documents_validation_status ON documents.documents(validation_status);
CREATE INDEX idx_documents_uploaded_by ON documents.documents(uploaded_by);
CREATE INDEX idx_documents_uploaded_at ON documents.documents(uploaded_at);
CREATE INDEX idx_documents_confidence_score ON documents.documents(confidence_score);

-- Create composite indexes for common queries
CREATE INDEX idx_documents_app_type ON documents.documents(application_id, document_type);
CREATE INDEX idx_documents_status_uploaded ON documents.documents(validation_status, uploaded_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION documents.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents.documents 
    FOR EACH ROW 
    EXECUTE FUNCTION documents.update_updated_at_column();

-- Create document versions table for version history
CREATE TABLE documents.document_versions (
    version_id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    version_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    validation_status VARCHAR(20) NOT NULL,
    validation_results JSONB,
    ocr_data JSONB,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(36) NOT NULL,
    
    -- Foreign key constraint
    CONSTRAINT fk_document_versions_document_id 
        FOREIGN KEY (document_id) 
        REFERENCES documents.documents(document_id) 
        ON DELETE CASCADE,
    
    -- Unique constraint for document_id + version_number
    CONSTRAINT uk_document_versions_doc_version 
        UNIQUE (document_id, version_number),
    
    -- Constraints
    CONSTRAINT chk_version_validation_status CHECK (validation_status IN ('pending', 'validated', 'failed', 'processing')),
    CONSTRAINT chk_version_file_size CHECK (file_size > 0 AND file_size <= 5242880), -- 5MB limit
    CONSTRAINT chk_version_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT chk_version_number CHECK (version_number > 0)
);

-- Create indexes for document versions
CREATE INDEX idx_document_versions_document_id ON documents.document_versions(document_id);
CREATE INDEX idx_document_versions_created_at ON documents.document_versions(created_at);

-- Create document metadata table for additional document properties
CREATE TABLE documents.document_metadata (
    metadata_id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    page_count INTEGER,
    dimensions_width INTEGER,
    dimensions_height INTEGER,
    quality VARCHAR(10),
    is_readable BOOLEAN NOT NULL DEFAULT false,
    has_text BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_document_metadata_document_id 
        FOREIGN KEY (document_id) 
        REFERENCES documents.documents(document_id) 
        ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_quality CHECK (quality IN ('high', 'medium', 'low')),
    CONSTRAINT chk_page_count CHECK (page_count > 0),
    CONSTRAINT chk_dimensions CHECK (dimensions_width > 0 AND dimensions_height > 0)
);

-- Create index for document metadata
CREATE INDEX idx_document_metadata_document_id ON documents.document_metadata(document_id);

-- Grant permissions (adjust as needed for your environment)
-- GRANT USAGE ON SCHEMA documents TO ltet_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA documents TO ltet_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA documents TO ltet_app_user;

-- Insert sample document types for reference
CREATE TABLE documents.document_types (
    type_id VARCHAR(36) PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    required_fields JSONB,
    validation_rules JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_category CHECK (category IN ('medical', 'education', 'skill_building', 'identity', 'financial', 'other'))
);

-- Create index for document types
CREATE INDEX idx_document_types_category ON documents.document_types(category);
CREATE INDEX idx_document_types_active ON documents.document_types(is_active);

-- Insert common document types
INSERT INTO documents.document_types (type_id, type_name, category, description, required_fields, validation_rules) VALUES
('dt_001', 'income_certificate', 'financial', 'Income certificate from employer', '["employee_id", "salary_amount", "issue_date"]', '{"salary_amount": {"type": "currency", "required": true}}'),
('dt_002', 'salary_slip', 'financial', 'Monthly salary slip', '["employee_id", "salary_amount", "month_year"]', '{"salary_amount": {"type": "currency", "required": true}}'),
('dt_003', 'medical_bill', 'medical', 'Medical treatment bill', '["bill_amount", "patient_name", "treatment_date"]', '{"bill_amount": {"type": "currency", "required": true}}'),
('dt_004', 'medical_report', 'medical', 'Medical diagnosis report', '["patient_name", "doctor_name", "diagnosis_date"]', '{"patient_name": {"type": "text", "required": true}}'),
('dt_005', 'education_certificate', 'education', 'Educational qualification certificate', '["student_name", "institution_name", "completion_date"]', '{"student_name": {"type": "text", "required": true}}'),
('dt_006', 'marksheet', 'education', 'Academic marksheet or transcript', '["student_name", "grade_percentage", "academic_year"]', '{"grade_percentage": {"type": "percentage", "required": true}}'),
('dt_007', 'bank_statement', 'financial', 'Bank account statement', '["account_number", "ifsc_code", "statement_period"]', '{"account_number": {"type": "text", "required": true}}'),
('dt_008', 'identity_proof', 'identity', 'Government issued identity document', '["id_number", "full_name", "issue_date"]', '{"id_number": {"type": "text", "required": true}}'),
('dt_009', 'address_proof', 'identity', 'Address verification document', '["address", "full_name", "issue_date"]', '{"address": {"type": "text", "required": true}}'),
('dt_010', 'skill_certificate', 'skill_building', 'Professional skill certification', '["certificate_name", "issuing_authority", "completion_date"]', '{"certificate_name": {"type": "text", "required": true}}');