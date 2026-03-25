import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";

// PWA update prompt (important for installed app to pick up new layouts)
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

createRoot(document.getElementById("root")!).render(<App />);
