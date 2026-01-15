import { e as createComponent, f as createAstro, m as maybeRenderHead, h as addAttribute, r as renderTemplate, k as renderHead, n as renderComponent } from '../chunks/astro/server_CE_9OsnW.mjs';
import 'piccolore';
/* empty css                                 */
/* empty css                                 */
import { $ as $$LandingNav, a as $$SectionHeader, b as $$InstrumentCard, c as $$LandingFooter } from '../chunks/LandingFooter_Ch_N-X_9.mjs';
import 'clsx';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const $$InstrumentFamilyCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$InstrumentFamilyCard;
  const { id, title, description, status, href, children } = Astro2.props;
  const liveCount = children.filter((c) => c.status === "live").length;
  return renderTemplate`${maybeRenderHead()}<div class="family-card" data-astro-cid-r5re5zji> <a${addAttribute(href, "href")} class="family-card-main" data-astro-cid-r5re5zji> <div class="card-header" data-astro-cid-r5re5zji> <span class="card-id" data-astro-cid-r5re5zji>${id}</span> <span${addAttribute(["card-status", status], "class:list")} data-astro-cid-r5re5zji> ${status === "live" ? "Live" : "Coming"} </span> </div> <div class="card-body" data-astro-cid-r5re5zji> <h3 class="card-title" data-astro-cid-r5re5zji>${title}</h3> <p class="card-description" data-astro-cid-r5re5zji>${description}</p> <div class="card-metrics" data-astro-cid-r5re5zji> <div class="card-metric" data-astro-cid-r5re5zji> <span class="card-metric-label" data-astro-cid-r5re5zji>Instruments:</span> <span class="card-metric-value" data-astro-cid-r5re5zji>${children.length}</span> </div> <div class="card-metric" data-astro-cid-r5re5zji> <span class="card-metric-label" data-astro-cid-r5re5zji>Live:</span> <span class="card-metric-value" data-astro-cid-r5re5zji>${liveCount}</span> </div> </div> </div> </a> <!-- Child Instruments List --> <div class="children-section" data-astro-cid-r5re5zji> ${children.map((child) => renderTemplate`<a${addAttribute(child.href || href, "href")}${addAttribute(["child-row", { "child-coming": child.status === "coming" }], "class:list")} data-astro-cid-r5re5zji> <span class="child-id" data-astro-cid-r5re5zji>${child.id}</span> <span class="child-title" data-astro-cid-r5re5zji>${child.title}</span> <span${addAttribute(["child-status-dot", child.status], "class:list")} data-astro-cid-r5re5zji></span> </a>`)} </div> <div class="card-footer" data-astro-cid-r5re5zji> <a${addAttribute(href, "href")} class="card-cta" data-astro-cid-r5re5zji>
View Family
</a> <span class="card-arrow" data-astro-cid-r5re5zji>→</span> </div> </div> `;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/landing/InstrumentFamilyCard.astro", void 0);

const prerender = false;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en" data-astro-cid-j7pv25f6> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><!-- Primary Meta Tags --><title>The Lab | Phronos Instruments</title><meta name="title" content="The Lab | Phronos Instruments"><meta name="description" content="Empirical tools for measuring how you think. Each instrument isolates a specific cognitive dimension—creativity, communication, pattern recognition—and returns quantified observations."><meta name="keywords" content="cognitive assessment, semantic cartography, pattern recognition, cognitive science, psychometrics, Phronos, instruments, cognition measurement"><meta name="author" content="Phronos"><meta name="robots" content="index, follow"><!-- Canonical URL --><link rel="canonical" href="https://instruments.phronos.org/"><!-- Favicons --><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/favicon.png"><!-- Open Graph / Facebook --><meta property="og:type" content="website"><meta property="og:url" content="https://instruments.phronos.org/"><meta property="og:title" content="The Lab | Phronos Instruments"><meta property="og:description" content="Empirical tools for measuring how you think. Each instrument isolates a specific cognitive dimension—creativity, communication, pattern recognition—and returns quantified observations."><meta property="og:site_name" content="Phronos Instruments"><!-- Twitter --><meta property="twitter:card" content="summary_large_image"><meta property="twitter:url" content="https://instruments.phronos.org/"><meta property="twitter:title" content="The Lab | Phronos Instruments"><meta property="twitter:description" content="Empirical tools for measuring how you think. Each instrument isolates a specific cognitive dimension—creativity, communication, pattern recognition—and returns quantified observations."><!-- Theme Color --><meta name="theme-color" content="#0D0D0D"><meta name="msapplication-TileColor" content="#0D0D0D"><meta name="page-version" content="landing-v2.0">${renderHead()}</head> <body data-astro-cid-j7pv25f6> ${renderComponent($$result, "LandingNav", $$LandingNav, { "data-astro-cid-j7pv25f6": true })} <main class="landing-container" data-astro-cid-j7pv25f6> <!-- HERO --> <section class="hero" data-astro-cid-j7pv25f6> <div class="hero-label" data-astro-cid-j7pv25f6> <span class="hero-label-line" data-astro-cid-j7pv25f6></span>
The Lab
</div> <h1 class="hero-title" data-astro-cid-j7pv25f6>Instruments for observing cognition.</h1> <p class="hero-description" data-astro-cid-j7pv25f6>
Empirical tools for measuring how you think. Each instrument isolates a specific 
          cognitive dimension—creativity, communication, pattern recognition—and returns 
          quantified observations without judgment.
