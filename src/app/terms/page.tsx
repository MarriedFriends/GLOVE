import Link from "next/link";

export const metadata = { title: "이용약관 — Glove" };

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

export default function TermsPage() {
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
          이용약관
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="제1조 (목적)">
          <p>
            이 약관은 Glove 운영팀(이하 &ldquo;운영팀&rdquo;)이 제공하는 대학생
            익명 매칭·채팅 서비스 Glove(이하 &ldquo;서비스&rdquo;)의 이용 조건과
            이용자·운영팀의 권리, 의무, 책임을 정하는 것을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (이용 자격)">
          <p>
            서비스는 대학(원)에 재적 중이며 학교 이메일(.ac.kr, .edu 등)을
            보유한 성인만 이용할 수 있습니다. 미성년자는 이용할 수 없습니다.
            가입 시 학교 이메일 인증이 필요하며, 타인의 이메일이나 계정을
            사용해서는 안 됩니다.
          </p>
        </Section>

        <Section title="제3조 (계정)">
          <p>
            계정은 본인만 사용할 수 있고, 비밀번호 관리 책임은 이용자에게
            있습니다. 이용자는 언제든지 서비스 내 &ldquo;계정 탈퇴&rdquo;로
            계정을 삭제할 수 있으며, 삭제 시 프로필·매칭·채팅 기록이 즉시
            삭제됩니다.
          </p>
        </Section>

        <Section title="제4조 (익명성과 콘텐츠)">
          <p>
            서비스는 익명 프로필(닉네임)을 기본으로 하며, 실명·이메일은 다른
            이용자에게 공개되지 않습니다. 연락처는 본인이 직접 입력해 상호
            공개에 동의한 경우에만 상대에게 공개됩니다.
          </p>
          <p>
            이용자가 작성·전송한 콘텐츠(메시지, 음성, 그림, 자기소개 등)에 대한
            책임은 작성자 본인에게 있습니다.
          </p>
        </Section>

        <Section title="제5조 (금지 행위)">
          <p>다음 행위는 금지되며, 위반 시 경고 없이 이용이 제한될 수 있습니다.</p>
          <ul className="list-disc pl-5">
            <li>타인 사칭, 허위 프로필 작성, 학교 이메일 인증 우회</li>
            <li>욕설, 괴롭힘, 스토킹, 협박, 차별적 발언</li>
            <li>음란물 전송, 성적 착취 목적의 접근</li>
            <li>상대방 동의 없는 개인정보(실명, 연락처, 사진 등) 유포</li>
            <li>영리 목적의 광고, 스팸, 홍보</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
          </ul>
        </Section>

        <Section title="제6조 (신고와 제재)">
          <p>
            이용자는 채팅·프로필 화면의 신고 기능으로 금지 행위를 신고할 수
            있고, 차단 기능으로 특정 이용자와의 노출·연락을 끊을 수 있습니다.
            운영팀은 신고를 확인해 경고, 이용 제한, 계정 삭제 등의 조치를 할 수
            있습니다.
          </p>
        </Section>

        <Section title="제7조 (서비스의 제공·변경·중단)">
          <p>
            서비스는 무료로 제공되며, 운영팀은 서비스의 내용을 변경하거나
            중단할 수 있습니다. 중대한 변경은 서비스 내 공지로 알립니다.
          </p>
        </Section>

        <Section title="제8조 (책임의 한계)">
          <p>
            운영팀은 이용자 간 만남·대화에서 발생한 분쟁에 개입할 의무를 지지
            않으며, 이용자가 자발적으로 공개한 정보로 인한 피해에 대해 책임지지
            않습니다. 다만 신고가 접수되면 성실히 확인하고 조치합니다.
          </p>
        </Section>

        <Section title="제9조 (준거법)">
          <p>
            이 약관은 대한민국 법률에 따라 해석되며, 분쟁은 민사소송법상의
            관할 법원에서 다룹니다.
          </p>
        </Section>

        <Section title="문의">
          <p>
            약관에 관한 문의: <span className="font-medium">glove309e@gmail.com</span>
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
