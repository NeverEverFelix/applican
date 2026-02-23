import styles from "./SignupPage.module.css";
import logo from "../assets/logo.png";
import googleIcon from "../assets/GoogleIcon.png";
import pageImage from "../assets/PageImage.png";

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <div className={styles.assetContainer}>
        <img src={pageImage} alt="Page visual" />
      </div>

      <form className={styles.form}>
        <div className={styles.header}>
          <img src={logo} alt="Logo" className={styles.logo} />
          <p className={styles.mainText}>Create An Account</p>
          <p className={styles.subText}>
            Join hundreds of others speeding up their job search using Applican.
          </p>
        </div>

        <div className={styles.main}>
          <div className={styles.inputGroup}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="email"
              className={styles.email}
            />

            <input
              type="text"
              name="name"
              placeholder="Full Name"
              autoComplete="name"
              className={styles.name}
            />

            <input
              type="text"
              name="jobrole"
              placeholder="Job role"
              autoComplete="organization-title"
              className={styles.jobrole}
            />
          </div>

          <button type="submit" className={styles.continue}>
            Sign Up
          </button>
        </div>

        <div className={styles.footer}>
          <p className={styles.orText}>OR</p>
          <button type="button" className={styles.AltLogin}>
            <img src={googleIcon} alt="Google" />
            <span>Continue with Google</span>
          </button>
        </div>
      </form>
    </div>
  );
}
