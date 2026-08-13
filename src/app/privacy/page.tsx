import Link from "next/link";

export const metadata = { title: "개인정보처리방침 — Glove" };

const EFFECTIVE_DATE = "2026년 8월 13일";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 justify-center bg-white px-6 py-12 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium uppercase tracking-widest text-rose-500"
        >
          Glove
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          개인정보처리방침
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="1. 수집하는 개인정보">
          <ul className="list-disc pl-5">
            <li>
              <span className="font-medium">가입 시</span>: 학교 이메일 주소,
              비밀번호(암호화 저장)
            </li>
            <li>
              <span className="font-medium">프로필 설문</span>: 닉네임, 성별,
              출생연도, 학번, 키 구간, 얼굴상, MBTI, 취미, 흡연 여부, 군필 여부,
              스타일, 자기소개 (실명은 수집하지 않습니다)
            </li>
            <li>
              <span className="font-medium">이용 과정</span>: 매칭 조건, 좋아요
              기록, 채팅 메시지, 음성 메시지(기기에서 변조된 파일만 저장),
              그림 메시지, 직접 입력한 연락처, 차단·신고 기록
            </li>
            <li>
              <span className="font-medium">자동 수집</span>: 접속 기록, 기기·
              브라우저 정보(서비스 안정 운영 목적)
            </li>
          </ul>
        </Section>

        <Section title="2. 이용 목적">
          <ul className="list-disc pl-5">
            <li>학교 이메일 확인을 통한 학생 인증</li>
            <li>익명 프로필 기반 매칭·추천·채팅 제공</li>
            <li>신고 처리, 부정 이용 방지 등 이용자 보호</li>
            <li>서비스 개선과 오류 대응</li>
          </ul>
        </Section>

        <Section title="3. 익명성 원칙">
          <p>
            이메일 주소와 로그인 정보는 다른 이용자에게 공개되지 않습니다. 다른
            이용자에게는 닉네임과 설문 기반 프로필만 보이며, 연락처는 본인이
            직접 입력해 상호 공개에 동의한 경우에만 상대에게 공개됩니다. 음성
            메시지는 기기에서 변조된 뒤 업로드되므로 원본 음성은 서버에 저장되지
            않습니다.
          </p>
        </Section>

        <Section title="4. 보관 기간과 파기">
          <p>
            개인정보는 회원 탈퇴 시 즉시 삭제됩니다(프로필, 매칭, 채팅, 좋아요
            기록 포함). 다만 신고 처리, 분쟁 대응, 관계 법령 준수를 위해 필요한
            최소한의 기록은 법령이 정한 기간 동안 보관될 수 있습니다.
          </p>
        </Section>

        <Section title="5. 처리 위탁 및 국외 이전">
          <p>서비스 운영을 위해 아래 업체에 처리를 위탁하고 있습니다.</p>
          <ul className="list-disc pl-5">
            <li>Supabase — 데이터베이스·인증·파일 저장 (서울 리전)</li>
            <li>Vercel — 웹 호스팅</li>
            <li>Brevo — 인증 메일 발송</li>
          </ul>
        </Section>

        <Section title="6. 이용자의 권리">
          <p>
            이용자는 언제든지 프로필 수정 화면에서 자신의 정보를 열람·수정할 수
            있고, &ldquo;계정 탈퇴&rdquo;로 삭제를 요청할 수 있습니다. 그 밖의
            요청(열람, 정정, 처리 정지 등)은 아래 문의처로 연락해 주세요.
          </p>
        </Section>

        <Section title="7. 문의처">
          <p>
            개인정보 보호 책임: Glove 운영팀 —{" "}
            <span className="font-medium">glove309e@gmail.com</span>
          </p>
          <p>
            방침이 변경되는 경우 서비스 내 공지로 알리고, 이 페이지에 시행일과
            함께 게시합니다.
          </p>
        </Section>

        <div className="mt-10">
          <Link
            href="/"
            className="text-sm font-medium text-rose-500 underline-offset-2 hover:underline"
          >
            ← 홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}
