import type { TFunction } from "i18next";
import { Text, View } from "react-native";

import {
  type ComparableStats,
  type HeadToHeadRow,
  headToHeadRows,
  headToHeadVerdict,
} from "../friendProfilePresentation";
import { friendProfileStyles as styles } from "../friendProfile.styles";

type Props = {
  you: ComparableStats;
  them: ComparableStats;
  friendName: string;
  t: TFunction;
};

function formatMetricValue(row: HeadToHeadRow, value: number, t: TFunction): string {
  if (row.metric === "hours") return t("friendProfile.hoursValue", { hours: value });
  if (row.metric === "streak") return t("friendProfile.daysShort", { count: value });
  return String(value);
}

function SplitBar({ yours, theirs }: { yours: number; theirs: number }) {
  if (yours + theirs <= 0) {
    return (
      <View style={styles.versusTrack}>
        <View style={styles.versusBarEmpty} />
      </View>
    );
  }
  return (
    <View style={styles.versusTrack}>
      {yours > 0 ? <View style={[styles.versusBarYou, { flex: yours }]} /> : null}
      {theirs > 0 ? <View style={[styles.versusBarThem, { flex: theirs }]} /> : null}
    </View>
  );
}

function VersusRow({ row, t }: { row: HeadToHeadRow; t: TFunction }) {
  const yours = formatMetricValue(row, row.yours, t);
  const theirs = formatMetricValue(row, row.theirs, t);
  const metric = t(`friendProfile.versusMetric.${row.metric}`);
  return (
    <View
      style={styles.versusRow}
      accessible
      accessibilityLabel={t("friendProfile.versusRowA11y", { metric, yours, theirs })}
    >
      <View style={styles.versusValues}>
        <Text style={[styles.versusValue, row.leader === "you" && styles.versusValueLead]}>{yours}</Text>
        <Text style={styles.versusMetric}>{metric}</Text>
        <Text
          style={[
            styles.versusValue,
            styles.versusValueEnd,
            row.leader === "them" && styles.versusValueLead,
          ]}
        >
          {theirs}
        </Text>
      </View>
      <SplitBar yours={row.yours} theirs={row.theirs} />
    </View>
  );
}

export function HeadToHeadCard({ you, them, friendName, t }: Props) {
  const rows = headToHeadRows(you, them);
  const verdict = headToHeadVerdict(rows);
  return (
    <View style={styles.section} testID="friend-profile-head-to-head">
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t("friendProfile.headToHeadTitle")}
      </Text>
      <View style={styles.card}>
        <View style={styles.versusHeader}>
          <Text style={styles.versusName}>{t("friendProfile.versusYou")}</Text>
          <Text style={[styles.versusName, styles.versusNameEnd]} numberOfLines={1}>
            {friendName}
          </Text>
        </View>
        {rows.map((row) => (
          <VersusRow key={row.metric} row={row} t={t} />
        ))}
        <Text style={styles.verdict}>
          {t(`friendProfile.verdict.${verdict}`, { name: friendName })}
        </Text>
      </View>
    </View>
  );
}
