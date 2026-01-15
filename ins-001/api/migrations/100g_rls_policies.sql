-- Migration 100g: Row Level Security Policies
-- Run AFTER 100f

-- Enable RLS on new tables
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_edges ENABLE ROW LEVEL SECURITY;

-- Instruments: public read
CREATE POLICY instruments_public_read ON instruments
    FOR SELECT USING (true);

-- System config: public read (no secrets here)
CREATE POLICY system_config_public_read ON system_config
    FOR SELECT USING (true);

-- Model versions: public read
CREATE POLICY model_versions_public_read ON model_versions
    FOR SELECT USING (true);

-- Games: sender can do everything
CREATE POLICY games_sender ON games
    FOR ALL USING (sender_id = auth.uid());

-- Games: recipient can read and update (for submitting their bridge/guesses)
CREATE POLICY games_recipient_select ON games
    FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY games_recipient_update ON games
    FOR UPDATE USING (recipient_id = auth.uid());

-- Share tokens: public read (needed for join flow)
CREATE POLICY share_tokens_public_read ON share_tokens
    FOR SELECT USING (true);

-- Share tokens: only sender can create
CREATE POLICY share_tokens_sender_insert ON share_tokens
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM games WHERE id = game_id AND sender_id = auth.uid())
    );

-- Social edges: participants can read
CREATE POLICY edges_participant ON social_edges
    FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

SELECT 'Phase 100g: RLS policies created' as status;
