import { retryRead, TimeoutError, withTimeout } from './timeout.js';

describe('withTimeout', () => {
  it('passes the result through when the call is fast', async () => {
    await expect(withTimeout(Promise.resolve(7), 50, 'fast')).resolves.toBe(7);
  });

  it('rejects with a TimeoutError naming the call when it is slow', async () => {
    const slow = new Promise((r) => setTimeout(r, 200));
    await expect(withTimeout(slow, 20, 'Razorpay refund')).rejects.toMatchObject({ name: 'TimeoutError', what: 'Razorpay refund', ms: 20 });
    await expect(withTimeout(slow, 20, 'x')).rejects.toBeInstanceOf(TimeoutError);
  });

  it('keeps the original error when the call fails before the deadline', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50, 'x')).rejects.toThrow('boom');
  });
});

describe('retryRead', () => {
  it('retries a failing read and returns the first success', async () => {
    let calls = 0;
    const result = await retryRead(() => (++calls < 3 ? Promise.reject(new Error('flaky')) : Promise.resolve('ok')), { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after the bounded number of tries with the last error', async () => {
    let calls = 0;
    await expect(retryRead(() => Promise.reject(new Error(`fail ${++calls}`)), { tries: 2, baseDelayMs: 1 })).rejects.toThrow('fail 2');
    expect(calls).toBe(2);
  });
});
