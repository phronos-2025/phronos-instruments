import { e as createComponent, n as renderComponent, r as renderTemplate } from '../../chunks/astro/server_CE_9OsnW.mjs';
import 'piccolore';
import { a as api, $ as $$InstrumentLayout } from '../../chunks/api_BU-QsgYZ.mjs';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { createContext, useReducer, useContext, useState, useEffect, useMemo } from 'react';
import { u as useAuth, A as AuthProvider } from '../../chunks/AuthProvider_DqxnARqy.mjs';
import { N as Navigation } from '../../chunks/Navigation_CCvfDsjT.mjs';
import { P as Panel, B as Button, s as supabase } from '../../chunks/Button_DFORBRMv.mjs';
import { P as ProgressBar, S as ShareLinkBox } from '../../chunks/ShareLinkBox_DYxLMesC.mjs';
import { M as MagicLinkModal } from '../../chunks/MagicLinkModal_CKjFIbjs.mjs';
export { renderers } from '../../renderers.mjs';

function gameReducer(state, action) {
  switch (action.type) {
    case "BEGIN":
      return { screen: "seed" };
    case "BACK":
      if (state.screen === "clues") return { screen: "seed" };
      if (state.screen === "share" && state.noiseFloor && state.seedWord) {
        return { screen: "clues", gameId: state.gameId, noiseFloor: state.noiseFloor, seedWord: state.seedWord };
      }
      if (state.screen === "share") return { screen: "seed" };
      if (state.screen === "seed") return { screen: "intro" };
      return state;
    case "SEED_SUBMITTED":
      if (action.isPolysemous && action.senseOptions) {
        return {
          screen: "sense",
          seedWord: action.seedWord,
          senseOptions: action.senseOptions
        };
      }
      if (action.gameId && action.noiseFloor) {
        return {
          screen: "clues",
          gameId: action.gameId,
          noiseFloor: action.noiseFloor,
          seedWord: action.seedWord
        };
      }
      return state;
    case "SENSE_SELECTED":
      return {
        screen: "clues",
        gameId: action.gameId,
        noiseFloor: action.noiseFloor,
        seedWord: action.seedWord
      };
    case "CLUES_SUBMITTED":
      return {
        screen: "share",
        gameId: action.gameId,
        divergence: action.divergence,
        noiseFloor: action.noiseFloor,
        seedWord: action.seedWord
      };
    case "GAME_COMPLETED":
      return {
        screen: "results",
        game: action.game
      };
    case "RESET":
      return { screen: "intro" };
    default:
      return state;
  }
}
const GameContext = createContext(void 0);
function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, { screen: "intro" });
  return /* @__PURE__ */ jsx(GameContext.Provider, { value: { state, dispatch }, children });
}
function useGameState() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameState must be used within GameProvider");
  }
  return context;
}

const IntroScreen = () => {
  const { dispatch } = useGameState();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const handleBegin = () => {
    if (consentAccepted) {
      dispatch({ type: "BEGIN" });
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 1 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.1" }),
      " · Signal"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Map a signal." }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "This instrument measures two dimensions of cognition: how divergently you associate concepts, and how effectively you communicate those associations to others." }),
    /* @__PURE__ */ jsx(Panel, { title: "How It Works", meta: "~5 minutes", children: /* @__PURE__ */ jsxs("div", { style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "var(--space-md)",
      fontFamily: "var(--font-mono)",
      fontSize: "0.75rem"
    }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { style: { color: "var(--gold)", fontSize: "1.5rem", marginBottom: "var(--space-xs)" }, children: "01" }),
        /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)", marginBottom: "4px" }, children: "Choose a word" }),
        /* @__PURE__ */ jsx("div", { style: { color: "var(--faded)", fontSize: "0.65rem" }, children: "Any word. Your target." })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { style: { color: "var(--gold)", fontSize: "1.5rem", marginBottom: "var(--space-xs)" }, children: "02" }),
        /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)", marginBottom: "4px" }, children: "Give 1-5 concepts" }),
        /* @__PURE__ */ jsx("div", { style: { color: "var(--faded)", fontSize: "0.65rem" }, children: "One-word associations." })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { style: { color: "var(--gold)", fontSize: "1.5rem", marginBottom: "var(--space-xs)" }, children: "03" }),
        /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)", marginBottom: "4px" }, children: "See what emerges" }),
        /* @__PURE__ */ jsx("div", { style: { color: "var(--faded)", fontSize: "0.65rem" }, children: "Divergence. Convergence." })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Panel, { className: "", style: { background: "transparent", borderColor: "var(--gold-dim)" }, children: /* @__PURE__ */ jsxs("div", { style: { fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--faded)" }, children: [
      /* @__PURE__ */ jsx("strong", { style: { color: "var(--text-light)" }, children: "What this measures:" }),
      /* @__PURE__ */ jsx("br", {}),
      /* @__PURE__ */ jsx("br", {}),
      /* @__PURE__ */ jsx("strong", { children: "Divergence" }),
      " — How far your associations venture from the predictable. High divergence indicates unexpected semantic paths.",
      /* @__PURE__ */ jsx("br", {}),
      /* @__PURE__ */ jsx("br", {}),
      /* @__PURE__ */ jsx("strong", { children: "Convergence" }),
      " — How accurately others can decode your associations. High convergence indicates effective communication of meaning."
    ] }) }),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "var(--space-md)", textAlign: "left", maxWidth: "500px" }, children: /* @__PURE__ */ jsxs("label", { style: { display: "flex", gap: "var(--space-sm)", alignItems: "flex-start", cursor: "pointer" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: consentAccepted,
          onChange: (e) => setConsentAccepted(e.target.checked),
          style: { marginTop: "4px", accentColor: "var(--gold)", width: "16px", height: "16px", cursor: "pointer" }
        }
      ),
      /* @__PURE__ */ jsxs("span", { style: { fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--faded)", lineHeight: "1.5" }, children: [
        "I agree to the",
        " ",
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "https://phronos.org/terms",
            target: "_blank",
            rel: "noopener noreferrer",
            style: { color: "var(--gold)", textDecoration: "none", borderBottom: "1px dotted" },
            children: "Terms of Service"
          }
        ),
        " ",
        "and",
        " ",
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "https://phronos.org/privacy",
            target: "_blank",
            rel: "noopener noreferrer",
            style: { color: "var(--gold)", textDecoration: "none", borderBottom: "1px dotted" },
            children: "Privacy Policy"
          }
        ),
        ", and consent to the processing of my responses as described therein."
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "btn-group", style: { marginTop: 0 }, children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "primary",
        onClick: handleBegin,
        disabled: !consentAccepted,
        children: "Begin Assessment"
      }
    ) }),
    /* @__PURE__ */ jsx("p", { style: { fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--faded)", marginTop: "var(--space-lg)" }, children: "There are no correct answers—only your signal." })
  ] });
};

