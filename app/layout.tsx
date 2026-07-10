import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Dotia — Dotación inteligente para faenas",
  description: "Gestión de dotación de personas en faenas mineras y constructivas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: extensiones del navegador (p. ej. Chrome Remote
    // Desktop) inyectan atributos en <html> antes de que React hidrate
    <html lang="es" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="h-full">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
