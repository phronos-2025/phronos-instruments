import { e as createComponent, f as createAstro, n as renderComponent, r as renderTemplate } from '../../../../chunks/astro/server_CE_9OsnW.mjs';
import 'piccolore';
import { a as api, $ as $$InstrumentLayout } from '../../../../chunks/api_BU-QsgYZ.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { P as Panel, B as Button, s as supabase } from '../../../../chunks/Button_DFORBRMv.mjs';
export { renderers } from '../../../../renderers.mjs';

const ClueInput = ({
  number,
  value,
  onChange,
  noiseFloor = []
}) => {
  const trimmedValue = value.trim();
  const hasValue = trimmedValue !== "";
  const isInNoiseFloor = hasValue && noiseFloor.some(
    (item) => item.word.toLowerCase() === trimmedValue.toLowerCase()
  );
  const statusClass = hasValue ? isInNoiseFloor ? "warning" : "valid" : "";
  const statusIcon = hasValue ? isInNoiseFloor ? "⚠" : "✓" : "";
  return /* @__PURE__ */ jsxs("div", { className: "clue-row", children: [
    /* @__PURE__ */ jsx("span", { className: "clue-number", children: number }),
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "text",
        className: `clue-input ${statusClass}`,
        value,
        onChange: (e) => onChange(e.target.value),
        placeholder: "Enter clue...",
        autoComplete: "off",
        spellCheck: "false"
      }
    ),
    /* @__PURE__ */ jsx("span", { className: `clue-status ${statusClass}`, children: statusIcon })
  ] });
};

const JoinScreen = ({ game, onGuessesSubmitted }) => {
  const [guesses, setGuesses] = useState(["", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const handleGuessChange = (index, value) => {
    const newGuesses = [...guesses];
    newGuesses[index] = value;
    setGuesses(newGuesses);
  };
  const allValid = guesses.every((g) => g.trim() !== "");
  const handleSubmit = async () => {
    if (!allValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.games.submitGuesses(game.game_id, {
        guesses: guesses.map((g) => g.trim())
      });
      onGuessesSubmitted(response, guesses.map((g) => g.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit guesses");
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs(Panel, { title: "Guess the Word", children: [
    game.sender_display_name && /* @__PURE__ */ jsxs("p", { style: { marginBottom: "1rem", color: "var(--faded)" }, children: [
      game.sender_display_name,
      " wrote these clues:"
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { marginBottom: "1.5rem", padding: "1rem", background: "var(--card-bg)", border: "1px solid var(--faded-light)" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--faded)", marginBottom: "0.5rem" }, children: "CLUES" }),
      /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)", lineHeight: "1.8" }, children: game.clues.map((clue, idx) => /* @__PURE__ */ jsxs("div", { style: { marginBottom: "0.5rem" }, children: [
        idx + 1,
        ". ",
        clue
      ] }, idx)) })
    ] }),
    /* @__PURE__ */ jsx("p", { style: { marginBottom: "1rem", color: "var(--faded)" }, children: "Enter 3 guesses. Any word is accepted." }),
    /* @__PURE__ */ jsx("div", { className: "clue-inputs", children: guesses.map((guess, idx) => /* @__PURE__ */ jsx(
      ClueInput,
      {
        number: idx + 1,
        value: guess,
        onChange: (value) => handleGuessChange(idx, value)
      },
      idx
    )) }),
    error && /* @__PURE__ */ jsxs("div", { style: { color: "var(--alert)", marginTop: "1rem", fontSize: "var(--text-sm)" }, children: [
      "◈ ",
      error
    ] }),
    /* @__PURE__ */ jsx("div", { className: "btn-group", children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "primary",
        onClick: handleSubmit,
        disabled: !allValid || isSubmitting,
        children: isSubmitting ? "Submitting..." : "Submit Guesses"
      }
    ) })
  ] }) });
};

const ScoreCard = ({
  label,
  value,
  interpretation
}) => {
  const percentage = Math.round(value * 100);
  return /* @__PURE__ */ jsxs("div", { className: "score-card", children: [
    /* @__PURE__ */ jsx("div", { className: "score-label", children: label }),
    /* @__PURE__ */ jsx("div", { className: "score-value", children: value.toFixed(2) }),
    interpretation && /* @__PURE__ */ jsx("div", { className: "score-interpretation", children: interpretation }),
    /* @__PURE__ */ jsx("div", { className: "score-bar", children: /* @__PURE__ */ jsx("div", { className: "score-bar-fill", style: { width: `${percentage}%` } }) })
  ] });
};

