import type { TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

type TextareaProps = {
  invalid?: boolean;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Textarea({ className = "", invalid = false, ...rest }: TextareaProps) {
  const invalidClassName = invalid ? styles.invalid : "";
  const combinedClassName = `${styles.textarea} ${invalidClassName} ${className}`.trim();
  return <textarea className={combinedClassName} aria-invalid={invalid || undefined} {...rest} />;
}

