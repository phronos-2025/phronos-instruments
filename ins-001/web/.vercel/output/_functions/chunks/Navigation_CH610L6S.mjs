import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useRef, useEffect, useState } from 'react';
import { u as useAuth } from './AuthProvider_6qS1E-_I.mjs';

const COLORS = {
  light: {
    ink: "#1A1A1A",
    gold: "#B08D55",
    goldDim: "rgba(176, 141, 85, 0.4)"
  },
  dark: {
    ink: "#E5E5E5",
    gold: "#B08D55",
    goldDim: "rgba(176, 141, 85, 0.4)"
  }
};
const ROTATION_SPEED_PER_SECOND = 0.45;
const PULSE_SPEED = 400;
class PhronosLens {
  canvas;
  ctx;
  size;
  scale;
  dpr;
  rotation = 0;
  animationId = null;
  lastTime = 0;
  theme;
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.size = options.size || canvas.width || 31;
    this.scale = this.size / 31;
    this.theme = options.theme || "dark";
    this.dpr = window.devicePixelRatio || 1;
    canvas.width = this.size * this.dpr;
    canvas.height = this.size * this.dpr;
    canvas.style.width = `${this.size}px`;
    canvas.style.height = `${this.size}px`;
    this.ctx = canvas.getContext("2d");
    this.ctx.scale(this.dpr, this.dpr);
  }
  get colors() {
    return COLORS[this.theme];
  }
  scaled(value) {
    return value * this.scale;
  }
  draw(deltaTime = 0) {
    const ctx = this.ctx;
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const colors = this.colors;
    ctx.clearRect(0, 0, this.size, this.size);
    this.rotation += ROTATION_SPEED_PER_SECOND * deltaTime;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);
    const radius = this.scaled(11.2);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0.3, Math.PI * 1.9);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = this.scaled(2.7);
    ctx.lineCap = "round";
    ctx.stroke();
    const headAngle = Math.PI * 1.9;
    const headX = Math.cos(headAngle) * radius;
    const headY = Math.sin(headAngle) * radius;
    ctx.beginPath();
    ctx.arc(headX, headY, this.scaled(3.25), 0, Math.PI * 2);
    ctx.fillStyle = colors.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX, headY, this.scaled(1.2), 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();
    ctx.restore();
    const pulse = (Math.sin(Date.now() / PULSE_SPEED) + 1) / 2;
    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      this.scaled(3.25) + pulse * this.scaled(1.6),
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = colors.goldDim;
    ctx.lineWidth = this.scaled(1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.scaled(1.6), 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();
  }
  animate(currentTime = 0) {
    const deltaTime = this.lastTime ? (currentTime - this.lastTime) / 1e3 : 0;
    this.lastTime = currentTime;
    this.draw(deltaTime);
    this.animationId = requestAnimationFrame((t) => this.animate(t));
  }
  start() {
    if (this.animationId) return;
    this.animate();
  }
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  resize(newSize) {
    this.size = newSize;
    this.scale = newSize / 31;
    this.canvas.width = newSize * this.dpr;
    this.canvas.height = newSize * this.dpr;
    this.canvas.style.width = `${newSize}px`;
    this.canvas.style.height = `${newSize}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }
}

const PhronosLogo = ({ size = 31, theme = "dark" }) => {
  const canvasRef = useRef(null);
  const lensRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lens = new PhronosLens(canvas, { size, theme });
    lens.start();
    lensRef.current = lens;
    return () => {
      lens.stop();
      lensRef.current = null;
    };
  }, [size, theme]);
  return /* @__PURE__ */ jsx(
    "canvas",
    {
      ref: canvasRef,
      style: {
        display: "block",
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0
      },
      "aria-label": "Phronos Logo"
    }
  );
};

const Navigation = ({
  instrumentId = "INS-001.1",
  instrumentTitle = "SIGNAL"
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const isRegistered = user?.email && !user?.is_anonymous;
  const displayEmail = user?.email ? user.email.length > 20 ? user.email.slice(0, 17) + "..." : user.email : null;
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);
  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("nav", { className: "nav", children: [
      /* @__PURE__ */ jsxs("a", { href: "https://phronos.org", className: "nav-brand", children: [
        /* @__PURE__ */ jsx(PhronosLogo, { size: 31, theme: "dark" }),
        /* @__PURE__ */ jsx("span", { className: "nav-wordmark", children: "Phronos" })
      ] }),
      /* @__PURE__ */ jsxs("ul", { className: "nav-links", children: [
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { href: "https://phronos.org/dispatches", className: "nav-link", children: "Dispatches" }) }),
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("span", { className: "nav-link nav-link-disabled", children: "Library" }) }),
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { href: "https://phronos.org/methods", className: "nav-link", children: "Methods" }) }),
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { href: "https://instruments.phronos.org", className: "nav-link nav-link-active", children: "Instruments" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "nav-right", children: [
        isRegistered && /* @__PURE__ */ jsx("div", { className: "nav-user", children: /* @__PURE__ */ jsx("span", { className: "nav-user-email", title: user?.email || "", children: displayEmail }) }),
        /* @__PURE__ */ jsxs("div", { className: "nav-status", children: [
          /* @__PURE__ */ jsx("span", { className: "status-dot" }),
          /* @__PURE__ */ jsxs("span", { className: "status-text", children: [
            instrumentId,
            " ",
            instrumentTitle
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: "nav-hamburger",
          "aria-label": "Open menu",
          onClick: handleMobileMenuToggle,
          children: [
            /* @__PURE__ */ jsx("span", {}),
            /* @__PURE__ */ jsx("span", {}),
            /* @__PURE__ */ jsx("span", {})
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `nav-mobile-menu ${mobileMenuOpen ? "is-open" : ""}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "nav-mobile-header", children: [
        /* @__PURE__ */ jsxs("a", { href: "https://phronos.org", className: "nav-brand", children: [
          /* @__PURE__ */ jsx(PhronosLogo, { size: 31, theme: "dark" }),
          /* @__PURE__ */ jsx("span", { className: "nav-wordmark", children: "Phronos" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "nav-mobile-close",
            "aria-label": "Close menu",
            onClick: handleMobileMenuToggle
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "nav-mobile-links", children: [
        /* @__PURE__ */ jsx("a", { href: "https://phronos.org/dispatches", className: "nav-mobile-link", onClick: handleLinkClick, children: "Dispatches" }),
        /* @__PURE__ */ jsxs("span", { className: "nav-mobile-link nav-mobile-link-disabled", children: [
          "Library",
          /* @__PURE__ */ jsx("span", { className: "soon-label", children: "(soon)" })
        ] }),
        /* @__PURE__ */ jsx("a", { href: "https://phronos.org/methods", className: "nav-mobile-link", onClick: handleLinkClick, children: "Methods" }),
        /* @__PURE__ */ jsx("a", { href: "https://instruments.phronos.org", className: "nav-mobile-link nav-mobile-link-active", onClick: handleLinkClick, children: "Instruments" })
      ] }),
      isRegistered && /* @__PURE__ */ jsx("div", { className: "nav-mobile-user", children: /* @__PURE__ */ jsx("span", { className: "nav-mobile-user-email", children: user?.email }) }),
      /* @__PURE__ */ jsxs("div", { className: "nav-mobile-status", children: [
        /* @__PURE__ */ jsx("span", { className: "status-dot" }),
        /* @__PURE__ */ jsxs("span", { className: "status-text", children: [
          instrumentId,
          " ",
          instrumentTitle
        ] })
      ] })
    ] })
  ] });
};

export { Navigation as N };
