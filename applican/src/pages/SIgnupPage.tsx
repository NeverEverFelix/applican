import styles from "./SignupPage.module.css";
import logo from "../assets/logo.png";
import googleIcon from "../assets/GoogleIcon.png";
import pageImage from "../assets/PageImage.png";
import SignupForm from "../features/auth/SignupForm";
import { useSignupFlow } from "../features/auth/useSignupFlow";

export default function SignupPage() {
  const flow = useSignupFlow();

  return (
    <div className={styles.container}>
      <div className={styles.assetContainer}>
        <img src={pageImage} alt="Page visual" />
      </div>

      <SignupForm flow={flow} logoSrc={logo} googleIconSrc={googleIcon} />
    </div>
  );
}
