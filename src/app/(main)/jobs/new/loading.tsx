// 진입 즉시 스켈레톤 — 클릭 후 빈 화면 대기 체감 제거.
export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded" />
      <div className="bg-white rounded border border-gray-200 p-6 space-y-4">
        <div className="h-20 w-20 rounded bg-gray-100 mx-auto" />
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-28 bg-gray-100 rounded" />
        <div className="h-10 w-40 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
