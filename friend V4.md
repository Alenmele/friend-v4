Friend Card V4 — 产品需求文档（管理分发版）
版本：v4.0-lite ｜ 日期：2026-08-08

一、项目概述
项	内容
项目名称	Friend Card V4（交友卡片 · 管理分发版）
项目定位	主人（管理员）创建个人卡片 → 生成专属链接 → 分享给访客 → 访客免登录填写表单 → 主人审核通过 → 双向查看资料。无裂变传播，访客不自动成为主人
核心模式	主人即管理员，统一管理卡片、链接和访客审核
技术栈	React 19 + Vite 8 + TailwindCSS 3 + Supabase JS SDK v2
后端服务	Supabase（Auth 认证 + PostgreSQL 数据库 + Storage 存储）
部署平台	GitHub Pages
目标用户	需要收集和管理访客信息的个人或组织（如活动报名、客户信息收集、内部信息互换等）
核心价值	访客无需登录即可提交信息、信息对等互换、主人全权管理、隐私保护
二、产品目标
目标	验收标准
主人可生成专属链接并分享	主人后台自动生成8位link_id，支持复制链接、预览卡片、关闭链接
访客免登录填写表单	打开链接 → 查看公开信息 → 填写6项资料+照片 → 提交成功
主人审核访客申请	审核列表按状态筛选 → 同意/拒绝/撤销权限 → 状态实时更新
双向互看	审核通过后访客可查看主人完整资料（含微信号）
主人全权管理	资料编辑、链接管控、访客管理、数据导出、账户注销一体化
无裂变	访客提交后不生成自己的链接，不成为主人
三、用户角色
角色	说明	权限
访客（未登录）	任何打开链接的人	查看主人公开信息（昵称、性别、自我介绍、交友期许）、填写表单提交申请、查看审核状态、通过后查看主人完整资料
主人（管理员）	卡片拥有者，系统预设账号	全部权限：编辑个人资料、管理专属链接、审核访客申请、查看访客统计、导出数据、清空访客记录、注销账户
四、页面架构
4.1 页面清单
页面	路由	核心内容	访问角色
访客·锁定页	/u/:linkId	展示主人公开信息（昵称/性别/自我介绍/交友期许），其余锁定	访客
访客·填写页	锁定页内弹窗	6项必填表单+照片上传，草稿自动保存	访客
访客·通过页	/u/:linkId（已通过状态）	展示主人完整资料（含微信号复制、照片）	通过审核的访客
主人后台	/dashboard	资料编辑（6项+照片）、链接管理、访客统计、管理操作	主人
审核列表	/dashboard?tab=visitors	访客列表、状态筛选、搜索、审核操作	主人
通知中心	/notifications	通知分类、未读/已读标记、全部已读	主人
4.2 页面导航结构
text
顶部导航（5个Tab切换，用于预览演示）：
  🔒 访客·锁定 → 📝 访客·填写 → ✅ 访客·通过 → 👤 主人后台 → 📋 审核列表 → 🔔 通知中心

实际产品中，访客侧和主人侧通过链接入口区分，非多Tab切换。主人后台移除"我访问的"Tab。
五、核心业务流程
5.1 主人创建与登录
text
系统预设主人账号（邮箱 + 密码）
  → 主人登录 → 进入 /dashboard
  → 首次登录：填写6项必填资料 + 上传照片
  → 保存后自动生成8位 link_id
  → 专属链接立即可用
5.2 访客访问与填写流程
text
访客打开链接 /u/:linkId
  ↓
判断链接状态：
  ├─ link_active = false → "链接已失效"
  ├─ owner不存在 → "该链接无效"
  ├─ 自己访问自己的链接 → 引导进入后台
  └─ 正常 → 继续
  ↓
判断访客提交状态（基于 localStorage 存储的 visitor_id）：
  ├─ 从未提交过 → 显示锁定页
  │    └─ 展示：主人昵称、性别、自我介绍、交友期许
  │    └─ 隐藏：微信号、照片
  │    └─ 按钮："填写信息互换"
  │
  ├─ pending（待审核）→ "审核中，请耐心等待"
  ├─ approved（已通过）→ 展示主人完整资料
  │    └─ 含：微信号复制按钮、照片
  ├─ rejected（已拒绝）→ "你的申请未被通过"
  │    └─ allow_reapply=true → 显示"重新申请"按钮
  └─ revoked（已撤销）→ "主人撤销了你的查看权限"
  ↓
