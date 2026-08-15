import { useNavigate } from 'react-router-dom';
import LockHeader from './LockHeader.jsx';
import Card, { CardLabel, CardValue } from '../common/Card.jsx';
import PhotoGrid from '../common/PhotoGrid.jsx';
import Button from '../common/Button.jsx';
import Tag from '../common/Tag.jsx';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * 访客各状态视图分发组件
 *
 * scenario: locked | pending | approved | rejected | revoked | link_closed | invalid_link | self_visit
 */
export default function VisitorStatusView({
  scenario,
  ownerProfile,
  visitorRecord,
  onApply,
  onReapply,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // 异常场景
  if (scenario === 'loading') {
    return (
      <div className="phone-body">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <div className="text-sm text-text-secondary">加载中...</div>
        </div>
      </div>
    );
  }

  // 链接无效（owner 不存在）
  if (scenario === 'invalid_link') {
    return (
      <div className="phone-body">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-3">❌</div>
          <div className="text-lg font-semibold text-text mb-2">该链接无效</div>
          <div className="text-sm text-text-secondary">链接不存在或已被删除</div>
        </div>
      </div>
    );
  }

  // 链接已关闭
  if (scenario === 'link_closed') {
    return (
      <div className="phone-body">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <div className="text-lg font-semibold text-text mb-2">链接已失效</div>
          <div className="text-sm text-text-secondary">主人已关闭此链接，暂不接受新申请</div>
        </div>
      </div>
    );
  }

  // 自己访问自己的链接
  if (scenario === 'self_visit') {
    return (
      <div className="phone-body">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-3">👋</div>
          <div className="text-lg font-semibold text-text mb-2">这是你的专属链接</div>
          <div className="text-sm text-text-secondary mb-6">
            无法以访客身份访问自己的卡片<br />请进入后台管理
          </div>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            进入主人后台
          </Button>
        </div>
      </div>
    );
  }

  // 已通过：展示完整资料
  if (scenario === 'approved') {
    const handleCopyWechat = () => {
      const wechat = ownerProfile?.wechat || '';
      navigator.clipboard?.writeText(wechat).then(
        () => showToast('📋 已复制微信号', 'success'),
        () => showToast('复制失败，请手动复制', 'error')
      );
    };

    return (
      <div className="phone-body">
        <LockHeader
          profile={ownerProfile}
          variant="approved"
          subtitle="🎉 你们已互相解锁"
        />

        <Card className="border-l-[3px] border-primary">
          <CardLabel>📖 自我介绍</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.bio || '暂无'}
          </CardValue>
        </Card>

        <Card className="border-l-[3px] border-primary">
          <CardLabel>💭 交友期许</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.expectation || '暂无'}
          </CardValue>
        </Card>

        <Card className="border border-primary bg-primary-light">
          <CardLabel>📱 微信号</CardLabel>
          <div className="flex justify-between items-center">
            <span className="text-base font-medium text-text">
              {ownerProfile?.wechat || '暂无'}
            </span>
            <Button variant="primary" size="sm" onClick={handleCopyWechat}>
              📋 复制
            </Button>
          </div>
        </Card>

        <Card>
          <CardLabel>🖼️ 个人照片</CardLabel>
          <PhotoGrid
            value={ownerProfile?.photos || []}
            maxCount={3}
            locked={false}
          />
        </Card>

        <SafetyTip />
      </div>
    );
  }

  // 待审核
  if (scenario === 'pending') {
    return (
      <div className="phone-body">
        <LockHeader profile={ownerProfile} subtitle="⏳ 审核中" />
        <Card variant="muted" className="text-center py-8">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-base font-semibold text-text mb-1">审核中，请耐心等待</div>
          <div className="text-xs text-text-secondary">
            你的申请已提交，主人审核通过后即可查看完整资料
          </div>
        </Card>

        <Card className="border-l-[3px] border-primary">
          <CardLabel>📖 自我介绍 · 公开</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.bio || '暂无'}
          </CardValue>
        </Card>
        <Card className="border-l-[3px] border-primary">
          <CardLabel>💭 交友期许 · 公开</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.expectation || '暂无'}
          </CardValue>
        </Card>

        <SafetyTip />
      </div>
    );
  }

  // 已拒绝
  if (scenario === 'rejected') {
    const canReapply = visitorRecord?.allow_reapply !== false;
    return (
      <div className="phone-body">
        <LockHeader profile={ownerProfile} subtitle="❌ 申请未通过" />
        <Card variant="muted" className="text-center py-8">
          <div className="text-4xl mb-3">❌</div>
          <div className="text-base font-semibold text-text mb-1">你的申请未被通过</div>
          <div className="text-xs text-text-secondary">
            {canReapply ? '你可以重新提交申请' : '暂不支持重新申请'}
          </div>
        </Card>

        <Card className="border-l-[3px] border-primary">
          <CardLabel>📖 自我介绍 · 公开</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.bio || '暂无'}
          </CardValue>
        </Card>
        <Card className="border-l-[3px] border-primary">
          <CardLabel>💭 交友期许 · 公开</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.expectation || '暂无'}
          </CardValue>
        </Card>

        {canReapply && (
          <Button variant="primary" onClick={onReapply} className="mt-4">
            重新申请
          </Button>
        )}

        <SafetyTip />
      </div>
    );
  }

  // 已撤销
  if (scenario === 'revoked') {
    return (
      <div className="phone-body">
        <LockHeader profile={ownerProfile} subtitle="↩️ 权限已撤销" />
        <Card variant="muted" className="text-center py-8">
          <div className="text-4xl mb-3">↩️</div>
          <div className="text-base font-semibold text-text mb-1">主人撤销了你的查看权限</div>
          <div className="text-xs text-text-secondary">
            你可以重新提交申请
          </div>
        </Card>

        <Card className="border-l-[3px] border-primary">
          <CardLabel>📖 自我介绍 · 公开</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.bio || '暂无'}
          </CardValue>
        </Card>
        <Card className="border-l-[3px] border-primary">
          <CardLabel>💭 交友期许 · 公开</CardLabel>
          <CardValue className="text-[15px] leading-relaxed">
            {ownerProfile?.expectation || '暂无'}
          </CardValue>
        </Card>

        <Button variant="primary" onClick={onReapply} className="mt-4">
          重新申请
        </Button>

        <SafetyTip />
      </div>
    );
  }

  // 默认：锁定页（未填写）
  return (
    <div className="phone-body">
      <LockHeader profile={ownerProfile} />

      <Card className="border-l-[3px] border-primary">
        <CardLabel>📖 自我介绍 · 公开</CardLabel>
        <CardValue className="text-[15px] leading-relaxed">
          {ownerProfile?.bio || '暂无'}
        </CardValue>
      </Card>
      <Card className="border-l-[3px] border-primary">
        <CardLabel>💭 交友期许 · 公开</CardLabel>
        <CardValue className="text-[15px] leading-relaxed">
          {ownerProfile?.expectation || '暂无'}
        </CardValue>
      </Card>

      <Card variant="muted">
        <CardLabel>🔒 微信号</CardLabel>
        <CardValue className="text-text-light">填写信息互换后可见</CardValue>
      </Card>

      <Card variant="muted">
        <CardLabel>🔒 个人照片</CardLabel>
        <PhotoGrid value={[]} maxCount={3} locked />
      </Card>

      <Card variant="brand" className="text-center py-5">
        <div className="text-sm text-text-secondary mb-3">
          填写你的信息并提交，主人审核通过后<br />即可查看完整资料
        </div>
        <Button variant="primary" onClick={onApply}>
          📝 填写信息互换
        </Button>
      </Card>

      <SafetyTip />
    </div>
  );
}

/**
 * 安全提示
 */
function SafetyTip() {
  return (
    <div
      className="mt-2 px-3.5 py-2.5 bg-amber-50 rounded-xl text-[11px] text-amber-700 leading-relaxed text-center mt-4"
    >
      🛡️ 请勿向任何人泄露银行卡号、验证码、密码。线下见面注意人身安全。
    </div>
  );
}
