import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/** True while this screen is the visible one; false while another screen covers it. */
export function useIsScreenFocused() {
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );
  return isFocused;
}
