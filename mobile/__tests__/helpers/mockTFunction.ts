import type { TFunction } from "i18next";

/** Typed i18n mock for unit tests (avoids `$TFunctionBrand` assignment errors). */
export function mockTFunction(
  impl: (key: string, options?: Record<string, unknown>) => string = (key) => key,
): TFunction {
  return impl as TFunction;
}
