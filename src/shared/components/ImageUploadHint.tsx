interface ImageUploadHintProps {
  /** 권장 비율 */
  ratio: string;
  /** 권장 크기 (픽셀) */
  recommendedSize: string;
  /** 최대 용량 */
  maxSize: string;
  /** 추가 안내 */
  note?: string;
}

export default function ImageUploadHint({ ratio, recommendedSize, maxSize, note }: ImageUploadHintProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
      <span className="inline-flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 5.25c0-.621.504-1.125 1.125-1.125h15c.621 0 1.125.504 1.125 1.125m-17.25 0v1.5c0 .621.504 1.125 1.125 1.125m-1.125-1.125c-.621 0-1.125.504-1.125 1.125v10.5c0 .621.504 1.125 1.125 1.125m17.25-14.25v1.5c0 .621-.504 1.125-1.125 1.125m1.125-1.125c.621 0 1.125.504 1.125 1.125v10.5c0 .621-.504 1.125-1.125 1.125m-1.125-14.25H4.5M20.25 5.25H15M4.5 19.5v-1.5" />
        </svg>
        비율 <span className="font-semibold text-gray-600">{ratio}</span>
      </span>
      <span>·</span>
      <span>
        권장 <span className="font-semibold text-gray-600">{recommendedSize}</span>
      </span>
      <span>·</span>
      <span>
        JPG / PNG, <span className="font-semibold text-gray-600">{maxSize}</span> 이하
      </span>
      {note && (
        <>
          <span>·</span>
          <span>{note}</span>
        </>
      )}
    </div>
  );
}
