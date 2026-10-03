import { http } from "@/lib/api/http";
import type { Ticket, TicketKind } from "@/lib/types";

export interface NewTicketInput {
  kind: TicketKind;
  name: string;
  email: string;
  phone?: string;
  category: string;
  /** An order (FB-1001) or work-order (WO-001) number. */
  reference?: string;
  message: string;
  /** Uploaded photo URLs; signed-in senders only. */
  attachments?: string[];
  /** The sender saw the privacy notice on the form. */
  consent: boolean;
  /** Honeypot: always empty from a real visitor. */
  website?: string;
}

export interface TicketCreated {
  number: string;
  /** Opens the ticket without signing in (it is also in the email). */
  accessToken: string;
}

export const createTicket = (input: NewTicketInput) => http<TicketCreated>("/support/tickets", { method: "POST", body: input });

export const getTicketByToken = (number: string, t: string) => http<Ticket>(`/support/tickets/${encodeURIComponent(number)}`, { query: { t } });
export const replyByToken = (number: string, t: string, body: { body: string }) =>
  http<Ticket>(`/support/tickets/${encodeURIComponent(number)}/messages`, { method: "POST", query: { t }, body });

export const listMyTickets = () => http<Ticket[]>("/account/tickets");
export const getMyTicket = (number: string) => http<Ticket>(`/account/tickets/${encodeURIComponent(number)}`);
export const replyMine = (number: string, body: { body: string; attachments?: string[] }) =>
  http<Ticket>(`/account/tickets/${encodeURIComponent(number)}/messages`, { method: "POST", body });
