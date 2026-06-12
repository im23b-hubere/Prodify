import {
  clearLevelCatalogCache,
  fetchLevelCatalog,
  parseLevelCatalog,
} from "../../lib/progressionLevelCatalog";
import { apiJson } from "../../lib/client";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

describe("progressionLevelCatalog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLevelCatalogCache();
  });

  it("parses level rows", () => {
    const rows = parseLevelCatalog([
      { level: 1, xp_start: 0, xp_end_exclusive: 50, xp_span: 50 },
      { level: 2, xp_start: 50, xp_end_exclusive: 200, xp_span: 150 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.level).toBe(1);
  });

  it("caches catalog responses", async () => {
    mockApiJson.mockResolvedValue([{ level: 1, xp_start: 0, xp_end_exclusive: 50, xp_span: 50 }]);

    await fetchLevelCatalog(20);
    await fetchLevelCatalog(20);

    expect(mockApiJson).toHaveBeenCalledTimes(1);
  });
});
