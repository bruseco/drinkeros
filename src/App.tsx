import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useTriggerRedirect } from "@/components/TriggerRedirect";
import ScrollToTop from "@/components/ScrollToTop";

// Public pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VipLanding from "./pages/VipLanding";
import VipLandingB from "./pages/VipLandingB";
import ResetPassword from "./pages/ResetPassword";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import PackageLanding from "./pages/PackageLanding";
import DrinkerosXperience from "./pages/landing/DrinkerosXperience";
import MixologiaAvancada from "./pages/landing/MixologiaAvancada";
import BarParaEventos from "./pages/landing/BarParaEventos";
import DrinkDeliveryEngarrafados from "./pages/landing/DrinkDeliveryEngarrafados";
import IngredientesArtesanais from "./pages/landing/IngredientesArtesanais";
import ClassicosDestilados from "./pages/landing/ClassicosDestilados";
import Rand from "./pages/landing/Rand";
import WorkshopAlemDosClassicos from "./pages/landing/WorkshopAlemDosClassicos";
import BartenderABordo from "./pages/landing/BartenderABordo";
import BebidaDecifrada from "./pages/landing/BebidaDecifrada";
import EbookLanding from "./pages/landing/EbookLanding";
import Checkout from "./pages/Checkout";
import SSO from "./pages/SSO";
import Migracao from "./pages/Migracao";
import CompleteProfile from "./pages/CompleteProfile";

// Admin pages
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLessons from "./pages/admin/AdminLessons";
import LessonForm from "./pages/admin/LessonForm";
import AdminPackages from "./pages/admin/AdminPackages";
import PackageForm from "./pages/admin/PackageForm";
import AdminCourses from "./pages/admin/AdminCourses";
import CourseForm from "./pages/admin/CourseForm";
import AdminProdutos from "./pages/admin/AdminProdutos";
import ProdutoForm from "./pages/admin/ProdutoForm";
import AdminEbooks from "./pages/admin/AdminEbooks";
import EbookForm from "./pages/admin/EbookForm";
import AdminExclusiveContent from "./pages/admin/AdminExclusiveContent";
import ExclusivePostForm from "./pages/admin/ExclusivePostForm";
import AdminTeam from "./pages/admin/AdminTeam";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminNibo from "./pages/admin/AdminNibo";
import AdminEmailSettings from "./pages/admin/AdminEmailSettings";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminUpsell from "./pages/admin/AdminUpsell";
import AdminClube from "./pages/admin/AdminClube";
import AdminWhatsApp from "./pages/admin/AdminWhatsApp";
import AdminWhatsAppQueue from "./pages/admin/AdminWhatsAppQueue";
import AdminWhatsAppConnections from "./pages/admin/AdminWhatsAppConnections";
import AdminWhatsAppTemplates from "./pages/admin/AdminWhatsAppTemplates";
import AdminWhatsAppBindings from "./pages/admin/AdminWhatsAppBindings";

import AdminCSReports from "./pages/admin/AdminCSReports";
import AdminCSTimeline from "./pages/admin/AdminCSTimeline";
import AdminCRM from "./pages/admin/AdminCRM";

import AdminUXMetrics from "./pages/admin/AdminUXMetrics";
import AdminAccessMetrics from "./pages/admin/AdminAccessMetrics";
import AdminSalesPages from "./pages/admin/AdminSalesPages";
import AdminTracking from "./pages/admin/AdminTracking";
import AdminPostChecklist from "./pages/admin/AdminPostChecklist";
import { FacebookPixel } from "./components/FacebookPixel";

// User pages
import { UserLayout } from "./components/user/UserLayout";
import UserHome from "./pages/user/UserHome";
import UserLesson from "./pages/user/UserLesson";
import UserFavorites from "./pages/user/UserFavorites";
import UserRecipes from "./pages/user/UserRecipes";
import UserEbooks from "./pages/user/UserEbooks";
import UserModules from "./pages/user/UserModules";
import UserModuleLessons from "./pages/user/UserModuleLessons";
import UserCompleted from "./pages/user/UserCompleted";
import UserCourses from "./pages/user/UserCourses";
import UserCourseModules from "./pages/user/UserCourseModules";
import UserCombos from "./pages/user/UserCombos";
import UserComboDetail from "./pages/user/UserComboDetail";
import UserProfile from "./pages/user/UserProfile";
import UserClubeManage from "./pages/user/UserClubeManage";
import UserRecipeDetail from "./pages/user/UserRecipeDetail";
import UserBatalha from "./pages/user/UserBatalha";
import UserBatalhaNew from "./pages/user/UserBatalhaNew";
import UserBatalhaRanking from "./pages/user/UserBatalhaRanking";
import UserBatalhaRecipeDetail from "./pages/user/UserBatalhaRecipeDetail";

