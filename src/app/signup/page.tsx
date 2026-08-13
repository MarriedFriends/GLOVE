import Link from "next/link";

import { signup } from "../login/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
            회원가입
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            학교 이메일(.ac.kr / .edu)로만 가입할 수 있어요.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <form action={signup} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              이메일
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@gist.ac.kr"
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
              autoComplete="new-password"
              placeholder="6자 이상"
              className="rounded-lg border border-black/[.12] bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 dark:border-white/[.15] dark:bg-zinc-900"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              비밀번호 확인
            </span>
            <input
              name="password_confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="비밀번호를 한 번 더 입력"
              className="rounded-lg border border-black/[.12] bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 dark:border-white/[.15] dark:bg-zinc-900"
            />
          </label>

          <button className="mt-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02]">
            가입하기
          </button>

          <p className="text-center text-xs leading-5 text-zinc-400 dark:text-zinc-500">
            가입하면{" "}
            <Link href="/terms" className="underline underline-offset-2">
              이용약관
            </Link>
            과{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주돼요.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-semibold text-rose-500">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
