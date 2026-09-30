import { ContactService } from './contact.service.js';

const setup = (env: { CONTACT_INBOX_EMAIL?: string; ADMIN_EMAIL?: string }) => {
  const send = vi.fn().mockResolvedValue(undefined);
  const service = new ContactService({ send } as never, { get: (key: keyof typeof env) => env[key] } as never);
  return { send, service };
};
const dto = { name: 'Maya', email: 'maya@example.com', message: 'Do you make bunny plushies?' };

describe('ContactService', () => {
  it('sends to the contact inbox with the visitor as sender', async () => {
    const { send, service } = setup({ CONTACT_INBOX_EMAIL: 'maker@example.com', ADMIN_EMAIL: 'admin@example.com' });
    await service.submit(dto);
    expect(send).toHaveBeenCalledWith('contact.message', { to: 'maker@example.com', name: 'Maya', fromEmail: 'maya@example.com', message: dto.message });
  });

  it('falls back to the admin address', async () => {
    const { send, service } = setup({ ADMIN_EMAIL: 'admin@example.com' });
    await service.submit(dto);
    expect(send.mock.calls[0]![1]).toMatchObject({ to: 'admin@example.com' });
  });

  it('answers 503 when no inbox is configured', async () => {
    const { send, service } = setup({});
    await expect(service.submit(dto)).rejects.toMatchObject({ status: 503, response: { code: 'CONTACT_UNAVAILABLE' } });
    expect(send).not.toHaveBeenCalled();
  });

  it('drops a honeypot submission without sending or erroring', async () => {
    const { send, service } = setup({ ADMIN_EMAIL: 'admin@example.com' });
    await expect(service.submit({ ...dto, website: 'http://spam.example' })).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
