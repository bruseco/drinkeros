import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { InstallBanner } from '@/components/user/InstallBanner';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8 inline-flex items-center justify-center">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-20" />
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Drinkeros
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-md mx-auto">
            Sua plataforma de estudos de Direito Criminal
          </p>

          {/* Install Banner */}
          <div className="mb-8 max-w-md mx-auto">
            <InstallBanner />
          </div>

          {/* Login Button */}
          <Button 
            size="lg" 
            asChild
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-6 text-lg font-semibold"
          >
            <Link to="/login">
              Entrar
            </Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Drinkeros. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Index;
