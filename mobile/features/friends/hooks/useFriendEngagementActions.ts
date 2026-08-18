import type { FriendEngagementContext } from "./friendEngagementTypes";
import { useFriendBuddyActions } from "./useFriendBuddyActions";
import { useFriendMomentumActions } from "./useFriendMomentumActions";
import { useFriendReactionActions } from "./useFriendReactionActions";

export function useFriendEngagementActions(context: FriendEngagementContext) {
  const buddyActions = useFriendBuddyActions(context);
  const momentumActions = useFriendMomentumActions(context);
  const reactionActions = useFriendReactionActions(context);

  return {
    ...momentumActions,
    ...buddyActions,
    ...reactionActions,
  };
}
