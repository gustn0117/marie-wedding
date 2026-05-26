'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminService } from '@/features/admin/services/admin-service';
import { formatDate, getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/shared/hooks/useAuth';
import { toast, toastConfirm } from '@/shared/components/Toast';

export default function AdminUsersPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banModal, setBanModal] = useState<{ user: Profile; reason: string } | null>(null);
  const [noteModal, setNoteModal] = useState<{ user: Profile; note: string } | null>(null);

  const totalPages = Math.ceil(count / 20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminService.getUsers(page, search || undefined, showDeleted);
      setUsers(result.data);
      setCount(result.count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleToggleRole = async (user: Profile) => {
    if (!confirm(`${user.contact_name}님의 권한을 ${user.role === 'admin' ? '일반 유저' : '관리자'}로 변경하시겠습니까?`)) return;
    setActionLoading(user.id);
    try {
      await adminService.updateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin');
      await load();
    } catch (err) {
      alert('권한 변경에 실패했습니다.');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user: Profile) => {
    const ok = await toastConfirm(`${user.contact_name}님과 작성한 공고·게시글·댓글·지원·리뷰·포트폴리오를 모두 삭제하시겠습니까? 알림·메시지·북마크는 영구 삭제됩니다.`);
    if (!ok) return;
    setActionLoading(user.id);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('purge_profile_cascade', { p_profile_id: user.id });
      if (error) throw error;
      toast('회원과 관련 데이터를 모두 삭제했습니다.', 'success');
      await load();
    } catch (err) {
      toast('삭제에 실패했습니다.', 'error');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (user: Profile) => {
    const restoreContent = await toastConfirm(`${user.contact_name}님을 복원합니다. 작성했던 공고·게시글·댓글·지원·리뷰·포트폴리오도 함께 복원하시겠습니까? (취소: 회원 계정만 복원)`);
    setActionLoading(user.id);
    try {
      const sb = createClient();
      const { error } = await sb.rpc('restore_profile_cascade', { p_profile_id: user.id, p_restore_content: restoreContent });
      if (error) throw error;
      toast(restoreContent ? '회원과 콘텐츠를 모두 복원했습니다.' : '회원 계정만 복원했습니다.', 'success');
      await load();
    } catch (err) {
      toast('복원에 실패했습니다.', 'error');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmBan = async () => {
    if (!banModal) return;
    const { user, reason } = banModal;
    if (!reason.trim()) { toast('제재 사유를 입력해 주세요.', 'error'); return; }
    setActionLoading(user.id);
    try {
      const sb = createClient();
      const { error } = await sb.from('profiles').update({
        banned_at: new Date().toISOString(),
        banned_reason: reason.trim(),
        banned_by: me?.id ?? null,
      }).eq('id', user.id);
      if (error) throw error;
      toast(`${user.contact_name}님을 제재했습니다.`, 'success');
      setBanModal(null);
      await load();
    } catch (err) {
      toast('제재 처리에 실패했습니다.', 'error');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const saveNote = async () => {
    if (!noteModal) return;
    const { user, note } = noteModal;
    setActionLoading(user.id);
    try {
      const sb = createClient();
      const { error } = await sb.from('profiles').update({ admin_note: note.trim() || null }).eq('id', user.id);
      if (error) throw error;
      toast('관리자 메모를 저장했습니다.', 'success');
      setNoteModal(null);
      await load();
    } catch {
      toast('저장에 실패했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (user: Profile) => {
    const ok = await toastConfirm(`${user.contact_name}님의 제재를 해제하시겠습니까?`);
    if (!ok) return;
    setActionLoading(user.id);
    try {
      const sb = createClient();
      const { error } = await sb.from('profiles').update({
        banned_at: null,
        banned_reason: null,
        banned_by: null,
      }).eq('id', user.id);
      if (error) throw error;
      toast('제재가 해제되었습니다.', 'success');
      await load();
    } catch {
      toast('해제에 실패했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
        <span className="text-sm text-gray-500">{count.toLocaleString()}명</span>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
          <div className="flex bg-white border border-gray-200 rounded overflow-hidden">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 회사명 검색..."
              className="flex-1 px-4 py-2.5 text-sm outline-none"
            />
            <button type="submit" className="px-4 text-gray-400 hover:text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
          </div>
        </form>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          삭제된 회원 포함
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">이름</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">회사</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">유형</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">업종</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">지역</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">권한</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">가입일</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">상태</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-5 py-4">
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-gray-400">
                    회원이 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={user.deleted_at ? 'bg-red-50/50 opacity-60' : 'hover:bg-gray-50'}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-50 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {user.contact_name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-800">{user.contact_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{user.company_name || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        user.account_type === 'business' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.account_type === 'business' ? '업체' : '개인'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{user.business_type ? getBusinessTypeLabel(user.business_type) : '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{getRegionLabel(user.region)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        user.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {user.role === 'admin' ? '관리자' : '일반'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(user.created_at)}</td>
                    <td className="px-5 py-3">
                      {user.deleted_at ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-500">삭제됨</span>
                      ) : user.banned_at ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-950 text-white" title={user.banned_reason ?? undefined}>제재됨</span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-600">활성</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.deleted_at ? (
                          <button
                            onClick={() => handleRestore(user)}
                            disabled={actionLoading === user.id}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                          >
                            복원
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleRole(user)}
                              disabled={actionLoading === user.id}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                            >
                              {user.role === 'admin' ? '일반으로' : '관리자로'}
                            </button>
                            {user.banned_at ? (
                              <button
                                onClick={() => handleUnban(user)}
                                disabled={actionLoading === user.id}
                                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                              >
                                제재 해제
                              </button>
                            ) : (
                              <button
                                onClick={() => setBanModal({ user, reason: '' })}
                                disabled={actionLoading === user.id}
                                className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                              >
                                제재
                              </button>
                            )}
                            <button
                              onClick={() => setNoteModal({ user, note: user.admin_note ?? '' })}
                              disabled={actionLoading === user.id}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                              title={user.admin_note || '메모 없음'}
                            >
                              메모{user.admin_note ? ' ✱' : ''}
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={actionLoading === user.id}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-5 py-4 border-t border-gray-100">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              이전
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-sm rounded ${
                    p === page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md border border-gray-200 bg-white p-5 shadow-xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">관리자 메모</p>
            <h2 className="text-base font-bold text-gray-900 mb-3">{noteModal.user.contact_name}</h2>
            <textarea
              value={noteModal.note}
              onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
              rows={6}
              placeholder="이 회원에 대한 비공개 메모 (관리자만 봅니다)"
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                disabled={actionLoading === noteModal.user.id}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveNote}
                disabled={actionLoading === noteModal.user.id}
                className="rounded border border-gray-950 bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {banModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md border border-gray-200 bg-white p-5 shadow-xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">사용자 제재</p>
            <h2 className="text-base font-bold text-gray-900 mb-1">{banModal.user.contact_name}</h2>
            <p className="text-xs text-gray-500 mb-3">{banModal.user.company_name || '개인 회원'}</p>
            <textarea
              value={banModal.reason}
              onChange={(e) => setBanModal({ ...banModal, reason: e.target.value })}
              rows={4}
              placeholder="제재 사유 (관리자 기록용)"
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBanModal(null)}
                disabled={actionLoading === banModal.user.id}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmBan}
                disabled={actionLoading === banModal.user.id || !banModal.reason.trim()}
                className="rounded border border-gray-950 bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                제재 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
