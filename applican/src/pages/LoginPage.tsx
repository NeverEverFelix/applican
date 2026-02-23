import styles from "./LoginPage.module.css";
import logo from "../assets/logo.png";
import googleIcon from "../assets/GoogleIcon.png";
import pageImage from "../assets/PageImage.png";
import { Link } from "react-router-dom";

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <form className={styles.form}>
        <div className={styles.header}>
          <img src={logo} alt="Logo" className={styles.logo} />
          <p className={styles.mainText}>Welcome Back</p>
          <p className={styles.subText}>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>

        <div className={styles.main}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            className={styles.email}
          />
          <button type="submit" className={styles.continue}>
            Continue
          </button>
        </div>

        <div className={styles.footer}>
          <p className={styles.orText}>OR</p>
          <button type="button" className={styles.AltLogin}>
            <img src={googleIcon} alt="Google" />
            <span>Sign in with Google</span>
          </button>
          <a href="/forgot-password" className={styles.forgotPassword}>
            Forgot password?
          </a>
        </div>
      </form>

      <div className={styles.assetContainer}>
        <img src={pageImage} alt="Page visual" />
      </div>
    </div>
  );
}
