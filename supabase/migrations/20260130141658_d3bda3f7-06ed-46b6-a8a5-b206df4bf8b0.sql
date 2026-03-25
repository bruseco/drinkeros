-- Enum para roles de admin
CREATE TYPE public.app_role AS ENUM ('super_admin', 'editor', 'viewer');

-- Tabela de roles de usuários (separada por segurança)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Tabela de profiles (para dados adicionais de usuários)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pacotes (produtos Hotmart)
CREATE TABLE public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    hotmart_product_code TEXT,
    price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de receitas
CREATE TABLE public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    image_url TEXT,
    servings TEXT,
    ingredients TEXT,
    instructions TEXT,
    video_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relacionamento receita-pacote
CREATE TABLE public.recipe_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
    package_id UUID REFERENCES public.packages(id) ON DELETE CASCADE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (recipe_id, package_id)
);

-- Tabela de acesso do usuário aos pacotes (via compra Hotmart)
CREATE TABLE public.user_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    package_id UUID REFERENCES public.packages(id) ON DELETE CASCADE NOT NULL,
    hotmart_transaction_id TEXT,
    purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, package_id)
);

-- Tabela de favoritos
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, recipe_id)
);

-- Tabela de lista de compras
CREATE TABLE public.shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
    item_text TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de coleções de favoritos
CREATE TABLE public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.collection_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (collection_id, recipe_id)
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_recipes ENABLE ROW LEVEL SECURITY;

-- Função para verificar role (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para verificar se é admin (qualquer role de admin)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'editor', 'viewer')
  )
$$;

-- Função para verificar se pode editar (super_admin ou editor)
CREATE OR REPLACE FUNCTION public.can_edit(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'editor')
  )
$$;

-- Função para verificar acesso a pacote
CREATE OR REPLACE FUNCTION public.has_package_access(_user_id UUID, _package_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_packages
    WHERE user_id = _user_id
      AND package_id = _package_id
  ) OR public.is_admin(_user_id)
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- user_roles: Só super_admin pode gerenciar, admins podem ver
CREATE POLICY "Super admins can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
    
CREATE POLICY "Admins can view roles" ON public.user_roles
    FOR SELECT USING (public.is_admin(auth.uid()));

-- profiles: Usuários podem ver/editar próprio profile, admins podem ver todos
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);
    
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin(auth.uid()));

-- packages: Públicos para leitura, admins com permissão podem gerenciar
CREATE POLICY "Anyone can view active packages" ON public.packages
    FOR SELECT USING (is_active = true OR public.is_admin(auth.uid()));
    
CREATE POLICY "Editors can manage packages" ON public.packages
    FOR ALL USING (public.can_edit(auth.uid()));

-- recipes: Publicadas visíveis para quem tem acesso ao pacote, admins veem tudo
CREATE POLICY "Admins can manage recipes" ON public.recipes
    FOR ALL USING (public.can_edit(auth.uid()));
    
CREATE POLICY "Users can view published recipes from their packages" ON public.recipes
    FOR SELECT USING (
        status = 'published' AND EXISTS (
            SELECT 1 FROM public.recipe_packages rp
            JOIN public.user_packages up ON up.package_id = rp.package_id
            WHERE rp.recipe_id = recipes.id AND up.user_id = auth.uid()
        )
    );

-- recipe_packages: Admins gerenciam, usuários podem ver
CREATE POLICY "Admins can manage recipe_packages" ON public.recipe_packages
    FOR ALL USING (public.can_edit(auth.uid()));
    
CREATE POLICY "Users can view recipe_packages" ON public.recipe_packages
    FOR SELECT USING (true);

-- user_packages: Usuários veem próprios pacotes, admins veem todos
CREATE POLICY "Users can view own packages" ON public.user_packages
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY "Admins can manage user_packages" ON public.user_packages
    FOR ALL USING (public.is_admin(auth.uid()));

-- favorites: Usuários gerenciam próprios favoritos
CREATE POLICY "Users can manage own favorites" ON public.favorites
    FOR ALL USING (auth.uid() = user_id);

-- shopping_list_items: Usuários gerenciam própria lista
CREATE POLICY "Users can manage own shopping list" ON public.shopping_list_items
    FOR ALL USING (auth.uid() = user_id);

-- collections: Usuários gerenciam próprias coleções
CREATE POLICY "Users can manage own collections" ON public.collections
    FOR ALL USING (auth.uid() = user_id);

-- collection_recipes: Usuários gerenciam receitas em suas coleções
CREATE POLICY "Users can manage own collection recipes" ON public.collection_recipes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_recipes.collection_id
            AND c.user_id = auth.uid()
        )
    );

-- Storage bucket para imagens
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images', 'recipe-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('package-covers', 'package-covers', true);

-- Storage policies
CREATE POLICY "Anyone can view recipe images" ON storage.objects
    FOR SELECT USING (bucket_id = 'recipe-images');
    
CREATE POLICY "Admins can upload recipe images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'recipe-images' AND public.can_edit(auth.uid()));
    
CREATE POLICY "Admins can update recipe images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'recipe-images' AND public.can_edit(auth.uid()));
    
CREATE POLICY "Admins can delete recipe images" ON storage.objects
    FOR DELETE USING (bucket_id = 'recipe-images' AND public.can_edit(auth.uid()));

CREATE POLICY "Anyone can view package covers" ON storage.objects
    FOR SELECT USING (bucket_id = 'package-covers');
    
CREATE POLICY "Admins can upload package covers" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'package-covers' AND public.can_edit(auth.uid()));
    
CREATE POLICY "Admins can update package covers" ON storage.objects
    FOR UPDATE USING (bucket_id = 'package-covers' AND public.can_edit(auth.uid()));
    
CREATE POLICY "Admins can delete package covers" ON storage.objects
    FOR DELETE USING (bucket_id = 'package-covers' AND public.can_edit(auth.uid()));