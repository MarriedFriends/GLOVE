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
  let notifiers: React.ReactNode[] = [];
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
    const activeChats = (matches ?? []).filter(
      (m) => Date.now() - +new Date(m.created_at) < 48 * 3600 * 1000,
    );
    if (activeChats.length) {
      const otherIds = activeChats.map((m) =>
        m.user_low === user.id ? m.user_high : m.user_low,
      );
      const { data: partners } = await supabase
        .from("profiles")
        .select("id, handle")
        .in("id", otherIds);
      notifiers = activeChats.map((m) => {
        const otherId = m.user_low === user.id ? m.user_high : m.user_low;
        const partner = (partners ?? []).find((p) => p.id === otherId);
        return (
          <MessageNotifier
            key={m.id}
            userId={user.id}
            matchId={m.id}
            partnerHandle={partner?.handle ?? "상대"}
          />
        );
      });
    }
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {notifiers}
        {noonNotifier}
      </body>
    </html>
  );
}
