import { e as createComponent, k as renderHead, l as renderScript, r as renderTemplate } from '../../chunks/astro/server_CE_9OsnW.mjs';
import 'piccolore';
import 'clsx';
/* empty css                                    */
/* empty css                                       */
export { renderers } from '../../renderers.mjs';

const prerender = false;
const $$Callback = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en" data-astro-cid-qbporkgn> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><title>Signing in... | Phronos Instruments</title>${renderHead()}</head> <body data-astro-cid-qbporkgn> <div class="callback-container" data-astro-cid-qbporkgn> <div class="callback-content" data-astro-cid-qbporkgn> <div class="spinner" data-astro-cid-qbporkgn></div> <p class="status" id="status" data-astro-cid-qbporkgn>Verifying your identity...</p> </div> </div> ${renderScript($$result, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/auth/callback.astro?astro&type=script&index=0&lang.ts")}  </body> </html>`;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/auth/callback.astro", void 0);

const $$file = "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/pages/auth/callback.astro";
const $$url = "/auth/callback";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Callback,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
