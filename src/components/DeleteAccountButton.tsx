"use client";

import { useTransition } from "react";

import { deleteAccount } from "@/app/safety/actions";

export function DeleteAccountButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const first = window.confirm(
      "정말 탈퇴할까요?\n프로필, 매칭, 채팅 기록이 모두 삭제되고 되돌릴 수 없어요.",
    );
    if (!first) return;
    const second = window.confirm(
      "마지막 확인이에요. 지금 탈퇴하면 모든 데이터가 즉시 삭제돼요.",
    );
    if (!second) return;

    startTransition(async () => {
      const res = await deleteAccount();
      // On success deleteAccount redirects away; reaching here means failure.
      if (res?.error) window.alert(`탈퇴에 실패했어요: ${res.error}`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="underline-offset-2 hover:underline disabled:opacity-60"
    >
      {pending ? "탈퇴 처리 중…" : "계정 탈퇴"}
    </button>
  );
}
