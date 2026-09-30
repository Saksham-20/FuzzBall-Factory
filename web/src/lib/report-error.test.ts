import { afterEach, describe, expect, it, vi } from "vitest";

describe("reportClientError", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function load(useMock: boolean) {
    vi.resetModules();
    vi.doMock("@/lib/site", () => ({ SITE: { useMock } }));
    return (await import("./report-error")).reportClientError;
  }

  it("sends the message, digest, path and kind, never a stack", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { pathname: "/p/rosie-bear" } });
    const report = await load(false);
    const error = Object.assign(new Error("x".repeat(400)), { digest: "abc123" });
    report(error, "render");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/client-errors$/);
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ message: "x".repeat(300), digest: "abc123", path: "/p/rosie-bear", kind: "render" });
    expect(init).toMatchObject({ method: "POST", keepalive: true, credentials: "omit" });
  });

  it("stays silent in the sample shop and when the request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { pathname: "/" } });
    (await load(true))(new Error("boom"), "global");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(() => void (async () => (await load(false))(new Error("boom"), "global"))()).not.toThrow();
  });
});
