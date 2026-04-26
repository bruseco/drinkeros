import React, { useEffect } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Egg, Loader2, GraduationCap, ShoppingCart, CheckCircle2, FileText } from 'lucide-react';
import { InstallBanner } from '@/components/user/InstallBanner';
import { usePackageBySlug } from '@/hooks/usePackages';
import { useCourseBySlug, useCoursePackages } from '@/hooks/useCourses';
import { useEbookBySlug } from '@/hooks/useEbooks';
import { useUserPlan } from '@/hooks/useUserPlan';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VIP_DISCOUNT_PERCENT, applyVipDiscount, formatBRL } from '@/lib/vipDiscount';

const PackageLanding: React.FC = () => {
  const { packageSlug } = useParams<{ packageSlug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);

  const { data: pkg, isLoading: pkgLoading } = usePackageBySlug(packageSlug || '');
  const { data: course, isLoading: courseLoading } = useCourseBySlug(packageSlug || '');
  const { data: ebook, isLoading: ebookLoading } = useEbookBySlug(packageSlug || '');
  const { data: courseModules = [] } = useCoursePackages(course?.id || '');
  const { data: userPlan } = useUserPlan();
  const isVip = !!userPlan?.isVip;

  const isLoading = pkgLoading || courseLoading || ebookLoading;
  const item = pkg || course || ebook;
  const isCourse = !pkg && !ebook && !!course;
  const isEbook = !pkg && !course && !!ebook;
  const isPackage = !!pkg;

  // Mostra toast com base em ?checkout=success|cancel
  useEffect(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      toast({
        title: 'Compra realizada com sucesso! 🎉',
        description: 'Acesse seu e-mail para ativar sua conta e começar.',
      });
    } else if (status === 'cancel') {
      toast({
        title: 'Compra cancelada',
        description: 'Você pode tentar novamente quando quiser.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  const handleBuy = async () => {
    if (!item || isPackage) return;
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-product-checkout', {
        body: {
          product_type: isCourse ? 'course' : 'ebook',
          slug: packageSlug,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || 'Não foi possível iniciar o checkout');
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao iniciar compra',
        description: err.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-background dark:to-orange-950/20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item) {
    return <Navigate to="/404" replace />;
  }

  const sellable = (isCourse && (item as any).is_available_for_sale && (item as any).price) || (isEbook && (item as any).price);
  const hasStripePrice = (isCourse || isEbook) && (!!(item as any).stripe_price_id || (isEbook && !!(item as any).price));
  const price = (item as any).price ? Number((item as any).price) : null;
  const finalPrice = price !== null && isVip ? applyVipDiscount(price) : price;
  const formattedPrice = finalPrice !== null ? formatBRL(finalPrice) : null;
  const formattedOriginalPrice = price !== null && isVip ? formatBRL(price) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-background dark:to-orange-950/20 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8 inline-flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full blur-2xl opacity-30 animate-pulse" />
              {item.cover_image_url ? (
                <div className="relative w-28 h-28 rounded-full shadow-2xl overflow-hidden">
                  <img src={item.cover_image_url} alt={(item as any).name || (item as any).title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-6 rounded-full shadow-2xl">
                  {isEbook ? <FileText className="h-16 w-16 text-white" /> : <Egg className="h-16 w-16 text-white" />}
                </div>
              )}
            </div>
          </div>

          {(isCourse || isEbook) && (
            <div className="mb-4">
              <Badge className="bg-primary/80 text-primary-foreground text-sm px-4 py-1">
                {isCourse ? `Curso · ${courseModules.length} módulos` : 'E-book'}
              </Badge>
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              {(item as any).name}
            </span>
          </h1>

          {(item as any).description && (
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-md mx-auto">
              {(item as any).description}
            </p>
          )}

          {isCourse && courseModules.length > 0 && (
            <div className="mb-8 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Módulos inclusos
              </h3>
              <div className="space-y-2">
                {courseModules.map((cp) => (
                  <div key={cp.id} className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-white/5 p-3 text-left">
                    {cp.package?.cover_image_url ? (
                      <img src={cp.package.cover_image_url} alt={cp.package.name} className="h-8 w-12 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{cp.package?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preço + CTA de compra */}
          {sellable && hasStripePrice && (
            <div className="mb-8">
              {isVip && formattedOriginalPrice && (
                <div className="mb-2 flex items-center justify-center gap-2">
                  <span className="text-lg text-muted-foreground line-through">{formattedOriginalPrice}</span>
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                    Sócio do Clube · {VIP_DISCOUNT_PERCENT}% OFF
                  </Badge>
                </div>
              )}
              <div className="text-4xl font-extrabold text-foreground mb-1">{formattedPrice}</div>
              <p className="text-sm text-muted-foreground mb-6">
                {isVip ? 'Preço exclusivo para sócios do Clube · ' : ''}Acesso por 1 ano · Pagamento único
              </p>
              <Button
                size="lg"
                onClick={handleBuy}
                disabled={checkoutLoading}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-6 text-lg font-semibold"
              >
                {checkoutLoading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
                ) : (
                  <><ShoppingCart className="mr-2 h-5 w-5" /> Comprar agora</>
                )}
              </Button>
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Pagamento seguro via Stripe
              </div>
            </div>
          )}

          <div className="mb-8 max-w-md mx-auto">
            <InstallBanner />
          </div>

          <Button
            size="lg"
            asChild
            variant={sellable && hasStripePrice ? 'outline' : 'default'}
            className={sellable && hasStripePrice ? '' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-6 text-lg font-semibold'}
          >
            <Link to="/login">
              {sellable && hasStripePrice ? 'Já comprei · Acessar' : 'Iniciar'}
            </Link>
          </Button>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {(item as any).name}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default PackageLanding;
