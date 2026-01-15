import { e as createComponent, f as createAstro, n as renderComponent, r as renderTemplate } from '../../../../chunks/astro/server_CE_9OsnW.mjs';
import 'piccolore';
import { a as api, $ as $$InstrumentLayout } from '../../../../chunks/api_BU-QsgYZ.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { u as useBridgingRecipientState, B as BridgingRecipientProvider } from '../../../../chunks/bridging-state_-XJ2qkac.mjs';
import { N as Navigation } from '../../../../chunks/Navigation_CCvfDsjT.mjs';
import { P as Panel, B as Button, s as supabase } from '../../../../chunks/Button_DFORBRMv.mjs';
export { renderers } from '../../../../renderers.mjs';

const BridgingJoinScreen = ({
  shareCode,
  gameId: initialGameId,
  anchor: initialAnchor,
  target: initialTarget,
  senderStepCount: initialStepCount
}) => {
  const { dispatch } = useBridgingRecipientState();
  const [gameId, setGameId] = useState(initialGameId || "");
  const [anchor, setAnchor] = useState(initialAnchor || "");
  const [target, setTarget] = useState(initialTarget || "");
  const [senderStepCount, setSenderStepCount] = useState(initialStepCount || 0);
  const [steps, setSteps] = useState(["", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(!initialGameId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (initialGameId && initialAnchor && initialTarget) {
      dispatch({
        type: "GAME_LOADED_V2",
        gameId: initialGameId,
        anchor: initialAnchor,
        target: initialTarget,
        senderStepCount: initialStepCount || 0
      });
      return;
    }
    const joinGame = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.signInAnonymously();
        }
        const response = await api.bridging.joinV2(shareCode);
        setGameId(response.game_id);
        setAnchor(response.anchor_word);
        setTarget(response.target_word);
        setSenderStepCount(response.sender_clue_count);
        setIsLoading(false);
        dispatch({
          type: "GAME_LOADED_V2",
          gameId: response.game_id,
          anchor: response.anchor_word,
          target: response.target_word,
          senderStepCount: response.sender_clue_count
        });
      } catch (err) {
        setIsLoading(false);
        const message = err instanceof Error ? err.message : "Failed to join game";
        setError(message);
        dispatch({
          type: "ERROR",
          message
        });
      }
    };
    joinGame();
  }, [shareCode, initialGameId, initialAnchor, initialTarget, initialStepCount, dispatch]);
  const updateStep = (index, value) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };
  const getFilledSteps = () => steps.filter((c) => c.trim().length > 0);
  const handleSubmit = async (e) => {
    e.preventDefault();
    const filledSteps = getFilledSteps();
    if (filledSteps.length === 0) {
      setError("Please enter at least one concept");
      return;
    }
    const anchorLower = anchor.toLowerCase();
    const targetLower = target.toLowerCase();
    for (const step of filledSteps) {
      const stepLower = step.trim().toLowerCase();
      if (stepLower === anchorLower || stepLower === targetLower) {
        setError("Concepts cannot be the anchor or target words");
        return;
      }
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.bridging.submitBridge(gameId, {
        clues: filledSteps.map((c) => c.trim().toLowerCase())
      });
      dispatch({
        type: "BRIDGE_SUBMITTED",
        // Sender (Them)
        senderSteps: response.sender_clues,
        senderRelevance: response.sender_relevance,
        senderDivergence: response.sender_divergence,
        // Recipient (You)
        recipientSteps: response.recipient_clues,
        recipientRelevance: response.recipient_relevance,
        recipientDivergence: response.recipient_divergence,
        // Bridge comparison
        bridgeSimilarity: response.bridge_similarity,
        centroidSimilarity: response.centroid_similarity,
        pathAlignment: response.path_alignment,
        // Haiku baseline
        haikuClues: response.haiku_clues,
        haikuRelevance: response.haiku_relevance,
        haikuDivergence: response.haiku_divergence,
        // Statistical baseline
        lexicalBridge: response.lexical_bridge,
        lexicalRelevance: response.lexical_relevance,
        lexicalDivergence: response.lexical_divergence
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit union");
    } finally {
      setIsSubmitting(false);
    }
  };
  if (isLoading) {
    return /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "2rem" }, children: [
      /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
        /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
        " · Loading"
      ] }),
      /* @__PURE__ */ jsx("h1", { className: "title", children: "Joining game..." }),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            color: "var(--faded)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem"
          },
          children: "Preparing..."
        }
      )
    ] });
  }
  if (error && !gameId) {
    return /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "2rem" }, children: [
      /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
        /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
        " · Error"
      ] }),
      /* @__PURE__ */ jsx("h1", { className: "title", children: "Could not join game." }),
      /* @__PURE__ */ jsx(
        "p",
        {
          style: {
            color: "var(--alert)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            marginBottom: "var(--space-lg)"
          },
          children: error
        }
      ),
      /* @__PURE__ */ jsx(
        "a",
        {
          href: "/ins-001-2",
          style: {
            color: "var(--gold)",
            fontFamily: "var(--font-mono)"
          },
          children: "Find your own common ground →"
        }
      )
    ] });
  }
  const filledCount = getFilledSteps().length;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
      " · Find Common Ground"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: "Connect these concepts." }),
    /* @__PURE__ */ jsx("p", { className: "description", children: "Someone found common ground between these two words. Now find your own." }),
    /* @__PURE__ */ jsxs(Panel, { style: { marginBottom: "var(--space-lg)", textAlign: "center" }, children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            fontFamily: "var(--font-mono)",
            fontSize: "1.25rem",
            color: "var(--gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-md)"
          },
          children: [
            /* @__PURE__ */ jsx("span", { style: { fontWeight: 600 }, children: anchor }),
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  color: "var(--faded)",
                  fontSize: "0.9rem",
                  letterSpacing: "0.1em"
                },
                children: "←――――――――――→"
              }
            ),
            /* @__PURE__ */ jsx("span", { style: { fontWeight: 600 }, children: target })
          ]
        }
      ),
      senderStepCount > 0 && /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            marginTop: "var(--space-sm)",
            color: "var(--faded)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem"
          },
          children: [
            "Their common ground used ",
            senderStepCount,
            " concept",
            senderStepCount !== 1 ? "s" : ""
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "description", children: [
      "Enter 1-5 concepts that connect ",
      /* @__PURE__ */ jsx("strong", { children: anchor }),
      " to",
      " ",
      /* @__PURE__ */ jsx("strong", { children: target }),
      ":"
    ] }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-sm)",
            marginBottom: "var(--space-lg)"
          },
          children: steps.map((step, index) => /* @__PURE__ */ jsx("div", { className: "input-group", style: { marginBottom: 0 }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "var(--space-sm)" }, children: [
            /* @__PURE__ */ jsxs(
              "span",
              {
                style: {
                  color: index === 0 ? "var(--gold)" : "var(--faded)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  width: "1.5rem",
                  textAlign: "right"
                },
                children: [
                  index + 1,
                  "."
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                className: "text-input",
                value: step,
                onChange: (e) => updateStep(index, e.target.value),
                placeholder: index === 0 ? "first concept (required)" : "optional concept",
                autoComplete: "off",
                spellCheck: "false",
                autoFocus: index === 0,
                disabled: isSubmitting,
                style: { flex: 1 }
              }
            )
          ] }) }, index))
        }
      ),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            textAlign: "center",
            marginBottom: "var(--space-md)",
            color: "var(--faded)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem"
          },
          children: filledCount === 0 ? "Enter at least one concept" : `${filledCount} concept${filledCount !== 1 ? "s" : ""} entered`
        }
      ),
      error && /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            color: "var(--alert)",
            marginBottom: "var(--space-md)",
            fontSize: "var(--text-sm)",
            textAlign: "center"
          },
          children: [
            "◈ ",
            error
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "btn-group", style: { justifyContent: "center" }, children: /* @__PURE__ */ jsx(
        Button,
        {
          type: "submit",
          variant: "primary",
          disabled: filledCount === 0 || isSubmitting,
          children: isSubmitting ? "Comparing..." : "Compare"
        }
      ) })
    ] })
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
function ScoreBar({ score, color = "var(--gold)" }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        background: "var(--bg-card)",
        borderRadius: "4px",
        height: "8px",
        overflow: "hidden"
      },
      children: /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            background: color,
            height: "100%",
            width: `${Math.min(100, score)}%`,
            transition: "width 0.3s ease"
          }
        }
      )
    }
  );
}
function getSimilarityInterpretation(score) {
  if (score >= 80) {
    return {
      text: "Highly similar common ground",
      description: "You and the sender navigated this connection almost identically."
    };
  } else if (score >= 60) {
    return {
      text: "Similar common ground",
      description: "You took a related conceptual path between these words."
    };
  } else if (score >= 40) {
    return {
      text: "Different approaches",
      description: "You found a distinct route connecting these concepts."
    };
  } else {
    return {
      text: "Divergent common ground",
      description: "You and the sender had very different ways of connecting these ideas."
    };
  }
}
const BridgingComparisonScreen = ({
  anchor,
  target,
  senderSteps,
  senderRelevance,
  senderDivergence,
  recipientSteps,
  recipientRelevance,
  recipientDivergence,
  bridgeSimilarity,
  haikuClues,
  haikuRelevance,
  haikuDivergence,
  lexicalBridge,
  lexicalRelevance,
  lexicalDivergence
}) => {
  const interpretation = getSimilarityInterpretation(bridgeSimilarity);
  const normalizeRelevance = (r) => {
    if (r === void 0 || r === null) return 0;
    return r <= 1 ? r * 100 : r;
  };
  const youRelevance = normalizeRelevance(recipientRelevance);
  const themRelevance = normalizeRelevance(senderRelevance);
  const haikuRel = normalizeRelevance(haikuRelevance);
  const statRel = normalizeRelevance(lexicalRelevance);
  const hasHaiku = haikuClues && haikuClues.length > 0 && haikuRelevance !== void 0 && haikuDivergence !== void 0;
  const hasStatistical = lexicalBridge && lexicalBridge.length > 0 && lexicalRelevance !== void 0 && lexicalDivergence !== void 0;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
      /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
      " · Common Ground Comparison"
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "title", children: interpretation.text }),
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
            anchor,
            " ←―――――――――――――――――――――→ ",
            target
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
            concepts: recipientSteps,
            relevance: youRelevance,
            spread: recipientDivergence,
            isYou: true
          }
        ),
        /* @__PURE__ */ jsx(
          DotPlotRow,
          {
            label: "Them",
            concepts: senderSteps,
            relevance: themRelevance,
            spread: senderDivergence
          }
        ),
        hasHaiku && /* @__PURE__ */ jsx(
          DotPlotRow,
          {
            label: "Haiku",
            concepts: haikuClues,
            relevance: haikuRel,
            spread: haikuDivergence
          }
        ),
        hasStatistical && /* @__PURE__ */ jsx(
          DotPlotRow,
          {
            label: "Statistical",
            concepts: lexicalBridge,
            relevance: statRel,
            spread: lexicalDivergence
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      Panel,
      {
        title: "Common Ground Similarity",
        meta: `${Math.round(bridgeSimilarity)}%`,
        style: { marginTop: "var(--space-md)" },
        children: [
          /* @__PURE__ */ jsx(ScoreBar, { score: bridgeSimilarity }),
          /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                color: "var(--faded)",
                marginTop: "var(--space-xs)"
              },
              children: [
                /* @__PURE__ */ jsx("span", { children: "divergent" }),
                /* @__PURE__ */ jsx("span", { children: "identical" })
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      Panel,
      {
        style: {
          background: "transparent",
          borderColor: "var(--gold-dim)",
          marginTop: "var(--space-md)"
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--faded)"
            },
            children: /* @__PURE__ */ jsx("strong", { style: { color: "var(--text-light)" }, children: interpretation.description })
          }
        )
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "btn-group", style: { justifyContent: "center", marginTop: "var(--space-lg)" }, children: /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: () => window.location.href = "/ins-001-2", children: "Find Your Own Common Ground" }) })
  ] });
};

