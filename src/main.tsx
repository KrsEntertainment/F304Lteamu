import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

declare global {
  interface Window {
    __F304L_BOOTED__?: boolean;
  }
}

const container = document.getElementById("root")!;

try {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  window.__F304L_BOOTED__ = true;
} catch (err) {
  // Если приложение упало при монтировании — показываем причину вместо пустого экрана
  const message = err instanceof Error ? err.message : String(err);
  container.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;' +
    'font-family:Manrope,system-ui,sans-serif;color:#F5F5F7;background:#08080A;text-align:center;line-height:1.6">' +
    "Не удалось запустить приложение: " +
    message.replace(/[<>&]/g, "") +
    "</div>";
  console.error(err);
}
