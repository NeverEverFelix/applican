import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { usePostHog } from "@posthog/react";
import { useState } from "react";
import { motion } from "framer-motion";
import styles from "./UserMenu.module.css";
import type { UserInfo } from "../types";
import IlluminateText from "../../effects/illuminate-text";
import { dropdownItemVariants, dropdownVariants } from "../../effects/spring";

type UserMenuProps = {
  user: UserInfo;
  onSignOut: () => void;
  onUpgrade: () => Promise<void>;
  onBilling: () => Promise<void>;
  isSigningOut?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function UserMenu({
  user,
  onSignOut,
  onUpgrade,
  onBilling,
  isSigningOut = false,
  open,
  onOpenChange,
}: UserMenuProps) {
  const posthog = usePostHog();
  const [isBillingActionPending, setIsBillingActionPending] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const initial = user.name.trim().charAt(0) || "?";
  const userPlan = typeof user.plan === "string" ? user.plan.trim().toLowerCase() : "";
  const isMenuOpen = open ?? internalOpen;
  const shouldShowUpgrade = userPlan !== "pro";
  const menuItems = shouldShowUpgrade
    ? (["Profile", "Upgrade", "History", "Settings", "Sign out"] as const)
    : (["Profile", "Billing", "History", "Settings", "Sign out"] as const);
  const handleOpenChange = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    if (nextOpen) {
      posthog?.capture("user_menu_opened", {
        source: "profile_button",
      });
    }
    onOpenChange?.(nextOpen);
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
    <DropdownMenu.Root open={isMenuOpen} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.triggerButton} aria-label="Open user menu">
          <span className={styles.initialBadge}>{initial}</span>
          <p className={styles.userName}>{user.name}</p>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content asChild sideOffset={-56} align="start" forceMount>
          <motion.div
            className={styles.menuContent}
            variants={dropdownVariants}
            initial={false}
            animate={isMenuOpen ? "open" : "closed"}
          >
          <div className={styles.menuHeader} aria-hidden="true">
            <span className={styles.initialBadge}>{initial}</span>
            <p className={styles.userName}>{user.name}</p>
          </div>
          {menuItems.map((item) => (
            <DropdownMenu.Item
              asChild
              key={item}
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
              <motion.button
                type="button"
                variants={dropdownItemVariants}
                className={
                  item === "Sign out"
                    ? `${styles.menuItem} ${styles.signOutItem}`
                    : item === "Upgrade"
                      ? `${styles.menuItem} ${styles.upgradeItem}`
                      : styles.menuItem
                }
              >
                {item === "Sign out" && isSigningOut ? (
                  "Signing out..."
                ) : (item === "Upgrade" || item === "Billing") && isBillingActionPending ? (
                  "Opening..."
                ) : item === "Upgrade" || item === "Billing" ? (
                  <IlluminateText
                    text={item}
                    as="span"
                    dimColor="#5f3b8f"
                    glowColor="#b47cff"
                  />
                ) : (
                  item
                )}
              </motion.button>
            </DropdownMenu.Item>
          ))}
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
