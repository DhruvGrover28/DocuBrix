import React from 'react'
import { Card, CardContent, Badge, Input, Textarea, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui'
import { ShieldCheck } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function SettingsPage({ user }) {
  return (
    <>
      <PageHeader title="Settings" subtitle="Administrative controls for the DocuBrix workspace." />

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="account" className="p-4">
            <TabsList>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="privacy">Privacy & Data</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4 p-3">
              <Input value={user.name} readOnly />
              <Input value={user.email} readOnly />
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> <span className="text-sm capitalize text-slate-600">Role: {user.role}</span></div>
            </TabsContent>
            <TabsContent value="profile" className="space-y-4 p-3">
              <Input value="DocuBrix workspace" readOnly />
              <Input value={user.role} readOnly />
              <Textarea value="Your document intelligence workspace." readOnly />
            </TabsContent>
            <TabsContent value="preferences" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Enable smart alerts</span><Badge variant="success">On</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Show summaries on dashboard</span><Badge variant="success">On</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Auto-approve low-risk docs</span><Badge variant="warning">Pilot</Badge></div>
            </TabsContent>
            <TabsContent value="notifications" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Email notifications</span><Badge variant="success">Enabled</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Slack updates</span><Badge variant="muted">Disabled</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Weekly digest</span><Badge variant="success">Enabled</Badge></div>
            </TabsContent>
            <TabsContent value="appearance" className="space-y-4 p-3">
              <Input value="Light" readOnly />
              <Input value="60% density" readOnly />
            </TabsContent>
            <TabsContent value="security" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Session timeout</span><Badge variant="success">Enabled</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>API access review</span><Badge variant="warning">Pending</Badge></div>
            </TabsContent>
            <TabsContent value="privacy" className="space-y-4 p-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Retention policy</span><Badge variant="muted">90 days</Badge></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span>Export controls</span><Badge variant="warning">Restricted</Badge></div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  )
}
