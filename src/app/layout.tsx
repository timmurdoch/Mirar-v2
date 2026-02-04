import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mirar - Sports Facility Audit",
  description: "Sports facility audit and management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
