import type { ReactNode } from "react";
import FieldMessage from "./FieldMessage";

type FormFieldProps = {
  children: ReactNode;
  className?: string;
  errorMessage?: string;
  errorClassName?: string;
  successMessage?: string;
  successClassName?: string;
};

export default function FormField({
  children,
  className = "",
  errorMessage,
  errorClassName = "",
  successMessage,
  successClassName = "",
}: FormFieldProps) {
  return (
    <div className={className}>
      {children}
      {successMessage ? (
        <FieldMessage className={successClassName}>{successMessage}</FieldMessage>
      ) : null}
      {errorMessage ? <FieldMessage className={errorClassName}>{errorMessage}</FieldMessage> : null}
    </div>
  );
}

