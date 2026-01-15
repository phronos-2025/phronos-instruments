import { e as createComponent, n as renderComponent, r as renderTemplate } from '../../chunks/astro/server_CE_9OsnW.mjs';
import 'piccolore';
import { a as api, $ as $$InstrumentLayout } from '../../chunks/api_BU-QsgYZ.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { a as useBridgingSenderState, b as BridgingSenderProvider } from '../../chunks/bridging-state_-XJ2qkac.mjs';
import { A as AuthProvider } from '../../chunks/AuthProvider_DqxnARqy.mjs';
import { N as Navigation } from '../../chunks/Navigation_CCvfDsjT.mjs';
import { P as Panel, B as Button, s as supabase } from '../../chunks/Button_DFORBRMv.mjs';
import { P as ProgressBar, S as ShareLinkBox } from '../../chunks/ShareLinkBox_DYxLMesC.mjs';
import { M as MagicLinkModal } from '../../chunks/MagicLinkModal_CKjFIbjs.mjs';
export { renderers } from '../../renderers.mjs';

const BridgingIntroScreen = () => {
  const { dispatch } = useBridgingSenderState();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const handleBegin = () => {
    if (consentAccepted) {
      dispatch({ type: "BEGIN" });
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 1 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
      " · Common Ground"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Find common ground." }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "This instrument measures how you locate semantic intersection between two different conceptual domains. Choose two words and find concepts that belong to both." }),
    /* @__PURE__ */ jsx(Panel, { title: "How It Works", meta: "~5 minutes", children: /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-md)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem"
        },
        children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  color: "var(--gold)",
                  fontSize: "1.5rem",
                  marginBottom: "var(--space-xs)"
                },
                children: "01"
              }
            ),
            /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)", marginBottom: "4px" }, children: "Choose two words" }),
            /* @__PURE__ */ jsx("div", { style: { color: "var(--faded)", fontSize: "0.65rem" }, children: "Anchor and target." })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  color: "var(--gold)",
                  fontSize: "1.5rem",
                  marginBottom: "var(--space-xs)"
                },
                children: "02"
              }
            ),
            /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)", marginBottom: "4px" }, children: "Find common ground" }),
            /* @__PURE__ */ jsx("div", { style: { color: "var(--faded)", fontSize: "0.65rem" }, children: "1-5 clues that belong to both." })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  color: "var(--gold)",
                  fontSize: "1.5rem",
                  marginBottom: "var(--space-xs)"
                },
                children: "03"
              }
            ),
            /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)", marginBottom: "4px" }, children: "See what emerges" }),
            /* @__PURE__ */ jsx("div", { style: { color: "var(--faded)", fontSize: "0.65rem" }, children: "Divergence. Relevance." })
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(
      Panel,
      {
        className: "",
        style: { background: "transparent", borderColor: "var(--gold-dim)" },
        children: /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              color: "var(--faded)"
            },
            children: [
              /* @__PURE__ */ jsx("strong", { style: { color: "var(--text-light)" }, children: "What this measures:" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("strong", { children: "Divergence" }),
              " — How far your clues arc from the direct path between anchor and target. High divergence indicates unexpected routes.",
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("strong", { children: "Relevance" }),
              " — How connected your clues are to both anchor and target. High relevance indicates clues in the shared semantic neighborhood."
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          marginBottom: "var(--space-md)",
          textAlign: "left",
          maxWidth: "500px"
        },
        children: /* @__PURE__ */ jsxs(
          "label",
          {
            style: {
              display: "flex",
              gap: "var(--space-sm)",
              alignItems: "flex-start",
              cursor: "pointer"
            },
            children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: consentAccepted,
                  onChange: (e) => setConsentAccepted(e.target.checked),
                  style: {
                    marginTop: "4px",
                    accentColor: "var(--gold)",
                    width: "16px",
                    height: "16px",
                    cursor: "pointer"
                  }
                }
              ),
              /* @__PURE__ */ jsxs(
                "span",
                {
                  style: {
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.7rem",
                    color: "var(--faded)",
                    lineHeight: "1.5"
                  },
                  children: [
                    "I agree to the",
                    " ",
                    /* @__PURE__ */ jsx(
                      "a",
                      {
                        href: "https://phronos.org/terms",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        style: {
                          color: "var(--gold)",
                          textDecoration: "none",
                          borderBottom: "1px dotted"
                        },
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
                        style: {
                          color: "var(--gold)",
                          textDecoration: "none",
                          borderBottom: "1px dotted"
                        },
                        children: "Privacy Policy"
                      }
                    ),
                    ", and consent to the processing of my responses as described therein."
                  ]
                }
              )
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "btn-group", style: { marginTop: 0 }, children: /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: handleBegin, disabled: !consentAccepted, children: "Begin Assessment" }) }),
    /* @__PURE__ */ jsx(
      "p",
      {
        style: {
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
          color: "var(--faded)",
          marginTop: "var(--space-lg)"
        },
        children: "There are no correct answers—only your connections."
      }
    )
  ] });
};

