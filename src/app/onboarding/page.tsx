import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-start justify-center bg-gradient-to-b from-rose-50 via-white to-white px-6 py-12 font-sans dark:from-rose-950/30 dark:via-black dark:to-black">
      <div className="w-full max-w-md">
        <p className="mb-10 text-center text-sm font-medium uppercase tracking-widest text-rose-500">
          Glove
        </p>
        <div className="flex justify-center">
          <OnboardingWizard error={error} />
        </div>
        <p className="mt-10 text-center text-xs text-zinc-400 dark:text-zinc-600">
          답변은 매칭에만 사용되며, 실명·이메일은 상대에게 보이지 않아요.
        </p>
      </div>
    </div>
  );
}
