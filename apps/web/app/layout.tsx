import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

// Display: a characterful grotesque for headlines and big COP figures.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Body/UI: friendly geometric sans — the delivery-app workhorse.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Data: precise mono for axis labels, timestamps and tiny metrics.
const dmMono = DM_Mono({
  variable: "--font-dmmono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Rappi Ops — Bono dinámico por lluvia",
  description:
    "Cálculo dinámico del bono por entrega para Rappiteneros según el forecast de lluvia por zona.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${bricolage.variable} ${jakarta.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
