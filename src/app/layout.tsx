import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Web3Provider } from "@/providers/web3-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeDrop – Encrypted Dead Man's Switch on IPFS",
  description:
    "Store encrypted messages and files that automatically release to trusted recipients after a period of inactivity. Built on IPFS. Uncensorable. Unstoppable. Powered by Filecoin.",
  keywords: [
    "SafeDrop",
    "dead man's switch",
    "encrypted storage",
    "IPFS",
    "digital inheritance",
    "Storacha",
    "Filecoin",
    "smart contract",
    "blockchain",
    "AES-256",
    "decentralized",
    "censorship resistant",
    "Web Crypto API",
  ],
  authors: [{ name: "SafeDrop Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SafeDrop – Encrypted Dead Man's Switch on IPFS",
    description:
      "Your digital afterlife, secured. Encrypt and store secrets on IPFS that auto-release after inactivity. Fully on-chain timeout logic.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SafeDrop – Encrypted Dead Man's Switch",
    description:
      "Store encrypted messages that auto-release after inactivity. Decentralized. Uncensorable. On-chain.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — next-themes handles this via suppressHydrationWarning */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme');
                  var d = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.classList.add(d ? 'dark' : 'light');
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Web3Provider>
          {children}
          <Toaster />
        </Web3Provider>
      </body>
    </html>
  );
}
