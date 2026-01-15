import { e as createComponent, f as createAstro, h as addAttribute, k as renderHead, o as renderSlot, r as renderTemplate } from './astro/server_CE_9OsnW.mjs';
import 'piccolore';
import 'clsx';
/* empty css                         */
/* empty css                         */
/* empty css                         */
import { s as supabase } from './Button_DFORBRMv.mjs';

const $$Astro = createAstro();
const $$InstrumentLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$InstrumentLayout;
  const {
    id,
    title,
    version = "0.1",
    status = "live",
    description,
    keywords,
    canonicalPath
  } = Astro2.props;
  const pageDescription = description || `${id} ${title} - Measure how you think. A Phronos cognitive assessment instrument.`;
  const pageKeywords = keywords || `${title.toLowerCase()}, cognitive assessment, Phronos instruments, cognition measurement, semantic cartography`;
  const canonicalUrl = canonicalPath ? `https://instruments.phronos.org${canonicalPath}` : void 0;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><!-- Primary Meta Tags --><title>${title} | Phronos Instruments</title><meta name="title"${addAttribute(`${title} | Phronos Instruments`, "content")}><meta name="description"${addAttribute(pageDescription, "content")}><meta name="keywords"${addAttribute(pageKeywords, "content")}><meta name="author" content="Phronos"><meta name="robots" content="index, follow"><!-- Canonical URL -->${canonicalUrl && renderTemplate`<link rel="canonical"${addAttribute(canonicalUrl, "href")}>`}<!-- Favicons --><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/favicon.png"><!-- Open Graph / Facebook --><meta property="og:type" content="website">${canonicalUrl && renderTemplate`<meta property="og:url"${addAttribute(canonicalUrl, "content")}>`}<meta property="og:title"${addAttribute(`${id} ${title} | Phronos Instruments`, "content")}><meta property="og:description"${addAttribute(pageDescription, "content")}><meta property="og:site_name" content="Phronos Instruments"><!-- Twitter --><meta property="twitter:card" content="summary_large_image">${canonicalUrl && renderTemplate`<meta property="twitter:url"${addAttribute(canonicalUrl, "content")}>`}<meta property="twitter:title"${addAttribute(`${id} ${title} | Phronos Instruments`, "content")}><meta property="twitter:description"${addAttribute(pageDescription, "content")}><!-- Theme Color --><meta name="theme-color" content="#0D0D0D"><meta name="msapplication-TileColor" content="#0D0D0D"><meta name="page-version" content="instrument-layout-v2.0">${renderHead()}</head> <body> <div class="instrument-page"> <div class="instrument-container"> ${renderSlot($$result, $$slots["default"])} </div> </div> </body></html>`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/layouts/InstrumentLayout.astro", void 0);

function normalizeApiUrl(url) {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
const rawApiUrl = "http://localhost:8000";
const API_URL = normalizeApiUrl(rawApiUrl);
async function getAuthHeaders() {
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Session error in getAuthHeaders:", sessionError);
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    session = authData.session;
  }
  if (!session) {
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      console.error("Failed to sign in anonymously:", authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    session = authData.session;
  }
  const headers = {
    "Content-Type": "application/json"
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  } else {
    console.error("No access token in session:", session);
    throw new Error("No access token available. Please refresh the page.");
  }
  return headers;
}
async function apiCall(endpoint, options = {}) {
  const headers = await getAuthHeaders();
  let baseUrl = API_URL.replace(/\/$/, "");
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
  }
  const endpointPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${endpointPath}`;
  try {
    const response = await fetch(fullUrl, {
      ...options,
      credentials: "include",
      // Include credentials for cross-origin requests
      headers: {
        ...headers,
        ...options.headers
      }
    });
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        const detail = errorData.detail || errorData.message || errorData.error || errorMessage;
        if (typeof detail === "object" && detail !== null) {
          errorMessage = detail.message || JSON.stringify(detail);
        } else {
          errorMessage = String(detail);
        }
      } catch {
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } catch {
        }
      }
      if (response.status === 403) {
        errorMessage = `403 Forbidden: ${errorMessage}`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
      const origin = typeof window !== "undefined" ? window.location.origin : "unknown";
      const isCorsError = error.message.includes("CORS") || error.message.includes("Access-Control");
      if (isCorsError) {
        throw new Error(`CORS error: API at ${API_URL} is blocking requests from ${origin}`);
      } else {
        throw new Error(`Network error: Cannot connect to API at ${API_URL}`);
      }
    }
    throw error;
  }
}
const api = {
  games: {
    create: (data) => apiCall("/api/v1/games/", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    get: (id) => apiCall(`/api/v1/games/${id}`),
    submitClues: (id, data) => apiCall(`/api/v1/games/${id}/clues`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
    submitGuesses: (id, data) => apiCall(`/api/v1/games/${id}/guesses`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
    suggest: (attempt) => {
      const params = new URLSearchParams();
      if (attempt) params.set("attempt", attempt.toString());
      const query = params.toString();
      return apiCall(`/api/v1/bridging/suggest${query ? `?${query}` : ""}`);
    }
  },
  share: {
    createToken: (gameId) => apiCall(`/api/v1/games/${gameId}/share`, {
      method: "POST"
    }),
    join: (token) => apiCall(`/api/v1/join/${token}`, {
      method: "POST"
    })
  },
  embeddings: {
    validate: (word) => apiCall("/api/v1/embeddings/validate", {
      method: "POST",
      body: JSON.stringify({ word })
    })
  },
  // INS-001.2: Bridging API
  bridging: {
    create: (data) => apiCall("/api/v1/bridging/", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    get: (id) => apiCall(`/api/v1/bridging/${id}`),
    submitClues: (id, data) => apiCall(`/api/v1/bridging/${id}/clues`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
    submitGuess: (id, data) => apiCall(`/api/v1/bridging/${id}/guess`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
    suggest: (fromWord, attempt) => {
      const params = new URLSearchParams();
      if (fromWord) params.set("from_word", fromWord);
      if (attempt) params.set("attempt", attempt.toString());
      const query = params.toString();
      return apiCall(`/api/v1/bridging/suggest${query ? `?${query}` : ""}`);
    },
    createShare: (gameId) => apiCall(`/api/v1/bridging/${gameId}/share`, {
      method: "POST"
    }),
    join: (shareCode) => apiCall(`/api/v1/bridging/join/${shareCode}`, {
      method: "POST"
    }),
    triggerHaikuGuess: (gameId) => apiCall(`/api/v1/bridging/${gameId}/haiku-guess`, {
      method: "POST"
    }),
    triggerHaikuBridge: (gameId) => apiCall(`/api/v1/bridging/${gameId}/haiku-bridge`, {
      method: "POST"
    }),
    // V2: Bridge-vs-Bridge methods
    getDistance: (anchor, target) => apiCall(`/api/v1/bridging/distance?anchor=${encodeURIComponent(anchor)}&target=${encodeURIComponent(target)}`),
    joinV2: (shareCode) => apiCall(`/api/v1/bridging/join-v2/${shareCode}`, {
      method: "POST"
    }),
    submitBridge: (id, data) => apiCall(`/api/v1/bridging/${id}/bridge`, {
      method: "POST",
      body: JSON.stringify(data)
    })
  }
};

export { $$InstrumentLayout as $, api as a };
