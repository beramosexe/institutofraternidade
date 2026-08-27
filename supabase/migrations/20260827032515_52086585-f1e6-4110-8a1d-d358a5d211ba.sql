INSERT INTO public.roles (slug, name, description, is_system)
VALUES ('estoque', 'Estoque', 'Responsável pela gestão do estoque do Instituto', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission)
SELECT id, 'stock.manage'::public.app_permission FROM public.roles WHERE slug = 'estoque'
ON CONFLICT DO NOTHING;

CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'un',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  location TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock managers can view items" ON public.stock_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'stock.manage'));
CREATE POLICY "Stock managers can insert items" ON public.stock_items FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'stock.manage'));
CREATE POLICY "Stock managers can update items" ON public.stock_items FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'stock.manage'));
CREATE POLICY "Stock managers can delete items" ON public.stock_items FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'stock.manage'));

CREATE TYPE public.stock_movement_type AS ENUM ('in', 'out', 'adjustment');

CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  reason TEXT,
  work_id UUID REFERENCES public.works(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock managers can view movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'stock.manage'));
CREATE POLICY "Stock managers can insert movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'stock.manage'));

CREATE TRIGGER tg_stock_items_updated_at BEFORE UPDATE ON public.stock_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF NEW.type = 'in' THEN
    UPDATE public.stock_items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE public.stock_items SET quantity = quantity - NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.type = 'adjustment' THEN
    UPDATE public.stock_items SET quantity = NEW.quantity WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER tg_stock_movements_apply AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();