点击"填写信息互换" → 弹出表单
  → 填写 6 项必填信息：
      1. 昵称
      2. 性别（男/女）
      3. 微信号
      4. 自我介绍
      5. 交友期许
      6. 个人照片（1-3张）
  → 照片要求：jpg/png/webp，单张≤5MB，前端压缩至1024px
  → 表单草稿自动保存至 localStorage（7天有效）
  → 再次打开时弹窗提示："检测到未完成的草稿，是否继续填写？"
  → 提交 → visitors 表 INSERT（status=pending）
  → 访客身份通过 localStorage 记录（后续查询状态用）
  → 主人收到 new_visitor 通知
5.3 主人审核流程
text
主人进入 /dashboard → 点击"收到的访客"Tab
  ↓
访客列表：
  ├─ 默认按 created_at 倒序排列（最新优先）
  ├─ 状态筛选：全部 / 待审核 / 已通过 / 已拒绝
  ├─ 搜索：按访客昵称搜索
  └─ 每个访客卡片显示：昵称、性别、微信号、自我介绍、交友期许、照片
  ↓
主人操作：
  ├─ 点击"同意解锁"
  │    → visitors.status = approved
  │    → 通知访客："XXX通过了你的申请"
  │    → 检测双向互访（该访客是否也填写过主人的表单）
  │    → 如是 → 触发 mutual_match 通知双方
  │
  ├─ 点击"拒绝"
  │    → visitors.status = rejected
  │    → 通知访客："你的申请未被XXX通过"
  │    → 可设置 allow_reapply（是否允许重新申请）
  │
  └─ 点击"撤销权限"（仅对已通过状态有效）
       → visitors.status = revoked
       → 访客权限立即失效
5.4 双向互访检测
text
当主人A通过访客B的申请时：
  → 系统查询 visitors 表是否存在反向记录（visitor_id = A, owner_id = B）
  → 如存在 → 双方 status 均设为 approved
  → 触发 mutual_match 通知双方
  → 双方可直接查看对方完整资料
5.5 访客身份维持机制
text
访客首次打开链接时，前端生成 UUID 作为 visitor_token
  → 存储在 localStorage：'fc_visitor_token'
  → 各链接下的访问状态存储：'fc_visitor_status_{linkId}'
  → 提交表单时，visitor_token 随表单数据一起提交
  → 查询访客状态时，通过 visitor_token 查询 visitors 表
  → 无需登录，即可查看审核进度和结果
技术实现要点：

1. 全局 token：key='fc_visitor_token'，value=UUID
2. 链接状态：key='fc_visitor_status_{linkId}'，value={ status, submitted_at }
3. visitor_token 在 localStorage 中持久化，清除浏览器数据后丢失
4. 丢失后访客需重新提交表单（原记录成为孤儿数据，可定期清理）
5. 后续可升级为「通过短信验证码绑定」方案
5.6 主人链接管理
text
主人后台 → 链接管理卡片：
  ├─ 显示专属链接（含 link_id）
  ├─ 复制链接 → 复制到剪贴板
  ├─ 预览卡片 → 以访客视角打开链接
  └─ 关闭链接 → link_active = false，访客访问显示"链接已失效"
      （关闭后可重新开启）
5.7 主人管理操作
text
主人后台 → 管理操作区：
  ├─ 导出数据 → 导出访客记录为 CSV/JSON
  ├─ 清空访客 → 删除所有访客记录（二次确认）
  └─ 注销账户 → 永久删除所有数据（二次确认 + 输入"确认注销"验证）
5.8 通知系统
text
通知触发规则：
  ├─ new_visitor → 访客提交申请 → 通知主人
  ├─ approve → 主人通过审核 → 通知访客
  ├─ reject → 主人拒绝申请 → 通知访客
  ├─ revoke → 主人撤销权限 → 通知访客
  ├─ mutual_match → 双向互访检测到 → 通知双方
  └─ system → 系统消息

通知中心功能：
  ├─ 分类筛选：全部 / 未读 / 系统
  ├─ 未读标记：左侧蓝点 + 浅蓝背景
  ├─ 已读标记：无蓝点 + 正常背景
  ├─ 点击通知 → 跳转对应页面并标记已读
  └─ 全部已读 → 标记当前列表所有通知为已读
