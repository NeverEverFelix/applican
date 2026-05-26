import type { LabelHTMLAttributes, ReactNode } from "react";
import styles from "./Label.module.css";

type LabelProps = {
  children: ReactNode;
} & LabelHTMLAttributes<HTMLLabelElement>;

export default function Label({ children, className = "", ...rest }: LabelProps) {
  const combinedClassName = `${styles.label} ${className}`.trim();
  return (
    <label className={combinedClassName} {...rest}>
      {children}
    </label>
  );
}