const SeedScreen = () => {
  const { dispatch } = useGameState();
  const [seedWord, setSeedWord] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestAttempt, setSuggestAttempt] = useState(1);
  const [error, setError] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const ensureAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Session error:", sessionError);
          setError(`Session error: ${sessionError.message}`);
          setAuthReady(true);
          return;
        }
        if (!session) {
          const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
          if (authError) {
            console.error("Auth error:", authError);
            setError(`Authentication failed: ${authError.message}. You can still try to continue.`);
            setAuthReady(true);
            return;
          }
          if (!authData.session) {
            console.error("No session after anonymous sign-in");
            setError("Failed to create anonymous session. Please refresh the page.");
            setAuthReady(true);
            return;
          }
        }
        setAuthReady(true);
      } catch (err) {
        console.error("Auth setup error:", err);
        setError(`Failed to initialize: ${err instanceof Error ? err.message : "Unknown error"}`);
        setAuthReady(true);
      }
    };
    const timeout = setTimeout(() => {
      if (!authReady) {
        console.warn("Auth initialization timeout");
        setError("Authentication is taking longer than expected. You can try to continue.");
        setAuthReady(true);
      }
    }, 5e3);
    ensureAuth().finally(() => {
      clearTimeout(timeout);
    });
  }, [authReady]);
  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const response = await api.games.suggest(suggestAttempt);
      setSeedWord(response.suggestion);
      setSuggestAttempt((a) => a + 1);
    } catch (err) {
      console.error("Suggest failed:", err);
    } finally {
      setIsSuggesting(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!seedWord.trim() || !authReady) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.games.create({
        seed_word: seedWord.trim(),
        recipient_type: "llm"
        // Default to LLM for now
      });
      if (response.is_polysemous && response.sense_options) {
        dispatch({
          type: "SEED_SUBMITTED",
          seedWord: seedWord.trim(),
          isPolysemous: true,
          senseOptions: response.sense_options
        });
      } else {
        dispatch({
          type: "SEED_SUBMITTED",
          seedWord: seedWord.trim(),
          isPolysemous: false,
          gameId: response.game_id,
          noiseFloor: response.noise_floor
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 1 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.1" }),
      " · Step 1 of 3"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Choose your word." }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "Pick any word as your target. This is the concept you will communicate through associations." }),
    /* @__PURE__ */ jsxs("div", { className: "input-group", children: [
      /* @__PURE__ */ jsx("label", { className: "input-label", children: "Target Word" }),
      !authReady ? /* @__PURE__ */ jsx("div", { style: { textAlign: "center", padding: "2rem", color: "var(--faded)" }, children: "Initializing..." }) : /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            className: "text-input",
            value: seedWord,
            onChange: (e) => setSeedWord(e.target.value),
            placeholder: "coffee",
            autoComplete: "off",
            spellCheck: "false",
            autoFocus: true,
            disabled: isSubmitting
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: handleSuggest,
            disabled: isSuggesting || isSubmitting,
            style: {
              marginTop: "var(--space-xs)",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--faded)",
              padding: "0.5rem 1rem",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              borderRadius: "4px"
            },
            children: isSuggesting ? "..." : "Suggest"
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "input-hint", children: "Any word works: common words, technical terms, proper nouns, slang." }),
        error && /* @__PURE__ */ jsxs("div", { style: { color: "var(--alert)", marginTop: "1rem", fontSize: "var(--text-sm)" }, children: [
          "◈ ",
          error
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "btn-group", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "ghost",
              onClick: () => dispatch({ type: "RESET" }),
              type: "button",
              children: "← Back"
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              type: "submit",
              variant: "primary",
              disabled: !seedWord.trim() || isSubmitting || !authReady,
              children: isSubmitting ? "Creating..." : "Continue →"
            }
          )
        ] })
      ] })
    ] })
  ] });
};

