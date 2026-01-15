import { e as createComponent, m as maybeRenderHead, n as renderComponent, l as renderScript, r as renderTemplate, f as createAstro, h as addAttribute } from './astro/server_CE_9OsnW.mjs';
import 'piccolore';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState } from 'react';
import { A as AuthProvider, u as useAuth } from './AuthProvider_DqxnARqy.mjs';
import { M as MagicLinkModal } from './MagicLinkModal_CKjFIbjs.mjs';
/* empty css                         */
import 'clsx';

const NavAuthButtonInner = ({ variant = "desktop" }) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const isRegistered = user?.email && !user?.is_anonymous;
  if (isRegistered) {
    if (variant === "mobile") {
      return /* @__PURE__ */ jsx("div", { className: "nav-mobile-auth-user", children: /* @__PURE__ */ jsx("span", { className: "nav-mobile-auth-email", children: user?.email }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "nav-auth-user", children: /* @__PURE__ */ jsx("span", { className: "nav-auth-email", title: user?.email || "", children: user?.email && user.email.length > 20 ? user.email.slice(0, 17) + "..." : user?.email }) });
  }
  if (variant === "mobile") {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "nav-mobile-subscribe",
          onClick: () => setShowModal(true),
          children: "Authenticate"
        }
      ),
      /* @__PURE__ */ jsx(MagicLinkModal, { isOpen: showModal, onClose: () => setShowModal(false) })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "nav-subscribe nav-subscribe-desktop",
        onClick: () => setShowModal(true),
        children: "Authenticate"
      }
    ),
    /* @__PURE__ */ jsx(MagicLinkModal, { isOpen: showModal, onClose: () => setShowModal(false) })
  ] });
};
const NavAuthButton = (props) => {
  return /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(NavAuthButtonInner, { ...props }) });
};