</p> <div class="hero-meta" data-astro-cid-j7pv25f6> <div class="hero-meta-item" data-astro-cid-j7pv25f6> <span class="dot" data-astro-cid-j7pv25f6></span> <span data-astro-cid-j7pv25f6>2 Instruments Live</span> </div> <div class="hero-meta-item" data-astro-cid-j7pv25f6> <span data-astro-cid-j7pv25f6>3 In Development</span> </div> </div> </section> <!-- INSTRUMENTS SECTION --> <section class="instruments-section" data-astro-cid-j7pv25f6> ${renderComponent($$result, "SectionHeader", $$SectionHeader, { "id": "01", "title": "Available Instruments", "data-astro-cid-j7pv25f6": true })} <div class="instruments-grid" data-astro-cid-j7pv25f6> ${renderComponent($$result, "InstrumentFamilyCard", $$InstrumentFamilyCard, { "id": "INS-001", "title": "Semantic Cartography", "description": "Instruments for mapping how you navigate conceptual space\u2014how you encode meaning, transmit it to others, and reconstruct it from sparse signals.", "status": "live", "href": "/ins-001/", "children": [
    { id: "INS-001.1", title: "Signal", status: "live", href: "/ins-001/ins-001-1/" },
    { id: "INS-001.2", title: "Common Ground", status: "live", href: "/ins-001/ins-001-2/" }
  ], "data-astro-cid-j7pv25f6": true })} ${renderComponent($$result, "InstrumentCard", $$InstrumentCard, { "id": "INS-002", "title": "Pattern Completion", "description": "Measures inductive reasoning and abstraction through visual and symbolic pattern recognition.", "status": "coming", "duration": "~8 min", "outputs": "3 scores", "data-astro-cid-j7pv25f6": true })} ${renderComponent($$result, "InstrumentCard", $$InstrumentCard, { "id": "INS-003", "title": "Temporal Estimation", "description": "Measures internal clock accuracy and time perception across varying cognitive loads.", "status": "coming", "duration": "~4 min", "outputs": "2 scores", "data-astro-cid-j7pv25f6": true })} </div> </section> <!-- HOW IT WORKS --> <section class="info-section" data-astro-cid-j7pv25f6> ${renderComponent($$result, "SectionHeader", $$SectionHeader, { "id": "02", "title": "How Instruments Work", "data-astro-cid-j7pv25f6": true })} <div class="info-grid" data-astro-cid-j7pv25f6> <div class="info-panel" data-astro-cid-j7pv25f6> <div class="info-panel-number" data-astro-cid-j7pv25f6>01</div> <div class="info-panel-title" data-astro-cid-j7pv25f6>Isolated Measurement</div> <p class="info-panel-description" data-astro-cid-j7pv25f6>
Each instrument targets a specific cognitive dimension. 
              No omnibus "IQ" claims—just precise observations.
</p> </div> <div class="info-panel" data-astro-cid-j7pv25f6> <div class="info-panel-number" data-astro-cid-j7pv25f6>02</div> <div class="info-panel-title" data-astro-cid-j7pv25f6>Quantified Output</div> <p class="info-panel-description" data-astro-cid-j7pv25f6>
Results are numerical scores with defined ranges. 
              Comparable across time and populations.
</p> </div> <div class="info-panel" data-astro-cid-j7pv25f6> <div class="info-panel-number" data-astro-cid-j7pv25f6>03</div> <div class="info-panel-title" data-astro-cid-j7pv25f6>No Judgment</div> <p class="info-panel-description" data-astro-cid-j7pv25f6>
Instruments observe—they don't evaluate. Higher or 
              lower scores indicate difference, not value.
</p> </div> </div> </section> <div class="diamond" data-astro-cid-j7pv25f6>◈</div> ${renderComponent($$result, "LandingFooter", $$LandingFooter, { "data-astro-cid-j7pv25f6": true })} </main> </body></html>`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/index.astro", void 0);

const $$file = "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
