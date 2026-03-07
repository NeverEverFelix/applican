import { useState } from "react";

export function useUpgradeGate() {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const openUpgradeModal = () => {
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModalAndOpenMenu = () => {
    setIsUpgradeModalOpen(false);
    window.setTimeout(() => {
      setIsUserMenuOpen(true);
    }, 500);
  };

  return {
    isUpgradeModalOpen,
    isUserMenuOpen,
    setIsUserMenuOpen,
    openUpgradeModal,
    closeUpgradeModalAndOpenMenu,
  };
}
