import { ContactService } from './contact.service.js';

const setup = () => {
  const create = vi.fn().mockResolvedValue({ number: 'SUP-0001' });
  return { create, service: new ContactService({ create } as never) };
};
const dto = { name: 'Maya', email: 'maya@example.com', message: 'Do you make bunny plushies?' };

describe('ContactService', () => {
  it('opens a general support ticket for the visitor', async () => {
    const { create, service } = setup();
    await service.submit(dto);
    expect(create).toHaveBeenCalledWith({ kind: 'SUPPORT', category: 'general', name: 'Maya', email: 'maya@example.com', message: dto.message });
  });

  it('drops a honeypot submission without creating anything or erroring', async () => {
    const { create, service } = setup();
    await expect(service.submit({ ...dto, website: 'http://spam.example' })).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });
});
