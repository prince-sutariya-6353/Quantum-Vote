import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "QuantumVote — Post-Quantum Secure Digital Voting",
  description:
    "The world's first quantum-resistant digital voting platform. Secured with CRYSTALS-Kyber and Dilithium post-quantum cryptography.",
  keywords: ["quantum voting", "PQC", "secure election", "Kyber", "Dilithium", "digital democracy"],
  authors: [{ name: "QuantumVote" }],
  openGraph: {
    title: "QuantumVote",
    description: "Quantum-resistant secure digital voting platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
