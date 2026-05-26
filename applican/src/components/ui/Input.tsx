import type { InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type InputProps = {
  invalid?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", invalid = false, ...rest }: InputProps) {
  const invalidClassName = invalid ? styles.invalid : "";
  const combinedClassName = `${styles.input} ${invalidClassName} ${className}`.trim();
  return <input className={combinedClassName} aria-invalid={invalid || undefined} {...rest} />;
}
