// Design Ref: §5.2 — 선택 상자에 쓰는 면허 목록 5개 (브라우저·서버 공용이라 server-only 아님)

export const LICENSE_NAMES = [
  "시설물유지관리업",
  "전기공사업",
  "정보통신공사업",
  "소방시설공사업",
  "기계설비공사업",
] as const;

/** 면허 이름 (위 목록 중 하나만 허용) */
export type LicenseName = (typeof LICENSE_NAMES)[number];

/** 문자열이 면허 목록에 있는 이름인지 확인 (API에서 입력 검사용) */
export function isLicenseName(value: unknown): value is LicenseName {
  return (
    typeof value === "string" &&
    (LICENSE_NAMES as readonly string[]).includes(value)
  );
}

/** 면허를 고르지 않았을 때의 안내 문구 — 화면과 API(400)가 같은 문장을 쓴다 */
export const LICENSE_REQUIRED_MESSAGE = "필요한 면허를 먼저 선택해 주세요.";
