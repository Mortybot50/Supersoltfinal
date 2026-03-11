import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["SuperSoltMVP-main/**", "supersolt/**", "node_modules/**"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "localhost",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ── Vendor chunks ──────────────────────────────────────────────
          // Charts — recharts is ~400kB, keep isolated
          if (id.includes("node_modules/recharts") || id.includes("node_modules/victory-vendor")) {
            return "vendor-charts"
          }
          // Date utilities
          if (id.includes("node_modules/date-fns")) {
            return "vendor-dates"
          }
          // Drag-and-drop (used only in Roster)
          if (id.includes("node_modules/@dnd-kit")) {
            return "vendor-dnd"
          }
          // CSV/Excel export utilities (used only in import/export flows)
          if (id.includes("node_modules/papaparse") || id.includes("node_modules/xlsx")) {
            return "vendor-csv"
          }
          // Radix UI primitives
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix"
          }
          // Supabase client
          if (id.includes("node_modules/@supabase")) {
            return "vendor-supabase"
          }
          // TanStack (React Query + Table)
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-tanstack"
          }
          // Form / validation
          if (id.includes("node_modules/react-hook-form") || id.includes("node_modules/zod") || id.includes("node_modules/@hookform")) {
            return "vendor-forms"
          }
          // React core
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/react-router")) {
            return "vendor-react"
          }
        },
      },
    },
  },
}));
