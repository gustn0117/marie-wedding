export const metadata = {
  title: '이벤트 | 마리에',
  description: '웨딩 박람회, 업계 행사 정보를 확인하세요.',
};

export default function EventsPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">이벤트</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">준비 중입니다</h3>
        <p className="text-sm text-gray-500">웨딩 박람회, 업계 행사 정보가 곧 업데이트됩니다.</p>
      </div>
    </div>
  );
}
