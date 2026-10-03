import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/support";
import { wait } from "@/lib/mock/db";
import { mockByToken, mockCreate, mockMessage, mockMine, mockUserId, toCustomer } from "@/lib/mock/support";
import { ApiError } from "@/lib/api/errors";
import type { Ticket } from "@/lib/types";
import type { NewTicketInput, TicketCreated } from "@/lib/api/real/support";

export type { NewTicketInput, TicketCreated } from "@/lib/api/real/support";

/** Real mode talks to the API. Sample mode keeps tickets in this browser so the screens can be tried out. */
export async function createTicket(input: NewTicketInput): Promise<TicketCreated> {
  if (!SITE.useMock) return real.createTicket(input);
  await wait(500);
  if (input.website?.trim()) return { number: "SUP-0000", accessToken: "0" };
  const { ticket } = mockCreate({ ...input, userId: mockUserId() });
  return { number: ticket.number, accessToken: ticket.token };
}

export async function getTicketByToken(number: string, t: string): Promise<Ticket> {
  if (!SITE.useMock) return real.getTicketByToken(number, t);
  await wait(150);
  return toCustomer(mockByToken(number, t));
}

export async function replyByToken(number: string, t: string, body: { body: string }): Promise<Ticket> {
  if (!SITE.useMock) return real.replyByToken(number, t, body);
  await wait(300);
  const found = mockByToken(number, t);
  return toCustomer(mockMessage(found.id, "customer", body.body));
}

export async function listMyTickets(): Promise<Ticket[]> {
  if (!SITE.useMock) return real.listMyTickets();
  await wait(150);
  return mockMine().map(toCustomer);
}

export async function getMyTicket(number: string): Promise<Ticket> {
  if (!SITE.useMock) return real.getMyTicket(number);
  await wait(150);
  const t = mockMine().find((x) => x.number === number);
  if (!t) throw new ApiError(404, "We could not find that request.");
  return toCustomer(t);
}

export async function replyMine(number: string, body: { body: string; attachments?: string[] }): Promise<Ticket> {
  if (!SITE.useMock) return real.replyMine(number, body);
  await wait(300);
  const t = mockMine().find((x) => x.number === number);
  if (!t) throw new ApiError(404, "We could not find that request.");
  return toCustomer(mockMessage(t.id, "customer", body.body));
}
