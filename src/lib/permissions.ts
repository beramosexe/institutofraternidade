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
};

/** Permissões críticas: somente a administração pode concedê-las. */
export const CRITICAL_PERMISSIONS: Permission[] = [
  "audio.delete",
  "logs.view",
  "role.manage",
];

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
  completed: "Concluído",
  archived: "Arquivado",
} as const;
