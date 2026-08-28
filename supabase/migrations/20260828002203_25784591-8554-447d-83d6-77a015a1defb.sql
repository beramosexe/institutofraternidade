-- ============ OPÇÕES CONFIGURÁVEIS ============
CREATE TABLE public.options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.options TO authenticated;
GRANT ALL ON public.options TO service_role;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
CREATE POLICY options_read ON public.options FOR SELECT TO authenticated USING (true);
CREATE POLICY options_write ON public.options FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'options.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'options.manage'));
CREATE TRIGGER tg_options_updated_at BEFORE UPDATE ON public.options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MANUTENÇÃO ============
CREATE TABLE public.maintenance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  category text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','analysis','awaiting_quote','quote_received','sent_to_finance','in_approval','approved','in_progress','done','rejected','postponed','cancelled','returned')),
  created_by uuid REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tickets TO authenticated;
GRANT ALL ON public.maintenance_tickets TO service_role;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY mt_read ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (created_by = auth.uid()
         OR assigned_to = auth.uid()
         OR public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'maintenance.manage')
         OR public.has_permission(auth.uid(), 'finance.view'));
CREATE POLICY mt_insert ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND (SELECT membership_status FROM public.profiles WHERE id = auth.uid()) = 'active');
CREATE POLICY mt_update ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'maintenance.manage')
         OR public.has_permission(auth.uid(), 'finance.approve'))
  WITH CHECK (public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'maintenance.manage')
         OR public.has_permission(auth.uid(), 'finance.approve'));
CREATE POLICY mt_delete ON public.maintenance_tickets FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'record.delete'));
CREATE TRIGGER tg_mt_updated_at BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_audit_mt AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.maintenance_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status text,
  note text,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.maintenance_ticket_events TO authenticated;
GRANT ALL ON public.maintenance_ticket_events TO service_role;
ALTER TABLE public.maintenance_ticket_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY mte_read ON public.maintenance_ticket_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_tickets t WHERE t.id = ticket_id));
CREATE POLICY mte_insert ON public.maintenance_ticket_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE TABLE public.maintenance_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  supplier text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  deadline text,
  document_path text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','postponed','returned')),
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_quotes TO authenticated;
GRANT ALL ON public.maintenance_quotes TO service_role;
ALTER TABLE public.maintenance_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mq_read ON public.maintenance_quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_tickets t WHERE t.id = ticket_id));
CREATE POLICY mq_write ON public.maintenance_quotes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'maintenance.manage'));
CREATE POLICY mq_update ON public.maintenance_quotes FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'maintenance.manage')
         OR public.has_permission(auth.uid(), 'finance.approve'))
  WITH CHECK (public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'maintenance.manage')
         OR public.has_permission(auth.uid(), 'finance.approve'));
CREATE POLICY mq_delete ON public.maintenance_quotes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'record.delete'));
CREATE TRIGGER tg_mq_updated_at BEFORE UPDATE ON public.maintenance_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_audit_mq AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_quotes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ============ PEDIDOS DE COMPRA ============
CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  justification text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_finance','approved','rejected','postponed','returned','purchased','cancelled')),
  needs_finance boolean NOT NULL DEFAULT false,
  notes text,
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  requested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_read ON public.purchase_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid()
         OR public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'purchase.manage')
         OR public.has_permission(auth.uid(), 'stock.manage')
         OR public.has_permission(auth.uid(), 'finance.view'));
CREATE POLICY pr_insert ON public.purchase_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid()
              AND (SELECT membership_status FROM public.profiles WHERE id = auth.uid()) = 'active');
CREATE POLICY pr_update ON public.purchase_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'purchase.manage')
         OR public.has_permission(auth.uid(), 'finance.approve'))
  WITH CHECK (public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'purchase.manage')
         OR public.has_permission(auth.uid(), 'finance.approve'));
CREATE POLICY pr_delete ON public.purchase_requests FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'record.delete'));
CREATE TRIGGER tg_pr_updated_at BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_audit_pr AFTER INSERT OR UPDATE OR DELETE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unidade',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_request_items TO authenticated;
GRANT ALL ON public.purchase_request_items TO service_role;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY pri_read ON public.purchase_request_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_requests r WHERE r.id = request_id));
CREATE POLICY pri_write ON public.purchase_request_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_requests r WHERE r.id = request_id
                 AND (r.requested_by = auth.uid() OR public.is_admin(auth.uid())
                      OR public.has_permission(auth.uid(), 'purchase.manage'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_requests r WHERE r.id = request_id
                 AND (r.requested_by = auth.uid() OR public.is_admin(auth.uid())
                      OR public.has_permission(auth.uid(), 'purchase.manage'))));

