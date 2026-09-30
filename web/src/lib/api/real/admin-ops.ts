import { http } from "@/lib/api/http";

export type EmailStatus = "PENDING" | "SENDING" | "SENT" | "FAILED";

export interface EmailRow {
  id: string;
  event: string;
  to: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  /** False once the content was cleared (sent, or a password reset that gave up): it cannot be resent. */
  resendable: boolean;
}

export interface AuditRow {
  id: string;
  at: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
}

export interface AuditPage {
  items: AuditRow[];
  nextCursor?: string;
}

export const listEmails = (status?: EmailStatus) => http<EmailRow[]>("/admin/email", { query: { status, limit: 100 } });
export const retryEmail = (id: string) => http<EmailRow>(`/admin/email/${encodeURIComponent(id)}/retry`, { method: "POST" });
export const listAudit = (q: { action?: string; entity?: string; before?: string }) => http<AuditPage>("/admin/audit", { query: { ...q, limit: 50 } });
