import { e as createComponent, h as addAttribute, k as renderHead, n as renderComponent, r as renderTemplate } from '../chunks/astro/server_CE_9OsnW.mjs';
import 'piccolore';
/* empty css                                 */
/* empty css                                 */
import { $ as $$LandingNav, a as $$SectionHeader, b as $$InstrumentCard, c as $$LandingFooter } from '../chunks/LandingFooter_Ch_N-X_9.mjs';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const prerender = false;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  const familyInfo = {
    id: "INS-001",
    title: "Semantic Cartography",
    description: "Instruments for mapping how you navigate conceptual space\u2014how you encode meaning, transmit it to others, and reconstruct it from sparse signals.",
    status: "live"
  };
  const childInstruments = [
    {
      id: "INS-001.1",
      title: "Signal",
      description: "Describe a concept divergently\u2014can it still be reconstructed? Measures the tension between divergence and communicability.",
      status: "live",
      duration: "~5 min",
      outputs: "2 scores",
      href: "/ins-001/ins-001-1/"
    },
    {
      id: "INS-001.2",
      title: "Common Ground",
      description: "Name concepts that belong to both anchor and target. Measures your ability to locate semantic intersection across distant concepts.",
      status: "live",
      duration: "~5 min",
      outputs: "2 scores",
      href: "/ins-001/ins-001-2/"
    }
  ];
  return renderTemplate`<html lang="en" data-astro-cid-5ikc4ciz> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><!-- Primary Meta Tags --><title>${familyInfo.title} | Phronos Instruments</title><meta name="title"${addAttribute(`${familyInfo.title} | Phronos Instruments`, "content")}><meta name="description"${addAttribute(familyInfo.description, "content")}><meta name="keywords" content="semantic cartography, cognitive mapping, meaning encoding, conceptual space, cognitive assessment, Phronos instruments"><meta name="author" content="Phronos"><meta name="robots" content="index, follow"><!-- Canonical URL --><link rel="canonical" href="https://instruments.phronos.org/ins-001/"><!-- Favicons --><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/favicon.png"><!-- Open Graph / Facebook --><meta property="og:type" content="website"><meta property="og:url" content="https://instruments.phronos.org/ins-001/"><meta property="og:title"${addAttribute(`${familyInfo.id} ${familyInfo.title} | Phronos Instruments`, "content")}><meta property="og:description"${addAttribute(familyInfo.description, "content")}><meta property="og:site_name" content="Phronos Instruments"><!-- Twitter --><meta property="twitter:card" content="summary_large_image"><meta property="twitter:url" content="https://instruments.phronos.org/ins-001/"><meta property="twitter:title"${addAttribute(`${familyInfo.id} ${familyInfo.title} | Phronos Instruments`, "content")}><meta property="twitter:description"${addAttribute(familyInfo.description, "content")}><!-- Theme Color --><meta name="theme-color" content="#0D0D0D"><meta name="msapplication-TileColor" content="#0D0D0D"><meta name="page-version" content="family-v1.0">${renderHead()}</head> <body data-astro-cid-5ikc4ciz> ${renderComponent($$result, "LandingNav", $$LandingNav, { "data-astro-cid-5ikc4ciz": true })} <main class="family-container" data-astro-cid-5ikc4ciz> <!-- Breadcrumb --> <nav class="breadcrumb" data-astro-cid-5ikc4ciz> <a href="/" class="breadcrumb-link" data-astro-cid-5ikc4ciz>Instruments</a> <span class="breadcrumb-separator" data-astro-cid-5ikc4ciz>/</span> <span class="breadcrumb-current" data-astro-cid-5ikc4ciz>${familyInfo.id}</span> </nav> <!-- Family Header --> <section class="family-header" data-astro-cid-5ikc4ciz> <div class="family-meta" data-astro-cid-5ikc4ciz> <span class="family-id" data-astro-cid-5ikc4ciz>${familyInfo.id}</span> <span class="family-status" data-astro-cid-5ikc4ciz>${familyInfo.status}</span> </div> <h1 class="family-title" data-astro-cid-5ikc4ciz>${familyInfo.title}</h1> <p class="family-description" data-astro-cid-5ikc4ciz>${familyInfo.description}</p> <div class="family-stats" data-astro-cid-5ikc4ciz> <span class="stat" data-astro-cid-5ikc4ciz>${childInstruments.length} instruments</span> <span class="stat-separator" data-astro-cid-5ikc4ciz>·</span> <span class="stat" data-astro-cid-5ikc4ciz>${childInstruments.filter((i) => i.status === "live").length} live</span> </div> </section> <!-- Child Instruments --> <section class="instruments-section" data-astro-cid-5ikc4ciz> ${renderComponent($$result, "SectionHeader", $$SectionHeader, { "id": "01", "title": "Instruments in This Family", "data-astro-cid-5ikc4ciz": true })} <div class="instruments-grid" data-astro-cid-5ikc4ciz> ${childInstruments.map((instrument) => renderTemplate`${renderComponent($$result, "InstrumentCard", $$InstrumentCard, { "id": instrument.id, "title": instrument.title, "description": instrument.description, "status": instrument.status, "duration": instrument.duration, "outputs": instrument.outputs, "href": instrument.href, "data-astro-cid-5ikc4ciz": true })}`)} </div> </section> <div class="diamond" data-astro-cid-5ikc4ciz>◈</div> ${renderComponent($$result, "LandingFooter", $$LandingFooter, { "data-astro-cid-5ikc4ciz": true })} </main> </body></html>`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/index.astro", void 0);

const $$file = "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/ins-001/index.astro";
const $$url = "/ins-001";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
