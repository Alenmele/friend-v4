import { useState, useEffect, useCallback } from 'react';
import TabBar from '../common/TabBar.jsx';
import Input from '../common/Input.jsx';
import VisitorCard from './VisitorCard.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Button from '../common/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabase.js';

const PAGE_SIZE = 10;

/**
 * 审核列表
 * - 状态筛选：全部 / 待审核 / 已通过 / 已拒绝
 * - 搜索：按昵称
 * - 分页：每页 10 条
 */
export default function VisitorList({ stats = {}, onStatsChange }) {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  // 拉取访客列表
  const fetchVisitors = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('visitors')
        .select('*', { count: 'exact' })
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      // 状态筛选
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      // 关键词搜索（昵称 ilike）
      if (keyword.trim()) {
        query = query.ilike('nickname', `%${keyword.trim()}%`);
      }

      // 分页
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setVisitors(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('访客列表查询失败:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter, keyword, page]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  // 切换筛选/搜索时重置到第一页
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleSearch = (e) => {
    setKeyword(e.target.value);
    setPage(1);
  };

  return (
    <>
      {/* 状态筛选 Tab */}
      <TabBar
        tabs={[
          { key: 'all', label: '全部' },
          { key: 'pending', label: '待审核', badge: stats.pending || undefined },
          { key: 'approved', label: '已通过' },
          { key: 'rejected', label: '已拒绝' },
        ]}
        active={filter}
        onChange={handleFilterChange}
      />

      {/* 搜索框 */}
      <Input
        placeholder="🔍 搜索访客昵称"
        value={keyword}
        onChange={handleSearch}
        className="mb-3"
      />

      {/* 列表 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <div className="text-xs text-text-secondary">加载中...</div>
        </div>
      ) : visitors.length === 0 ? (
        <EmptyState
          icon="📭"
          title={keyword ? '未找到匹配的访客' : '还没有访客'}
          description={keyword ? '尝试其他关键词' : '快去分享链接吧'}
        />
      ) : (
        <>
          {visitors.map((v) => (
            <VisitorCard
              key={v.id}
              visitor={v}
              onAction={() => {
                fetchVisitors();
                onStatsChange?.();
              }}
            />
          ))}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 mb-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ← 上一页
              </Button>
              <span className="text-xs text-text-secondary px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页 →
              </Button>
            </div>
          )}

          <div className="text-center text-xs text-text-light mt-2 mb-4">
            共 {total} 条记录
          </div>
        </>
      )}

      <SafetyTip />
    </>
  );
}

function SafetyTip() {
  return (
    <div className="mt-3 px-3.5 py-2.5 bg-amber-50 rounded-xl text-[11px] text-amber-700 leading-relaxed text-center">
      🛡️ 请勿向任何人泄露银行卡号、验证码、密码。
    </div>
  );
}
