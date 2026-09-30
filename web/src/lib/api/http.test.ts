import { afterEach, describe, expect, it, vi } from "vitest";
import { http, refreshSession } from "./http";

const reply = (status: number) => new Response(status === 409 ? JSON.stringify({ code: "REFRESH_RACE" }) : "{}", { status });

describe("refreshSession", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is true when the refresh works", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200)));
    expect(await refreshSession()).toBe(true);
  });

  it("is false when the session is gone (401), without a retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(401));
    vi.stubGlobal("fetch", fetchMock);
    expect(await refreshSession()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("after losing a race to another tab (409) it tries once more, and succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(409)).mockResolvedValueOnce(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    expect(await refreshSession()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still busy after the retry is not a sign-out: the caller's own retry decides", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(409)));
    expect(await refreshSession()).toBe(true);
  });

  it("shares one request between concurrent callers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("http reads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries a GET once after a network failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(json({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = http("/retry-network");
    await vi.advanceTimersByTimeAsync(600);
    expect(await result).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a GET once after a 503, then reports the second answer", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(json({ message: "busy" }, 503));
    vi.stubGlobal("fetch", fetchMock);
    const result = http("/retry-503").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(600);
    expect(await result).toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ message: "busy" }, 503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(http("/orders", { method: "POST", body: {} })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 4xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ message: "nope" }, 404));
    vi.stubGlobal("fetch", fetchMock);
    await expect(http("/missing")).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns a hung request into a timeout error, without a retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(http("/hung")).rejects.toMatchObject({ status: 0, code: "TIMEOUT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes an abort signal to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal("fetch", fetchMock);
    await http("/signal");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("shares one request between concurrent identical GETs, each caller with its own copy", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({ items: [1] }));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([http<{ items: number[] }>("/shared"), http<{ items: number[] }>("/shared")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    a.items.push(2);
    expect(b.items).toEqual([1]);
  });

  it("does not share requests with different queries", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({}));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([http("/list", { query: { page: 1 } }), http("/list", { query: { page: 2 } })]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a read after a write starts a fresh request instead of joining a stale one", async () => {
    let release: (r: Response) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (release = r)))
      .mockImplementation(async () => json({ v: "fresh" }));
    vi.stubGlobal("fetch", fetchMock);
    const stale = http("/cart");
    await http("/cart/items", { method: "POST", body: {} });
    const fresh = await http("/cart");
    expect(fresh).toEqual({ v: "fresh" });
    release(json({ v: "stale" }));
    await stale;
  });
});
