-- Migration 101: Mailing List Table
-- Supports email newsletter subscriptions with optional user linking

-- 1. Create mailing_list table
CREATE TABLE mailing_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    is_active BOOLEAN DEFAULT TRUE,
    source TEXT DEFAULT 'website',  -- 'website', 'instrument', 'import'
    welcome_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email)
);

COMMENT ON TABLE mailing_list IS 'Email newsletter subscribers with optional link to auth.users';

-- 2. Create index for fast lookups
CREATE INDEX idx_mailing_list_email ON mailing_list(email);
CREATE INDEX idx_mailing_list_user_id ON mailing_list(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_mailing_list_active ON mailing_list(is_active) WHERE is_active = TRUE;

-- 3. Enable RLS
ALTER TABLE mailing_list ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Anyone can subscribe (insert)
CREATE POLICY mailing_list_public_insert ON mailing_list
    FOR INSERT WITH CHECK (true);

-- Users can view their own subscription (by email match via JWT)
CREATE POLICY mailing_list_user_select ON mailing_list
    FOR SELECT USING (
        email = (current_setting('request.jwt.claims', true)::json->>'email')
        OR user_id = auth.uid()
    );

-- Users can update their own subscription
CREATE POLICY mailing_list_user_update ON mailing_list
    FOR UPDATE USING (
        email = (current_setting('request.jwt.claims', true)::json->>'email')
        OR user_id = auth.uid()
    );

-- Public can read by unsubscribe token (for unsubscribe flow)
CREATE POLICY mailing_list_token_select ON mailing_list
    FOR SELECT USING (true);

-- 5. Function to link existing subscribers when user authenticates
CREATE OR REPLACE FUNCTION link_mailing_list_on_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user signs up/in, link any existing subscription to their account
    UPDATE mailing_list
    SET user_id = NEW.id,
        updated_at = NOW()
    WHERE email = NEW.email
      AND user_id IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to auto-link on user creation
DROP TRIGGER IF EXISTS link_mailing_on_user_create ON auth.users;
CREATE TRIGGER link_mailing_on_user_create
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION link_mailing_list_on_auth();

-- 7. Function to auto-subscribe authenticated users (optional - call from app)
CREATE OR REPLACE FUNCTION subscribe_authenticated_user(p_email TEXT, p_source TEXT DEFAULT 'website')
RETURNS UUID AS $$
DECLARE
    v_subscription_id UUID;
    v_user_id UUID;
BEGIN
    -- Get current user ID if authenticated
    v_user_id := auth.uid();

    -- Insert or update subscription
    INSERT INTO mailing_list (email, user_id, source)
    VALUES (p_email, v_user_id, p_source)
    ON CONFLICT (email) DO UPDATE SET
        user_id = COALESCE(mailing_list.user_id, v_user_id),
        is_active = TRUE,
        updated_at = NOW()
    RETURNING id INTO v_subscription_id;

    RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Migration 101: mailing_list table created' as status;
