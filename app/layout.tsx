import type { Metadata } from "next";
import "./globals.css";

// 글꼴은 globals.css의 한글 시스템 글꼴 목록을 쓴다. (Geist는 한글이 없어 외부 글꼴을 내려받을 필요가 없다)
export const metadata: Metadata = {
  title: "수의계약 적격업체 평가 도우미",
  // 대외비 자료이므로 검색엔진에 색인되지 않게 한다 (CHECK.md A-3)
  robots: { index: false, follow: false },
  description:
    "시설관리 수의계약 담당자를 위해 업체 정보 7개 항목을 한 화면에 모아 보여주고 적격 여부를 판단합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
