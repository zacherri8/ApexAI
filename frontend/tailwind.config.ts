import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        panel: "#111111",
        accent: "#e10600",
        electric: "#f5f5f5",
        grid: "#2a2a2a",
        carbon: "#0b0b0b",
        steel: "#171717",
        graphite: "#202020",
        track: "#8b8b8b",
      },
    },
  },
  plugins: [],
};

export default config;
