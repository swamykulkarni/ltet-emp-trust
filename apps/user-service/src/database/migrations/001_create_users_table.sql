-- Create users table for LTET Employee Trust Portal
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Personal Information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15) NOT NULL,
    address_street TEXT,
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_pincode VARCHAR(10),
    address_country VARCHAR(100) DEFAULT 'India',
    
    -- Employment Information
    department VARCHAR(255) NOT NULL,
    ic VARCHAR(100) NOT NULL,
    joining_date DATE NOT NULL,
    retirement_date DATE,
    employment_status VARCHAR(20) NOT NULL CHECK (employment_status IN ('active', 'retired')),
    
    -- Bank Details (optional)
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(11),
    bank_name VARCHAR(255),
    
    -- Authentication & Security
    roles TEXT[] NOT NULL DEFAULT ARRAY['employee'],
    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    refresh_token TEXT,
    refresh_token_expires_at TIMESTAMP,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create dependents table
CREATE TABLE IF NOT EXISTS user_dependents (
    dependent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    documents TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);
CREATE INDEX IF NOT EXISTS idx_users_employment_status ON users(employment_status);
CREATE INDEX IF NOT EXISTS idx_users_ic ON users(ic);
CREATE INDEX IF NOT EXISTS idx_user_dependents_user_id ON user_dependents(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_dependents_updated_at BEFORE UPDATE ON user_dependents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();