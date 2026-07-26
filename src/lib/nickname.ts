/**
 * Generates an anonymous nickname from survey answers, e.g. a cat-faced user
 * who likes music becomes "흥이 많은 고양이". Randomized per call so retries
 * (e.g. on a duplicate-handle collision) naturally produce fresh options.
 */

const FACE_ANIMALS: Record<string, string> = {
  dog: "강아지",
  cat: "고양이",
  fox: "여우",
  snake: "뱀",
  mouse: "생쥐",
  bear: "곰",
  rabbit: "토끼",
};

const HOBBY_MODIFIERS: Record<string, string[]> = {
  "운동·헬스": ["단백질 챙기는", "3대 500 노리는"],
  러닝: ["새벽을 달리는", "바람을 가르는"],
  등산: ["정상에서 웃는", "능선을 걷는"],
  "축구·풋살": ["해트트릭 노리는", "중원을 지배하는"],
  영화: ["엔딩크레딧까지 보는", "팝콘을 든"],
  "드라마·예능": ["정주행 중인", "본방 사수하는"],
  "음악 감상": ["흥이 많은", "플레이리스트 부자"],
  노래방: ["고음 지르는", "마이크 안 놓는"],
  "악기 연주": ["감성 연주하는", "새벽에 튜닝하는"],
  게임: ["한 판만 더 하는", "팀을 캐리하는"],
  보드게임: ["수를 읽는", "전략 짜는"],
  독서: ["책갈피 꽂는", "활자에 빠진"],
  여행: ["캐리어 끄는", "떠날 준비된"],
  "맛집 탐방": ["웨이팅도 견디는", "맛집 지도 가진"],
  "카페 투어": ["라떼를 든", "원두 향 맡는"],
  사진: ["셔터를 누르는", "골든아워 기다리는"],
  "요리·베이킹": ["앞치마 두른", "오븐 앞을 지키는"],
  "전시·공연": ["예술에 취한", "앙코르 외치는"],
  댄스: ["리듬 타는", "스텝 밟는"],
  반려동물: ["집사 기질의", "산책 메이트"],
};

// Fallback flavor when a hobby has no entry — drawn from MBTI letters.
const MBTI_MODIFIERS: Record<string, string> = {
  E: "어디서든 인싸인",
  I: "속 깊은",
  N: "상상력이 풍부한",
  S: "현실 감각 있는",
  T: "팩트로 말하는",
  F: "공감 만렙",
  P: "즉흥 여행 가능한",
  J: "계획표가 가득한",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** The animal for a face type plus every modifier this user's answers allow. */
export function getNicknameParts(
  faceType: string,
  hobbies: string[],
  mbti: string,
): { animal: string; pool: string[] } {
  const animal = FACE_ANIMALS[faceType] ?? "동물";

  const pool = hobbies.flatMap((h) => HOBBY_MODIFIERS[h] ?? []);
  for (const letter of mbti) {
    if (MBTI_MODIFIERS[letter]) pool.push(MBTI_MODIFIERS[letter]);
  }
  if (pool.length === 0) pool.push("정체를 숨긴");

  return { animal, pool };
}

export function generateNickname(
  faceType: string,
  hobbies: string[],
  mbti: string,
): string {
  const { animal, pool } = getNicknameParts(faceType, hobbies, mbti);
  return `${pick(pool)} ${animal}`;
}

/**
 * Server-side check that a submitted nickname really is one of the
 * combinations this user's survey answers can produce (the client sends the
 * chosen name in a hidden field, which could be tampered with).
 */
export function isValidNickname(
  name: string,
  faceType: string,
  hobbies: string[],
  mbti: string,
): boolean {
  const { animal, pool } = getNicknameParts(faceType, hobbies, mbti);
  return pool.some((modifier) => name === `${modifier} ${animal}`);
}
