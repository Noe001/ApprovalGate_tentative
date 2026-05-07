import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addDays } from 'date-fns'
import { Trash2, UserPlus, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/hooks/use-current-user'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { formatDate } from '@/lib/utils/date'
import { ROLE_LABELS } from '@/types/enums'
import type { UserRole } from '@/types/enums'
import { requireAdminRole } from '@/lib/route-guards'

export const Route = createFileRoute('/t/$tenant_id/team')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: TeamPage,
})

type MemberRole = 'owner' | 'admin' | 'approver' | 'viewer'

interface MemberRow {
  id: string
  user_id: string
  role: MemberRole
  joined_at: string
  user_profiles: {
    id: string
    name: string
    avatar_url: string | null
    email_cached?: string
  } | null
}

interface InvitationRow {
  id: string
  email: string
  role: MemberRole
  expires_at: string
  created_at: string
}

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className="inline-flex items-center font-mono uppercase"
      style={{
        fontSize: 10,
        letterSpacing: '0.08em',
        color: '#999999',
        border: '1px solid #CCCCCC',
        borderRadius: 4,
        padding: '2px 8px',
      }}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function TeamPage() {
  const { tenant_id } = Route.useParams()
  const { role } = Route.useRouteContext() as { role: UserRole; tenantName: string }
  const { user } = useCurrentUser()
  const queryClient = useQueryClient()

  const canManage = role === 'owner' || role === 'admin'

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('approver')
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  // Fetch members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', tenant_id],
    queryFn: async () => {
      const { data: memberData, error } = await supabase
        .from('tenant_members')
        .select('id, user_id, role, joined_at')
        .eq('tenant_id', tenant_id)
        .order('joined_at', { ascending: true })
      if (error) throw error
      const userIds = (memberData ?? []).map(m => m.user_id)
      const { data: profiles } = userIds.length
        ? await supabase.from('user_profiles').select('id, name, avatar_url').in('id', userIds)
        : { data: [] }
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
      return (memberData ?? []).map(m => ({
        ...m,
        user_profiles: profileMap[m.user_id] ?? null,
      })) as MemberRow[]
    },
  })

  // Fetch pending invitations
  const { data: invitations } = useQuery({
    queryKey: ['team-invitations', tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, expires_at, created_at')
        .eq('tenant_id', tenant_id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as InvitationRow[]
    },
  })

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: MemberRole }) => {
      const { error } = await supabase
        .from('tenant_members')
        .update({ role: newRole })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', tenant_id] })
      toast.success('ロールを変更しました')
    },
    onError: () => {
      toast.error('ロールの変更に失敗しました')
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('tenant_members')
        .delete()
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', tenant_id] })
      setRemovingMemberId(null)
      toast.success('メンバーを削除しました')
    },
    onError: () => {
      toast.error('メンバーの削除に失敗しました')
    },
  })

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email, inviteRole }: { email: string; inviteRole: MemberRole }) => {
      if (!user) throw new Error('Not authenticated')
      const expiresAt = addDays(new Date(), 7).toISOString()
      const { error } = await supabase
        .from('invitations')
        .insert({
          tenant_id,
          inviter_id: user.id,
          email,
          role: inviteRole,
          expires_at: expiresAt,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', tenant_id] })
      setInviteEmail('')
      setInviteRole('approver')
      toast.success('招待を送りました')
    },
    onError: () => {
      toast.error('招待の送信に失敗しました')
    },
  })

  // Cancel invitation mutation
  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', tenant_id] })
      toast.success('招待をキャンセルしました')
    },
    onError: () => {
      toast.error('招待のキャンセルに失敗しました')
    },
  })

  function canChangeRole(member: MemberRow): boolean {
    if (!canManage) return false
    // Only owner can modify other admins
    if (member.role === 'owner') return false
    if (member.role === 'admin' && role !== 'owner') return false
    // Cannot change own role
    if (member.user_id === user?.id) return false
    return true
  }

  function canRemoveMember(member: MemberRow): boolean {
    if (!canManage) return false
    // Cannot remove self
    if (member.user_id === user?.id) return false
    // Only owner can remove admins
    if (member.role === 'owner') return false
    if (member.role === 'admin' && role !== 'owner') return false
    return true
  }

  const roleOptions: MemberRole[] = role === 'owner'
    ? ['admin', 'approver', 'viewer']
    : ['approver', 'viewer']

  return (
    <div>
      <TopBar title="チーム管理" />
      <div className="p-6 space-y-8">
        {/* Member list */}
        <div>
          <div className="border-b border-[#E8E8E8] pb-3 mb-0">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#999999]">メンバー</span>
          </div>
          <div>
            {membersLoading ? (
              <div className="py-8 text-center font-mono text-[11px]" style={{ color: '#CCCCCC' }}>読み込み中...</div>
            ) : !members || members.length === 0 ? (
              <EmptyState
                title="メンバーがいません"
                description="チームメンバーを招待してください"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">MEMBER</th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">ROLE</th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">JOINED</th>
                    {canManage && (
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 w-12" />
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((member) => {
                    const profile = member.user_profiles
                    const name = profile?.name ?? '(不明なユーザー)'
                    const email = (profile as { email_cached?: string } | null)?.email_cached
                    const isCurrentUser = member.user_id === user?.id

                    return (
                      <tr key={member.id} className="hover:bg-[#F0F0F0] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-[#E8E8E8] flex items-center justify-center shrink-0">
                              <span className="font-mono text-xs font-medium text-[#1A1A1A]">
                                {getInitials(name)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm text-[#1A1A1A]">
                                {name}
                                {isCurrentUser && (
                                  <span className="ml-2 font-mono text-[10px] text-[#999999] uppercase tracking-[0.06em]">(YOU)</span>
                                )}
                              </p>
                              {email && (
                                <p className="font-mono text-[11px] text-[#999999]">{email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {canChangeRole(member) ? (
                            <Select
                              value={member.role}
                              onValueChange={(val) =>
                                changeRoleMutation.mutate({
                                  memberId: member.id,
                                  newRole: val as MemberRole,
                                })
                              }
                              disabled={changeRoleMutation.isPending}
                            >
                              <SelectTrigger className="w-32 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roleOptions.map((r) => (
                                  <SelectItem key={r} value={r} className="text-xs">
                                    {ROLE_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <RoleBadge role={member.role} />
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[#999999]">
                          {formatDate(member.joined_at)}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            {canRemoveMember(member) && (
                              <AlertDialog
                                open={removingMemberId === member.id}
                                onOpenChange={(open) => {
                                  if (!open) setRemovingMemberId(null)
                                }}
                              >
                                <AlertDialogTrigger asChild>
                                  <button
                                    className="p-1.5 rounded transition-colors"
                                    style={{ color: '#CCCCCC' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#D71921')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = '#CCCCCC')}
                                    onClick={() => setRemovingMemberId(member.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>メンバーを削除しますか？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      <strong>{name}</strong> をチームから削除します。
                                      この操作は元に戻せません。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="font-mono text-[12px] uppercase tracking-[0.06em] rounded-full"
                                      style={{ background: 'transparent', border: '1px solid #D71921', color: '#D71921', padding: '8px 20px' }}
                                      onClick={() => removeMemberMutation.mutate(member.id)}
                                    >
                                      削除する
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Invite section - admin/owner only */}
        {canManage && (
          <div>
            <div className="border-b border-[#E8E8E8] pb-3 mb-4">
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#999999]">招待を送る</span>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#CCCCCC' }} />
                    <input
                      type="email"
                      placeholder="メールアドレスを入力"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full pl-9 pr-3 h-10 text-sm outline-none transition-colors"
                      style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                      onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                      onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && inviteEmail.trim()) {
                          inviteMutation.mutate({ email: inviteEmail.trim(), inviteRole })
                        }
                      }}
                    />
                  </div>
                </div>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (!inviteEmail.trim()) return
                    inviteMutation.mutate({ email: inviteEmail.trim(), inviteRole })
                  }}
                  disabled={inviteMutation.isPending || !inviteEmail.trim()}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  招待を送る
                </Button>
              </div>

              {/* Pending invitations */}
              {invitations && invitations.length > 0 && (
                <div>
                  <p className="font-mono uppercase text-[10px] tracking-[0.08em] mb-2" style={{ color: '#999999' }}>保留中の招待</p>
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between py-3 border-b border-[#E8E8E8] last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 shrink-0" style={{ color: '#CCCCCC' }} />
                          <div>
                            <p className="text-sm" style={{ color: '#1A1A1A' }}>{inv.email}</p>
                            <p className="font-mono text-[11px]" style={{ color: '#999999' }}>
                              {ROLE_LABELS[inv.role]} · 有効期限: {formatDate(inv.expires_at)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => cancelInviteMutation.mutate(inv.id)}
                          disabled={cancelInviteMutation.isPending}
                          className="font-mono text-[11px] uppercase tracking-[0.06em] disabled:opacity-50"
                          style={{ color: '#CCCCCC', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#D71921')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#CCCCCC')}
                        >
                          CANCEL
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