const SenseDisambiguationScreen = ({
  seedWord,
  senseOptions
}) => {
  const { dispatch } = useGameState();
  const [selectedSense, setSelectedSense] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!selectedSense) return;
    setIsSubmitting(true);
    try {
      const response = await api.games.create({
        seed_word: seedWord,
        seed_word_sense: selectedSense,
        recipient_type: "llm"
      });
      dispatch({
        type: "SENSE_SELECTED",
        gameId: response.game_id,
        noiseFloor: response.noise_floor,
        seedWord
      });
    } catch (err) {
      console.error("Failed to create game with sense:", err);
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 1 }),
    /* @__PURE__ */ jsxs(Panel, { title: "Clarify Meaning", children: [
      /* @__PURE__ */ jsxs("p", { style: { marginBottom: "1.5rem", color: "var(--faded)" }, children: [
        "The word ",
        /* @__PURE__ */ jsxs("strong", { style: { color: "var(--gold)" }, children: [
          '"',
          seedWord,
          '"'
        ] }),
        " has multiple meanings. Which one do you mean?"
      ] }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }, children: senseOptions.map((sense, idx) => /* @__PURE__ */ jsxs(
        "label",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem",
            border: "1px solid var(--faded-light)",
            cursor: "pointer",
            transition: "all 0.2s",
            backgroundColor: selectedSense === sense ? "var(--gold-dim)" : "transparent"
          },
          onClick: () => setSelectedSense(sense),
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "radio",
                name: "sense",
                value: sense,
                checked: selectedSense === sense,
                onChange: () => setSelectedSense(sense),
                style: { cursor: "pointer" }
              }
            ),
            /* @__PURE__ */ jsx("span", { style: { color: "var(--text-light)" }, children: sense })
          ]
        },
        idx
      )) }),
      /* @__PURE__ */ jsx("div", { className: "btn-group", children: /* @__PURE__ */ jsx(
        Button,
        {
          variant: "primary",
          onClick: handleSubmit,
          disabled: !selectedSense || isSubmitting,
          children: isSubmitting ? "Creating..." : "Continue"
        }
      ) })
    ] })
  ] });
};

const NoiseFloor = ({ words }) => {
  const validWords = Array.isArray(words) ? words.filter((w) => w && w.word) : [];
  return /* @__PURE__ */ jsx("div", { className: "noise-floor", children: /* @__PURE__ */ jsx("div", { className: "noise-words", children: validWords.map((item, idx) => {
    const similarity = item.similarity || 0;
    const similarityPercent = Math.min(Math.max(similarity * 100, 0), 100);
    return /* @__PURE__ */ jsx(
      "span",
      {
        className: "noise-word",
        "data-similarity": similarity.toFixed(2),
        style: { "--similarity-width": `${similarityPercent}%` },
        title: `Similarity: ${similarity.toFixed(2)}`,
        children: item.word
      },
      `${item.word}-${idx}`
    );
  }) }) });
};

