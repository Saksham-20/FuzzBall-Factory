import type { NotificationEvent, NotificationEventMap, OrderPayload, RenderedEmail, Template, TemplateContext, WorkOrderPayload } from '../events.js';
import { formatRupees, renderEmail } from './layout.js';

/**
 * Template registry: one entry per NotificationEvent (a total mapping, so adding an event without a template
 * is a compile error). Welcome and password-reset are finished copy; the order and work-order entries are
 * short, honest defaults built on `simple()` that the commerce/custom-order work should refine.
 */
type Registry = { [E in NotificationEvent]: Template<E> };

const supportLine = (ctx: TemplateContext) => (ctx.supportEmail ? `Questions? Reply to this email or write to ${ctx.supportEmail}.` : undefined);
const first = (name: string) => name.trim().split(/\s+/)[0] || 'there';

function base(ctx: TemplateContext) {
  return { brandName: ctx.brandName, supportLine: supportLine(ctx) };
}

function orderEmail(subject: string, heading: string, lines: (p: OrderPayload) => string[], cta = 'View your order'): Template<Extract<NotificationEvent, `order.${string}`>> {
  return (p, ctx): RenderedEmail =>
    renderEmail({
      ...base(ctx),
      subject: subject.replace('{n}', (p as OrderPayload).orderNumber),
      heading,
      paragraphs: [`Hi ${first(p.name)},`, ...lines(p as OrderPayload)],
      cta: { label: cta, url: (p as OrderPayload).url },
    });
}

function workOrderEmail(subject: string, heading: string, lines: (p: WorkOrderPayload) => string[], cta = 'Open your work order'): Template<Extract<NotificationEvent, `workorder.${string}`>> {
  return (p, ctx): RenderedEmail =>
    renderEmail({
      ...base(ctx),
      subject: subject.replace('{n}', (p as WorkOrderPayload).workOrderNumber),
      heading,
      paragraphs: [`Hi ${first(p.name)},`, ...lines(p as WorkOrderPayload)],
      cta: { label: cta, url: (p as WorkOrderPayload).url },
    });
}

const note = (n?: string) => (n ? [n] : []);
const itemLines = (p: OrderPayload) => (p.items?.length ? [p.items.map((i) => `${i.qty} x ${i.name}`).join(', ')] : []);

