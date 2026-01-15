import { jsx } from 'react/jsx-runtime';
import { createContext, useReducer, useContext } from 'react';

function bridgingSenderReducer(state, action) {
  switch (action.type) {
    case "BEGIN":
      return { screen: "anchor-target" };
    case "BACK":
      if (state.screen === "steps") {
        return { screen: "anchor-target" };
      }
      if (state.screen === "share") {
        return {
          screen: "steps",
          gameId: state.gameId,
          anchor: state.anchor,
          target: state.target
        };
      }
      if (state.screen === "anchor-target") {
        return { screen: "intro" };
      }
      return state;
    case "ANCHOR_TARGET_SET":
      return {
        screen: "anchor-target",
        anchor: action.anchor,
        target: action.target
      };
    case "GAME_CREATED":
      return {
        screen: "steps",
        gameId: action.gameId,
        anchor: action.anchor,
        target: action.target
      };
    case "STEPS_SUBMITTED":
      if (state.screen === "steps") {
        return {
          screen: "share",
          gameId: action.gameId,
          anchor: state.anchor,
          target: state.target,
          steps: action.steps,
          divergence: action.divergence,
          shareCode: action.shareCode
        };
      }
      return state;
    case "GAME_COMPLETED":
      return {
        screen: "results",
        game: action.game
      };
    case "RESET":
      return { screen: "anchor-target" };
    // Skip intro (consent already given)
    default:
      return state;
  }
}
function bridgingRecipientReducer(state, action) {
  switch (action.type) {
    case "GAME_LOADED_V2":
      return {
        screen: "build-bridge",
        gameId: action.gameId,
        anchor: action.anchor,
        target: action.target,
        senderStepCount: action.senderStepCount
      };
    case "ERROR":
      return {
        screen: "error",
        message: action.message
      };
    case "BRIDGE_SUBMITTED":
      if (state.screen === "build-bridge") {
        return {
          screen: "comparison",
          gameId: state.gameId,
          anchor: state.anchor,
          target: state.target,
          // Sender (Them)
          senderSteps: action.senderSteps,
          senderRelevance: action.senderRelevance,
          senderDivergence: action.senderDivergence,
          // Recipient (You)
          recipientSteps: action.recipientSteps,
          recipientRelevance: action.recipientRelevance,
          recipientDivergence: action.recipientDivergence,
          // Bridge comparison
          bridgeSimilarity: action.bridgeSimilarity,
          centroidSimilarity: action.centroidSimilarity,
          pathAlignment: action.pathAlignment,
          // Haiku baseline
          haikuClues: action.haikuClues,
          haikuRelevance: action.haikuRelevance,
          haikuDivergence: action.haikuDivergence,
          // Statistical baseline
          lexicalBridge: action.lexicalBridge,
          lexicalRelevance: action.lexicalRelevance,
          lexicalDivergence: action.lexicalDivergence
        };
      }
      return state;
    case "RESET":
      return { screen: "loading" };
    default:
      return state;
  }
}
const BridgingSenderContext = createContext(void 0);
const BridgingRecipientContext = createContext(void 0);
function BridgingSenderProvider({ children }) {
  const [state, dispatch] = useReducer(bridgingSenderReducer, { screen: "intro" });
  return /* @__PURE__ */ jsx(BridgingSenderContext.Provider, { value: { state, dispatch }, children });
}
function BridgingRecipientProvider({ children }) {
  const [state, dispatch] = useReducer(bridgingRecipientReducer, { screen: "loading" });
  return /* @__PURE__ */ jsx(BridgingRecipientContext.Provider, { value: { state, dispatch }, children });
}
function useBridgingSenderState() {
  const context = useContext(BridgingSenderContext);
  if (!context) {
    throw new Error("useBridgingSenderState must be used within BridgingSenderProvider");
  }
  return context;
}
function useBridgingRecipientState() {
  const context = useContext(BridgingRecipientContext);
  if (!context) {
    throw new Error("useBridgingRecipientState must be used within BridgingRecipientProvider");
  }
  return context;
}

export { BridgingRecipientProvider as B, useBridgingSenderState as a, BridgingSenderProvider as b, useBridgingRecipientState as u };
