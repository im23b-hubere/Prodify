import { ProfileScreenView } from "../../features/profile/components/ProfileScreenView";
import { useProfileScreenController } from "../../features/profile/hooks/useProfileScreenController";

export default function ProfileScreen() {
  return <ProfileScreenView controller={useProfileScreenController()} />;
}
