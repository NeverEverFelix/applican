import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import styles from "./UserMenu.module.css";
import type { UserInfo } from "../types";

type UserMenuProps = {
  user: UserInfo;
  onSignOut: () => void;
  isSigningOut?: boolean;
};

export default function UserMenu({ user, onSignOut, isSigningOut = false }: UserMenuProps) {
  const initial = user.name.trim().charAt(0) || "?";
  const menuItems = ["Profile", "Billing", "History", "Settings", "Sign out"] as const;
  const triggerSentryTestError = () => {
    throw new Error("This is your first error!");
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.triggerButton} aria-label="Open user menu">
          <span className={styles.initialBadge}>{initial}</span>
          <p className={styles.userName}>{user.name}</p>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menuContent} sideOffset={0} align="start">
          {menuItems.map((item) => (
            <DropdownMenu.Item
              key={item}
              className={item === "Sign out" ? `${styles.menuItem} ${styles.signOutItem}` : styles.menuItem}
              disabled={item === "Sign out" && isSigningOut}
              onSelect={
                item === "Sign out"
                  ? onSignOut
                  : item === "Billing"
                    ? triggerSentryTestError
                    : undefined
              }
            >
              {item === "Sign out" && isSigningOut ? "Signing out..." : item}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
