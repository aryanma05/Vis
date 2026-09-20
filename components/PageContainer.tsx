import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <section
      className={`mx-auto max-w-5xl px-6 py-12 ${className ?? ""}`}
    >
      {children}
    </section>
  );
}