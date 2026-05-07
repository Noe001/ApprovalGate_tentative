import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/utils/date'
import { requireAdminRole } from '@/lib/route-guards'

export const Route = createFileRoute('/t/$tenant_id/projects/$project_id/')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { tenant_id, project_id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', project_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys', project_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('api_keys')
        .select('*')
        .eq('project_id', project_id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: recentRequests } = useQuery({
    queryKey: ['project-requests', project_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('approval_requests')
        .select('id, reason, status, created_at')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: isActive })
        .eq('id', project_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project_id] })
      queryClient.invalidateQueries({ queryKey: ['projects', tenant_id] })
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', project_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', tenant_id] })
      navigate({ to: '/t/$tenant_id/projects', params: { tenant_id } })
      toast.success('プロジェクトを削除しました')
    },
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  if (!project) return <div className="p-8 text-center text-gray-500">プロジェクトが見つかりません</div>

  return (
    <div>
      <TopBar
        title={project.name}
        actions={
          <Link to="/t/$tenant_id/projects" params={{ tenant_id }} className="flex items-center gap-1 text-sm text-gray-600">
            <ArrowLeft className="h-4 w-4" />
            一覧
          </Link>
        }
      />
      <div className="p-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="api-keys">APIキー</TabsTrigger>
            <TabsTrigger value="settings">設定</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <div style={{ display: 'flex', borderTop: '1px solid #E8E8E8', borderBottom: '1px solid #E8E8E8' }}>
              {[
                { label: 'APIキー', value: apiKeys?.length ?? 0 },
                { label: '総リクエスト', value: recentRequests?.length ?? 0 },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, padding: '16px 24px', borderRight: i === 0 ? '1px solid #E8E8E8' : 'none' }}>
                  <span className="font-mono uppercase" style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{item.label}</span>
                  <span className="font-mono" style={{ fontSize: 24, color: '#1A1A1A', lineHeight: 1 }}>{item.value}</span>
                </div>
              ))}
            </div>

            {recentRequests && recentRequests.length > 0 && (
              <div>
                <div className="flex items-center pb-3 border-b border-gray-200 mb-0">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">最近のリクエスト</span>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100">
                    {recentRequests.map(req => (
                      <tr key={req.id} className="hover:bg-[#F0F0F0] transition-colors">
                        <td className="py-3 pr-4">
                          <Link
                            to="/t/$tenant_id/approvals/$request_id"
                            params={{ tenant_id, request_id: req.id }}
                            className="text-sm"
                            style={{ color: '#1A1A1A' }}
                          >
                            {req.reason}
                          </Link>
                        </td>
                        <td className="py-3 font-mono text-right" style={{ fontSize: 11, color: '#CCCCCC' }}>{formatDate(req.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="api-keys" className="mt-6">
            <div className="flex justify-end mb-4">
              <Link
                to="/t/$tenant_id/projects/$project_id/api-keys"
                params={{ tenant_id, project_id }}
              >
                <Button>APIキーを管理</Button>
              </Link>
            </div>
            <div className="border-t border-[#E8E8E8]">
              {!apiKeys?.length ? (
                <div className="py-8 text-center font-mono" style={{ fontSize: 11, color: '#CCCCCC' }}>
                  APIキーがありません。「APIキーを管理」からキーを発行してください。
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8E8E8]">
                      <th className="py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>名前</th>
                      <th className="py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>種別</th>
                      <th className="py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>最終使用</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8E8]">
                    {apiKeys.map(key => (
                      <tr key={key.id} className="hover:bg-[#F0F0F0] transition-colors">
                        <td className="py-3 text-sm" style={{ color: '#1A1A1A' }}>{key.name}</td>
                        <td className="py-3">
                          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: key.is_test ? '#CCCCCC' : '#1A1A1A' }}>
                            {key.is_test ? 'TEST' : 'LIVE'}
                          </span>
                        </td>
                        <td className="py-3 font-mono" style={{ fontSize: 11, color: '#CCCCCC' }}>
                          {key.last_used_at ? formatDate(key.last_used_at) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 space-y-8">
            <ApprovalConfigSection
              tenantId={tenant_id}
              projectId={project_id}
              project={project}
            />

            <div className="space-y-4">
              <div className="border-b border-[#E8E8E8] pb-3">
                <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>プロジェクト設定</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>プロジェクトを有効化</p>
                  <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>無効にするとSDKからのリクエストが受け付けられません</p>
                </div>
                <Switch
                  checked={project.is_active}
                  onCheckedChange={(checked) => toggleActiveMutation.mutate(checked)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="pb-3" style={{ borderBottom: '1px solid rgba(215,25,33,0.3)' }}>
                <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#D71921' }}>危険ゾーン</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>プロジェクトを削除</p>
                  <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>この操作は取り消せません</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">削除</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>プロジェクトを削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        「{project.name}」を削除します。この操作は取り消せません。
                        関連するAPIキーとルールもすべて削除されます。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProjectMutation.mutate()}
                        className="font-mono text-[12px] uppercase tracking-[0.06em] rounded-full"
                        style={{ background: 'transparent', border: '1px solid #D71921', color: '#D71921', padding: '8px 20px' }}
                      >
                        DELETE
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

interface ProjectConfig {
  id: string
  default_approver_ids: string[]
  timeout_seconds: number | null
  approver_mode: 'any' | 'all'
}

function ApprovalConfigSection({
  tenantId,
  projectId,
  project,
}: {
  tenantId: string
  projectId: string
  project: ProjectConfig
}) {
  const queryClient = useQueryClient()
  const [approverIds, setApproverIds] = useState<string[]>(project.default_approver_ids ?? [])
  const [timeoutSec, setTimeoutSec] = useState<string>(
    project.timeout_seconds != null ? String(project.timeout_seconds) : ''
  )
  const [mode, setMode] = useState<'any' | 'all'>(project.approver_mode ?? 'any')

  useEffect(() => {
    setApproverIds(project.default_approver_ids ?? [])
    setTimeoutSec(project.timeout_seconds != null ? String(project.timeout_seconds) : '')
    setMode(project.approver_mode ?? 'any')
  }, [project.id])

  const { data: members } = useQuery({
    queryKey: ['approver-candidates', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_members')
        .select('user_id, role, user_profiles(id, name, email_cached)')
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'admin', 'approver'])
      return (data ?? []) as unknown as Array<{
        user_id: string
        role: string
        user_profiles: { id: string; name: string; email_cached?: string | null } | null
      }>
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = timeoutSec.trim()
      const parsed = trimmed === '' ? null : Number(trimmed)
      if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
        throw new Error('タイムアウトは正の整数で入力してください')
      }
      const { error } = await supabase
        .from('projects')
        .update({
          default_approver_ids: approverIds,
          timeout_seconds: parsed,
          approver_mode: mode,
        })
        .eq('id', projectId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('承認設定を保存しました')
    },
    onError: (e: Error) => toast.error(e.message ?? '保存に失敗しました'),
  })

  const toggleApprover = (userId: string) => {
    setApproverIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">承認設定</span>
      </div>

      <div className="space-y-2">
        <p className="block text-sm font-medium text-gray-700">デフォルト承認者</p>
        <p className="text-xs text-gray-500">
          ルールに一致しないリクエストの通知先。owner / admin / approver から選択。
        </p>
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-56 overflow-auto">
          {!members?.length ? (
            <div className="p-3 text-xs text-gray-400">候補となるメンバーがいません</div>
          ) : (
            members.map((m) => {
              const profile = m.user_profiles
              const userId = m.user_id
              const checked = approverIds.includes(userId)
              return (
                <label
                  key={userId}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm text-gray-900">{profile?.name ?? '(no name)'}</p>
                    <p className="text-xs text-gray-500">
                      {profile?.email_cached ?? userId}
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-gray-400">
                        {m.role}
                      </span>
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`${profile?.name ?? userId} をデフォルト承認者にする`}
                    checked={checked}
                    onChange={() => toggleApprover(userId)}
                    className="h-4 w-4"
                  />
                </label>
              )
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="project-default-approver-mode" className="block text-sm font-medium text-gray-700 mb-1">承認モード</label>
          <select
            id="project-default-approver-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'any' | 'all')}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="any">いずれか1人で承認 (any)</option>
            <option value="all">全員の承認が必要 (all)</option>
          </select>
        </div>
        <div>
          <label htmlFor="project-approval-timeout" className="block text-sm font-medium text-gray-700 mb-1">
            タイムアウト（秒）
          </label>
          <input
            id="project-approval-timeout"
            type="number"
            min={1}
            value={timeoutSec}
            onChange={(e) => setTimeoutSec(e.target.value)}
            placeholder="未指定の場合はテナント既定値"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? '保存中...' : '承認設定を保存'}
        </Button>
      </div>
    </div>
  )
}
