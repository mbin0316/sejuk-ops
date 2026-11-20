// Sejuk Ops theme for Tailwind CSS (v3 config; for v4 copy the values into @theme).
// Usage: bg-navy-900, text-ink-muted, bg-status-success-tint, rounded-card, etc.
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: { 800: "#33415e", 900: "#1e2a44" },
        page: "#f3f6fb",
        surface: "#ffffff",
        line: "#e3e8f0",
        ink: { DEFAULT: "#1a2235", muted: "#5b6478" },
        "on-navy": { DEFAULT: "#ffffff", muted: "#a9b4c8", soft: "#c9d1e0" },
        accent: {
          DEFAULT: "#6c7cf0",
          strong: "#4f5fd6",
          text: "#3f4fc4",
          tint: "#e8ebfd",
        },
        status: {
          success: "#3fc1a5", "success-tint": "#e2f6f1", "success-text": "#0f7a63",
          danger: "#f07a6a", "danger-tint": "#fdecea", "danger-text": "#b5402f",
          warning: "#f5b544", "warning-tint": "#fef4e0", "warning-text": "#8a5a00",
        },
      },
      fontFamily: {
        sans: ["Lexend", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        caption: ["12px", "16px"],
        label: ["13px", { lineHeight: "18px", fontWeight: "500" }],
        body: ["15px", "22px"],
        heading: ["18px", { lineHeight: "26px", fontWeight: "500" }],
        title: ["24px", { lineHeight: "32px", fontWeight: "500" }],
        metric: ["32px", { lineHeight: "38px", fontWeight: "500" }],
        hero: ["36px", { lineHeight: "40px", fontWeight: "500" }],
      },
      borderRadius: {
        input: "10px",
        btn: "12px",
        card: "16px",
        panel: "22px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30, 42, 68, 0.06)",
      },
    },
  },
};