function getWordStem(word) {
  word = word.toLowerCase();
  const suffixes = [
    "ically",
    "ation",
    "ness",
    "ment",
    "able",
    "ible",
    "tion",
    "sion",
    "ally",
    "ful",
    "less",
    "ing",
    "ity",
    "ous",
    "ive",
    "est",
    "ier",
    "ies",
    "ied",
    "ly",
    "ed",
    "er",
    "en",
    "es",
    "s"
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}
function isMorphologicalVariant(word1, word2) {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  if (w1 === w2) return true;
  if (w1.startsWith(w2) || w2.startsWith(w1)) {
    if (Math.abs(w1.length - w2.length) <= 4) {
      return true;
    }
  }
  if (getWordStem(w1) === getWordStem(w2)) return true;
  return false;
}
const CluesScreen = ({
  gameId,
  noiseFloor,
  seedWord
}) => {
  const { dispatch } = useGameState();
  const [concepts, setConcepts] = useState(["", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const updateConcept = (index, value) => {
    const newConcepts = [...concepts];
    newConcepts[index] = value;
    setConcepts(newConcepts);
    setError(null);
  };
  const validations = useMemo(() => {
    const seedLower = seedWord.toLowerCase();
    const filledSoFar = [];
    return concepts.map((concept) => {
      const trimmed = concept.trim().toLowerCase();
      if (!trimmed) {
        return { status: "empty" };
      }
      if (isMorphologicalVariant(trimmed, seedLower)) {
        return {
          status: "invalid",
          error: `Too similar to target "${seedWord}"`
        };
      }
      for (const prev of filledSoFar) {
        if (isMorphologicalVariant(trimmed, prev)) {
          return {
            status: "invalid",
            error: `Duplicate of "${prev}"`
          };
        }
      }
      const isInNoiseFloor = noiseFloor.some(
        (item) => item.word.toLowerCase() === trimmed
      );
      filledSoFar.push(trimmed);
      if (isInNoiseFloor) {
        return { status: "warning" };
      }
      return { status: "valid" };
    });
  }, [concepts, seedWord, noiseFloor]);
  const validFilledCount = validations.filter(
    (v) => v.status === "valid" || v.status === "warning"
  ).length;
  const hasInvalidConcepts = validations.some((v) => v.status === "invalid");
  const canSubmit = validFilledCount > 0 && !hasInvalidConcepts && !isSubmitting;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const validConcepts = concepts.filter((_, i) => validations[i].status === "valid" || validations[i].status === "warning").map((c) => c.trim());
      await api.games.submitClues(gameId, {
        clues: validConcepts
      });
      const game = await api.games.get(gameId);
      dispatch({
        type: "GAME_COMPLETED",
        game
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit concepts");
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 2 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "subtitle-id", children: "INS-001.1" }),
      " · Step 2 of 3"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Provide your concepts." }),
    /* @__PURE__ */ jsxs("p", { className: "description", children: [
      "Enter single-word concepts that will help someone guess your target word:",
      " ",
      /* @__PURE__ */ jsx("span", { className: "target-word", children: seedWord })
    ] }),
    /* @__PURE__ */ jsxs(Panel, { title: "Semantic Neighborhood", meta: "Top 10 predictable associations", children: [
      /* @__PURE__ */ jsx(NoiseFloor, { words: noiseFloor }),
      /* @__PURE__ */ jsx("p", { className: "hint-text", children: "These are the most predictable associations. Your divergence score measures how far your concepts venture from this neighborhood." })
    ] }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsx(Panel, { title: "Your Concepts", meta: `${validFilledCount}/5 concepts`, children: /* @__PURE__ */ jsxs("div", { className: "clue-inputs", children: [
        concepts.map((concept, index) => {
          const validation = validations[index];
          const isValid = validation.status === "valid";
          const isInvalid = validation.status === "invalid";
          const isWarning = validation.status === "warning";
          const isEmpty = validation.status === "empty";
          return /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                marginBottom: "var(--space-sm)"
              },
              children: [
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--faded)",
                      width: "20px"
                    },
                    children: index + 1
                  }
                ),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    className: "text-input",
                    value: concept,
                    onChange: (e) => updateConcept(index, e.target.value),
                    placeholder: index === 0 ? "first concept" : "",
                    autoComplete: "off",
                    spellCheck: "false",
                    autoFocus: index === 0,
                    disabled: isSubmitting,
                    style: {
                      flex: 1,
                      marginBottom: 0,
                      borderColor: isInvalid ? "var(--alert)" : isWarning ? "var(--gold)" : isValid ? "var(--active)" : void 0
                    }
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "span",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.65rem",
                      minWidth: "60px",
                      textAlign: "right",
                      color: isInvalid ? "var(--alert)" : isWarning ? "var(--gold)" : isValid ? "var(--active)" : "var(--faded)"
                    },
                    children: [
                      isInvalid && "✗",
                      isWarning && "⚠",
                      isValid && "✓",
                      isEmpty && index > 0 && "(optional)"
                    ]
                  }
                )
              ]
            },
            index
          );
        }),
        validations.map(
          (v, i) => v.status === "invalid" && v.error ? /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                color: "var(--alert)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                marginTop: "var(--space-xs)"
              },
              children: [
                "Concept ",
                i + 1,
                ": ",
                v.error
              ]
            },
            `error-${i}`
          ) : null
        ),
        /* @__PURE__ */ jsx("p", { className: "input-hint", style: { marginTop: "var(--space-sm)" }, children: "At least 1 concept required. More concepts provide more signal." })
      ] }) }),
      error && /* @__PURE__ */ jsxs("div", { className: "error-message", children: [
        "◈ ",
        error
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "btn-group", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "ghost",
            onClick: () => dispatch({ type: "BACK" }),
            type: "button",
            children: "← Back"
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            type: "submit",
            variant: "primary",
            disabled: !canSubmit,
            children: isSubmitting ? "Submitting..." : "Submit"
          }
        )
      ] })
    ] })
  ] });
};

