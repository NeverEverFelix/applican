import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { usePostHog } from "@posthog/react";
import { useState } from "react";
import styles from "./UserMenu.module.css";
import type { UserInfo } from "../types";

type UserMenuProps = {
  user: UserInfo;
  onSignOut: () => void;
  onUpgrade: () => Promise<void>;
  onBilling: () => Promise<void>;
  isSigningOut?: boolean;
};

export default function UserMenu({ user, onSignOut, onUpgrade, onBilling, isSigningOut = false }: UserMenuProps) {
  const posthog = usePostHog();
  const [isBillingActionPending, setIsBillingActionPending] = useState(false);
  const initial = user.name.trim().charAt(0) || "?";
  const userPlan = typeof user.plan === "string" ? user.plan.trim().toLowerCase() : "";
  const shouldShowUpgrade = userPlan !== "pro";
  const menuItems = shouldShowUpgrade
    ? (["Profile", "Upgrade", "History", "Settings", "Sign out"] as const)
    : (["Profile", "Billing", "History", "Settings", "Sign out"] as const);
  const handleOpenUserMenu = () => {
    posthog?.capture("user_menu_opened", {
      source: "profile_button",
    });
  };
  const handleProfileSelect = () => {
    posthog?.capture("profile_button_clicked", {
      source: "user_menu_item",
    });
  };
  const handleBillingSelect = () => {
    if (isBillingActionPending) {
      return;
    }

    setIsBillingActionPending(true);
    if (shouldShowUpgrade) {
      posthog?.capture("checkout_clicked", { source: "user_menu_upgrade" });
      void onUpgrade()
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Failed to open checkout.";
          posthog?.capture("checkout_open_failed", { message });
          window.alert(message);
        })
        .finally(() => {
          setIsBillingActionPending(false);
        });
      return;
    }

    posthog?.capture("billing_portal_clicked", { source: "user_menu_billing" });
    void onBilling()
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to open billing portal.";
        posthog?.capture("billing_portal_open_failed", { message });
        window.alert(message);
      })
      .finally(() => {
        setIsBillingActionPending(false);
      });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.triggerButton} aria-label="Open user menu" onClick={handleOpenUserMenu}>
          <span className={styles.initialBadge}>{initial}</span>
          <p className={styles.userName}>{user.name}</p>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menuContent} sideOffset={0} align="start">
          {menuItems.map((item) => (
            <DropdownMenu.Item
              key={item}
              className={
                item === "Sign out"
                  ? `${styles.menuItem} ${styles.signOutItem}`
                  : item === "Upgrade"
                    ? `${styles.menuItem} ${styles.upgradeItem}`
                    : styles.menuItem
              }
              disabled={item === "Sign out" ? isSigningOut : item === "Upgrade" || item === "Billing" ? isBillingActionPending : false}
              onSelect={
                item === "Sign out"
                  ? onSignOut
                  : item === "Profile"
                    ? handleProfileSelect
                  : item === "Billing"
                    ? handleBillingSelect
                    : item === "Upgrade"
                      ? handleBillingSelect
                    : undefined
              }
            >
              {item === "Sign out" && isSigningOut
                ? "Signing out..."
                : (item === "Upgrade" || item === "Billing") && isBillingActionPending
                  ? "Opening..."
                  : item}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
