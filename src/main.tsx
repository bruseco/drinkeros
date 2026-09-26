import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./lib/installPrompt"; // captura beforeinstallprompt o quanto antes
import { registerSW } from "virtual:pwa-register";

if (import.meta.env.PROD) {
  // Auto-update: when a new SW is ready, activate it immediately without asking
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Automatically apply the update — no user prompt needed
      updateSW(true);
    },
    onOfflineReady() {
      console.log("App ready for offline use");
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });

    if ("caches" in window) {
      void caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          void caches.delete(cacheName);
        });
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

