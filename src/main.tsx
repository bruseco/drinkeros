import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("Atualização disponível", {
        description: "Toque em Atualizar para carregar o novo layout.",
        action: {
          label: "Atualizar",
          onClick: () => updateSW(true),
        },
        duration: Infinity,
      });
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

createRoot(document.getElementById("root")!).render(<App />);

