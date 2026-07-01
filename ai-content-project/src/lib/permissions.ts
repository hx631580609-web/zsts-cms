// 操作类型与标签/颜色映射

export type ActionType = 'create' | 'update' | 'delete' | 'reset' | 'login' | 'view';

export const ACTION_LABEL: Record<ActionType, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  reset: '重置',
  login: '登录',
  view: '查看',
};

export const ACTION_COLOR: Record<ActionType, string> = {
  create: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  update: 'text-blue-600 bg-blue-50 border-blue-200',
  delete: 'text-red-600 bg-red-50 border-red-200',
  reset: 'text-amber-600 bg-amber-50 border-amber-200',
  login: 'text-violet-600 bg-violet-50 border-violet-200',
  view: 'text-zinc-600 bg-zinc-50 border-zinc-200',
};