export const templates: Registry = {
  'auth.welcome': (p, ctx) =>
    renderEmail({
      ...base(ctx),
      subject: `Welcome to ${ctx.brandName}`,
      preheader: 'Your account is ready.',
      heading: `Welcome, ${first(p.name)}!`,
      paragraphs: [
        `Your ${ctx.brandName} account is ready. You can save favourites, track orders, and send us a work order for something made just for you.`,
        'Everything here is crocheted by one pair of hands, so pieces can be one of a kind or made to order. We show the lead time before you pay.',
      ],
    }),

  'auth.password_reset': (p, ctx) =>
    renderEmail({
      ...base(ctx),
      subject: `Reset your ${ctx.brandName} password`,
      preheader: 'Use this link to choose a new password.',
      heading: 'Choose a new password',
      paragraphs: [`Hi ${first(p.name)}, we got a request to reset your password. The link works for ${p.expiresInMinutes} minutes.`],
      cta: { label: 'Reset password', url: p.resetUrl },
      footnote: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
    }),

  'order.placed': orderEmail('We got your order {n}', 'Order received', (p) => [
    `Thank you! Order ${p.orderNumber} is in.${p.total != null ? ` Total: ${formatRupees(p.total)}${p.paymentMethod === 'COD' ? ' (cash on delivery)' : ''}.` : ''}`,
    ...itemLines(p),
    ...(p.paymentMethod === 'COD' ? ["We'll message you on WhatsApp to confirm before it goes out. Please keep the cash ready for the courier."] : []),
    ...(p.estimatedDispatch ? [`Estimated dispatch: ${p.estimatedDispatch}.`] : []),
    ...note(p.note),
  ]),
  'order.confirmed': orderEmail('Order {n} is confirmed', 'Confirmed and in the queue', (p) => [
    `${p.paymentMethod === 'RAZORPAY' ? 'Payment received, thank you! ' : ''}Order ${p.orderNumber} is confirmed and in the queue.`,
    ...itemLines(p),
    ...(p.estimatedDispatch ? [`Estimated dispatch: ${p.estimatedDispatch}. Made-to-order pieces are crocheted after you order, so we'll keep you posted as it moves.`] : []),
    ...note(p.note),
  ]),
  'order.shipped': orderEmail('Order {n} is on its way', 'Shipped', (p) => [
    `Order ${p.orderNumber} has been handed to the courier.`,
    ...(p.courier || p.awb ? [`${p.courier ?? 'Courier'}${p.awb ? `, tracking number ${p.awb}` : ''}.`] : []),
    ...(p.paymentMethod === 'COD' && p.total != null ? [`Please keep ${formatRupees(p.total)} ready for the courier.`] : []),
    ...note(p.note),
  ], 'Track your order'),
  'order.delivered': orderEmail('Order {n} was delivered', 'Delivered', (p) => [
    `Order ${p.orderNumber} has been delivered. We hope you love it!`,
    'If something is not right, reply to this email or message us on WhatsApp within 7 days and we will sort it out. A photo or unboxing video helps.',
    ...note(p.note),
  ]),
  'order.cancelled': orderEmail('Order {n} was cancelled', 'Order cancelled', (p) => [
    `Order ${p.orderNumber} has been cancelled.`,
    ...note(p.note),
    ...(p.paymentMethod === 'RAZORPAY' ? ['If you already paid, the refund goes back to your original payment method, usually within 5-7 business days.'] : []),
  ]),

  'workorder.received': workOrderEmail('We got your work order {n}', 'Work order received', (p) => [
    `${p.workOrderNumber} ("${p.title}") is with us. We'll review it and send a quote.`,
    ...note(p.note),
  ]),
  'workorder.quoted': workOrderEmail('Your quote for {n} is ready', 'Your quote is ready', (p) => [
    `We've quoted ${p.workOrderNumber} ("${p.title}")${p.amount != null ? ` at ${formatRupees(p.amount)}` : ''}. You can accept, counter or decline.`,
    ...note(p.note),
  ], 'See the quote'),
  'workorder.countered': workOrderEmail('Counter-offer on {n}', 'Counter-offer received', (p) => [
    `A counter-offer${p.amount != null ? ` of ${formatRupees(p.amount)}` : ''} came in on ${p.workOrderNumber} ("${p.title}").`,
    ...note(p.note),
  ]),
  'workorder.accepted': workOrderEmail('{n} is accepted', 'Quote accepted', (p) => [
    `${p.workOrderNumber} ("${p.title}") is accepted.${p.amount != null ? ` The advance to start is ${formatRupees(p.amount)}.` : ''}`,
    ...note(p.note),
  ], 'Pay the advance'),
  'workorder.deposit_paid': workOrderEmail('Advance received for {n}', 'Advance received', (p) => [
    `Thank you. We've received the advance for ${p.workOrderNumber} ("${p.title}"), and it's in the queue.`,
    ...note(p.note),
  ]),
  'workorder.progress': workOrderEmail('Progress on {n}', 'A progress update', (p) => [`There's news on ${p.workOrderNumber} ("${p.title}").`, ...note(p.note)], 'See the photos'),
  'workorder.awaiting_approval': workOrderEmail('Approve your finished piece: {n}', 'Ready for your approval', (p) => [
    `${p.workOrderNumber} ("${p.title}") is finished. Have a look and let us know it's right.`,
    ...note(p.note),
  ], 'Review and approve'),
  'workorder.balance_due': workOrderEmail('Balance due for {n}', 'Balance due', (p) => [
    `Approved! The balance${p.amount != null ? ` of ${formatRupees(p.amount)}` : ''} for ${p.workOrderNumber} ("${p.title}") is due before we ship.`,
    ...note(p.note),
  ], 'Pay the balance'),
  'workorder.shipped': workOrderEmail('{n} is on its way', 'Shipped', (p) => [
    `${p.workOrderNumber} ("${p.title}") has shipped.${p.courier || p.awb ? ` ${p.courier ?? 'Courier'}${p.awb ? `, tracking number ${p.awb}` : ''}.` : ''}`,
    ...note(p.note),
  ], 'Track it'),
  'workorder.declined': workOrderEmail('An update on {n}', "We can't take this one on", (p) => [
    `Thank you for sending ${p.workOrderNumber} ("${p.title}"). Sadly we can't make it.`,
    ...note(p.note),
    'You are welcome to send us another idea any time.',
  ], 'See the details'),
};

export function renderTemplate<E extends NotificationEvent>(event: E, payload: NotificationEventMap[E], ctx: TemplateContext): RenderedEmail {
  return (templates[event] as Template<E>)(payload, ctx);
}