const $$LandingNav = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<nav class="nav" data-astro-cid-isgwgjjn> <a href="https://phronos.org" class="nav-brand" data-astro-cid-isgwgjjn> ${renderComponent($$result, "PhronosLogo", null, { "size": 31, "theme": "dark", "client:only": "react", "client:component-hydration": "only", "data-astro-cid-isgwgjjn": true, "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/ui/PhronosLogo", "client:component-export": "PhronosLogo" })} <span class="nav-wordmark" data-astro-cid-isgwgjjn>Phronos</span> </a> <ul class="nav-links" data-astro-cid-isgwgjjn> <li data-astro-cid-isgwgjjn><a href="https://phronos.org/dispatches" class="nav-link" data-astro-cid-isgwgjjn>Dispatches</a></li> <li data-astro-cid-isgwgjjn><span class="nav-link nav-link-disabled" data-astro-cid-isgwgjjn>Library</span></li> <li data-astro-cid-isgwgjjn><a href="https://phronos.org/methods" class="nav-link" data-astro-cid-isgwgjjn>Methods</a></li> <li data-astro-cid-isgwgjjn><a href="/" class="nav-link nav-link-active" data-astro-cid-isgwgjjn>Instruments</a></li> </ul> ${renderComponent($$result, "NavAuthButton", NavAuthButton, { "client:load": true, "variant": "desktop", "client:component-hydration": "load", "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/auth/NavAuthButton", "client:component-export": "NavAuthButton", "data-astro-cid-isgwgjjn": true })} <button class="nav-hamburger" aria-label="Open menu" data-astro-cid-isgwgjjn> <span data-astro-cid-isgwgjjn></span> <span data-astro-cid-isgwgjjn></span> <span data-astro-cid-isgwgjjn></span> </button> </nav> <!-- Mobile Menu --> <div class="nav-mobile-menu" data-astro-cid-isgwgjjn> <div class="nav-mobile-header" data-astro-cid-isgwgjjn> <a href="https://phronos.org" class="nav-brand" data-astro-cid-isgwgjjn> ${renderComponent($$result, "PhronosLogo", null, { "size": 31, "theme": "dark", "client:only": "react", "client:component-hydration": "only", "data-astro-cid-isgwgjjn": true, "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/ui/PhronosLogo", "client:component-export": "PhronosLogo" })} <span class="nav-wordmark" data-astro-cid-isgwgjjn>Phronos</span> </a> <button class="nav-mobile-close" aria-label="Close menu" data-astro-cid-isgwgjjn></button> </div> <div class="nav-mobile-links" data-astro-cid-isgwgjjn> <a href="https://phronos.org/dispatches" class="nav-mobile-link" data-astro-cid-isgwgjjn>Dispatches</a> <span class="nav-mobile-link nav-mobile-link-disabled" data-astro-cid-isgwgjjn>
Library
<span class="soon-label" data-astro-cid-isgwgjjn>(soon)</span> </span> <a href="https://phronos.org/methods" class="nav-mobile-link" data-astro-cid-isgwgjjn>Methods</a> <a href="/" class="nav-mobile-link nav-mobile-link-active" data-astro-cid-isgwgjjn>Instruments</a> </div> ${renderComponent($$result, "NavAuthButton", NavAuthButton, { "client:load": true, "variant": "mobile", "client:component-hydration": "load", "client:component-path": "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/auth/NavAuthButton", "client:component-export": "NavAuthButton", "data-astro-cid-isgwgjjn": true })} </div> ${renderScript($$result, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/landing/LandingNav.astro?astro&type=script&index=0&lang.ts")} `;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/landing/LandingNav.astro", void 0);

const $$Astro$1 = createAstro();
const $$InstrumentCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$InstrumentCard;
  const { id, title, description, status, duration, outputs, href } = Astro2.props;
  const isClickable = status === "live" && href;
  const Tag = isClickable ? "a" : "div";
  return renderTemplate`${renderComponent($$result, "Tag", Tag, { "class:list": [
    "instrument-card",
    { "available": isClickable },
    { "coming-soon": !isClickable }
  ], "href": isClickable ? href : void 0, "data-astro-cid-u7vuvllx": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="card-header" data-astro-cid-u7vuvllx> <span class="card-id" data-astro-cid-u7vuvllx>${id}</span> <span${addAttribute(["card-status", status], "class:list")} data-astro-cid-u7vuvllx> ${status === "live" ? "Live" : "Coming"} </span> </div> <div class="card-body" data-astro-cid-u7vuvllx> <h3 class="card-title" data-astro-cid-u7vuvllx>${title}</h3> <p class="card-description" data-astro-cid-u7vuvllx>${description}</p> ${(duration || outputs) && renderTemplate`<div class="card-metrics" data-astro-cid-u7vuvllx> ${duration && renderTemplate`<div class="card-metric" data-astro-cid-u7vuvllx> <span class="card-metric-label" data-astro-cid-u7vuvllx>Duration:</span> <span class="card-metric-value" data-astro-cid-u7vuvllx>${duration}</span> </div>`} ${outputs && renderTemplate`<div class="card-metric" data-astro-cid-u7vuvllx> <span class="card-metric-label" data-astro-cid-u7vuvllx>Outputs:</span> <span class="card-metric-value" data-astro-cid-u7vuvllx>${outputs}</span> </div>`} </div>`} </div> <div class="card-footer" data-astro-cid-u7vuvllx> <span class="card-cta" data-astro-cid-u7vuvllx> ${status === "live" ? "Begin Assessment" : "In Development"} </span> <span class="card-arrow" data-astro-cid-u7vuvllx>${status === "live" ? "\u2192" : "\u2014"}</span> </div> ` })} `;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/landing/InstrumentCard.astro", void 0);

const $$Astro = createAstro();
const $$SectionHeader = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$SectionHeader;
  const { id, title } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div class="section-header" data-astro-cid-4ncjxmxw> <span class="section-number" data-astro-cid-4ncjxmxw>${id}</span> <h2 class="section-title" data-astro-cid-4ncjxmxw>${title}</h2> </div> `;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/landing/SectionHeader.astro", void 0);

const $$LandingFooter = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<footer class="landing-footer" data-astro-cid-ml52l7o4> <p class="footer-tagline" data-astro-cid-ml52l7o4>
Phenotyping for Human Resilience, Ontological Navigation, & Open Science
</p> <div class="footer-links" data-astro-cid-ml52l7o4> <a href="https://phronos.org" class="footer-link" data-astro-cid-ml52l7o4>phronos.org</a> <span style="color: var(--faded);" data-astro-cid-ml52l7o4>·</span> <a href="https://phronos.org/dispatches" class="footer-link" data-astro-cid-ml52l7o4>Dispatches</a> <span style="color: var(--faded);" data-astro-cid-ml52l7o4>·</span> <a href="https://github.com/phronos-2025" class="footer-link" data-astro-cid-ml52l7o4>GitHub</a> <span style="color: var(--faded);" data-astro-cid-ml52l7o4>·</span> <a href="https://phronos.org/terms" class="footer-link" data-astro-cid-ml52l7o4>Terms</a> <span style="color: var(--faded);" data-astro-cid-ml52l7o4>·</span> <a href="https://phronos.org/privacy" class="footer-link" data-astro-cid-ml52l7o4>Privacy</a> </div> <p class="footer-copyright" data-astro-cid-ml52l7o4>© 2026 Phronos Observatory</p> </footer> `;
}, "/Users/vishal/Documents/GitHub/phronos-instruments/ins-001/web/src/components/landing/LandingFooter.astro", void 0);

export { $$LandingNav as $, $$SectionHeader as a, $$InstrumentCard as b, $$LandingFooter as c };
