import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Nota: historyApiFallback é do webpack-dev-server, não do Vite.
    // O roteamento SPA em dev funciona automaticamente com o Vite.
    // Em produção, o vercel.json cuida dos rewrites.
  },
  preview: {
    port: 5173,
  },
});
