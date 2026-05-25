'use client';

interface StatsData {
  totalProfiles: number;
  verifiedProfiles: number;
  listedProfiles: number;
  totalJobs: number;
  recentJobs: number;
  totalPosts: number;
  regionCounts: Array<[string, number]>;
  bizCounts: Array<[string, number]>;
}

export default function StatsExportButton({ stats, regionLabel, bizLabel }: { stats: StatsData; regionLabel: Record<string, string>; bizLabel: Record<string, string> }) {
  function download() {
    const today = new Date().toISOString().split('T')[0];
    const lines: string[] = [];
    lines.push(`Marié Platform Stats Export,${today}`);
    lines.push('');
    lines.push('Metric,Value');
    lines.push(`누적 회원,${stats.totalProfiles}`);
    lines.push(`인증 업체,${stats.verifiedProfiles}`);
    lines.push(`공개 디렉토리,${stats.listedProfiles}`);
    lines.push(`누적 공고,${stats.totalJobs}`);
    lines.push(`최근 30일 공고,${stats.recentJobs}`);
    lines.push(`커뮤니티 게시글,${stats.totalPosts}`);
    lines.push('');
    lines.push('지역,활성 업체');
    stats.regionCounts.forEach(([key, n]) => {
      lines.push(`${regionLabel[key] || key},${n}`);
    });
    lines.push('');
    lines.push('업종,활성 업체');
    stats.bizCounts.forEach(([key, n]) => {
      lines.push(`${bizLabel[key] || key},${n}`);
    });

    const csv = '﻿' + lines.join('\n'); // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `marie-stats-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary"
    >
      ⬇ CSV 다운로드
    </button>
  );
}
