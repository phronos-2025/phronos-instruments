-- Migration 100h: Seed Reference Data (without vocabulary update)
-- Run AFTER 100g

-- Insert instruments
INSERT INTO instruments (id, name, description, version, config) VALUES
    ('INS-001', 'Semantic Associations',
     'Measures semantic creativity and communicability through word association games',
     '0.3.2',
     '{"num_clues": 5, "num_guesses": 3, "noise_floor_k": 20, "profile_threshold_games": 15}');

-- Insert model versions
INSERT INTO model_versions (model_type, model_name, model_version, config) VALUES
    ('embedding', 'openai', 'text-embedding-3-small', '{"dimensions": 1536, "cost_per_million_tokens": 0.02}'),
    ('llm', 'anthropic', 'claude-haiku-4-5-20251001', '{"temperature": 0.3}'),
    ('scoring', 'phronos', 'v3.1', '{"relevance_threshold": 0.15, "divergence_scale": 100}');

-- Insert system config
INSERT INTO system_config (key, value) VALUES
    ('embedding_model', '"text-embedding-3-small"'),
    ('llm_model', '"claude-haiku-4-5-20251001"'),
    ('scoring_version', '"v3.1"'),
    ('schema_version', '1');

SELECT 'Phase 100h: Seed data inserted (run 100h2 next to link vocabulary)' as status;