function BridgingRecipientRouter({ shareCode }) {
  const { state } = useBridgingRecipientState();
  switch (state.screen) {
    case "loading":
      return /* @__PURE__ */ jsx(BridgingJoinScreen, { shareCode });
    case "error":
      return /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "2rem" }, children: [
        /* @__PURE__ */ jsxs("p", { className: "subtitle", children: [
          /* @__PURE__ */ jsx("span", { className: "id", children: "INS-001.2" }),
          " · Error"
        ] }),
        /* @__PURE__ */ jsx("h1", { className: "title", children: "Something went wrong." }),
        /* @__PURE__ */ jsx(
          "p",
          {
            style: {
              color: "var(--alert)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem"
            },
            children: state.message
          }
        ),
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "/ins-001-2",
            style: {
              display: "inline-block",
              marginTop: "var(--space-lg)",
              color: "var(--gold)",
              fontFamily: "var(--font-mono)"
            },
            children: "Create your own bridge →"
          }
        )
      ] });
    case "build-bridge":
      return /* @__PURE__ */ jsx(
        BridgingJoinScreen,
        {
          shareCode,
          gameId: state.gameId,
          anchor: state.anchor,
          target: state.target,
          senderStepCount: state.senderStepCount
        }
      );
    case "comparison":
      return /* @__PURE__ */ jsx(
        BridgingComparisonScreen,
        {
          anchor: state.anchor,
          target: state.target,
          senderSteps: state.senderSteps,
          senderRelevance: state.senderRelevance,
          senderDivergence: state.senderDivergence,
          recipientSteps: state.recipientSteps,
          recipientRelevance: state.recipientRelevance,
          recipientDivergence: state.recipientDivergence,
          bridgeSimilarity: state.bridgeSimilarity,
          haikuClues: state.haikuClues,
          haikuRelevance: state.haikuRelevance,
          haikuDivergence: state.haikuDivergence,
          lexicalBridge: state.lexicalBridge,
          lexicalRelevance: state.lexicalRelevance,
          lexicalDivergence: state.lexicalDivergence
        }
      );
    default:
      return /* @__PURE__ */ jsx(BridgingJoinScreen, { shareCode });
  }
}
function JoinBridgingGame({ shareCode }) {
  return /* @__PURE__ */ jsxs(BridgingRecipientProvider, { children: [
    /* @__PURE__ */ jsx(Navigation, { instrumentId: "INS-001.2", instrumentTitle: "COMMON GROUND" }),
    /* @__PURE__ */ jsx(BridgingRecipientRouter, { shareCode })
  ] });
}

const $$Astro = createAstro();
const prerender = false;
const $$shareCode = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$shareCode;
  const { shareCode } = Astro2.params;
  return renderTemplate`${renderComponent($$result, "InstrumentLayout", $$InstrumentLayout, { "id": "INS-001.2", "title": "COMMON GROUND", "version": "0.1", "status": "live" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "JoinBridgingGame", JoinBridgingGame, { "shareCode": shareCode || "", "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/bridging/JoinBridgingGame", "client:component-export": "default" })} ` })}`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-2/join/[shareCode].astro", void 0);

const $$file = "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-2/join/[shareCode].astro";
const $$url = "/ins-001/ins-001-2/join/[shareCode]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$shareCode,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