六、访客状态矩阵
访客状态	页面显示	可操作	可见内容
未提交过	锁定页	"填写信息互换"按钮	昵称、性别、自我介绍、交友期许
待审核	"审核中，请耐心等待"	无	公开信息
已通过	完整资料页	复制微信号、查看照片	全部资料（含微信号）
已拒绝	"你的申请未被通过"	allow_reapply=true时显示"重新申请"	公开信息
已撤销	"主人撤销了你的查看权限"	重新提交	公开信息
链接关闭	"链接已失效"	无	无
owner不存在	"该链接无效"	无	无
自己访问自己	"这是你的专属链接"	进入后台	完整资料
七、通知类型
类型	图标	触发事件	接收者	文案	跳转目标
new_visitor	🆕	访客提交申请	主人	"XXX 向你提交了好友申请"	审核列表
approve	✅	主人通过审核	访客	"XXX 通过了你的申请"	访客通过页
reject	❌	主人拒绝申请	访客	"你的申请未被 XXX 通过"	锁定页
revoke	↩️	主人撤销权限	访客	"XXX 已撤销你的查看权限"	锁定页
mutual_match	💞	双向互访	双方	"对方也填写了你的表单，是否立即互看？"	对方卡片页
system	🔔	系统消息	主人	系统通知内容	对应页面
八、数据库设计
8.1 表结构
profiles（主人档案）
字段	类型	约束	说明
id	uuid	PK, FK→auth.users(id)	用户ID
email	text		登录邮箱
nickname	text	NOT NULL	昵称
gender	text	NOT NULL	男/女
age	integer	NOT NULL	年龄
wechat	text	NOT NULL	微信号
bio	text	DEFAULT ''	自我介绍
expectation	text	DEFAULT ''	交友期许
photos	text[]	DEFAULT '{}'	照片URL数组
avatar	text		头像URL（从photos中选取或单独上传）
link_id	text	UNIQUE	8位专属链接标识
link_active	boolean	DEFAULT true	链接开关
created_at	timestamptz	DEFAULT NOW()	
updated_at	timestamptz	DEFAULT NOW()	
visitors（访客记录）
字段	类型	约束	说明
id	uuid	PK	
owner_id	uuid	FK→profiles(id) ON DELETE CASCADE	主人ID
visitor_token	text		访客唯一标识（localStorage存储）
nickname	text	NOT NULL	访客昵称
gender	text	NOT NULL	男/女
wechat	text	NOT NULL	微信号
bio	text	DEFAULT ''	自我介绍
expectation	text	DEFAULT ''	交友期许
photos	text[]	DEFAULT '{}'	照片URL数组
status	text	DEFAULT 'pending'	pending/approved/rejected/revoked
allow_reapply	boolean	DEFAULT true	是否允许重新申请
created_at	timestamptz	DEFAULT NOW()	
updated_at	timestamptz	DEFAULT NOW()	
关键设计：访客无需注册，通过 visitor_token（由前端生成的UUID）标识身份，存储在 localStorage 中。

notifications（通知）
字段	类型	约束	说明
id	uuid	PK	
user_id	uuid	FK→profiles(id) ON DELETE CASCADE	接收者ID（主人）
visitor_token	text		访客接收者token（与user_id二选一）
type	text	NOT NULL	new_visitor/approve/reject/revoke/mutual_match/system
content	jsonb	DEFAULT '{}'	{ title, body, link, actor_name, target_id }
is_read	boolean	DEFAULT false	
created_at	timestamptz	DEFAULT NOW()	
8.2 索引
sql
CREATE INDEX idx_profiles_link_id ON profiles(link_id);
CREATE INDEX idx_visitors_owner_id ON visitors(owner_id);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
九、RLS 安全策略
表	SELECT	INSERT	UPDATE	DELETE
profiles	公开字段（nickname/gender/age/bio/expectation）无需登录；完整资料需认证	仅主人（auth.uid() = id）	仅主人	仅主人
visitors	主人可查所有；访客通过 visitor_token 查自己的	访客可插自己的（需匹配 visitor_token）	主人可更新	主人可删除
notifications	主人可查 user_id=自己的；访客可查 visitor_token=自己的	系统写入（via service_role）	本人/访客本人	本人/访客本人
storage	公开读（访客照片URL）	主人可写自己的 bucket 路径；访客可写自己的上传	仅主人	仅主人
十、UI 设计规范
10.1 主题色
类别	色值	用途
Primary	#4a8eff	主色（按钮、链接、高亮）
Primary Dark	#3a7aee	hover态
Primary Light	#f0f6ff	品牌浅背景
Surface	#ffffff	卡片背景
Surface Muted	#f0f2f6	输入框背景
Border	#e6eaef	默认边框
Text Primary	#1a1a2e	主文字
Text Secondary	#6b7280	辅助文字
Success	#10b981	已通过
Warning	#f59e0b	待审核
Danger	#ef4444	已拒绝/危险操作
10.2 组件规范
组件	样式
输入框	rounded-full 胶囊风格，背景 #f0f2f6
文本域	rounded-2xl，禁止resize
按钮	rounded-full，主/次/危险三种，active:scale-98
卡片	rounded-2xl，细边框+轻阴影
Tab切换条	rounded-full 胶囊背景，激活项白色+阴影
状态标签	rounded-full：
  - 待审核 pending：#fff7e6 背景 / #b45309 文字（Warning 橙色）
  - 已通过 approved：#ecfdf5 背景 / #065f46 文字（Success 绿色）
  - 已拒绝 rejected：#fee2e2 背景 / #b91c1c 文字（Danger 红色）
  - 已撤销 revoked：#f0f2f6 背景 / #6b7280 文字（Neutral 灰色）
