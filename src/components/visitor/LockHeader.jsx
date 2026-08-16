/**
 * LockHeader 锁定页头部
 * 显示头像 + 昵称 + 性别年龄
 *
 * @param {Object} profile - 主人档案
 * @param {string} variant - locked | approved
 * @param {string} subtitle - 副标题
 */
export default function LockHeader({ profile, variant = 'locked', subtitle }) {
  const isApproved = variant === 'approved';
  const avatar = profile?.avatar;
  const firstChar = profile?.nickname?.[0] || '?';
  const genderSymbol = profile?.gender === '男' ? '♂' : '♀';

  return (
    <div
      className="text-center pt-6 pb-5 px-4 -mx-4 -mt-5 mb-4 rounded-b-2xl"
      style={{
        background: isApproved
          ? 'linear-gradient(to bottom, #ecfdf5, #fff)'
          : 'linear-gradient(to bottom, var(--primary-light), #fff)',
        borderBottom: isApproved ? '2px solid var(--success)' : 'none',
      }}
    >
      {/* 头像 */}
      <div
        className="w-18 h-18 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl text-white shadow-primary overflow-hidden"
        style={{
          width: '72px',
          height: '72px',
          background: avatar
            ? `url(${avatar}) center/cover`
            : isApproved
            ? 'linear-gradient(135deg, #6ee7b7, var(--success))'
            : 'linear-gradient(135deg, #93c5fd, var(--primary))',
        }}
      >
        {!avatar && (isApproved ? '✅' : firstChar)}
      </div>

      {/* 昵称 */}
      <div className="text-lg font-semibold text-text flex items-center justify-center gap-2">
        {profile?.nickname || '未知'}的交友卡片
        {isApproved && (
          <span className="tag tag-approved text-xs">已通过</span>
        )}
      </div>

      {/* 性别（不显示年龄） */}
      <div className="inline-block mt-1 text-xs text-primary bg-primary-light px-3.5 py-1 rounded-full">
        {genderSymbol} {profile?.gender}
      </div>

      {/* 副标题 */}
      {subtitle && (
        <div
          className="text-[13px] mt-1.5 font-medium"
          style={{ color: isApproved ? 'var(--success)' : 'inherit' }}
        >
          {subtitle}
        </div>
      )}

      {!isApproved && (
        <div className="mt-3 flex justify-center gap-1.5">
          <span className="tag tag-locked">🔒 未填写不可见</span>
        </div>
      )}
    </div>
  );
}
