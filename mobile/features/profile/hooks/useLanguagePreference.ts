import { useCallback, useEffect, useRef, useState } from "react";

import { applyLanguagePreference } from "../../../lib/i18n";
import {
  loadLanguagePreference,
  type LanguagePreference,
} from "../../../lib/languagePreference";

/** Settings language choice: system locale or a pinned catalog language. */
export function useLanguagePreference() {
  const [preference, setPreference] = useState<LanguagePreference | undefined>(undefined);
  const applySequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void loadLanguagePreference().then((stored) => {
      if (cancelled) return;
      setPreference(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectPreference = useCallback(async (next: LanguagePreference) => {
    const sequence = ++applySequence.current;
    const previous = preference;
    setPreference(next);
    try {
      await applyLanguagePreference(next);
    } catch {
      if (sequence !== applySequence.current) return;
      setPreference(previous ?? (await loadLanguagePreference()));
    }
  }, [preference]);

  return {
    preference: preference ?? "system",
    ready: preference !== undefined,
    selectPreference,
  };
}
