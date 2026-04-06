-- Migration 120: Update AAAI 2026 study to v3 config format
-- Restructures battery with evaluative items, count-up timers, optional break

BEGIN;

UPDATE studies SET config = '{
  "battery": [
    {
      "item_number": 1,
      "type": "generative",
      "task": "dat",
      "m": 0,
      "n": 10,
      "targets": [],
      "solution": null,
      "min_words": 2,
      "show_timer": true,
      "show_worked_example": false,
      "instructions": "Name 10 words that are as different from each other as possible.",
      "scoring": {"divergence": true, "divergence_glove": true}
    },
    {
      "item_number": 2,
      "type": "generative",
      "task": "rat",
      "m": 3,
      "n": 1,
      "targets": ["print", "berry", "bird"],
      "solution": "blue",
      "min_words": 1,
      "show_timer": true,
      "show_worked_example": false,
      "instructions": "Find a single word that forms a compound word or phrase with each of the three words above.",
      "scoring": {"alignment": true}
    },
    {
      "item_number": 3,
      "type": "generative",
      "task": "bridge",
      "m": 5,
      "n": 5,
      "targets": ["crane", "novel", "field", "scale", "root"],
      "solution": null,
      "min_words": 1,
      "show_timer": true,
      "show_worked_example": true,
      "instructions": "Enter 5 words that connect to all of the target words.",
      "scoring": {"divergence": true, "alignment": true, "parsimony": true, "recovery": true}
    },
    {
      "item_number": 4,
      "type": "generative",
      "task": "bridge",
      "m": 5,
      "n": 3,
      "targets": ["bridge", "wave", "key", "frame", "pitch"],
      "solution": null,
      "min_words": 1,
      "show_timer": true,
      "show_worked_example": false,
      "instructions": "Enter 3 words that connect to all of the target words. You have fewer words than targets \u2014 make each one count.",
      "scoring": {"divergence": true, "alignment": true, "parsimony": true, "recovery": true}
    },
    {
      "item_number": 5,
      "type": "evaluative",
      "task": "alignment_ranking",
      "targets": ["crane", "novel", "field", "scale", "root"],
      "show_timer": false,
      "instructions": "Which set of words best connects to all five targets? Rank them from best to worst.",
      "stimulus_sets": {
        "A": {"label": "Set A", "words": ["paper", "book", "ground", "measure", "plant"], "precomputed_alignment": null},
        "B": {"label": "Set B", "words": ["work", "heavy", "deep", "music", "old"], "precomputed_alignment": null},
        "C": {"label": "Set C", "words": ["river", "bright", "smooth", "circle", "hammer"], "precomputed_alignment": null}
      }
    },
    {
      "item_number": 6,
      "type": "evaluative",
      "task": "parsimony_loo",
      "targets": ["light", "match", "spring", "bank", "suit"],
      "show_timer": false,
      "instructions": "Which word, if any, could be removed without losing much connection to the targets?",
      "stimulus_set": {
        "words": ["fire", "water", "season", "money", "clothing", "flame"],
        "expected_redundant": "flame",
        "precomputed_deltas": null
      }
    },
    {
      "item_number": 7,
      "type": "evaluative",
      "task": "peer_rating",
      "targets": ["crane", "novel", "field", "scale", "root"],
      "show_timer": false,
      "source_item": 3,
      "n_responses_to_rate": 2,
      "cold_start_threshold": 5,
      "instructions": "Rate each set of words on three dimensions.",
      "cold_start_sets": {
        "X": {"words": ["telescope", "origami", "harvest", "symphony", "archaeology"], "precomputed_divergence": null, "precomputed_alignment": null, "precomputed_parsimony": null},
        "Y": {"words": ["paper", "ground", "measure", "growth", "lift"], "precomputed_divergence": null, "precomputed_alignment": null, "precomputed_parsimony": null}
      },
      "dimensions": [
        {"key": "difference", "prompt": "How different are these words from each other?", "low": "Very similar", "high": "Very different"},
        {"key": "connection", "prompt": "How well do these words connect to all of the targets?", "low": "No connection", "high": "Strong connection"},
        {"key": "uniqueness", "prompt": "Does each word contribute something unique?", "low": "Much redundancy", "high": "Every word is essential"}
      ]
    },
    {
      "item_number": 8,
      "type": "generative",
      "task": "bridge",
      "m": 3,
      "n": 5,
      "targets": ["net", "press", "current"],
      "solution": null,
      "min_words": 1,
      "show_timer": true,
      "show_worked_example": false,
      "optional": true,
      "instructions": "Enter 5 words that connect to all of the target words.",
      "scoring": {"divergence": true, "alignment": true, "parsimony": true, "recovery": true}
    },
    {
      "item_number": 9,
      "type": "generative",
      "task": "rat",
      "m": 3,
      "n": 1,
      "targets": ["water", "mine", "shaker"],
      "solution": "salt",
      "min_words": 1,
      "show_timer": true,
      "show_worked_example": false,
      "optional": true,
      "instructions": "Find a single word that forms a compound word or phrase with each of the three words above.",
      "scoring": {"alignment": true}
    },
    {
      "item_number": 10,
      "type": "generative",
      "task": "bridge",
      "m": 5,
      "n": 5,
      "targets": ["table", "cell", "record", "channel", "drive"],
      "solution": null,
      "min_words": 1,
      "show_timer": true,
      "show_worked_example": false,
      "optional": true,
      "instructions": "Enter 5 words that connect to all of the target words.",
      "scoring": {"divergence": true, "alignment": true, "parsimony": true, "recovery": true}
    }
  ],
  "worked_example": {
    "show_before_item": 3,
    "targets": ["ocean", "engine", "glass", "rhythm", "paper"],
    "associations": ["surface", "clear", "sheet", "deep", "mechanical"],
    "explanations": [
      {"word": "surface", "connections": "ocean surface, glass surface"},
      {"word": "clear", "connections": "clear glass, clear ocean water"},
      {"word": "sheet", "connections": "sheet of paper, sheet of glass, sheet music"},
      {"word": "deep", "connections": "deep ocean, deep rhythm"},
      {"word": "mechanical", "connections": "engine is mechanical, mechanical rhythm"}
    ]
  },
  "optional_break_after_item": 7
}'::jsonb
WHERE slug = 'aaai2026';

-- Sync items_completed from games_completed for any existing enrollments
UPDATE study_enrollments
SET items_completed = games_completed
WHERE study_slug = 'aaai2026' AND items_completed = 0 AND games_completed > 0;

COMMIT;