通知未读	左侧蓝点 + 背景 #f5f8ff
10.3 交互规范
场景	规范
敏感操作（清空访客/注销账户/关闭链接）	Modal二次确认 + 二次确认弹窗需显示操作内容
注销账户二次确认	Modal + 输入"确认注销"文本验证
清空访客二次确认	Modal + "确定要清空所有访客记录吗？此操作不可恢复"
操作反馈	Toast提示（成功绿色/错误红色）
照片上传	显示进度环，失败可重试
访客通知查看	整行可点击跳转并自动标记为已读
主人头像显示	使用 profiles.avatar 字段，若为空则用昵称首字符占位
照片网格	动态显示：已上传照片 + 剩余空位（最多3格）
审核列表	支持按昵称实时搜索，支持分页（每页10条）
十一、访客身份维持机制
text
访客首次打开链接时，前端生成 UUID 作为 visitor_token
  → 存储在 localStorage：'fc_visitor_token'
  → 提交表单时，visitor_token 随表单数据一起提交
  → 查询访客状态时，通过 visitor_token 查询 visitors 表
  → 无需登录，即可查看审核进度和结果
技术实现要点：

visitor_token 在 localStorage 中持久化，清除浏览器数据后丢失

丢失后访客需重新提交表单（原记录成为孤儿数据，可定期清理）

后续可升级为「通过短信验证码绑定」方案

十二、环境变量
变量名	用途	必填
VITE_SUPABASE_URL	Supabase项目URL	是
VITE_SUPABASE_ANON_KEY	Supabase匿名公钥	是
十三、部署
Supabase 配置
配置项	设置	说明
Confirm email	关闭	主人注册无需邮箱验证
Email provider	启用	唯一登录方式
第三方登录	禁用	暂不支持
部署前检查清单
#	检查项	状态
1	关闭 Confirm email	☐
2	执行 v4-lite-schema.sql（建表+RLS+索引）	☐
3	执行 v4-storage.sql（创建 storage bucket + RLS）	☐
4	创建主人账号（通过Supabase控制台或注册接口）	☐
5	设置主人 is_admin = true	☐
十四、可升级功能（规划）
优先级	功能	说明
P2	访客短信验证码绑定	替代 localStorage，更稳定的访客身份
P2	数据导出增强	支持按时间范围导出访客记录
P3	多主人支持	一个平台多个主人账号，各自管理自己的卡片
P3	访客消息回复	主人可直接回复访客申请
十五、验收标准
功能验收
#	功能	标准
1	主人登录	邮箱密码登录成功，跳转后台
2	资料编辑	6项必填+照片保存成功，自动生成link_id
3	链接管理	复制链接、预览卡片、关闭/开启链接正常
4	访客访问锁定页	显示昵称/性别/自我介绍/交友期许，微信号和照片锁定
5	访客填写表单	6项+照片提交成功，草稿自动保存恢复
6	访客状态查询	localStorage记录，刷新页面后状态保持
7	主人审核	同意/拒绝/撤销权限正常，状态实时更新
8	双向互访	双方互相申请后自动approved
9	通知中心	所有通知正确触发，未读/已读区分
10	访客通过后查看	展示完整资料，微信号可复制
11	管理操作	导出数据、清空访客、注销账户（含二次确认）
12	无裂变	访客提交后不生成自己的链接
非功能验收
#	项	标准
1	移动端适配	iPhone/Android主流机型显示正常
2	首屏加载	< 3秒
3	错误处理	所有操作有友好提示
十六、术语表
术语	说明
主人	卡片拥有者，系统管理员账号，负责分发链接和审核访客
访客	通过链接打开页面的用户，无需登录即可提交表单
link_id	8位随机字符串，主人专属链接标识
visitor_token	访客唯一标识，由前端生成并存储在localStorage
pending	待审核状态
approved	已通过状态
rejected	已拒绝状态
revoked	已撤销状态
mutual_match	双向互访，双方互相申请并通过
文档版本： v4.0-lite
最后更新： 2026-08-08