const AnchorTargetScreen = ({
  anchor: initialAnchor,
  target: initialTarget
}) => {
  const { dispatch } = useBridgingSenderState();
  const [anchor, setAnchor] = useState(initialAnchor || "");
  const [target, setTarget] = useState(initialTarget || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggestingAnchor, setIsSuggestingAnchor] = useState(false);
  const [isSuggestingTarget, setIsSuggestingTarget] = useState(false);
  const [anchorSuggestAttempt, setAnchorSuggestAttempt] = useState(1);
  const [targetSuggestAttempt, setTargetSuggestAttempt] = useState(1);
  const [error, setError] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [distance, setDistance] = useState(null);
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);
  useEffect(() => {
    const ensureAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Session error:", sessionError);
          setAuthReady(true);
          return;
        }
        if (!session) {
          const { error: authError } = await supabase.auth.signInAnonymously();
          if (authError) {
            console.error("Auth error:", authError);
            setError(`Authentication failed: ${authError.message}`);
            setAuthReady(true);
            return;
          }
        }
        setAuthReady(true);
      } catch (err) {
        console.error("Auth setup error:", err);
        setAuthReady(true);
      }
    };
    ensureAuth();
  }, []);
  const fetchDistance = useCallback(async (a, t) => {
    if (!a.trim() || !t.trim() || !authReady) {
      setDistance(null);
      return;
    }
    const anchorClean = a.trim().toLowerCase();
    const targetClean = t.trim().toLowerCase();
    if (anchorClean === targetClean) {
      setDistance({
        anchor: anchorClean,
        target: targetClean,
        distance: 0,
        interpretation: "identical"
      });
      return;
    }
    setIsLoadingDistance(true);
    try {
      const result = await api.bridging.getDistance(anchorClean, targetClean);
      setDistance(result);
    } catch (err) {
      console.error("Failed to get distance:", err);
      setDistance(null);
    } finally {
      setIsLoadingDistance(false);
    }
  }, [authReady]);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchDistance(anchor, target);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [anchor, target, fetchDistance]);
  const handleSuggestAnchor = async () => {
    setIsSuggestingAnchor(true);
    try {
      const response = await api.bridging.suggest(target || void 0, anchorSuggestAttempt);
      setAnchor(response.suggestion);
      setAnchorSuggestAttempt((a) => a + 1);
    } catch (err) {
      console.error("Suggest failed:", err);
    } finally {
      setIsSuggestingAnchor(false);
    }
  };
  const handleSuggestTarget = async () => {
    setIsSuggestingTarget(true);
    try {
      const response = await api.bridging.suggest(anchor || void 0, targetSuggestAttempt);
      setTarget(response.suggestion);
      setTargetSuggestAttempt((a) => a + 1);
    } catch (err) {
      console.error("Suggest failed:", err);
    } finally {
      setIsSuggestingTarget(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!anchor.trim() || !target.trim() || !authReady) return;
    const anchorClean = anchor.trim().toLowerCase();
    const targetClean = target.trim().toLowerCase();
    if (anchorClean === targetClean) {
      setError("Anchor and target must be different words");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.bridging.create({
        anchor_word: anchorClean,
        target_word: targetClean,
        recipient_type: "haiku"
        // Default to Haiku for immediate feedback
      });
      dispatch({
        type: "GAME_CREATED",
        gameId: response.game_id,
        anchor: response.anchor_word,
        target: response.target_word
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setIsSubmitting(false);
    }
  };
  const formatDistance = (d) => {
    const labels = {
      identical: "identical",
      close: "close · try more distant concepts",
      "below average": "below average distance",
      average: "average distance",
      "above average": "good distance",
      distant: "very distant"
    };
    return labels[d.interpretation] || d.interpretation;
  };
  const isGoodDistance = (d) => {
    return d.interpretation === "above average" || d.interpretation === "distant";
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 1 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
      " · Step 1 of 3"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Choose your anchor and target." }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "Pick two words to connect. Your concepts will find common ground between them." }),
    !authReady ? /* @__PURE__ */ jsx(
      "div",
      {
        style: { textAlign: "center", padding: "2rem", color: "var(--faded)" },
        children: "Initializing..."
      }
    ) : /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-lg)",
            marginBottom: "var(--space-lg)"
          },
          children: [
            /* @__PURE__ */ jsxs("div", { className: "input-group", style: { marginBottom: 0 }, children: [
              /* @__PURE__ */ jsx("label", { className: "input-label", children: "Anchor" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  className: "text-input",
                  value: anchor,
                  onChange: (e) => setAnchor(e.target.value),
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
                  onClick: handleSuggestAnchor,
                  disabled: isSuggestingAnchor || isSubmitting,
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
                  children: isSuggestingAnchor ? "..." : "Suggest"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "input-group", style: { marginBottom: 0 }, children: [
              /* @__PURE__ */ jsx("label", { className: "input-label", children: "Target" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  className: "text-input",
                  value: target,
                  onChange: (e) => setTarget(e.target.value),
                  placeholder: "sunshine",
                  autoComplete: "off",
                  spellCheck: "false",
                  disabled: isSubmitting
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: handleSuggestTarget,
                  disabled: isSuggestingTarget || isSubmitting,
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
                  children: isSuggestingTarget ? "..." : "Suggest"
                }
              )
            ] })
          ]
        }
      ),
      anchor && target && /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            marginBottom: "var(--space-lg)",
            padding: "var(--space-md)",
            border: "1px solid var(--gold-dim)",
            borderRadius: "4px"
          },
          children: [
            distance && !isLoadingDistance && /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  fontSize: "0.7rem",
                  color: distance.interpretation === "identical" ? "var(--alert)" : isGoodDistance(distance) ? "var(--gold)" : "var(--faded)",
                  marginBottom: "var(--space-xs)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                },
                children: formatDistance(distance)
              }
            ),
            isLoadingDistance && /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  fontSize: "0.7rem",
                  color: "var(--faded)",
                  marginBottom: "var(--space-xs)"
                },
                children: "..."
              }
            ),
            /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  fontSize: "0.9rem",
                  color: "var(--gold)"
                },
                children: [
                  anchor.toLowerCase(),
                  " ←――――――――――――――――→ ",
                  target.toLowerCase()
                ]
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsx("p", { className: "input-hint", children: "Tip: Distant concepts make for more interesting common ground." }),
      error && /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            color: "var(--alert)",
            marginTop: "1rem",
            fontSize: "var(--text-sm)"
          },
          children: [
            "◈ ",
            error
          ]
        }
      ),
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
            disabled: !anchor.trim() || !target.trim() || isSubmitting || !authReady,
            children: isSubmitting ? "Creating..." : "Continue →"
          }
        )
      ] })
    ] })
  ] });
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
const BridgingStepsScreen = ({
  gameId,
  anchor,
  target
}) => {
  const { dispatch } = useBridgingSenderState();
  const [steps, setSteps] = useState(["", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const updateStep = (index, value) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
    setError(null);
  };
  const validations = useMemo(() => {
    const anchorLower = anchor.toLowerCase();
    const targetLower = target.toLowerCase();
    const filledSoFar = [];
    return steps.map((step) => {
      const trimmed = step.trim().toLowerCase();
      if (!trimmed) {
        return { status: "empty" };
      }
      if (isMorphologicalVariant(trimmed, anchorLower)) {
        return {
          status: "invalid",
          error: `Too similar to anchor "${anchor}"`
        };
      }
      if (isMorphologicalVariant(trimmed, targetLower)) {
        return {
          status: "invalid",
          error: `Too similar to target "${target}"`
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
      filledSoFar.push(trimmed);
      return { status: "valid" };
    });
  }, [steps, anchor, target]);
  const validFilledCount = validations.filter((v) => v.status === "valid").length;
  const hasInvalidConcepts = validations.some((v) => v.status === "invalid");
  const canSubmit = validFilledCount > 0 && !hasInvalidConcepts && !isSubmitting;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const validConcepts = steps.filter((_, i) => validations[i].status === "valid").map((c) => c.trim().toLowerCase());
      const response = await api.bridging.submitClues(gameId, {
        clues: validConcepts
      });
      if (response.status === "completed" && (response.haiku_clues || response.haiku_guessed_anchor)) {
        const game = await api.bridging.get(gameId);
        dispatch({
          type: "GAME_COMPLETED",
          game
        });
      } else {
        dispatch({
          type: "STEPS_SUBMITTED",
          gameId,
          steps: response.clues,
          divergence: response.divergence_score,
          shareCode: response.share_code
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit concepts");
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 2 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
      " · Step 2 of 3"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Find your common ground." }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "Enter single-word concepts that belong to both your anchor and target." }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "0.9rem",
          color: "var(--gold)",
          marginBottom: "var(--space-lg)",
          padding: "var(--space-md)",
          border: "1px solid var(--gold-dim)",
          borderRadius: "4px"
        },
        children: [
          anchor,
          " ←――――――――――――――――→ ",
          target
        ]
      }
    ),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsxs("div", { className: "input-group", children: [
        /* @__PURE__ */ jsxs("label", { className: "input-label", children: [
          "Your Concepts",
          " ",
          /* @__PURE__ */ jsxs("span", { style: { color: "var(--faded)", fontWeight: "normal" }, children: [
            validFilledCount,
            "/5 concepts"
          ] })
        ] }),
        steps.map((step, index) => {
          const validation = validations[index];
          const isValid = validation.status === "valid";
          const isInvalid = validation.status === "invalid";
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
                    value: step,
                    onChange: (e) => updateStep(index, e.target.value),
                    placeholder: index === 0 ? "first concept" : "",
                    autoComplete: "off",
                    spellCheck: "false",
                    autoFocus: index === 0,
                    disabled: isSubmitting,
                    style: {
                      flex: 1,
                      marginBottom: 0,
                      borderColor: isInvalid ? "var(--alert)" : isValid ? "var(--active)" : void 0
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
                      color: isInvalid ? "var(--alert)" : isValid ? "var(--active)" : "var(--faded)"
                    },
                    children: [
                      isInvalid && "✗",
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
        /* @__PURE__ */ jsx("p", { className: "input-hint", children: "At least 1 concept required. More concepts provide more signal." })
      ] }),
      error && /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            color: "var(--alert)",
            marginTop: "1rem",
            fontSize: "var(--text-sm)"
          },
          children: [
            "◈ ",
            error
          ]
        }
      ),
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

function getDivergenceInterpretation(score) {
  if (score < 30) {
    return {
      label: "Predictable",
      description: "Your concepts stay close to the direct path between anchor and target."
    };
  } else if (score < 50) {
    return {
      label: "Moderate",
      description: "Your concepts take a moderately creative route."
    };
  } else if (score < 70) {
    return {
      label: "Creative",
      description: "Your concepts arc away from the obvious path."
    };
  } else {
    return {
      label: "Highly Creative",
      description: "Your concepts take a highly unexpected route to connect the ideas."
    };
  }
}
const BridgingShareScreen = ({
  gameId,
  anchor,
  target,
  steps,
  divergence,
  shareCode: initialShareCode
}) => {
  const { dispatch } = useBridgingSenderState();
  const [shareCode, setShareCode] = useState(initialShareCode || "");
  const [shareUrl, setShareUrl] = useState("");
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isGettingHaiku, setIsGettingHaiku] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const interpretation = getDivergenceInterpretation(divergence);
  const handleCreateShare = async () => {
    if (shareCode) {
      handleCopy();
      return;
    }
    setIsCreatingShare(true);
    setError(null);
    try {
      const response = await api.bridging.createShare(gameId);
      setShareCode(response.share_code);
      setShareUrl(response.share_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setIsCreatingShare(false);
    }
  };
  const handleCopy = async () => {
    const url = shareUrl || `${window.location.origin}/ins-001-2/join/${shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };
  const handleLetHaikuBuild = async () => {
    setIsGettingHaiku(true);
    setError(null);
    try {
      await api.bridging.triggerHaikuBridge(gameId);
      const game = await api.bridging.get(gameId);
      dispatch({
        type: "GAME_COMPLETED",
        game
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get Haiku union");
    } finally {
      setIsGettingHaiku(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(ProgressBar, { currentStep: 3 }),
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
      " · Step 3 of 3"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Common ground submitted." }),
    /* @__PURE__ */ jsxs(
      Panel,
      {
        title: "Your Common Ground",
        meta: Math.round(divergence).toString(),
        style: { marginBottom: "var(--space-lg)" },
        children: [
          /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                textAlign: "center",
                marginBottom: "var(--space-md)"
              },
              children: [
                /* @__PURE__ */ jsxs(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.9rem",
                      color: "var(--gold)",
                      marginBottom: "var(--space-sm)"
                    },
                    children: [
                      anchor,
                      " ←――――――――――――――――→ ",
                      target
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8rem",
                      color: "var(--text-light)"
                    },
                    children: steps.join(" · ")
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                marginBottom: "var(--space-md)"
              },
              children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      background: "var(--bg-card)",
                      borderRadius: "4px",
                      height: "8px",
                      overflow: "hidden",
                      marginBottom: "var(--space-xs)"
                    },
                    children: /* @__PURE__ */ jsx(
                      "div",
                      {
                        style: {
                          background: "var(--gold)",
                          height: "100%",
                          width: `${Math.min(100, divergence)}%`,
                          transition: "width 0.3s ease"
                        }
                      }
                    )
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.65rem",
                      color: "var(--faded)"
                    },
                    children: [
                      /* @__PURE__ */ jsx("span", { children: "predictable" }),
                      /* @__PURE__ */ jsx("span", { children: "creative" })
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                color: "var(--text-light)"
              },
              children: [
                /* @__PURE__ */ jsx("strong", { style: { color: "var(--gold)" }, children: interpretation.label }),
                /* @__PURE__ */ jsx("br", {}),
                /* @__PURE__ */ jsx("span", { style: { color: "var(--faded)" }, children: interpretation.description })
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("p", { className: "description", children: "Who should find common ground?" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-md)",
          marginBottom: "var(--space-lg)"
        },
        children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleCreateShare,
              disabled: isCreatingShare,
              style: {
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "var(--space-md)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.2s"
              },
              onMouseEnter: (e) => e.currentTarget.style.borderColor = "var(--gold)",
              onMouseLeave: (e) => e.currentTarget.style.borderColor = "var(--border)",
              children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      fontSize: "1.5rem",
                      marginBottom: "var(--space-xs)"
                    },
                    children: "🔗"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85rem",
                      color: "var(--text-light)",
                      marginBottom: "4px"
                    },
                    children: "Share with someone"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.65rem",
                      color: "var(--faded)"
                    },
                    children: "Send a link to a friend or colleague"
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleLetHaikuBuild,
              disabled: isGettingHaiku,
              style: {
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "var(--space-md)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.2s"
              },
              onMouseEnter: (e) => e.currentTarget.style.borderColor = "var(--gold)",
              onMouseLeave: (e) => e.currentTarget.style.borderColor = "var(--border)",
              children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      fontSize: "1.5rem",
                      marginBottom: "var(--space-xs)"
                    },
                    children: "🤖"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85rem",
                      color: "var(--text-light)",
                      marginBottom: "4px"
                    },
                    children: isGettingHaiku ? "Finding..." : "Let Haiku find"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.65rem",
                      color: "var(--faded)"
                    },
                    children: "See how Claude Haiku finds the same common ground"
                  }
                )
              ]
            }
          )
        ]
      }
    ),
    shareCode && /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "var(--space-md)",
          marginBottom: "var(--space-lg)"
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                color: "var(--faded)",
                marginBottom: "var(--space-xs)"
              },
              children: "Share link"
            }
          ),
          /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                display: "flex",
                gap: "var(--space-sm)",
                alignItems: "center"
              },
              children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    readOnly: true,
                    value: shareUrl || `${window.location.origin}/ins-001-2/join/${shareCode}`,
                    style: {
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8rem",
                      color: "var(--text-light)",
                      outline: "none"
                    }
                  }
                ),
                /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: handleCopy, children: copied ? "Copied!" : "Copy" })
              ]
            }
          )
        ]
      }
    ),
    error && /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          color: "var(--alert)",
          marginBottom: "var(--space-md)",
          fontSize: "var(--text-sm)"
        },
        children: [
          "◈ ",
          error
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "btn-group", children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "ghost",
        onClick: () => dispatch({ type: "RESET" }),
        children: "Build Another →"
      }
    ) })
  ] });
};

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
          // 80px label + 12px gap (--space-sm)
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
                  left: `${scale(relevance)}%`,
                  width: `${Math.max(0, scale(spread) - scale(relevance))}%`,
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
          // 80px label + 12px gap (--space-sm)
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
                  borderTop: "1px dashed var(--border)",
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
          // align with track
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
function HumanDataRow({
  concepts,
  relevance,
  spread
}) {
  return /* @__PURE__ */ jsx(
    DotPlotRow,
    {
      label: "Human",
      concepts,
      relevance,
      spread
    }
  );
}
const BridgingResultsScreen = ({
  game
}) => {
  const { dispatch } = useBridgingSenderState();
  const [shareUrl, setShareUrl] = useState(
    game.share_code ? `${window.location.origin}/ins-001-2/join/${game.share_code}` : null
  );
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [showInitModal, setShowInitModal] = useState(false);
  const relevance = game.relevance ?? game.binding_score ?? 0;
  const spread = game.divergence ?? game.divergence_score ?? 0;
  const relevanceDisplay = relevance <= 1 ? relevance * 100 : relevance;
  const haikuClues = game.haiku_clues;
  const haikuRelevance = game.haiku_relevance ?? game.haiku_binding;
  const haikuSpread = game.haiku_divergence;
  const hasHaikuUnion = haikuClues && haikuClues.length > 0;
  const lexicalUnion = game.lexical_bridge;
  const lexicalRelevance = game.lexical_relevance;
  const lexicalSpread = game.lexical_divergence ?? game.lexical_similarity;
  const hasLexicalUnion = lexicalUnion && lexicalUnion.length > 0;
  const recipientClues = game.recipient_clues;
  const recipientRelevance = game.recipient_relevance ?? game.recipient_binding;
  const recipientSpread = game.recipient_divergence;
  const hasHumanUnion = recipientClues && recipientClues.length > 0;
  const handleCreateShareLink = async () => {
    setIsCreatingShare(true);
    setShareError(null);
    try {
      const response = await api.bridging.createShare(game.game_id);
      setShareUrl(response.share_url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setIsCreatingShare(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
      " · Your Results"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Common Ground Analysis" }),
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
            game.anchor_word,
            " ←―――――――――――――――――――――→ ",
            game.target_word
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
            spread,
            isYou: true
          }
        ),
        hasHaikuUnion && haikuRelevance !== void 0 && haikuSpread !== void 0 && /* @__PURE__ */ jsx(
          DotPlotRow,
          {
            label: "Haiku",
            concepts: haikuClues,
            relevance: haikuRelevance <= 1 ? haikuRelevance * 100 : haikuRelevance,
            spread: haikuSpread
          }
        ),
        hasLexicalUnion && lexicalRelevance != null && lexicalSpread != null && /* @__PURE__ */ jsx(
          DotPlotRow,
          {
            label: "Statistical",
            concepts: lexicalUnion,
            relevance: lexicalRelevance <= 1 ? lexicalRelevance * 100 : lexicalRelevance,
            spread: lexicalSpread
          }
        ),
        hasHumanUnion && recipientRelevance !== void 0 && recipientSpread !== void 0 ? /* @__PURE__ */ jsx(
          HumanDataRow,
          {
            concepts: recipientClues,
            relevance: recipientRelevance <= 1 ? recipientRelevance * 100 : recipientRelevance,
            spread: recipientSpread
          }
        ) : /* @__PURE__ */ jsx(
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
        style: { background: "transparent", borderColor: "var(--faded-light)" },
        children: [
          /* @__PURE__ */ jsx("div", { className: "panel-header", children: /* @__PURE__ */ jsx("span", { className: "panel-title", children: "Interpretation" }) }),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "panel-content",
              style: {
                fontFamily: "var(--font-body)",
                fontSize: "0.9rem",
                color: "var(--faded)",
                lineHeight: "1.7"
              },
              children: (() => {
                const userRel = Math.round(relevanceDisplay);
                const userSpread = Math.round(spread);
                const haikuRel = hasHaikuUnion && haikuRelevance !== void 0 ? Math.round(haikuRelevance <= 1 ? haikuRelevance * 100 : haikuRelevance) : null;
                const haikuSpr = hasHaikuUnion && haikuSpread !== void 0 ? Math.round(haikuSpread) : null;
                const statRel = hasLexicalUnion && lexicalRelevance != null ? Math.round(lexicalRelevance <= 1 ? lexicalRelevance * 100 : lexicalRelevance) : null;
                const statSpr = hasLexicalUnion && lexicalSpread != null ? Math.round(lexicalSpread) : null;
                const compare = (user, baseline, name) => {
                  if (baseline === null) return null;
                  const diff = user - baseline;
                  if (Math.abs(diff) <= 5) return `on par with ${name}`;
                  return diff > 0 ? `higher than ${name}` : `lower than ${name}`;
                };
                const haikuRelComp = compare(userRel, haikuRel, "Haiku");
                const statRelComp = compare(userRel, statRel, "the statistical model");
                let relevanceStatement = `Your relevance (${userRel}) is `;
                if (haikuRelComp && statRelComp) {
                  relevanceStatement += `${haikuRelComp}, and ${statRelComp}.`;
                } else if (haikuRelComp) {
                  relevanceStatement += `${haikuRelComp}.`;
                } else if (statRelComp) {
                  relevanceStatement += `${statRelComp}.`;
                } else {
                  relevanceStatement = `Your relevance is ${userRel}.`;
                }
                const haikuSprComp = compare(userSpread, haikuSpr, "Haiku");
                const statSprComp = compare(userSpread, statSpr, "the statistical model");
                let spreadStatement = ` Your spread (${userSpread}) is `;
                if (haikuSprComp && statSprComp) {
                  spreadStatement += `${haikuSprComp}, and ${statSprComp}`;
                } else if (haikuSprComp) {
                  spreadStatement += `${haikuSprComp}`;
                } else if (statSprComp) {
                  spreadStatement += `${statSprComp}`;
                } else {
                  spreadStatement = ` Your spread is ${userSpread}`;
                }
                let insight = "";
                if (userSpread > (haikuSpr ?? 50) && userSpread > (statSpr ?? 50)) {
                  insight = ", which may indicate your concepts are more diverse but less focused on the semantic bridge between anchor and target.";
                } else if (userRel > (haikuRel ?? 50) && userRel > (statRel ?? 50)) {
                  insight = ", suggesting strong conceptual bridging between the anchor and target.";
                } else if (userRel < (haikuRel ?? 50) && userRel < (statRel ?? 50)) {
                  insight = ". The bridging concepts may be too distant from the semantic space between anchor and target.";
                } else {
                  insight = ".";
                }
                return relevanceStatement + spreadStatement + insight;
              })()
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(Panel, { style: { borderColor: "var(--gold)", background: "linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))", marginTop: "var(--space-md)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "panel-header", style: { borderBottomColor: "var(--gold-dim)" }, children: [
        /* @__PURE__ */ jsx("span", { className: "panel-title", style: { color: "var(--gold)" }, children: "Unregistered Record" }),
        /* @__PURE__ */ jsxs("span", { className: "panel-meta", children: [
          "Session ID: #",
          game.game_id?.slice(0, 4).toUpperCase() || "----"
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "panel-content", children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "var(--space-md)", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsx("div", { style: { flex: 1, minWidth: "200px" }, children: /* @__PURE__ */ jsx("p", { style: { fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-light)", marginBottom: "var(--space-xs)" }, children: "Save your scores to your permanent cognitive profile." }) }),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "primary",
            style: { fontSize: "0.65rem", padding: "10px 20px" },
            onClick: () => setShowInitModal(true),
            children: "Initialize ID"
          }
        )
      ] }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "btn-group", style: { marginTop: "var(--space-md)" }, children: /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: () => dispatch({ type: "RESET" }), children: "Find More Common Ground" }) }),
    /* @__PURE__ */ jsx(
      MagicLinkModal,
      {
        isOpen: showInitModal,
        onClose: () => setShowInitModal(false)
      }
    )
  ] });
};

function BridgingGameRouter() {
  const { state } = useBridgingSenderState();
  switch (state.screen) {
    case "intro":
      return /* @__PURE__ */ jsx(BridgingIntroScreen, {});
    case "anchor-target":
      return /* @__PURE__ */ jsx(AnchorTargetScreen, { anchor: state.anchor, target: state.target });
    case "steps":
      return /* @__PURE__ */ jsx(
        BridgingStepsScreen,
        {
          gameId: state.gameId,
          anchor: state.anchor,
          target: state.target
        }
      );
    case "share":
      return /* @__PURE__ */ jsx(
        BridgingShareScreen,
        {
          gameId: state.gameId,
          anchor: state.anchor,
          target: state.target,
          steps: state.steps,
          divergence: state.divergence,
          shareCode: state.shareCode
        }
      );
    case "results":
      return /* @__PURE__ */ jsx(BridgingResultsScreen, { game: state.game });
    default:
      return /* @__PURE__ */ jsx(BridgingIntroScreen, {});
  }
}
function BridgingGame() {
  return /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsxs(BridgingSenderProvider, { children: [
    /* @__PURE__ */ jsx(Navigation, { instrumentId: "INS-001.2", instrumentTitle: "COMMON GROUND" }),
    /* @__PURE__ */ jsx(BridgingGameRouter, {})
  ] }) });
}

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "InstrumentLayout", $$InstrumentLayout, { "id": "INS-001.2", "title": "COMMON GROUND", "version": "0.1", "status": "live", "description": "Name concepts that belong to both anchor and target. Common Ground measures your ability to locate semantic intersection across distant concepts.", "keywords": "common ground, semantic intersection, conceptual bridging, cognitive assessment, Phronos instruments, semantic space navigation", "canonicalPath": "/ins-001/ins-001-2/" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "BridgingGame", BridgingGame, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/bridging/BridgingGame", "client:component-export": "default" })} ` })}`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-2/index.astro", void 0);

const $$file = "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-2/index.astro";
const $$url = "/ins-001/ins-001-2";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
