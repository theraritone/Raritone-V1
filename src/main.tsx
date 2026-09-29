import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support, and the "camera works on your phone" install prompt. Only in a
// production build — a cached shell in development serves stale modules.
if (import.meta.env.PROD) {
  registerServiceWorker();
}
