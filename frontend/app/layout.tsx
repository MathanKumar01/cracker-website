import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Thaswika Crackers | Diwali Orders",
  description: "Browse the Thaswika Crackers price list and place your order.",
};

export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