const ShareOption = ({ icon, title, description, onClick }) => {
  return /* @__PURE__ */ jsxs("div", { className: "share-option", onClick, children: [
    /* @__PURE__ */ jsx("div", { className: "share-option-icon", children: icon }),
    /* @__PURE__ */ jsx("div", { className: "share-option-title", children: title }),
    /* @__PURE__ */ jsx("div", { className: "share-option-desc", children: description })
  ] });
};
const ShareOptions = ({
  onClaudeClick,
  onFriendClick
}) => {
  return /* @__PURE__ */ jsxs("div", { className: "share-options", children: [
    /* @__PURE__ */ jsx(
      ShareOption,
      {
        icon: "🤖",
        title: "Claude (AI)",
        description: "Instant results. Measure how well an LLM decodes your associations.",
        onClick: onClaudeClick
      }
    ),
    /* @__PURE__ */ jsx(
      ShareOption,
      {
        icon: "🔗",
        title: "Send to a Friend",
        description: "Generate a link. Measure network convergence with someone you know.",
        onClick: onFriendClick
      }
    )
  ] });
};

const ShareScreen = ({
  gameId,
  divergence
}) => {
  const { dispatch } = useGameState();
  const [shareToken, setShareToken] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showShareLink, setShowShareLink] = useState(false);
  const handleCreateShareLink = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.share.createToken(gameId);
      setShareToken(response.token);
      setShareUrl(response.share_url);
      setShowShareLink(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setIsLoading(false);
    }
  };
  const handleClaudeClick = async () => {
    try {
      const game = await api.games.get(gameId);
      dispatch({ type: "GAME_COMPLETED", game });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    }
  };
  const handleFriendClick = () => {
    if (!shareUrl) {
      handleCreateShareLink();
    } else {
      setShowShareLink(true);
    }
  };
  const divergenceInterpretation = divergence < 0.3 ? "Conventional" : divergence < 0.6 ? "Moderate" : "High Divergence";
  const divergenceDescription = divergence < 0.3 ? "Your clues align closely with predictable associations." : divergence < 0.6 ? "Your clues show moderate deviation from predictable associations." : "Your clues venture significantly from predictable associations.";
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 3 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.1" }),
      " · Step 3 of 3"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Who will guess?" }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "Your divergence score is ready. Now choose who will attempt to decode your associations." }),
    /* @__PURE__ */ jsxs(Panel, { className: "", style: { borderColor: "var(--gold)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "panel-header", children: [
        /* @__PURE__ */ jsx("span", { className: "panel-title", children: "Your Divergence Score" }),
        /* @__PURE__ */ jsx("span", { className: "panel-meta", children: "Calculated" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "panel-content", style: { display: "flex", alignItems: "center", gap: "var(--space-lg)" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontFamily: "var(--font-serif)", fontSize: "3rem", fontWeight: "300", color: "var(--gold)" }, children: divergence.toFixed(2) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-light)" }, children: divergenceInterpretation }),
          /* @__PURE__ */ jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--faded)" }, children: divergenceDescription })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      ShareOptions,
      {
        onClaudeClick: handleClaudeClick,
        onFriendClick: handleFriendClick
      }
    ),
    showShareLink && shareUrl && /* @__PURE__ */ jsxs("div", { style: { marginTop: "var(--space-lg)", borderTop: "1px solid var(--faded-light)", paddingTop: "var(--space-md)" }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--space-xs)" }, children: [
        /* @__PURE__ */ jsx("p", { className: "mono-label", style: { margin: 0 }, children: "Share Link" }),
        /* @__PURE__ */ jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--active)" }, children: "● Link Active (expires 7d)" })
      ] }),
      /* @__PURE__ */ jsx(ShareLinkBox, { url: shareUrl }),
      /* @__PURE__ */ jsx("div", { style: { marginTop: "var(--space-md)", background: "var(--faded-ultra)", padding: "var(--space-sm)", border: "1px solid var(--faded-light)" }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-light)", flex: 1, minWidth: "180px" }, children: [
          /* @__PURE__ */ jsx("strong", { style: { color: "var(--gold)" }, children: "Don't miss the results." }),
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("span", { style: { color: "var(--faded)" }, children: "Create an account to be notified when your friend guesses." })
        ] }),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "secondary",
            style: { fontSize: "0.65rem", padding: "6px 12px", whiteSpace: "nowrap" },
            onClick: () => {
            },
            children: "Notify Me"
          }
        )
      ] }) }),
      /* @__PURE__ */ jsx("div", { style: { marginTop: "var(--space-md)", textAlign: "right" }, children: /* @__PURE__ */ jsx(
        Button,
        {
          variant: "ghost",
          onClick: async () => {
            try {
              const game = await api.games.get(gameId);
              dispatch({ type: "GAME_COMPLETED", game });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to load results");
            }
          },
          children: "View Session Dashboard →"
        }
      ) })
    ] }),
    error && /* @__PURE__ */ jsxs("div", { style: { color: "var(--alert)", marginTop: "1rem", fontSize: "var(--text-sm)" }, children: [
      "◈ ",
      error
    ] }),
    /* @__PURE__ */ jsx("div", { className: "btn-group", children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "ghost",
        onClick: () => dispatch({ type: "BACK" }),
        children: "← Back"
      }
    ) })
  ] });
};

