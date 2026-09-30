import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/admin-ops";
import { wait } from "@/lib/mock/db";
import type { AuditPage, EmailRow, EmailStatus } from "@/lib/api/real/admin-ops";

export type { AuditPage, AuditRow, EmailRow, EmailStatus } from "@/lib/api/real/admin-ops";

/**
 * The email outbox and the admin audit trail live on the server, so the mock shop has nothing to show: it answers
 * with empty lists and the screens say so.
 */
export async function listEmails(status?: EmailStatus): Promise<EmailRow[]> {
  if (!SITE.useMock) return real.listEmails(status);
  await wait(80);
  return [];
}

export async function retryEmail(id: string): Promise<EmailRow> {
  if (!SITE.useMock) return real.retryEmail(id);
  throw new Error("The sample shop has no email outbox.");
}

export async function listAudit(q: { action?: string; entity?: string; before?: string } = {}): Promise<AuditPage> {
  if (!SITE.useMock) return real.listAudit(q);
  await wait(80);
  return { items: [] };
}
