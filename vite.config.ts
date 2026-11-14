import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Базовый путь сборки. По умолчанию "./" — относительные ссылки, поэтому
// собранный dist работает и в корне домена, и в подпапке (GitHub Pages),
// и при открытии как обычный файл. Задать жёстко: BASE_PATH=/repo/
const base = process.env.BASE_PATH || "./";

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Разрешаем запросы через preview-домен песочницы (*.e2b.app)
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
});
