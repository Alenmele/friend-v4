import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useVisitor } from '../hooks/useVisitor.js';
import VisitorStatusView from '../components/visitor/VisitorStatusView.jsx';
import VisitorForm from '../components/visitor/VisitorForm.jsx';
import { validateLinkId } from '../utils/validators.js';

/**
 * 访客页 /u/:linkId
 * 负责状态分发：锁定/填写/通过/拒绝/撤销/链接失效/无效/自己访问
 */
export default function VisitorPage() {
  const { linkId } = useParams();
  const [view, setView] = useState('status'); // status | form

  // 校验 linkId 格式
  const linkIdError = validateLinkId(linkId);

  const {
    visitorToken,
    ownerProfile,
    visitorRecord,
    loading,
    scenario,
    refresh,
    submitApplication,
  } = useVisitor(linkIdError ? null : linkId);

  // linkId 格式错误
  if (linkIdError) {
    return (
      <div className="app-wrapper">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-3">❌</div>
          <div className="text-lg font-semibold text-text mb-2">链接格式错误</div>
          <div className="text-sm text-text-secondary">{linkIdError}</div>
        </div>
      </div>
    );
  }

  // 表单视图
  if (view === 'form' && ownerProfile) {
    return (
      <div className="app-wrapper">
        <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
          <VisitorForm
            ownerProfile={ownerProfile}
            visitorToken={visitorToken}
            onSubmit={async (formData) => {
              const result = await submitApplication(formData);
              if (result?.success) {
                setView('status');
              }
              return result;
            }}
            onCancel={() => setView('status')}
          />
        </div>
      </div>
    );
  }

  // 状态视图
  return (
    <div className="app-wrapper">
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <VisitorStatusView
          scenario={scenario}
          ownerProfile={ownerProfile}
          visitorRecord={visitorRecord}
          onApply={() => setView('form')}
          onReapply={() => setView('form')}
        />
      </div>
    </div>
  );
}
