import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TFunction } from "i18next";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { colors } from "../../constants/theme";
import { resolveCalendarWeeks, weekStripTitle, weekdayShortLabels } from "../../lib/streakCalendarWeeks";
import type { StreakCalendarWeekDto, StreakDayKind, StreakOverviewDto } from "../../types/streak";
import { styles } from "./DashboardStudioHud.styles";

const BAR_HEIGHT = {
  none: 6,
  freeze: 12,
  session: 22,
} as const;

export function DashboardWeekDots({
  overview,
  onOpenHistory,
  t,
}: {
  overview: StreakOverviewDto;
  onOpenHistory: () => void;
  t: TFunction;
}) {
  const weeks = useMemo(
    () => resolveCalendarWeeks(overview, [], weekdayShortLabels(t)),
    [overview, t],
  );
  if (weeks.length === 0) return null;

  return (
    <WeekStripPager weeks={weeks} onOpenHistory={onOpenHistory} t={t} />
  );
}

function WeekStripPager({
  weeks,
  onOpenHistory,
  t,
}: {
  weeks: StreakCalendarWeekDto[];
  onOpenHistory: () => void;
  t: TFunction;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const currentIndex = weeks.findIndex((week) => week.offset === 0);
  const startIndex = currentIndex >= 0 ? currentIndex : weeks.length - 1;
  const [pageIndex, setPageIndex] = useState(startIndex);
  const didCenter = useRef(false);

  useEffect(() => {
    if (pageWidth <= 0 || didCenter.current) return;
    didCenter.current = true;
    scrollRef.current?.scrollTo({ x: pageWidth * startIndex, animated: false });
  }, [pageWidth, startIndex]);

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      setPageIndex(Math.max(0, Math.min(weeks.length - 1, next)));
    },
    [pageWidth, weeks.length],
  );

  const openHistory = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onOpenHistory();
  };

  const visibleWeek = weeks[pageIndex] ?? weeks[startIndex];

  return (
    <View
      testID="dashboard-week-strip"
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        if (width > 0 && width !== pageWidth) setPageWidth(width);
      }}
    >
      <View style={styles.weekStripHeader}>
        <Text style={styles.weekStripTitle} numberOfLines={1}>
          {visibleWeek ? weekStripTitle(visibleWeek, t) : t("dashboard.weekStripThisWeek")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("streakHero.historyA11y")}
          onPress={openHistory}
          hitSlop={10}
          style={({ pressed }) => [styles.weekStripHistory, pressed && { opacity: 0.85 }]}
        >
          <ChevronRight color={colors.textSecondary} size={16} />
        </Pressable>
      </View>
      {pageWidth > 0 ? (
        <ScrollView
          ref={scrollRef}
          testID="dashboard-week-pager"
          accessibilityLabel={t("dashboard.weekStripPagerA11y")}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          keyboardShouldPersistTaps="handled"
        >
          {weeks.map((week) => (
            <WeekPage key={week.week_start} week={week} width={pageWidth} />
          ))}
        </ScrollView>
      ) : (
        <WeekPage week={visibleWeek ?? weeks[0]} width={undefined} />
      )}
      {weeks.length > 1 ? (
        <View style={styles.weekStripDots} accessibilityElementsHidden>
          {weeks.map((week, index) => (
            <View
              key={`dot-${week.week_start}`}
              style={[styles.weekStripDot, index === pageIndex && styles.weekStripDotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function WeekPage({ week, width }: { week: StreakCalendarWeekDto; width?: number }) {
  return (
    <View
      testID={`dashboard-week-page-${week.offset}`}
      style={[styles.weekDots, width != null && { width }]}
    >
      {week.days.map((day) => (
        <WeekDayColumn
          key={day.date}
          label={day.label}
          kind={day.state}
          isToday={day.is_today}
          isFuture={day.is_future}
        />
      ))}
    </View>
  );
}

function WeekDayColumn({
  label,
  kind,
  isToday,
  isFuture,
}: {
  label: string;
  kind: StreakDayKind;
  isToday: boolean;
  isFuture: boolean;
}) {
  return (
    <View style={[styles.dayColumn, isFuture && styles.dayColumnFuture]}>
      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label.slice(0, 2)}</Text>
      <View style={[styles.weekBarTrack, isToday && styles.weekBarTrackToday]}>
        <View
          style={[
            styles.weekBarFill,
            { height: BAR_HEIGHT[kind] },
            kind === "session" && styles.weekBarSession,
            kind === "freeze" && styles.weekBarFreeze,
          ]}
        />
      </View>
    </View>
  );
}
