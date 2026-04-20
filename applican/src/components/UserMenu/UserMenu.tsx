import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { usePostHog } from "@posthog/react";
import gsap from "gsap";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./UserMenu.module.css";
import type { UserInfo } from "../types";
import IlluminateText from "../../effects/illuminate-text";

type UserMenuProps = {
  user: UserInfo;
  onSignOut: () => void;
  onUpgrade: () => Promise<void>;
  onBilling: () => Promise<void>;
  onProfileSelect?: () => void;
  onHistorySelect?: () => void;
  isSigningOut?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function UserMenu({
  user,
  onSignOut,
  onUpgrade,
  onBilling,
  onProfileSelect,
  onHistorySelect,
  isSigningOut = false,
  open,
  onOpenChange,
}: UserMenuProps) {
  const posthog = usePostHog();
  const [isBillingActionPending, setIsBillingActionPending] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const menuContentRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedAnimation = useRef(false);
  const initial = user.name.trim().charAt(0) || "?";
  const userPlan = typeof user.plan === "string" ? user.plan.trim().toLowerCase() : "";
  const isMenuOpen = open ?? internalOpen;
  const shouldShowUpgrade = userPlan !== "pro";
  const menuItems = shouldShowUpgrade
    ? (["Profile", "Upgrade", "History", "Sign out"] as const)
    : (["Profile", "Billing", "History", "Sign out"] as const);
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
    onProfileSelect?.();
  };
  const handleHistorySelect = () => {
    posthog?.capture("history_menu_clicked", {
      source: "user_menu_item",
    });
    onHistorySelect?.();
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

  useLayoutEffect(() => {
    const target = menuContentRef.current;
    if (!target) {
      return;
    }

    if (!hasInitializedAnimation.current) {
      gsap.set(target, {
        y: isMenuOpen ? 0 : -44,
        opacity: isMenuOpen ? 1 : 0,
        scale: isMenuOpen ? 1 : 0.9,
        filter: isMenuOpen ? "blur(0px)" : "blur(12px)",
        transformOrigin: "top right",
        pointerEvents: isMenuOpen ? "auto" : "none",
      });
      hasInitializedAnimation.current = true;
      return;
    }

    gsap.killTweensOf(target);

    if (isMenuOpen) {
      gsap.to(target, {
        duration: 1.2,
        ease: "elastic.out(1, 0.3)",
        y: 0,
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        pointerEvents: "auto",
        overwrite: "auto",
      });
      return;
    }

    gsap.to(target, {
      duration: 0.22,
      ease: "power2.in",
      y: -24,
      opacity: 0,
      scale: 0.95,
      filter: "blur(10px)",
      pointerEvents: "none",
      overwrite: "auto",
    });
  }, [isMenuOpen]);

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
          <div ref={menuContentRef} className={styles.menuContent}>
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
                      : item === "History"
                        ? handleHistorySelect
                      : item === "Billing"
                        ? handleBillingSelect
                        : item === "Upgrade"
                          ? handleBillingSelect
                          : undefined
                }
              >
                <button
                  type="button"
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
                </button>
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
