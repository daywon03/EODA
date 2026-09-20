import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({ getEnv: vi.fn() }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { describeImage } = await import("./image-vision-service");
const { getEnv } = await import("@/lib/config/env");
type AppEnv = ReturnType<typeof getEnv>;

function mockEnv(openrouter: AppEnv["openrouter"]): void {
  vi.mocked(getEnv).mockReturnValue({ openrouter } as AppEnv);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv({ apiKey: "test-key" });
});

describe("describeImage", () => {
  it("rend la description produite par le modèle", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Un organigramme montrant..." } }] }),
    });

    const result = await describeImage({ buffer: Buffer.from("fake-png"), contentType: "image/png" });

    expect(result).toBe("Un organigramme montrant...");
  });

  it("rend null sans lever d'exception si l'appel échoue", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await describeImage({ buffer: Buffer.from("fake-png"), contentType: "image/png" });

    expect(result).toBeNull();
  });

  it("rend null si la clé API est absente, sans appeler fetch", async () => {
    mockEnv(null);

    const result = await describeImage({ buffer: Buffer.from("fake-png"), contentType: "image/png" });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
