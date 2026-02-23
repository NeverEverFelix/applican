import styles from "./LoginPage.module.css";
import pageImage from "../assets/PageImage.png";
import logo from "../assets/logo.png";
import googleIcon from "../assets/GoogleIcon.png";
import LoginForm from "../features/auth/LoginForm";
import { useLoginFlow } from "../features/auth/useLoginFlow";

export default function LoginPage() {
  const flow = useLoginFlow();

  return (
    <div className={styles.container}>
      <LoginForm flow={flow} logoSrc={logo} googleIconSrc={googleIcon} />

      <div className={styles.assetContainer}>
        <img src={pageImage} alt="Page visual" />
      </div>
    </div>
  );
}
