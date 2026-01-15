import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_BK3ev1gV.mjs';
import { manifest } from './manifest_D7SZcWVY.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/auth/callback.astro.mjs');
const _page2 = () => import('./pages/ins-001/ins-001-1/join/_token_.astro.mjs');
const _page3 = () => import('./pages/ins-001/ins-001-1.astro.mjs');
const _page4 = () => import('./pages/ins-001/ins-001-2/join/_sharecode_.astro.mjs');
const _page5 = () => import('./pages/ins-001/ins-001-2.astro.mjs');
const _page6 = () => import('./pages/ins-001.astro.mjs');
const _page7 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/auth/callback.astro", _page1],
    ["src/pages/ins-001/ins-001-1/join/[token].astro", _page2],
    ["src/pages/ins-001/ins-001-1/index.astro", _page3],
    ["src/pages/ins-001/ins-001-2/join/[shareCode].astro", _page4],
    ["src/pages/ins-001/ins-001-2/index.astro", _page5],
    ["src/pages/ins-001/index.astro", _page6],
    ["src/pages/index.astro", _page7]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "e1513d5b-f1ff-4a5c-a229-b1eb8522828f",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
