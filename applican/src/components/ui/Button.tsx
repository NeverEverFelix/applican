import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "link";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClassNames: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  link: styles.link,
};

export default function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...rest
}: ButtonProps) {
  const combinedClassName = `${styles.button} ${variantClassNames[variant]} ${className}`.trim();

  return (
    <button type={type} className={combinedClassName} {...rest}>
      {children}
    </button>
  );
}

