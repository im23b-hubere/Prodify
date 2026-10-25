import { ApiError } from "../../lib/apiErrors";
import {
  userFacingErrorMessage,
  userFacingErrorOrFallback,
} from "../../lib/userFacingErrorMessage";

const t = ((key: string) => `t:${key}`) as never;

describe("userFacingErrorMessage", () => {
  it("maps known ApiError codes through t()", () => {
    expect(
      userFacingErrorMessage(new ApiError(401, "bad", null, "invalid_credentials"), t, "common.tryAgain"),
    ).toBe("t:errors.auth.invalidCredentials");
  });

  it("translates the upper-case codes the server sends", () => {
    expect(
      userFacingErrorMessage(
        new ApiError(403, "This account has been suspended", null, "ACCOUNT_SUSPENDED"),
        t,
        "common.tryAgain",
      ),
    ).toBe("t:errors.auth.accountSuspended");
  });

  it("tells a producer who used every streak save this week without offering Premium", () => {
    expect(
      userFacingErrorMessage(
        new ApiError(
          409,
          "You've used all your streak saves for this week.",
          null,
          "RESCUE_LIMIT_REACHED",
        ),
        t,
        "dashboard.couldNotSendSupport",
      ),
    ).toBe("t:errors.rescueLimitReached");
  });

  it("explains in the producer's language when shared text uses forbidden language", () => {
    expect(
      userFacingErrorMessage(
        new ApiError(422, "This contains language that isn't allowed.", null, "CONTENT_REJECTED"),
        t,
        "common.tryAgain",
      ),
    ).toBe("t:errors.contentRejected");
  });

  it("explains in the producer's language when shared text uses forbidden language", () => {
    expect(
      userFacingErrorMessage(
        new ApiError(422, "This contains language that isn't allowed.", null, "CONTENT_REJECTED"),
        t,
        "common.tryAgain",
      ),
    ).toBe("t:errors.contentRejected");
  });

  it("uses the fallback when there is no usable message", () => {
    expect(userFacingErrorMessage(undefined, t, "dashboard.loadFailed")).toBe("t:dashboard.loadFailed");
    expect(userFacingErrorMessage(new Error(""), t, "common.tryAgain")).toBe("t:common.tryAgain");
  });

  it("keeps short English ApiError messages for product copy until coded", () => {
    expect(
      userFacingErrorMessage(new ApiError(400, "Friend request already sent"), t, "common.tryAgain"),
    ).toBe("Friend request already sent");
  });

  it("falls back for opaque payload dumps", () => {
    expect(
      userFacingErrorMessage(new ApiError(500, '{"detail":"boom"}'), t, "common.tryAgain"),
    ).toBe("t:common.tryAgain");
  });

  it("accepts a pre-translated fallback string", () => {
    expect(userFacingErrorOrFallback(undefined, "Could not load")).toBe("Could not load");
  });
});