const GuessResultsScreen = ({ game, guesses }) => {
  const convergenceInterpretation = game.convergence_score < 0.4 ? "Low convergence" : game.convergence_score < 0.7 ? "Partial convergence" : "High convergence";
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(Panel, { title: "Results", children: [
      game.exact_match ? /* @__PURE__ */ jsx("div", { style: {
        padding: "1.5rem",
        background: "var(--active)",
        color: "var(--bg-deep)",
        textAlign: "center",
        marginBottom: "1.5rem",
        fontFamily: "var(--font-serif)",
        fontSize: "1.2rem"
      }, children: "✓ Correct! You guessed it!" }) : /* @__PURE__ */ jsxs("div", { style: {
        padding: "1.5rem",
        background: "var(--card-bg)",
        border: "1px solid var(--faded-light)",
        textAlign: "center",
        marginBottom: "1.5rem"
      }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--faded)", marginBottom: "0.5rem" }, children: "YOUR GUESSES" }),
        /* @__PURE__ */ jsx("div", { style: { color: "var(--text-light)" }, children: guesses.join(", ") })
      ] }),
      /* @__PURE__ */ jsx(
        ScoreCard,
        {
          label: "Convergence",
          value: game.convergence_score,
          interpretation: convergenceInterpretation
        }
      ),
      /* @__PURE__ */ jsxs("div", { style: { marginTop: "1.5rem", padding: "1rem", background: "var(--card-bg)", border: "1px solid var(--faded-light)" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--faded)", marginBottom: "0.5rem" }, children: "THE WORD WAS" }),
        /* @__PURE__ */ jsx("div", { style: { fontFamily: "var(--font-serif)", fontSize: "1.5rem", color: "var(--gold)" }, children: game.seed_word })
      ] }),
      /* @__PURE__ */ jsx("p", { style: { marginTop: "1.5rem", color: "var(--faded)", fontSize: "var(--text-sm)" }, children: "Convergence measures how well the sender's clues communicated their intended word. Higher scores indicate successful semantic transmission." })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { textAlign: "center", marginTop: "2rem" }, children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "primary",
        onClick: () => window.location.href = "/",
        children: "Play Your Own Game"
      }
    ) })
  ] });
};

const ErrorScreen = ({ error }) => {
  const getErrorContent = () => {
    switch (error) {
      case "expired":
        return {
          title: "Link Expired",
          message: "This link has expired.",
          detail: "Ask your friend for a new one."
        };
      case "already_joined":
        return {
          title: "Already Joined",
          message: "This game already has a recipient.",
          detail: "The sender can generate a new link if needed."
        };
      case "not_found":
        return {
          title: "Game Not Found",
          message: "This game could not be found.",
          detail: "The link may be invalid or the game may have been deleted."
        };
      case "network":
        return {
          title: "Connection Error",
          message: "Failed to connect to the server.",
          detail: "Please check your connection and try again."
        };
      default:
        return {
          title: "Error",
          message: "An unexpected error occurred.",
          detail: "Please try again later."
        };
    }
  };
  const { title, message, detail } = getErrorContent();
  return /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs(Panel, { title, children: [
    /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "2rem 0" }, children: [
      /* @__PURE__ */ jsx("div", { style: {
        fontSize: "3rem",
        marginBottom: "1rem",
        color: "var(--alert)"
      }, children: "◈" }),
      /* @__PURE__ */ jsx("p", { style: {
        fontSize: "1.2rem",
        color: "var(--text-light)",
        marginBottom: "0.5rem"
      }, children: message }),
      /* @__PURE__ */ jsx("p", { style: {
        fontSize: "var(--text-sm)",
        color: "var(--faded)"
      }, children: detail })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { textAlign: "center", marginTop: "2rem" }, children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "primary",
        onClick: () => window.location.href = "/",
        children: "Back to Home"
      }
    ) })
  ] }) });
};

function JoinGame({ token }) {
  const [state, setState] = useState({ screen: "loading", token });
  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }
      try {
        const game = await api.share.join(token);
        setState({ screen: "join", game });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        if (errorMessage.includes("expired")) {
          setState({ screen: "error", error: "expired" });
        } else if (errorMessage.includes("already has a recipient")) {
          setState({ screen: "error", error: "already_joined" });
        } else if (errorMessage.includes("not found")) {
          setState({ screen: "error", error: "not_found" });
        } else {
          setState({ screen: "error", error: "network" });
        }
      }
    };
    initializeAuth();
  }, [token]);
  const handleGuessesSubmitted = (response, guesses) => {
    setState({ screen: "results", game: response, guesses });
  };
  switch (state.screen) {
    case "loading":
      return /* @__PURE__ */ jsx("div", { style: { textAlign: "center", padding: "2rem", color: "var(--faded)" }, children: "Loading..." });
    case "error":
      return /* @__PURE__ */ jsx(ErrorScreen, { error: state.error });
    case "join":
      return /* @__PURE__ */ jsx(JoinScreen, { game: state.game, onGuessesSubmitted: handleGuessesSubmitted });
    case "results":
      return /* @__PURE__ */ jsx(GuessResultsScreen, { game: state.game, guesses: state.guesses });
    default:
      return null;
  }
}

const $$Astro = createAstro();
const prerender = false;
const $$token = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$token;
  const { token } = Astro2.params;
  return renderTemplate`${renderComponent($$result, "InstrumentLayout", $$InstrumentLayout, { "id": "INS-001.1", "title": "SIGNAL", "version": "0.1", "status": "live" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "JoinGame", JoinGame, { "token": token || "", "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/JoinGame", "client:component-export": "default" })} ` })}`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-1/join/[token].astro", void 0);

const $$file = "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/ins-001-1/join/[token].astro";
const $$url = "/ins-001/ins-001-1/join/[token]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$token,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
