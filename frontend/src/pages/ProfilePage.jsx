import React, { useRef, useState } from 'react'
import { Camera, Check, Upload, User } from 'lucide-react'
import { toast } from 'sonner'
import { updateCurrentUser } from '../api/client'
import PageHeader from '../components/PageHeader'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '../components/ui'

// 12 colorful preset avatars via DiceBear (SVG, stable)
const PRESET_AVATARS = [
  { id: 'av1',  url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=DocuBrix1&background=%23dbeafe' },
  { id: 'av2',  url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=DocuBrix2&background=%23fef3c7' },
  { id: 'av3',  url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=DocuBrix3&background=%23dcfce7' },
  { id: 'av4',  url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=DocuBrix4&background=%23ede9fe' },
  { id: 'av5',  url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=DocuBrix5&background=%23fee2e2' },
  { id: 'av6',  url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=DocuBrix6&background=%23f0fdf4' },
  { id: 'av7',  url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DocuBrix7&background=%23dbeafe' },
  { id: 'av8',  url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DocuBrix8&background=%23fef3c7' },
  { id: 'av9',  url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DocuBrix9&background=%23dcfce7' },
  { id: 'av10', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DocuBrix10&background=%23ede9fe' },
  { id: 'av11', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=DocuBrix11&background=%23fee2e2' },
  { id: 'av12', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=DocuBrix12&background=%23f0fdf4' },
]

const ROLE_BADGE_COLORS = {
  admin:    'bg-purple-100 text-purple-700 border border-purple-200',
  reviewer: 'bg-amber-100 text-amber-700 border border-amber-200',
  user:     'bg-blue-100 text-blue-700 border border-blue-200',
}

function getStoredAvatar(userId) {
  try { return localStorage.getItem(`docubrix_avatar_${userId}`) || null } catch { return null }
}
function saveStoredAvatar(userId, url) {
  try { localStorage.setItem(`docubrix_avatar_${userId}`, url) } catch {}
}

export default function ProfilePage({ user, onUserUpdated }) {
  const [name, setName]       = useState(user.name)
  const [saving, setSaving]   = useState(false)
  const [avatar, setAvatar]   = useState(() => getStoredAvatar(user.id || user.email))
  const [tab, setTab]         = useState('presets') // 'presets' | 'upload'
  const fileInputRef          = useRef(null)

  const handleSave = async () => {
    try {
      setSaving(true)
      const updatedUser = await updateCurrentUser({ name })
      onUserUpdated(updatedUser)
      toast.success('Profile updated successfully.')
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Unable to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectPreset = (url) => {
    setAvatar(url)
    saveStoredAvatar(user.id || user.email, url)
    toast.success('Avatar updated!')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target.result
      setAvatar(url)
      saveStoredAvatar(user.id || user.email, url)
      toast.success('Custom photo set!')
    }
    reader.readAsDataURL(file)
  }

  const initials = name.slice(0, 2).toUpperCase()

  return (
    <>
      <PageHeader title="Profile" subtitle="Personalize your identity and workspace." />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        {/* Left — Avatar card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Identity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center gap-4">
            {/* Avatar display */}
            <div className="relative group">
              {avatar ? (
                <img
                  src={avatar}
                  alt="avatar"
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-100 dark:ring-blue-900 shadow-md"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-400 flex items-center justify-center text-2xl font-bold text-white ring-4 ring-blue-100 dark:ring-blue-900 shadow-md">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                title="Upload photo"
              >
                <Camera className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            <div>
              <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{name}</div>
              <div className="mt-1.5">
                <span className={`inline-block text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full ${ROLE_BADGE_COLORS[user.role] || ROLE_BADGE_COLORS.user}`}>
                  {user.role}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
            </div>

            {/* Stats row */}
            <div className="w-full grid grid-cols-3 gap-2 mt-2">
              {[
                { label: 'Docs', value: '—' },
                { label: 'Reviews', value: '—' },
                { label: 'Days Active', value: '1+' },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 text-center">
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right — Edit info + avatar picker */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <Input value={user.email} readOnly />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                <Input value={user.role} readOnly />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Organization</label>
                <Input value="DocuBrix workspace" readOnly />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={handleSave} disabled={saving || name.trim().length < 2} className="active:scale-95 transition-transform">
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Choose Avatar</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {['presets', 'upload'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      tab === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t === 'presets' ? '🎨 Preset Avatars' : '📷 Upload Photo'}
                  </button>
                ))}
              </div>

              {tab === 'presets' ? (
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map(av => (
                    <button
                      key={av.id}
                      onClick={() => handleSelectPreset(av.url)}
                      className={`relative rounded-full overflow-hidden ring-2 transition-transform hover:scale-110 hover:ring-blue-400 ${
                        avatar === av.url ? 'ring-blue-500 scale-110' : 'ring-transparent'
                      }`}
                    >
                      <img src={av.url} alt={av.id} className="h-10 w-10 object-cover" />
                      {avatar === av.url && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-600/40 rounded-full">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div
                    className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-400 transition"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-6 w-6 text-slate-400" />
                    <div className="text-sm text-slate-500 dark:text-slate-400">Click to upload a photo</div>
                    <div className="text-xs text-slate-400">PNG, JPG, GIF up to 2 MB</div>
                  </div>
                  {avatar && avatar.startsWith('data:') && (
                    <div className="text-xs text-emerald-500 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Custom photo active
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
