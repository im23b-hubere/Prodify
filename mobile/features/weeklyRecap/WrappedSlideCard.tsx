import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import type { WrappedSlide } from "./wrappedSlides";
import { styles } from "./WeeklyWrappedViewer.styles";

export function WrappedSlideCard({
  slide,
  width,
  height,
}: {
  slide: WrappedSlide;
  width: number;
  height: number;
}) {
  const isNumericStat = slide.kind === "stat" || slide.kind === "intro";

  return (
    <LinearGradient
      colors={slide.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.slide, { width, minHeight: height }]}
    >
      <View style={styles.slideInner}>
        {slide.kicker ? <Text style={styles.kicker}>{slide.kicker}</Text> : null}
        <Text
          style={[
            styles.title,
            slide.kind === "intro" && styles.titleIntro,
            slide.kind === "stat" && styles.titleStat,
            slide.kind === "label" && styles.titleLabel,
            slide.kind === "quote" && styles.titleQuote,
            slide.kind === "outro" && styles.titleOutro,
            slide.kind === "empty" && styles.titleEmpty,
          ]}
          numberOfLines={slide.kind === "quote" ? 8 : slide.kind === "label" ? 2 : 3}
          adjustsFontSizeToFit={slide.kind === "label"}
          minimumFontScale={slide.kind === "label" ? 0.55 : undefined}
        >
          {slide.title}
        </Text>
        {slide.subtitle ? (
          <Text
            style={[styles.subtitle, isNumericStat && styles.subtitleStat]}
            numberOfLines={slide.kind === "quote" ? 2 : 3}
          >
            {slide.subtitle}
          </Text>
        ) : null}
        {slide.footnote ? (
          <Text style={styles.footnote} numberOfLines={3}>
            {slide.footnote}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}
