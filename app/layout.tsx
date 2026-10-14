import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "FieldScore - Sales CRM for Real Estate Teams",
  description:
    "The all-in-one sales CRM built for real estate teams. Track leads, manage pipelines, monitor attendance, and close deals faster with FieldScore.",
  keywords: ["CRM", "real estate", "sales", "lead management", "field sales"],
  icons: {
    icon: "/fieldscore_favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#060B18] text-[#F1F5F9] antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
