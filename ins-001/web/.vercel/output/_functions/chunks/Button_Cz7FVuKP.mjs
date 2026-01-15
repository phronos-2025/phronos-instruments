import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';

function getSupabaseClient() {
  {
    throw new Error("Missing Supabase environment variables: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY");
  }
}
const supabase = new Proxy({}, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  }
});

const Panel = ({ title, meta, children, className = "", style }) => {
  return /* @__PURE__ */ jsxs("div", { className: `panel ${className}`, style, children: [
    (title || meta) && /* @__PURE__ */ jsxs("div", { className: "panel-header", children: [
      title && /* @__PURE__ */ jsx("span", { className: "panel-title", children: title }),
      meta && /* @__PURE__ */ jsx("span", { className: "panel-meta", children: meta })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "panel-content", children })
  ] });
};

const Button = ({
  variant = "primary",
  children,
  className = "",
  ...props
}) => {
  const baseClass = "btn";
  const variantClass = `btn-${variant}`;
  return /* @__PURE__ */ jsx(
    "button",
    {
      className: `${baseClass} ${variantClass} ${className}`,
      ...props,
      children
    }
  );
};

export { Button as B, Panel as P, supabase as s };
