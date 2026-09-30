import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshSession } from "./http";

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
