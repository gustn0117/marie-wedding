'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminService } from '@/features/admin/services/admin-service';
import { formatDate, getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Profile } from '@/types/database';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    if (!confirm(`${user.contact_name}님을 삭제하시겠습니까?`)) return;
    setActionLoading(user.id);
    try {
      await adminService.softDeleteUser(user.id);
      await load();
    } catch (err) {
      alert('삭제에 실패했습니다.');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (user: Profile) => {
    setActionLoading(user.id);
    try {
      await adminService.restoreUser(user.id);
      await load();
    } catch (err) {
      alert('복원에 실패했습니다.');
      console.error(err);
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
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
    </div>
  );
}
