export const profileData = {
  name: 'Aisha Patel',
  email: 'aisha.patel@docubrix.ai',
  phone: '+1 (415) 555-0198',
  organization: 'DocuBrix Labs',
  role: 'Operations Analyst',
  location: 'London, UK',
  bio: 'Document automation specialist focused on financial workflows and operational intelligence.',
  avatar: 'AP',
}

export const appShellNav = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Document Processing', path: '/processing' },
  { label: 'Document Library', path: '/library' },
  { label: 'Review Queue', path: '/review' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'System Status', path: '/status' },
  { label: 'Profile', path: '/profile' },
  { label: 'Settings', path: '/settings' },
  { label: 'Team Management', path: '/team', comingSoon: true },
  { label: 'Workflow Automation', path: '/automation', comingSoon: true },
  { label: 'Exports & Reports', path: '/reports', comingSoon: true },
  { label: 'Integrations', path: '/integrations', comingSoon: true },
]

export const defaultStats = {
  totalDocuments: 0,
  documentsNeedingReview: 0,
  successfulDocuments: 0,
  averageConfidence: 0,
}
