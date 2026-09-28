import { memo } from "react";
import { SvgXml } from "react-native-svg";

import { PROGRESSION_NAMED_LEVEL_MAX } from "../../lib/progressionLevels";
import { RANK_ART_XML } from "../../lib/rankArt.generated";

type Props = {
  level: number;
  size: number;
};

/** The rank's round medallion illustration. Levels past the named catalog reuse the top one. */
export const RankArt = memo(function RankArt({ level, size }: Props) {
  const safe = Math.min(PROGRESSION_NAMED_LEVEL_MAX, Math.max(1, Math.floor(level)));
  return <SvgXml xml={RANK_ART_XML[safe] ?? null} width={size} height={size} />;
});
