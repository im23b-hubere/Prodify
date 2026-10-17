import { useCallback, useEffect, useState } from "react";

import { applyLanguagePreference } from "../../../lib/i18n";
import {
  loadLanguagePreference,
  type LanguagePreference,
} from "../../../lib/languagePreference";

/** Settings language choice: system locale or a pinned catalog language. */
export function useLanguagePreference() {
  const [preference, setPreference] = useState<LanguagePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLanguagePreference().then((stored) => {
      if (cancelled) return;
      setPreference(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectPreference = useCallback(async (next: LanguagePreference) => {
    setPreference(next);
    await applyLanguagePreference(next);
  }, []);

  return { preference, ready, selectPreference };
}
