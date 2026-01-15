import { jsx, jsxs } from 'react/jsx-runtime';
import { useState } from 'react';

const ProgressBar = ({
  currentStep,
  totalSteps = 4
}) => {
  return /* @__PURE__ */ jsx("div", { className: "progress", children: Array.from({ length: totalSteps }, (_, i) => {
    const stepNum = i + 1;
    const isActive = stepNum === currentStep;
    const isCompleted = stepNum < currentStep;
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: `progress-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`
      },
      i
    );
  }) });
};

const ShareLinkBox = ({ url }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "share-link-box", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "text",
        className: "share-link-input",
        value: url,
        readOnly: true
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "share-link-btn",
        onClick: handleCopy,
        type: "button",
        children: copied ? "Copied!" : "Copy"
      }
    )
  ] });
};

export { ProgressBar as P, ShareLinkBox as S };
