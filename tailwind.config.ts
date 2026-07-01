import type { Config } from "tailwindcss";

/**
 * UFPtrade design tokens (DESIGN.md). Light, warm-neutral industrial B2B.
 * Restrained color: Brand Orange carries actions / focus / active only.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#E86824", dark: "#C4551A", light: "#FEF0E6" },
        // Warm neutral ramp
        ink: { DEFAULT: "#1A1714", muted: "#4A4540", subtle: "#7A756E" },
        line: { DEFAULT: "#E8E4DE", strong: "#D4CFC8" },
        surface: {
          DEFAULT: "#FFFFFF",
          page: "#FAF9F7",
          sunken: "#F5F3EF",
          sidebar: "#1A1714",
        },
        // Semantic
        success: "#2D7A3A",
        warning: "#B38600",
        danger: "#B32424",
        info: "#2468A8",
      },
      fontFamily: {
        sans: ["'Inter Variable'", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono Variable'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(26,23,20,0.06)",
        pop: "0 4px 12px rgba(26,23,20,0.08)",
        modal: "0 8px 24px rgba(26,23,20,0.12)",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
