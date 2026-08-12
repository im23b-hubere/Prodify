import { FriendsScreenView } from "../../features/friends/components/FriendsScreenView";
import { useFriendsScreenController } from "../../features/friends/hooks/useFriendsScreenController";

export default function FriendsScreen() {
  return <FriendsScreenView controller={useFriendsScreenController()} />;
}
