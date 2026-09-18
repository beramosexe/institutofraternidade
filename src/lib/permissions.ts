export const ALL_PERMISSIONS = [
  "audio.upload",
  "audio.edit_any",
  "audio.delete",
  "audio.publish",
  "audio.reprocess",
  "transcription.review",
  "transcription.approve",
  "work.manage",
  "user.manage",
  "role.manage",
  "logs.view",
  "attendance.manage",
  "member.validate",
  "member.manage",
  "class.manage",
  "member.role_assign",
  "stock.manage",
  "maintenance.request",
  "maintenance.manage",
  "purchase.manage",
  "finance.view",
  "finance.approve",
  "media.manage",
  "options.manage",
  "record.delete",
  "notification.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "audio.upload": "Enviar áudios",
  "audio.edit_any": "Editar qualquer áudio",
  "audio.delete": "Excluir áudios",
  "audio.publish": "Publicar áudios",
  "audio.reprocess": "Reprocessar áudios",
  "transcription.review": "Revisar transcrições",
  "transcription.approve": "Aprovar transcrições",
  "work.manage": "Gerenciar trabalhos / agenda",
  "user.manage": "Gerenciar usuários",
  "role.manage": "Gerenciar cargos",
  "logs.view": "Visualizar logs de auditoria",
  "attendance.manage": "Controle de presença (acolhimento)",
  "member.validate": "Validar novos associados",
  "member.manage": "Gerenciar associados (dados, status, funções)",
  "class.manage": "Gerenciar turmas e níveis",
  "member.role_assign": "Atribuir cargos a associados",
  "stock.manage": "Gerenciar estoque",
  "maintenance.request": "Abrir chamados de manutenção",
  "maintenance.manage": "Gerenciar chamados de manutenção",
  "purchase.manage": "Gerenciar compras e pedidos",
  "finance.view": "Visualizar financeiro",
  "finance.approve": "Aprovar financeiro",
  "media.manage": "Gerenciar mídias",
  "options.manage": "Gerenciar opções configuráveis",
  "record.delete": "Excluir registros definitivamente",
  "notification.manage": "Gerenciar notificações",
};

/** Permissões críticas: somente a administração pode concedê-las. */
export const CRITICAL_PERMISSIONS: Permission[] = [
  "role.manage",
  "user.manage",
  "member.role_assign",
  "logs.view",
  "audio.delete",
  "record.delete",
  "finance.approve",
];

export const MAINTENANCE_STATUS_LABELS = {
  open: "Aberto",
  analysis: "Em análise",
  awaiting_quote: "Aguardando orçamento",
  quote_received: "Orçamento recebido",
  sent_to_finance: "Enviado ao financeiro",
  in_approval: "Em aprovação",
  approved: "Aprovado",
  in_progress: "Em execução",
  done: "Concluído",
  rejected: "Não aprovado",
  postponed: "Postergado",
  cancelled: "Cancelado",
  returned: "Devolvido",
} as const;

export type MaintenanceStatus = keyof typeof MAINTENANCE_STATUS_LABELS;

export const PRIORITY_LABELS = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
} as const;

export const PURCHASE_REQUEST_STATUS_LABELS = {
  open: "Aberto",
  in_finance: "No financeiro",
  approved: "Aprovado",
  rejected: "Não aprovado",
  postponed: "Postergado",
  returned: "Devolvido",
  purchased: "Comprado",
  cancelled: "Cancelado",
} as const;



export const MEMBERSHIP_STATUS_LABELS = {
  pending: "Pendente de validação",
  active: "Ativo",
  inactive: "Inativo",
} as const;

export const CLASS_STATUS_LABELS = {
  planned: "Planejada",
  open: "Aberta",
  ongoing: "Em andamento",
  closed: "Encerrada",
  cancelled: "Cancelada",
} as const;

export const CLASS_MEMBER_STATUS_LABELS = {
  active: "Ativo",
  ended: "Encerrado",
  removed: "Removido",
} as const;

export const ACCESS_LEVEL_LABELS = {
  public: "Público geral",
  associates: "Restrito aos associados",
  work_participants: "Restrito aos participantes do trabalho",
  attendees_only: "Apenas presentes no dia",
} as const;

export const AUDIO_STATUS_LABELS = {
  uploaded: "Enviado",
  converting: "Convertendo",
  transcribing: "Transcrevendo",
  ready: "Pronto",
  error: "Erro",
  archived: "Arquivado",
} as const;

export const REVIEW_STATUS_LABELS = {
  unreviewed: "Não revisada",
  in_review: "Em revisão",
  reviewed: "Revisada",
} as const;

export const WORK_STATUS_LABELS = {
  draft: "Rascunho",
  published: "Publicado",
  postponed: "Adiado",
  cancelled: "Cancelado",
  completed: "Concluído",
  archived: "Arquivado",
} as const;
