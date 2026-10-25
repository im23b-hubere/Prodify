import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import { colors } from "../../../constants/theme";
import { useLaunchPhase } from "../../../lib/launch";

/** The native player can already be released when the pager unmounts. */
function safePause(player: { pause: () => void }) {
  try {
    player.pause();
  } catch {
    // Already gone.
  }
}

/**
 * A silent looping app recording. It plays only while its slide is on screen and starts
 * over each time the slide comes back, so the walkthrough is always seen from the top.
 * On a cold start it waits for the launch logo to clear, so the opening isn't played
 * behind it.
 */
export function OnboardingVideo({ source, active }: { source: number; active: boolean }) {
  const launched = useLaunchPhase() === "done";
  const playing = active && launched;
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    if (!playing) {
      safePause(player);
      return;
    }
    player.currentTime = 0;
    player.play();
    return () => safePause(player);
  }, [playing, player]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls={false}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  video: { width: "100%", height: "100%", backgroundColor: colors.background },
});
