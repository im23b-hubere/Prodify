import { useMemo } from "react";
import { View } from "react-native";

import type { FriendsOverviewProps } from "../../components/FriendsOverviewSection";
import { friendsRankingStyles as styles } from "../../styles/friendsRanking.styles";
import { yourStanding } from "../friendsRanking";
import { RankingSection } from "./RankingSection";
import { WeekHeroCard } from "./WeekHeroCard";

export function FriendsStandingSection({ props }: { props: FriendsOverviewProps }) {
  const standing = useMemo(
    () => yourStanding(props.entries, props.currentUserId),
    [props.currentUserId, props.entries],
  );
  return (
    <View style={styles.standing}>
      {standing ? (
        <WeekHeroCard
          t={props.t}
          standing={standing}
          period={props.mode}
          onStartSession={props.onStartSession}
        />
      ) : null}
      <RankingSection
        t={props.t}
        entries={props.entries}
        currentUserId={props.currentUserId}
        period={props.mode}
        onChangePeriod={props.setMode}
        onOpenProfile={props.onOpenProfile}
      />
    </View>
  );
}
