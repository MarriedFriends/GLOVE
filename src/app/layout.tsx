import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { createClient } from "@/lib/supabase/server";
import { MessageNotifier } from "@/components/MessageNotifier";
import { NoonNotifier } from "@/components/NoonNotifier";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Glove",
  description: "익명으로 만나는 대학생 소개팅 — Glove",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mount the global message notifier when the user has a live chat, so new
  // messages alert them on every page of the app.
  let notifier: React.ReactNode = null;
  let noonNotifier: React.ReactNode = null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    noonNotifier = <NoonNotifier userId={user.id} />;
    const { data: matches } = await supabase
      .from("matches")
      .select("id, user_low, user_high, created_at")
      .eq("status", "active");
    const activeChat = (matches ?? []).find(
      (m) => Date.now() - +new Date(m.created_at) < 48 * 3600 * 1000,
    );
    if (activeChat) {
      const otherId =
        activeChat.user_low === user.id
          ? activeChat.user_high
          : activeChat.user_low;
      const { data: partner } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", otherId)
        .maybeSingle();
      notifier = (
        <MessageNotifier
          userId={user.id}
          matchId={activeChat.id}
          partnerHandle={partner?.handle ?? "상대"}
        />
      );
    }
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {notifier}
        {noonNotifier}
      </body>
    </html>
  );
}
