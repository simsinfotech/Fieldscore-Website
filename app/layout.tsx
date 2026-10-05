import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen bg-brand-bg text-brand-text antialiased">
        {children}
      </body>
    </html>
  );
}
