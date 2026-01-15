-- Migration 100j: Verification
-- Run LAST to verify everything worked

-- Check all tables exist
DO $$
DECLARE
    missing_tables TEXT[];
BEGIN
    SELECT array_agg(t) INTO missing_tables
    FROM unnest(ARRAY['instruments', 'system_config', 'model_versions', 'games', 'share_tokens', 'social_edges']) t
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = t
    );

    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION 'Missing tables: %', missing_tables;
    END IF;

    RAISE NOTICE 'All tables created successfully';
END $$;

-- Check vocabulary has model_version_id
DO $$
DECLARE
    unlinked_count INT;
BEGIN
    SELECT COUNT(*) INTO unlinked_count
    FROM vocabulary_embeddings
    WHERE model_version_id IS NULL;

    IF unlinked_count > 0 THEN
        RAISE WARNING '% vocabulary embeddings not linked to model version', unlinked_count;
    ELSE
        RAISE NOTICE 'All vocabulary embeddings linked to model version';
    END IF;
END $$;

-- Check seed data
DO $$
DECLARE
    instrument_count INT;
    model_count INT;
    config_count INT;
BEGIN
    SELECT COUNT(*) INTO instrument_count FROM instruments;
    SELECT COUNT(*) INTO model_count FROM model_versions;
    SELECT COUNT(*) INTO config_count FROM system_config;

    IF instrument_count = 0 THEN
        RAISE WARNING 'No instruments found';
    ELSE
        RAISE NOTICE 'Found % instruments', instrument_count;
    END IF;

    IF model_count = 0 THEN
        RAISE WARNING 'No model versions found';
    ELSE
        RAISE NOTICE 'Found % model versions', model_count;
    END IF;

    IF config_count = 0 THEN
        RAISE WARNING 'No system config found';
    ELSE
        RAISE NOTICE 'Found % config entries', config_count;
    END IF;
END $$;

SELECT 'Migration 100 complete!' as status;