function HumanShareRow({
  shareUrl,
  isCreatingShare,
  shareError,
  onCreateShare
}) {
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: "var(--space-lg)" }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          color: "var(--faded)",
          marginBottom: "var(--space-xs)",
          letterSpacing: "0.02em",
          fontStyle: "italic",
          textAlign: "center",
          marginLeft: "92px"
        },
        children: "compare your concepts"
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "var(--space-sm)" }, children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            width: "80px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "var(--text-light)"
          },
          children: "Human"
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            flex: 1,
            height: "32px",
            position: "relative",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "absolute",
                  left: "10%",
                  right: "10%",
                  top: "50%",
                  height: "1px",
                  borderTop: "1px dashed var(--faded-light)",
                  transform: "translateY(-50%)"
                }
              }
            ),
            !shareUrl && /* @__PURE__ */ jsx("div", { style: { position: "relative", zIndex: 1 }, children: /* @__PURE__ */ jsx(
              Button,
              {
                variant: "secondary",
                onClick: onCreateShare,
                disabled: isCreatingShare,
                style: {
                  fontSize: "0.65rem",
                  padding: "4px 12px"
                },
                children: isCreatingShare ? "Creating..." : "Create Share Link"
              }
            ) })
          ]
        }
      )
    ] }),
    shareUrl && /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          marginTop: "var(--space-sm)",
          marginLeft: "92px"
        },
        children: /* @__PURE__ */ jsx(ShareLinkBox, { url: shareUrl })
      }
    ),
    shareError && /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          color: "var(--alert)",
          marginTop: "var(--space-xs)",
          marginLeft: "92px"
        },
        children: shareError
      }
    )
  ] });
}
function DotPlotRow({ label, concepts, relevance, spread, isYou }) {
  const scale = (val) => Math.min(100, Math.max(0, val));
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: "var(--space-lg)" }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          color: isYou ? "var(--gold)" : "var(--text-light)",
          marginBottom: "var(--space-xs)",
          letterSpacing: "0.02em",
          textAlign: "center",
          marginLeft: "92px"
        },
        children: concepts.join(" · ")
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "var(--space-sm)" }, children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            width: "80px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: isYou ? "var(--gold)" : "var(--text-light)"
          },
          children: label
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            flex: 1,
            height: "32px",
            position: "relative",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: "2px",
            marginBottom: "16px"
          },
          children: [
            [25, 50, 75].map((v) => /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "absolute",
                  left: `${v}%`,
                  top: 0,
                  bottom: 0,
                  width: "1px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)"
                }
              },
              v
            )),
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "absolute",
                  left: `${Math.min(scale(relevance), scale(spread))}%`,
                  width: `${Math.abs(scale(spread) - scale(relevance))}%`,
                  top: "50%",
                  height: "2px",
                  backgroundColor: "var(--gold)",
                  opacity: 0.4,
                  transform: "translateY(-50%)"
                }
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "absolute",
                  left: `${scale(relevance)}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "var(--gold)"
                }
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "absolute",
                  left: `${scale(spread)}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  border: "2px solid var(--gold)",
                  backgroundColor: "var(--bg)",
                  boxSizing: "border-box"
                }
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  position: "absolute",
                  left: `${scale(relevance)}%`,
                  bottom: "-16px",
                  transform: "translateX(-50%)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  color: "var(--gold)"
                },
                children: Math.round(relevance)
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  position: "absolute",
                  left: `${scale(spread)}%`,
                  bottom: "-16px",
                  transform: "translateX(-50%)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  color: "var(--faded)"
                },
                children: Math.round(spread)
              }
            )
          ]
        }
      )
    ] })
  ] });
}
const ResultsScreen = () => {
  const { state, dispatch } = useGameState();
  const { user, loading: authLoading } = useAuth();
  const game = state.screen === "results" ? state.game : null;
  const [showInitModal, setShowInitModal] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState(null);
  const isRegistered = user?.email && !user?.is_anonymous;
  if (!game) return null;
  const handleCreateShareLink = async () => {
    if (!game.game_id) return;
    setIsCreatingShare(true);
    setShareError(null);
    try {
      const response = await api.share.createToken(game.game_id);
      const url = `${window.location.origin}/ins-001-1/join/${response.token}`;
      setShareUrl(url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setIsCreatingShare(false);
    }
  };
  const spreadDisplay = game.spread ?? (game.divergence_score ?? 0) * 100;
  const relevanceDisplay = game.relevance !== void 0 ? game.relevance * 100 : (game.convergence_score ?? 0) * 100;
  const hasHaikuData = game.recipient_type === "llm" && game.guesses && game.guesses.length > 0;
  const haikuRelevance = game.guess_similarities ? game.guess_similarities.reduce((a, b) => a + b, 0) / game.guess_similarities.length * 100 : 0;
  const haikuSpread = game.guess_similarities && game.guess_similarities.length > 1 ? Math.min(100, Math.max(
    0,
    (1 - Math.max(...game.guess_similarities) + Math.min(...game.guess_similarities)) * 100
  )) : 50;
  const spreadInterpretation = spreadDisplay < 30 ? "Low" : spreadDisplay < 60 ? "Moderate" : "High";
  const relevanceInterpretation = relevanceDisplay < 40 ? "Weak" : relevanceDisplay < 70 ? "Moderate" : "Strong";
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.1" }),
      " · Complete"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Results." }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "Your semantic association profile for this session." }),
    /* @__PURE__ */ jsxs(Panel, { children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--gold)",
            textAlign: "center",
            marginBottom: "var(--space-lg)"
          },
          children: [
            "Target: ",
            game.seed_word
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            gap: "var(--space-md)",
            marginBottom: "var(--space-md)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "var(--faded)"
          },
          children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--gold)"
                  }
                }
              ),
              /* @__PURE__ */ jsx("span", { children: "Relevance" })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    border: "2px solid var(--gold)",
                    backgroundColor: "transparent",
                    boxSizing: "border-box"
                  }
                }
              ),
              /* @__PURE__ */ jsx("span", { children: "Spread" })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            color: "var(--faded)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "var(--space-xs)",
            marginTop: "var(--space-md)"
          },
          children: "Your Clues"
        }
      ),
      /* @__PURE__ */ jsxs("div", { style: { marginLeft: "92px", marginRight: "12px", marginBottom: "var(--space-sm)" }, children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--faded)",
              marginBottom: "2px"
            },
            children: [0, 25, 50, 75, 100].map((v) => /* @__PURE__ */ jsx("span", { children: v }, v))
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              height: "1px",
              backgroundColor: "var(--border)",
              position: "relative"
            },
            children: [0, 25, 50, 75, 100].map((v) => /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "absolute",
                  left: `${v}%`,
                  top: "-2px",
                  width: "1px",
                  height: "5px",
                  backgroundColor: "var(--border)"
                }
              },
              v
            ))
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { marginTop: "var(--space-md)" }, children: [
        /* @__PURE__ */ jsx(
          DotPlotRow,
          {
            label: "You",
            concepts: game.clues || [],
            relevance: relevanceDisplay,
            spread: spreadDisplay,
            isYou: true
          }
        ),
        (hasHaikuData || game.noise_floor && game.noise_floor.length > 0) && /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              color: "var(--faded)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "var(--space-xs)",
              marginTop: "var(--space-lg)",
              paddingTop: "var(--space-md)",
              borderTop: "1px solid var(--border)"
            },
            children: "Guesses (from your clues)"
          }
        ),
        hasHaikuData && /* @__PURE__ */ jsx(
          DotPlotRow,
          {
            label: "Haiku",
            concepts: game.guesses || [],
            relevance: haikuRelevance,
            spread: haikuSpread
          }
        ),
        game.noise_floor && game.noise_floor.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                color: "var(--faded)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "var(--space-xs)",
                marginTop: "var(--space-lg)",
                paddingTop: "var(--space-md)",
                borderTop: "1px solid var(--border)"
              },
              children: "Noise Floor (predictable associations)"
            }
          ),
          /* @__PURE__ */ jsx(
            DotPlotRow,
            {
              label: "Statistical",
              concepts: game.noise_floor.map((w) => w.word),
              relevance: game.noise_floor.reduce((sum, w) => sum + w.similarity * 100, 0) / game.noise_floor.length,
              spread: 50
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          HumanShareRow,
          {
            shareUrl,
            isCreatingShare,
            shareError,
            onCreateShare: handleCreateShareLink
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      Panel,
      {
        className: "",
        style: { background: "transparent", borderColor: "var(--faded-light)" },
        children: [
          /* @__PURE__ */ jsx("div", { className: "panel-header", children: /* @__PURE__ */ jsx("span", { className: "panel-title", children: "Interpretation" }) }),
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: "panel-content",
              style: {
                fontFamily: "var(--font-body)",
                fontSize: "0.9rem",
                color: "var(--faded)",
                lineHeight: "1.7"
              },
              children: [
                /* @__PURE__ */ jsxs("p", { style: { marginBottom: "var(--space-sm)" }, children: [
                  "Your clues show ",
                  spreadInterpretation.toLowerCase(),
                  " spread (",
                  Math.round(spreadDisplay),
                  ") with ",
                  relevanceInterpretation.toLowerCase(),
                  " relevance (",
                  Math.round(relevanceDisplay),
                  ") to the target concept.",
                  spreadDisplay > 60 && relevanceDisplay > 50 && " This indicates creative but valid associations.",
                  spreadDisplay < 40 && relevanceDisplay > 50 && " This indicates conventional, predictable associations.",
                  relevanceDisplay < 40 && " The associations may be too distant from the target concept."
                ] }),
                hasHaikuData && /* @__PURE__ */ jsxs("p", { style: { marginBottom: 0, fontSize: "0.8rem" }, children: [
                  'Haiku guessed "',
                  game.guesses?.join(", "),
                  '" from your clues —',
                  haikuRelevance > 70 ? " accurately inferring the target." : haikuRelevance > 40 ? " getting close to the target." : " struggling to identify the target."
                ] })
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      Panel,
      {
        className: "",
        style: {
          borderColor: isRegistered ? "var(--active)" : "var(--gold)",
          background: isRegistered ? "linear-gradient(to bottom, var(--card-bg), rgba(85, 176, 120, 0.05))" : "linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))"
        },
        children: [
          /* @__PURE__ */ jsxs("div", { className: "panel-header", style: { borderBottomColor: isRegistered ? "var(--active)" : "var(--gold-dim)" }, children: [
            /* @__PURE__ */ jsx("span", { className: "panel-title", style: { color: isRegistered ? "var(--active)" : "var(--gold)" }, children: isRegistered ? "Registered Record" : "Unregistered Record" }),
            /* @__PURE__ */ jsxs("span", { className: "panel-meta", children: [
              "Session ID: #",
              game.game_id?.slice(0, 4).toUpperCase() || "----"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "panel-content", children: isRegistered ? /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                display: "flex",
                gap: "var(--space-md)",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap"
              },
              children: /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: "200px" }, children: [
                /* @__PURE__ */ jsxs(
                  "p",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--text-light)",
                      marginBottom: "var(--space-xs)"
                    },
                    children: [
                      "Linked to ",
                      user?.email
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "p",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.65rem",
                      color: "var(--faded)",
                      margin: 0
                    },
                    children: "This session is saved to your cognitive profile."
                  }
                )
              ] })
            }
          ) : /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                display: "flex",
                gap: "var(--space-md)",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap"
              },
              children: [
                /* @__PURE__ */ jsx("div", { style: { flex: 1, minWidth: "200px" }, children: /* @__PURE__ */ jsx(
                  "p",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--text-light)",
                      marginBottom: "var(--space-xs)"
                    },
                    children: "Save your scores to your permanent cognitive profile."
                  }
                ) }),
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    variant: "primary",
                    style: { fontSize: "0.65rem", padding: "10px 20px" },
                    onClick: () => setShowInitModal(true),
                    children: "Initialize ID"
                  }
                )
              ]
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "btn-group", children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "secondary",
        onClick: () => {
          dispatch({ type: "RESET" });
          window.location.reload();
        },
        children: "Play Again"
      }
    ) }),
    /* @__PURE__ */ jsxs("footer", { className: "footer", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("a", { href: "/methods", style: { color: "var(--faded)", textDecoration: "none" }, children: "Methodology" }),
        " ",
        "·",
        " ",
        /* @__PURE__ */ jsx("a", { href: "/about", style: { color: "var(--faded)", textDecoration: "none" }, children: "About Phronos" }),
        " ",
        "·",
        " ",
        /* @__PURE__ */ jsx("a", { href: "/constitution", style: { color: "var(--faded)", textDecoration: "none" }, children: "Constitution" })
      ] }),
      /* @__PURE__ */ jsx("div", { children: "© 2026 Phronos Observatory" })
    ] }),
    /* @__PURE__ */ jsx(MagicLinkModal, { isOpen: showInitModal, onClose: () => setShowInitModal(false) })
  ] });
};

