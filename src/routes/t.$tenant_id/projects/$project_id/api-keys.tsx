import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Key, ArrowLeft, Eye, EyeOff, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/common/CopyButton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { formatDate } from '@/lib/utils/date'
import { requireAdminRole } from '@/lib/route-guards'

function generateApiKey(isTest: boolean): string {
  const prefix = isTest ? 'rg_test_' : 'rg_live_'
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = prefix
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const Route = createFileRoute('/t/$tenant_id/projects/$project_id/api-keys')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: ApiKeysPage,
})

function ApiKeysPage() {
  const { tenant_id, project_id } = Route.useParams()
  const queryClient = useQueryClient()
  const [isNewKeyOpen, setIsNewKeyOpen] = useState(false)
  const [isTest, setIsTest] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState(false)

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys', project_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('api_keys')
        .select('*')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const createKeyMutation = useMutation({
    mutationFn: async ({ name, isTest }: { name: string; isTest: boolean }) => {
      const rawKey = generateApiKey(isTest)
      const hash = await hashKey(rawKey)
      const lastFour = rawKey.slice(-4)

      const { error } = await supabase.from('api_keys').insert({
        project_id,
        name,
        key_prefix: isTest ? 'rg_test_' : 'rg_live_',
        key_hash: hash,
        last_four: lastFour,
        is_test: isTest,
      })

      if (error) throw error
      return rawKey
    },
    onSuccess: (rawKey) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', project_id] })
      setNewKey(rawKey)
      setShowNewKey(true)
      setIsNewKeyOpen(false)
      setKeyName('')
      toast.success('APIキーを発行しました')
    },
  })

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', project_id] })
      toast.success('APIキーを無効化しました')
    },
  })

  return (
    <div>
      <TopBar
        title="APIキー管理"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/t/$tenant_id/projects/$project_id"
              params={{ tenant_id, project_id }}
              className="flex items-center gap-1 text-sm text-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
              プロジェクトに戻る
            </Link>
            <Button onClick={() => setIsNewKeyOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              新規発行
            </Button>
          </div>
        }
      />

      {newKey && (
        <div className="mx-6 mt-4 p-4" style={{ background: 'transparent', border: '1px solid #D4A843', borderRadius: 8 }}>
          <p className="font-mono uppercase mb-2" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#D4A843' }}>API KEY — SAVE NOW</p>
          <p className="font-mono mb-3" style={{ fontSize: 11, color: '#999999' }}>このキーは一度しか表示されません。今すぐコピーして安全な場所に保存してください。</p>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#F8F8F8', border: '1px solid #E8E8E8' }}>
            <code className="text-sm flex-1 font-mono break-all" style={{ color: '#1A1A1A' }}>
              {showNewKey ? newKey : '••••••••••••••••••••••••••••••••••••••••'}
            </code>
            <button
              onClick={() => setShowNewKey(!showNewKey)}
              className="p-1 transition-colors"
              style={{ color: '#999999' }}
            >
              {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <CopyButton value={newKey} />
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 font-mono uppercase"
            style={{ fontSize: 11, letterSpacing: '0.06em', color: '#CCCCCC' }}
          >
            CLOSE (保存済みの場合)
          </button>
        </div>
      )}

      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-8 font-mono" style={{ fontSize: 11, color: '#CCCCCC' }}>読み込み中...</div>
        ) : (
          <div style={{ border: '1px solid #E8E8E8', borderRadius: 8, overflow: 'hidden' }}>
            {!apiKeys?.length ? (
              <div className="p-8 text-center font-mono" style={{ fontSize: 11, color: '#CCCCCC' }}>
                APIキーがありません。「新規発行」からキーを作成してください。
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8E8E8]">
                    <th className="px-6 py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>名前</th>
                    <th className="px-6 py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>種別</th>
                    <th className="px-6 py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>末尾4桁</th>
                    <th className="px-6 py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>最終使用</th>
                    <th className="px-6 py-3 text-left font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>ステータス</th>
                    <th className="px-6 py-3 text-left font-mono uppercase w-16" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {apiKeys.map(key => (
                    <tr key={key.id} className={`hover:bg-[#F0F0F0] transition-colors ${key.revoked_at ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-3 text-sm" style={{ color: '#1A1A1A' }}>
                        <div className="flex items-center gap-2">
                          <Key className="h-3.5 w-3.5" style={{ color: '#CCCCCC' }} />
                          {key.name}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: key.is_test ? '#CCCCCC' : '#1A1A1A', border: '1px solid #CCCCCC', padding: '2px 6px' }}>
                          {key.is_test ? 'TEST' : 'LIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono" style={{ fontSize: 12, color: '#999999' }}>...{key.last_four}</td>
                      <td className="px-6 py-3 font-mono" style={{ fontSize: 11, color: '#CCCCCC' }}>
                        {key.last_used_at ? formatDate(key.last_used_at) : '未使用'}
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: key.revoked_at ? '#D71921' : '#4A9E5C' }}>
                          {key.revoked_at ? '無効' : '有効'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {!key.revoked_at && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="p-1 transition-colors" style={{ color: '#CCCCCC' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#D71921')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = '#CCCCCC')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>APIキーを無効化しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  「{key.name}」を無効化します。このキーを使用しているSDKは動作しなくなります。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => revokeKeyMutation.mutate(key.id)}
                                  className="font-mono text-[12px] uppercase tracking-[0.06em] rounded-full"
                                  style={{ background: 'transparent', border: '1px solid #D71921', color: '#D71921', padding: '8px 20px' }}
                                >
                                  REVOKE
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* New key dialog */}
      <Dialog open={isNewKeyOpen} onOpenChange={setIsNewKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>APIキーを発行</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="api-key-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>KEY NAME</label>
              <input
                id="api-key-name"
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="production-key"
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: '#1A1A1A' }}>テスト用キー</p>
                <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>テスト用キーはSlack通知を送信しません</p>
              </div>
              <Switch checked={isTest} onCheckedChange={setIsTest} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewKeyOpen(false)}>キャンセル</Button>
            <Button
              onClick={() => {
                if (!keyName.trim()) {
                  toast.error('キー名を入力してください')
                  return
                }
                createKeyMutation.mutate({ name: keyName, isTest })
              }}
              disabled={createKeyMutation.isPending}
            >
              発行する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
