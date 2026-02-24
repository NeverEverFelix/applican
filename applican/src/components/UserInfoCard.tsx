import styles from "./UserInfo.module.css";
import type { UserInfo } from "./types";

type UserInfoCardProps = {
  user: UserInfo;
};

export default function UserInfoCard({ user }: UserInfoCardProps) {
  const initial = user.name.trim().charAt(0) || "?";

  return (
    <div className={styles.userInfoCard}>
      <span className={styles.initialBadge}>{initial}</span>
      <p className={styles.userName}>{user.name}</p>
    </div>
  );
}
