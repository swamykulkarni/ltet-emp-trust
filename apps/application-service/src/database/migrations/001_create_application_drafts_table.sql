-- Create application drafts table for saving incomplete applications
CREATE TABLE IF NOT EXISTS applications.application_drafts (
    draft_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users.users(user_id),
    scheme_id UUID NOT NULL REFERENCES schemes.schemes(scheme_id),
    application_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_application_drafts_user_id ON applications.application_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_application_drafts_scheme_id ON applications.application_drafts(scheme_id);
CREATE INDEX IF NOT EXISTS idx_application_drafts_updated_at ON applications.application_drafts(updated_at);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_application_drafts_updated_at 
    BEFORE UPDATE ON applications.application_drafts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON applications.application_drafts TO ltet_user;