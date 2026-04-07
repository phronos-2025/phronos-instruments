-- Migration 121: Fix post-survey Likert labels for questions 5-7
-- "How novel/relevant/likely" questions need degree labels, not agree/disagree

BEGIN;

UPDATE studies
SET post_survey = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'id' = 'novelty' THEN
        jsonb_set(item, '{labels}', '["Not at all novel", "Slightly novel", "Moderately novel", "Very novel", "Extremely novel"]')
      WHEN item->>'id' = 'relevance' THEN
        jsonb_set(item, '{labels}', '["Not at all relevant", "Slightly relevant", "Moderately relevant", "Very relevant", "Extremely relevant"]')
      WHEN item->>'id' = 'likelihood_to_use' THEN
        jsonb_set(item, '{labels}', '["Very unlikely", "Unlikely", "Neutral", "Likely", "Very likely"]')
      ELSE item
    END
  )
  FROM jsonb_array_elements(post_survey) AS item
)
WHERE slug = 'aaai2026';

COMMIT;