-- ============ COMPRAS ============
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  purchased_on date NOT NULL DEFAULT current_date,
  supplier text,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  applied_to_stock boolean NOT NULL DEFAULT false,
  purchased_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY pu_read ON public.purchases FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
         OR public.has_permission(auth.uid(), 'purchase.manage')
         OR public.has_permission(auth.uid(), 'stock.manage')
         OR public.has_permission(auth.uid(), 'finance.view'));
CREATE POLICY pu_write ON public.purchases FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'purchase.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'purchase.manage'));
CREATE TRIGGER tg_pu_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_audit_pu AFTER INSERT OR UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unidade',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY pi_read ON public.purchase_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id));
CREATE POLICY pi_write ON public.purchase_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'purchase.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'purchase.manage'));

CREATE TABLE public.purchase_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'nota',
  mime_type text,
  ai_suggestion jsonb,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_documents TO authenticated;
GRANT ALL ON public.purchase_documents TO service_role;
ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pd_read ON public.purchase_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id));
CREATE POLICY pd_write ON public.purchase_documents FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'purchase.manage'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'purchase.manage'));

-- ============ NOTIFICAÇÕES ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY nt_read_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY nt_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY nt_delete_own ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  internal boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT false,
  push boolean NOT NULL DEFAULT false,
  whatsapp boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY np_own ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER tg_np_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notificar por permissão (usado por gatilhos internos)
CREATE OR REPLACE FUNCTION public.notify_permission(_permission app_permission, _kind text, _title text, _body text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT DISTINCT ur.user_id, _kind, _title, _body, _link
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE rp.permission = _permission AND p.membership_status = 'active';

  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT DISTINCT ur.user_id, _kind, _title, _body, _link
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE r.slug = 'admin' AND p.membership_status = 'active';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_permission(app_permission, text, text, text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_notify_new_maintenance_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_permission('maintenance.manage', 'maintenance',
    'Novo chamado de manutenção', NEW.title, '/app/manutencao');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_maintenance_ticket() FROM anon, authenticated;
CREATE TRIGGER tg_notify_mt AFTER INSERT ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_maintenance_ticket();

CREATE OR REPLACE FUNCTION public.tg_notify_new_purchase_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_permission('purchase.manage', 'purchase',
    'Novo pedido de compra', NEW.title, '/app/compras');
  IF NEW.needs_finance THEN
    PERFORM public.notify_permission('finance.approve', 'finance',
      'Nova solicitação aguardando aprovação', NEW.title, '/app/financeiro');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_purchase_request() FROM anon, authenticated;
CREATE TRIGGER tg_notify_pr AFTER INSERT ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_purchase_request();

CREATE OR REPLACE FUNCTION public.tg_notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantity <= NEW.min_quantity AND (OLD.quantity IS NULL OR OLD.quantity > OLD.min_quantity) THEN
    PERFORM public.notify_permission('purchase.manage', 'stock',
      'Produto atingiu estoque mínimo', NEW.name, '/app/estoque');
    PERFORM public.notify_permission('stock.manage', 'stock',
      'Produto atingiu estoque mínimo', NEW.name, '/app/estoque');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_notify_low_stock() FROM anon, authenticated;
CREATE TRIGGER tg_notify_low_stock AFTER UPDATE OF quantity, min_quantity ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_low_stock();

CREATE OR REPLACE FUNCTION public.tg_notify_pending_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.membership_status = 'pending' THEN
    PERFORM public.notify_permission('member.validate', 'members',
      'Novo cadastro aguardando validação', coalesce(NEW.full_name,'Novo associado'), '/app/associados');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_notify_pending_member() FROM anon, authenticated;
CREATE TRIGGER tg_notify_pending_member AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_pending_member();

-- ============ ESTOQUE: embalagem ============
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS package_size numeric(12,2);
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS package_content text;

-- ============ TRABALHOS: cor ============
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS color text;

-- ============ ÁUDIOS: resumo, palavras-chave, plays ============
ALTER TABLE public.audios ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.audios ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.audios ADD COLUMN IF NOT EXISTS play_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.audios ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.register_audio_play(_audio_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.can_access_audio(_audio_id, auth.uid()) THEN
    UPDATE public.audios SET play_count = play_count + 1 WHERE id = _audio_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_audio_play(uuid) TO anon, authenticated;