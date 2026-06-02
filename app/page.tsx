import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex-1">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg">OVERNIGHT BRIEF</div>
          <div className="flex gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm hover:underline"
            >
              로그인
            </Link>
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
            >
              시작하기
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          밤사이 쌓인 글로벌 테크 뉴스를
          <br />
          <span className="text-blue-600">매일 아침 8시, 한국어 요약으로.</span>
        </h1>
        <p className="text-gray-600 mb-12 text-lg">
          여러 외신을 일일이 찾아보는 시간을 줄여드립니다. 키워드만 설정하면
          이메일·Slack·Discord 어디로든 받아볼 수 있습니다.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 mb-12 text-left">
          <div className="text-xs text-gray-500 mb-2">
            #AI바이브코딩 · TechCrunch
          </div>
          <div className="font-semibold mb-3">
            OpenAI releases GPT-5 with major reasoning gains
          </div>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside mb-3">
            <li>OpenAI가 GPT-5를 공개했습니다.</li>
            <li>이번 모델은 기존 대비 추론 능력이 3배 향상되었습니다.</li>
            <li>API 가격은 GPT-4o 대비 30% 인하되었습니다.</li>
          </ul>
          <span className="text-blue-600 text-sm">원문 보기 →</span>
        </div>

        <Link
          href="/auth/login"
          className="inline-block px-8 py-3 bg-blue-600 text-white rounded-md text-lg font-medium hover:bg-blue-700"
        >
          무료로 시작하기 →
        </Link>

        <div className="mt-8 text-sm text-gray-500 flex gap-6 justify-center">
          <span>✓ 매일 아침 8시 발송</span>
          <span>✓ 키워드 맞춤</span>
          <span>✓ 멀티 채널 지원</span>
        </div>
      </main>
    </div>
  );
}
