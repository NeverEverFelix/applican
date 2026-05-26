import type { ReactNode } from "react";

type FieldMessageProps = {
  children: ReactNode;
  className?: string;
};

export default function FieldMessage({ children, className = "" }: FieldMessageProps) {
  return <p className={className}>{children}</p>;
}

