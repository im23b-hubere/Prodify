import { apiErrorFromResponse, readResponsePayload } from "../../lib/apiResponse";

function response(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("API response decoding", () => {
  it("decodes JSON and empty response bodies", async () => {
    await expect(readResponsePayload(response(200, '{"ok":true}'))).resolves.toEqual({ ok: true });
    await expect(readResponsePayload(response(204, ""))).resolves.toBeNull();
  });

  it("preserves non-JSON response text", async () => {
    await expect(readResponsePayload(response(502, "upstream failed"))).resolves.toBe(
      "upstream failed",
    );
  });

  it("prefers the structured backend error message", () => {
    const error = apiErrorFromResponse(response(401, ""), {
      error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" },
      detail: "fallback",
    });

    expect(error).toMatchObject({
      status: 401,
      message: "Invalid credentials",
      code: "INVALID_CREDENTIALS",
    });
  });

  it("falls back to FastAPI validation details", () => {
    const error = apiErrorFromResponse(response(422, ""), {
      detail: [{ loc: ["body", "username"], msg: "Username is required" }],
    });

    expect(error).toMatchObject({ status: 422, message: "Username is required" });
  });
});
