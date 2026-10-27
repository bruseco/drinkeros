import logo from "@/assets/logotipo-drinkeros.png";
export default function QuizFooter() {
  return (
    <footer className="py-10 bg-black text-center border-t border-white/5">
      <img
        src={logo}
        alt="Drinkeros"
        className="h-8 w-auto mx-auto mb-3 opacity-70"
      />
      <p className="text-sm text-white/50">
        © {new Date().getFullYear()} Drinkeros — Todos os direitos reservados
      </p>
    </footer>
  );
}
