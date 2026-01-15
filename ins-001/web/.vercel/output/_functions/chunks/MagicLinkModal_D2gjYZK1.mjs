import { jsx, jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { P as Panel, B as Button, s as supabase } from './Button_Cz7FVuKP.mjs';

const MagicLinkModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  if (!isOpen) return null;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const returnPath = window.location.pathname;
      const { error: error2 } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnPath)}`
        }
      });
      if (error2) throw error2;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setIsLoading(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { style: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1e3,
    padding: "2rem"
  }, children: /* @__PURE__ */ jsx("div", { style: { maxWidth: "500px", width: "100%" }, children: /* @__PURE__ */ jsx(Panel, { title: "Initialize ID", children: sent ? /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("p", { style: { marginBottom: "1rem", color: "var(--faded)" }, children: "Check your email for a magic link to convert your anonymous account to a registered account." }),
    /* @__PURE__ */ jsx("div", { className: "btn-group", children: /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: onClose, children: "Close" }) })
  ] }) : /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
    /* @__PURE__ */ jsx("p", { style: { marginBottom: "1rem", color: "var(--faded)" }, children: "Convert your anonymous account to a registered account to save your profile." }),
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "email",
        value: email,
        onChange: (e) => setEmail(e.target.value),
        placeholder: "your@email.com",
        className: "clue-input",
        style: { width: "100%", marginBottom: "1rem" },
        required: true,
        disabled: isLoading
      }
    ),
    error && /* @__PURE__ */ jsxs("div", { style: { color: "var(--alert)", marginBottom: "1rem", fontSize: "var(--text-sm)" }, children: [
      "◈ ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "btn-group", children: [
      /* @__PURE__ */ jsx(
        Button,
        {
          type: "submit",
          variant: "primary",
          disabled: !email || isLoading,
          children: isLoading ? "Sending..." : "Send Magic Link"
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          type: "button",
          variant: "ghost",
          onClick: onClose,
          children: "Cancel"
        }
      )
    ] })
  ] }) }) }) });
};

export { MagicLinkModal as M };
