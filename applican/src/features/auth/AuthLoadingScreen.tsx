import styles from "./AuthLoadingScreen.module.css";

export default function AuthLoadingScreen() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-label="Loading authentication">
      <div className={styles.spinner} />
    </div>
  );
}
