import { ShieldCheck } from "lucide-react";

export default function GuaranteeNote() {
  return (
    <p className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-2 text-center text-xs leading-relaxed text-emerald-300">
      <ShieldCheck aria-hidden="true" className="h-6 w-6 shrink-0" />
      <span><strong>15 dias de garantia</strong> para experimentar com tranquilidade</span>
    </p>
  );
}