// Sensible defaults to reduce DB read pressure (Disk IO):
// - staleTime 60s evita refetch a cada navegação dentro de 1min
// - refetchOnWindowFocus desabilitado: aba focar não dispara query
// - retry: 1 evita tempestade de retentativas em falhas transitórias
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Componente que preserva tokens OAuth na URL
const RootRedirect = () => {
  const isRedirecting = useTriggerRedirect();
  
  if (isRedirecting) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const hash = window.location.hash;
  if (hash && (hash.includes('access_token') || hash.includes('refresh_token'))) {
    window.location.href = '/login' + hash;
    return null;
  }
  return <Navigate to="/login" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <FacebookPixel />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/clube" element={<Navigate to="/clube-b" replace />} />
            <Route path="/clube-b" element={<VipLandingB />} />
            <Route path="/vip" element={<Navigate to="/clube-b" replace />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/install" element={<Install />} />
            <Route path="/sso" element={<SSO />} />
            <Route path="/migracao" element={<Migracao />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            
            {/* Custom landing pages (must come before the catch-all :packageSlug) */}
            <Route path="/drinkeros-xperience" element={<DrinkerosXperience />} />
            <Route path="/mixologia-avancada" element={<MixologiaAvancada />} />
            <Route path="/bar-p-eventos" element={<BarParaEventos />} />
            <Route path="/drinkdelivery-engarrafados" element={<DrinkDeliveryEngarrafados />} />
            <Route path="/ingredientes-artesanais" element={<IngredientesArtesanais />} />
            <Route path="/producao-de-ingredientes-artesanais" element={<IngredientesArtesanais />} />
            <Route path="/classicos-destilados" element={<ClassicosDestilados />} />
            <Route path="/rand" element={<Rand />} />
            <Route path="/workshop-alem-dos-classicos" element={<WorkshopAlemDosClassicos />} />
            <Route path="/bartender-a-bordo" element={<BartenderABordo />} />
            <Route path="/bebida-decifrada" element={<BebidaDecifrada />} />
            <Route path="/ebook/:slug" element={<EbookLanding />} />
            <Route path="/checkout/:productType/:slug" element={<Checkout />} />

            {/* Dynamic package landing pages - must be after static routes */}
            <Route path="/:packageSlug" element={<PackageLanding />} />

            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="aulas" element={<AdminLessons />} />
              <Route path="aulas/nova" element={<LessonForm />} />
              <Route path="aulas/:id" element={<LessonForm />} />
              <Route path="modulos" element={<AdminPackages />} />
              <Route path="modulos/novo" element={<PackageForm />} />
              <Route path="modulos/:id" element={<PackageForm />} />
              <Route path="cursos" element={<AdminCourses />} />
              <Route path="cursos/novo" element={<CourseForm />} />
              <Route path="cursos/:id" element={<CourseForm />} />
              <Route path="produtos" element={<AdminProdutos />} />
              <Route path="produtos/novo" element={<ProdutoForm />} />
              <Route path="produtos/:id" element={<ProdutoForm />} />
              <Route path="ebooks" element={<AdminEbooks />} />
              <Route path="ebooks/novo" element={<EbookForm />} />
              <Route path="ebooks/:id" element={<EbookForm />} />
              <Route path="receitas" element={<AdminExclusiveContent />} />
              <Route path="receitas/nova" element={<ExclusivePostForm />} />
              <Route path="receitas/:id" element={<ExclusivePostForm />} />
              <Route path="team" element={<AdminTeam />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="nibo" element={<AdminNibo />} />
              <Route path="configuracoes" element={<AdminEmailSettings />} />
              <Route path="notificacoes" element={<AdminNotifications />} />
              <Route path="upsell" element={<AdminUpsell />} />
              <Route path="whatsapp" element={<AdminWhatsApp />} />
              <Route path="whatsapp/fila" element={<AdminWhatsAppQueue />} />
              <Route path="whatsapp/conexoes" element={<AdminWhatsAppConnections />} />
              <Route path="whatsapp/modelos" element={<AdminWhatsAppTemplates />} />
              <Route path="whatsapp/associacoes" element={<AdminWhatsAppBindings />} />
              
              <Route path="cs-reports" element={<AdminCSReports />} />
              <Route path="cs-timeline" element={<AdminCSTimeline />} />
              <Route path="crm" element={<AdminCRM />} />
              <Route path="ux-metrics" element={<AdminUXMetrics />} />
              <Route path="metricas-acesso" element={<AdminAccessMetrics />} />
              <Route path="paginas-venda" element={<AdminSalesPages />} />
              <Route path="clube" element={<AdminClube />} />
              <Route path="metricas" element={<AdminTracking />} />
              <Route path="checklist-postagens" element={<AdminPostChecklist />} />
            </Route>

            {/* User app routes */}
            <Route path="/app" element={<UserLayout />}>
              <Route index element={<Navigate to="/app/receitas" replace />} />
              <Route path="aula/:id" element={<UserLesson />} />
              <Route path="receitas" element={<UserRecipes />} />
              <Route path="receita/:id" element={<UserRecipeDetail />} />
              <Route path="ebooks" element={<UserEbooks />} />
              <Route path="favoritos" element={<UserFavorites />} />
              <Route path="modulos" element={<UserModules />} />
              <Route path="modulo/:moduleId" element={<UserModuleLessons />} />
              <Route path="concluidos" element={<UserCompleted />} />
              <Route path="cursos" element={<UserCourses />} />
              <Route path="curso/:courseId" element={<UserCourseModules />} />
              <Route path="combos" element={<UserCombos />} />
              <Route path="combo/:comboId" element={<UserComboDetail />} />
              <Route path="perfil" element={<UserProfile />} />
              <Route path="clube/gerenciar" element={<UserClubeManage />} />
              <Route path="batalha" element={<UserBatalha />} />
              <Route path="batalha/nova" element={<UserBatalhaNew />} />
              <Route path="batalha/ranking" element={<UserBatalhaRanking />} />
              <Route path="batalha/receita/:id" element={<UserBatalhaRecipeDetail />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
