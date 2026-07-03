import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sites Rio — leads de estabelecimentos sem site no Rio de Janeiro",
  description:
    "Encontre estabelecimentos do Rio de Janeiro sem site próprio e venda seus serviços de criação de sites.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