function GameRouter() {
  const { state } = useGameState();
  switch (state.screen) {
    case "intro":
      return /* @__PURE__ */ jsx(IntroScreen, {});
    case "seed":
      return /* @__PURE__ */ jsx(SeedScreen, {});
    case "sense":
      return /* @__PURE__ */ jsx(SenseDisambiguationScreen, { seedWord: state.seedWord, senseOptions: state.senseOptions });
    case "clues":
      return /* @__PURE__ */ jsx(CluesScreen, { gameId: state.gameId, noiseFloor: state.noiseFloor, seedWord: state.seedWord });
    case "share":
      return /* @__PURE__ */ jsx(ShareScreen, { gameId: state.gameId, divergence: state.divergence });
    case "results":
      return /* @__PURE__ */ jsx(ResultsScreen, { game: state.game });
    default:
      return /* @__PURE__ */ jsx(IntroScreen, {});
  }
}
function Game() {
  return /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsxs(GameProvider, { children: [
    /* @__PURE__ */ jsx(Navigation, { instrumentId: "INS-001.1", instrumentTitle: "SIGNAL" }),
    /* @__PURE__ */ jsx(GameRouter, {})
  ] }) });
}

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "InstrumentLayout", $$InstrumentLayout, { "id": "INS-001.1", "title": "SIGNAL", "version": "0.1", "status": "live", "description": "Describe a concept divergently\u2014can it still be reconstructed? Signal measures the tension between creative divergence and communicability in your semantic encoding.", "keywords": "signal, semantic encoding, divergent thinking, communicability, cognitive assessment, Phronos instruments, creativity measurement", "canonicalPath": "/ins-001/ins-001-1/" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Game", Game, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/Game", "client:component-export": "default" })} ` })}`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-1/index.astro", void 0);

const $$file = "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-1/index.astro";
const $$url = "/ins-001/ins-001-1";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
