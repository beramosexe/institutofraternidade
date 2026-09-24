-- Seed das roles de sistema essenciais.
-- Mantemos os slugs usados pelo código e evitamos depender de criação manual
-- ao reconstruir o banco do zero.
INSERT INTO public.roles (slug, name, description, is_system)
VALUES
  ('admin', 'Administrador', 'Acesso administrativo completo ao sistema.', true),
  ('associate', 'Associado', 'Acesso de associado ao Instituto.', true),
  ('uploader', 'Uploader', 'Perfil autorizado para envio de áudios.', true),
  ('reviewer', 'Revisor', 'Perfil autorizado para revisão de conteúdo.', true)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true,
  updated_at = now();
