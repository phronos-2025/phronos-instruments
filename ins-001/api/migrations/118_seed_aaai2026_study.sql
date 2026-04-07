-- Migration 118: Seed the AAAI 2026 Spring Symposium study
-- 10-game battery: DAT×2, RAT×2, Bridge×6

BEGIN;

INSERT INTO studies (slug, title, description, config, worked_example, pre_survey, post_survey)
VALUES (
  'aaai2026',
  'Measuring Constructive Creativity in AI-Augmented Work',
  'This study accompanies the paper "Measuring Constructive Creativity in AI-Augmented Work" presented at AAAI 2026. You''ll play 10 semantic association games and see how your creativity profile compares to other participants.',
  -- config: 10-game battery
  '[
    {
      "game_number": 1,
      "type": "dat",
      "m": 0,
      "n": 10,
      "timer_seconds": 60,
      "targets": [],
      "solution": null,
      "instructions": "Name 10 words as different from each other as possible."
    },
    {
      "game_number": 2,
      "type": "rat",
      "m": 3,
      "n": 1,
      "timer_seconds": 30,
      "targets": ["print", "berry", "bird"],
      "solution": "blue",
      "instructions": "Find a single word that forms a compound word or phrase with each of the three target words."
    },
    {
      "game_number": 3,
      "type": "bridge",
      "m": 3,
      "n": 3,
      "timer_seconds": 60,
      "targets": ["star", "ring", "stone"],
      "solution": null,
      "instructions": "Enter 3 words that connect to all of the target words.",
      "show_worked_example": true
    },
    {
      "game_number": 4,
      "type": "bridge",
      "m": 5,
      "n": 5,
      "timer_seconds": 90,
      "targets": ["crane", "novel", "field", "scale", "root"],
      "solution": null,
      "instructions": "Enter 5 words that connect to all of the target words."
    },
    {
      "game_number": 5,
      "type": "dat",
      "m": 0,
      "n": 5,
      "timer_seconds": 45,
      "targets": [],
      "solution": null,
      "instructions": "Name 5 words as different from each other as possible."
    },
    {
      "game_number": 6,
      "type": "bridge",
      "m": 5,
      "n": 3,
      "timer_seconds": 60,
      "targets": ["bridge", "wave", "key", "frame", "pitch"],
      "solution": null,
      "instructions": "Enter 3 words that connect to all of the target words. You have fewer words than targets — make each one count."
    },
    {
      "game_number": 7,
      "type": "bridge",
      "m": 3,
      "n": 5,
      "timer_seconds": 60,
      "targets": ["net", "press", "current"],
      "solution": null,
      "instructions": "Enter 5 words that connect to all of the target words."
    },
    {
      "game_number": 8,
      "type": "bridge",
      "m": 7,
      "n": 7,
      "timer_seconds": 90,
      "targets": ["cast", "draft", "stock", "code", "check", "plate", "ground"],
      "solution": null,
      "instructions": "Enter 7 words that connect to all of the target words."
    },
    {
      "game_number": 9,
      "type": "rat",
      "m": 3,
      "n": 1,
      "timer_seconds": 30,
      "targets": ["water", "mine", "shaker"],
      "solution": "salt",
      "instructions": "Find a single word that forms a compound word or phrase with each of the three target words."
    },
    {
      "game_number": 10,
      "type": "bridge",
      "m": 5,
      "n": 5,
      "timer_seconds": 90,
      "targets": ["table", "cell", "record", "channel", "drive"],
      "solution": null,
      "instructions": "Enter 5 words that connect to all of the target words."
    }
  ]'::jsonb,
  -- worked_example: shown before game 3
  '{
    "show_before_game": 3,
    "targets": ["ocean", "engine", "glass", "rhythm", "paper"],
    "associations": ["surface", "clear", "sheet", "deep", "mechanical"],
    "explanations": [
      "surface → ocean surface, glass surface",
      "clear → clear glass, clear ocean water",
      "sheet → sheet of paper, sheet of glass, sheet music",
      "deep → deep ocean, deep rhythm",
      "mechanical → engine is mechanical, mechanical rhythm"
    ]
  }'::jsonb,
  -- pre_survey: 6 items
  '[
    {
      "id": "meta_monitoring",
      "type": "likert",
      "text": "When working on a complex task, I regularly pause to assess whether my approach is working.",
      "labels": ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
    },
    {
      "id": "meta_evaluation",
      "type": "likert",
      "text": "I can usually tell the difference between when I''m doing good work and when I''m going through the motions.",
      "labels": ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
    },
    {
      "id": "creative_self_efficacy",
      "type": "likert",
      "text": "How would you rate your own creativity relative to your professional peers?",
      "labels": ["Well below average", "Below average", "Average", "Above average", "Well above average"]
    },
    {
      "id": "ai_usage",
      "type": "categorical",
      "text": "In a typical work week, how often do you use AI tools (e.g., LLMs, copilots) to help generate ideas or draft content?",
      "options": ["Never", "Rarely", "Sometimes", "Often", "Always"]
    },
    {
      "id": "familiarity",
      "type": "categorical",
      "text": "Before today, were you familiar with semantic association tasks like the Remote Associates Test or the Divergent Association Task?",
      "options": ["Yes", "No", "I''ve heard of them but never taken one"]
    },
    {
      "id": "country_region",
      "type": "text",
      "text": "What country do you primarily work in?"
    }
  ]'::jsonb,
  -- post_survey: 7 items + free text
  '[
    {
      "id": "meta_strategy_adjustment",
      "type": "likert",
      "text": "During the games, I found myself adjusting my strategy based on the score feedback I received.",
      "labels": ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
    },
    {
      "id": "meta_evaluative_clarity",
      "type": "likert",
      "text": "After seeing my scores, I have a clearer sense of what makes a set of word associations ''good'' versus ''mediocre''.",
      "labels": ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
    },
    {
      "id": "perceived_validity",
      "type": "likert",
      "text": "The scores I received felt like they captured something real about the quality of my responses.",
      "labels": ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
    },
    {
      "id": "creative_self_efficacy_post",
      "type": "likert",
      "text": "After playing these games, how would you rate your own creativity relative to your professional peers?",
      "labels": ["Well below average", "Below average", "Average", "Above average", "Well above average"]
    },
    {
      "id": "novelty",
      "type": "likert",
      "text": "How novel do you find this approach to measuring creativity?",
      "labels": ["Not at all novel", "Slightly novel", "Moderately novel", "Very novel", "Extremely novel"]
    },
    {
      "id": "relevance",
      "type": "likert",
      "text": "How relevant is this to your own work?",
      "labels": ["Not at all relevant", "Slightly relevant", "Moderately relevant", "Very relevant", "Extremely relevant"]
    },
    {
      "id": "likelihood_to_use",
      "type": "likert",
      "text": "How likely are you to use a tool like this in your research or organization?",
      "labels": ["Very unlikely", "Unlikely", "Neutral", "Likely", "Very likely"]
    },
    {
      "id": "free_text",
      "type": "text",
      "text": "Any thoughts, critiques, or suggestions?"
    }
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  worked_example = EXCLUDED.worked_example,
  pre_survey = EXCLUDED.pre_survey,
  post_survey = EXCLUDED.post_survey;

COMMIT;
