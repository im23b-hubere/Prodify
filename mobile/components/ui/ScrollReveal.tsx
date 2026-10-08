import { createContext, type RefObject, useCallback, useContext, useMemo, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

/** Long enough for an animated scrollTo to settle before anything is measured again. */
const REVEAL_SCROLL_MS = 320;

/** Scrolls the page down by `pixels` and resolves once the scroll has settled. */
type Reveal = (pixels: number) => Promise<void>;

const ScrollRevealContext = createContext<Reveal | null>(null);

export const ScrollRevealProvider = ScrollRevealContext.Provider;

/** The enclosing page's reveal, or null outside a page that offers one. */
export function useScrollReveal() {
  return useContext(ScrollRevealContext);
}

/**
 * Lets content inside a ScrollView ask for room below itself, such as a menu that should open
 * in full. Pass `onScroll` to the ScrollView and `reveal` to a ScrollRevealProvider.
 */
export function useScrollRevealSource(scrollRef: RefObject<ScrollView | null>) {
  const offset = useRef(0);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);
  const reveal = useCallback<Reveal>(
    (pixels) =>
      new Promise((resolve) => {
        scrollRef.current?.scrollTo({ y: offset.current + pixels, animated: true });
        setTimeout(resolve, REVEAL_SCROLL_MS);
      }),
    [scrollRef],
  );
  return useMemo(() => ({ onScroll, reveal }), [onScroll, reveal]);
}
