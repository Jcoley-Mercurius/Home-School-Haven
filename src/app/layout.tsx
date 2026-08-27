import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";

/* MDS §3: Lora for editorial display, Manrope for body, UI, and controls. */
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Home School Haven of SWFL",
  description:
    "A Christ-centered learning community where families grow together in faith, creativity, and confident homeschooling.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
