import type { ReactNode } from "react";
import "./globals.css";
export const metadata = {
  title: "Provenance — Verifiable process rewards",
  description:
    "Sepolia agent fund, process rewards, and reproducibility evidence.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
