/**
 * Single source of truth for the onboarding survey choices.
 * Imported by both the wizard UI (client) and the save action (server) so the
 * two can never drift apart. Keep values in sync with the CHECK constraints
 * in supabase/schema.sql.
 */

export const GENDER_OPTIONS = [
  { value: "male", label: "남성", emoji: "🙋‍♂️" },
  { value: "female", label: "여성", emoji: "🙋‍♀️" },
] as const;

export const MIN_ADMISSION_YEAR = 2015; // 15학번
export const MAX_ADMISSION_YEAR = 2026; // 26학번
export const MIN_AGE = 19;
export const MAX_AGE = 30;

export const HEIGHT_BUCKETS = [
  "~150",
  "151~155",
  "156~160",
  "161~165",
  "166~170",
  "171~175",
  "176~180",
  "181~185",
  "186~190",
  "190~",
] as const;

export function formatHeight(bucket: string): string {
  if (bucket === "~150") return "150cm 이하";
  if (bucket === "190~") return "190cm 이상";
  return `${bucket}cm`;
}

export const FACE_OPTIONS = [
  { value: "dog", label: "강아지상", emoji: "🐶" },
  { value: "cat", label: "고양이상", emoji: "🐱" },
  { value: "fox", label: "여우상", emoji: "🦊" },
  { value: "snake", label: "뱀상", emoji: "🐍" },
  { value: "mouse", label: "쥐상", emoji: "🐭" },
  { value: "bear", label: "곰상", emoji: "🐻" },
  { value: "rabbit", label: "토끼상", emoji: "🐰" },
] as const;

export const MBTI_PAIRS = [
  {
    name: "에너지 방향",
    options: [
      { value: "E", label: "외향형", desc: "사람들과 어울릴 때 에너지가 충전돼요" },
      { value: "I", label: "내향형", desc: "혼자만의 시간에서 에너지를 얻어요" },
    ],
  },
  {
    name: "인식 방식",
    options: [
      { value: "N", label: "직관형", desc: "상상력이 풍부하고 새로운 가능성을 봐요" },
      { value: "S", label: "감각형", desc: "현실적이고 직접 경험한 것을 믿어요" },
    ],
  },
  {
    name: "판단 기준",
    options: [
      { value: "T", label: "사고형", desc: "논리와 이성으로 차분하게 판단해요" },
      { value: "F", label: "감정형", desc: "공감을 잘하고 사람 마음을 먼저 살펴요" },
    ],
  },
  {
    name: "생활 양식",
    options: [
      { value: "P", label: "인식형", desc: "즉흥적이고 유연하게 움직이는 게 좋아요" },
      { value: "J", label: "판단형", desc: "계획을 세우고 정리된 상태가 편해요" },
    ],
  },
] as const;

export const HOBBY_OPTIONS = [
  "운동·헬스",
  "러닝",
  "등산",
  "축구·풋살",
  "영화",
  "드라마·예능",
  "음악 감상",
  "노래방",
  "악기 연주",
  "게임",
  "보드게임",
  "독서",
  "여행",
  "맛집 탐방",
  "카페 투어",
  "사진",
  "요리·베이킹",
  "전시·공연",
  "댄스",
  "반려동물",
] as const;

export const MAX_HOBBIES = 5;
