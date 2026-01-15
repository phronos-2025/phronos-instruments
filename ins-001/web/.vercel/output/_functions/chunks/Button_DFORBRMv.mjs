import { createClient } from '@supabase/supabase-js';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';

const supabaseUrl = undefined                                   ;
const supabaseAnonKey = undefined                                        ;
{
  throw new Error("Missing Supabase environment variables: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY");
}
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
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
