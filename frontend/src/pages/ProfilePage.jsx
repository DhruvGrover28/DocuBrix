import React, { useState } from 'react'
import { updateCurrentUser } from '../api/client'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '../components/ui'
import { toast } from 'sonner'
import PageHeader from '../components/PageHeader'

export default function ProfilePage({ user, onUserUpdated }) {
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)

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

  return (
    <>
      <PageHeader title="Profile" subtitle="Professional identity and workspace context." />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-400 text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>
            <div className="text-2xl font-semibold text-slate-900">{name}</div>
            <div className="mt-1 text-sm capitalize text-slate-600">{user.role}</div>
            <div className="mt-5 text-sm text-slate-600">{user.email}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <Input value={user.email} readOnly />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
              <Input value={user.role} readOnly />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Organization</label>
              <Input value="DocuBrix workspace" readOnly />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleSave} disabled={saving || name.trim().length < 2}>
                {saving ? 'Saving...' : 'Save profile'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
