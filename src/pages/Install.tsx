import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import drinkrosLogo from "@/assets/logotipo-drinkeros.png";
import { Download, Share, Plus, MoreVertical, Smartphone, CheckCircle2, ArrowLeft, Apple, Chrome } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    "Abra suas receitas com um toque",
    "Receba notificações de novos conteúdos",
    "Experiência de app nativo",
    "Inicie rapidamente da tela inicial",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <main className="container mx-auto px-4 py-8 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" aria-label="Voltar para a página inicial">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Instalar App Drinkeros</h1>
        </div>

        {/* App Preview */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-20 mx-auto" />
          </div>
          <p className="text-muted-foreground">O Mundo dos Drinks é aqui!</p>
        </div>

        {/* Already Installed */}
        {isInstalled ? (
          <Card className="border-success/30 bg-success/5 mb-8">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-success mb-2">App já instalado!</h2>
              <p className="text-muted-foreground text-sm">Você já pode acessar o app direto da sua tela inicial.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Features */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Por que instalar?
                </h2>
                <ul className="space-y-3">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Install Button (Android/Chrome) */}
            {deferredPrompt && (
              <Button
                onClick={handleInstallClick}
                className="w-full h-14 text-lg rounded-2xl shadow-lg shadow-primary/30 mb-6"
              >
                <Download className="mr-2 h-5 w-5" />
                Instalar Agora
              </Button>
            )}

            {/* iOS Instructions */}
            {isIOS && (
              <Card className="mb-6 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <Apple className="h-5 w-5" />
                    <span className="font-semibold">Instruções para iPhone/iPad</span>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Toque no botão Compartilhar</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Share className="h-4 w-4" /> na barra do Safari
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Role e toque em "Adicionar à Tela de Início"</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Plus className="h-4 w-4" /> Add to Home Screen
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Confirme tocando em "Adicionar"</p>
                      <p className="text-sm text-muted-foreground mt-1">O app aparecerá na sua tela inicial</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Android Instructions */}
            {isAndroid && !deferredPrompt && (
              <Card className="mb-6 overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <Chrome className="h-5 w-5" />
                    <span className="font-semibold">Instruções para Android</span>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Toque no menu do navegador</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MoreVertical className="h-4 w-4" /> três pontinhos no canto
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Selecione "Instalar app" ou "Adicionar à tela inicial"</p>
                      <p className="text-sm text-muted-foreground mt-1">A opção pode variar conforme o navegador</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Confirme a instalação</p>
                      <p className="text-sm text-muted-foreground mt-1">O app aparecerá na sua tela inicial</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Desktop Instructions */}
            {!isIOS && !isAndroid && !deferredPrompt && (
              <Card className="mb-6 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <Chrome className="h-5 w-5" />
                    <span className="font-semibold">Instruções para Desktop</span>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Procure o ícone de instalação</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Na barra de endereço do Chrome, clique no ícone de instalação
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Clique em "Instalar"</p>
                      <p className="text-sm text-muted-foreground mt-1">O app será instalado no seu computador</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Continue to App */}
        <div className="text-center">
          <Link to="/app">
            <Button variant="outline" className="rounded-2xl">
              Continuar no navegador
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Install;
