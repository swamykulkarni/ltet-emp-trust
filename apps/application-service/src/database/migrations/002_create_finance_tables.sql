-- Create finance schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS finance;

-- Create payment queue table for approved claims
CREATE TABLE IF NOT EXISTS finance.payment_queue (
    queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications.applications(application_id),
    user_id UUID NOT NULL REFERENCES users.users(user_id),
    scheme_id UUID NOT NULL REFERENCES schemes.schemes(scheme_id),
    approved_amount DECIMAL(15,2) NOT NULL,
    beneficiary_name VARCHAR(255) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255),
    queue_status VARCHAR(50) DEFAULT 'pending' CHECK (queue_status IN ('pending', 'validated', 'processed', 'failed', 'cancelled')),
    validation_status VARCHAR(50) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'duplicate')),
    validation_details JSONB DEFAULT '{}'::jsonb,
    batch_id UUID,
    priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5),
    scheduled_date DATE,
    processed_by UUID REFERENCES users.users(user_id),
    processed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment batches table for batch processing
CREATE TABLE IF NOT EXISTS finance.payment_batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_name VARCHAR(255) NOT NULL,
    batch_type VARCHAR(50) DEFAULT 'regular' CHECK (batch_type IN ('regular', 'urgent', 'manual')),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    batch_status VARCHAR(50) DEFAULT 'draft' CHECK (batch_status IN ('draft', 'ready', 'processing', 'completed', 'failed')),
    created_by UUID NOT NULL REFERENCES users.users(user_id),
    approved_by UUID REFERENCES users.users(user_id),
    processed_by UUID REFERENCES users.users(user_id),
    scheduled_date DATE,
    processed_at TIMESTAMP WITH TIME ZONE,
    sap_reference VARCHAR(100),
    reconciliation_status VARCHAR(50) DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'unmatched', 'partial')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bank validation cache table
CREATE TABLE IF NOT EXISTS finance.bank_validation_cache (
    cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    validation_result JSONB NOT NULL,
    is_valid BOOLEAN NOT NULL,
    bank_name VARCHAR(255),
    branch_name VARCHAR(255),
    validation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    UNIQUE(account_number, ifsc_code)
);

-- Create duplicate detection table
CREATE TABLE IF NOT EXISTS finance.duplicate_detection (
    detection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    beneficiary_name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users.users(user_id),
    application_ids UUID[] NOT NULL,
    detection_type VARCHAR(50) NOT NULL CHECK (detection_type IN ('exact_match', 'similar_name', 'same_account')),
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    status VARCHAR(50) DEFAULT 'flagged' CHECK (status IN ('flagged', 'reviewed', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users.users(user_id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reconciliation table
CREATE TABLE IF NOT EXISTS finance.payment_reconciliation (
    reconciliation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES finance.payment_batches(batch_id),
    queue_id UUID REFERENCES finance.payment_queue(queue_id),
    bank_reference VARCHAR(100),
    transaction_id VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    transaction_date DATE NOT NULL,
    reconciliation_status VARCHAR(50) DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'unmatched', 'partial', 'disputed')),
    match_confidence DECIMAL(3,2) DEFAULT 0.0,
    reconciled_by UUID REFERENCES users.users(user_id),
    reconciled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_queue_status ON finance.payment_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_payment_queue_validation_status ON finance.payment_queue(validation_status);
CREATE INDEX IF NOT EXISTS idx_payment_queue_application_id ON finance.payment_queue(application_id);
CREATE INDEX IF NOT EXISTS idx_payment_queue_user_id ON finance.payment_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_queue_batch_id ON finance.payment_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_queue_scheduled_date ON finance.payment_queue(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_payment_batches_status ON finance.payment_batches(batch_status);
CREATE INDEX IF NOT EXISTS idx_payment_batches_created_by ON finance.payment_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_payment_batches_scheduled_date ON finance.payment_batches(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_bank_validation_cache_account_ifsc ON finance.bank_validation_cache(account_number, ifsc_code);
CREATE INDEX IF NOT EXISTS idx_bank_validation_cache_expires_at ON finance.bank_validation_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_duplicate_detection_account_ifsc ON finance.duplicate_detection(account_number, ifsc_code);
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_user_id ON finance.duplicate_detection(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_status ON finance.duplicate_detection(status);

CREATE INDEX IF NOT EXISTS idx_reconciliation_batch_id ON finance.payment_reconciliation(batch_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_queue_id ON finance.payment_reconciliation(queue_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON finance.payment_reconciliation(reconciliation_status);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_payment_queue_updated_at 
    BEFORE UPDATE ON finance.payment_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_batches_updated_at 
    BEFORE UPDATE ON finance.payment_batches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA finance TO ltet_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA finance TO ltet_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA finance TO ltet_user;