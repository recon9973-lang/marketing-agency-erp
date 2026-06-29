export type AuditEventInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
};

export function buildAuditEvent(input: AuditEventInput) {
  return {
    ...input,
    createdAt: new Date()
  };
}
