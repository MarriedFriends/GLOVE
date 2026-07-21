import Link from "next/link";

import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-rose-50 via-white to-white px-6 font-sans dark:from-rose-950/30 dark:via-black dark:to-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-medium uppercase tracking-widest text-rose-500"
          >
            Glove
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            로그인 / 회원가입
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            학교 이메일로 가입하고 익명으로 시작하세요.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
            {message}
          </p>
        )}

        <form className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              이메일
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@university.ac.kr"
              className="rounded-lg border border-black/[.12] bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 dark:border-white/[.15] dark:bg-zinc-900"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              비밀번호
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              placeholder="6자 이상"
              className="rounded-lg border border-black/[.12] bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 dark:border-white/[.15] dark:bg-zinc-900"
            />
          </label>

          <div className="mt-2 flex flex-col gap-2">
            <button
              formAction={login}
              className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02]"
            >
              로그인
            </button>
            <button
              formAction={signup}
              className="rounded-full border border-black/[.12] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.15] dark:text-zinc-50 dark:hover:bg-white/[.06]"
            >
              회원가입
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
