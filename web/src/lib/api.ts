import { config } from '@/config'

const BASE = config.apiUrl

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message || 'Request failed')
  return json.data
}

// Types
export interface Task {
  id: string
  description: string
  category: string
  lat: number
  lon: number
  address: string | null
  radiusMeters: number
  // Approximate location (public listing, exact coords hidden)
  latApprox?: number
  lonApprox?: number
  addressApprox?: string | null
  paymentAmount: string
  escrowAccountIndex: number
  escrowAddress: string
  escrowTxHash: string | null
  status: 'open' | 'accepted' | 'submitted' | 'verified' | 'paid' | 'expired' | 'rejected'
  deadline: string
  workerId: string | null
  worker: Worker | null
  submissions?: Submission[]
  createdAt: string
  updatedAt: string
}

export interface Worker {
  id: string
  name: string | null
  walletAddress: string | null
  skills: string | null
  bio: string | null
  availability: string
  locationLat: number | null
  locationLon: number | null
  reputationScore: number
  tasksCompleted: number
  totalEarned: string
  tasks?: Task[]
  submissions?: Submission[]
  createdAt: string
}

export interface Submission {
  id: string
  taskId: string
  workerId: string
  photoUrl: string | null
  photoIpfsHash: string | null
  gpsLat: number | null
  gpsLon: number | null
  exifData: string | null
  verificationScore: number | null
  verificationResult: string | null
  status: 'pending' | 'approved' | 'rejected' | 'manual_review'
  payoutTxHash: string | null
  attestationUid: string | null
  createdAt: string
}

export interface AgentLog {
  id: string
  action: string
  details: string
  txHash: string | null
  createdAt: string
}

export interface DashboardOverview {
  stats: {
    totalTasks: number
    openTasks: number
    completedTasks: number
    totalWorkers: number
    treasuryBalance: string
    treasuryBalanceFormatted: string
    treasuryAddress: string
  }
  pipeline: {
    open: number
    accepted: number
    submitted: number
    verified: number
    paid: number
  }
  treasury: {
    available: string
    availableFormatted: string
    inEscrow: string
    inEscrowFormatted: string
    aaveSupplied: string
    aaveSuppliedFormatted: string
    eth: string
    ethFormatted: string
  }
  recentLogs: AgentLog[]
}

export interface PipelineTask {
  id: string
  description: string
  paymentAmount: string
  status: string
  workerId: string | null
  createdAt: string
}

export interface TreasuryInfo {
  address: string
  balance: string
  balanceFormatted: string
}

export interface Client {
  id: string
  walletAddress: string
  name: string | null
  balance: string
  totalDeposited: string
  totalSpent: string
  requests?: ClientRequest[]
  createdAt: string
}

export interface ClientRequest {
  id: string
  clientId: string
  description: string
  category: string
  targetLat: number | null
  targetLon: number | null
  targetAddress: string | null
  budget: string
  pricePerTask: string | null
  maxPricePerTask: string | null
  tasksRequested: number
  tasksCreated: number
  tasksCompleted: number
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'insufficient_funds'
  createdAt: string
}

// Tasks
export const api = {
  tasks: {
    list: () => request<Task[]>('/tasks/list'),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    accept: (taskId: string, workerId: string) =>
      request<Task>(`/tasks/${taskId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ workerId }),
      }),
    treasuryInfo: () => request<TreasuryInfo>('/tasks/treasury/info'),
  },

  submissions: {
    submit: (taskId: string, data: { workerId: string; photoBase64: string; gpsLat: number; gpsLon: number; reportData?: string }) =>
      request<{ submission: Submission; verification: { overallScore: number; passed: boolean; reason: string }; payout: { workerTxHash: string } | null }>(
        `/submissions/${taskId}/submit`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
  },

  workers: {
    register: (walletAddress?: string, name?: string) =>
      request<{ worker: Worker; wallet: { address: string; seedPhrase: string }; verified: boolean }>('/workers/register', {
        method: 'POST',
        body: JSON.stringify({ name, walletAddress }),
      }),
    get: (id: string) => request<Worker>(`/workers/${id}`),
    getByWallet: (address: string) => request<Worker>(`/workers/wallet/${address}`),
    list: () => request<Worker[]>('/workers/list'),
    search: (skill?: string, availableOnly?: boolean) => {
      const params = new URLSearchParams()
      if (skill) params.set('skill', skill)
      if (availableOnly) params.set('available', 'true')
      return request<{ count: number; workers: Worker[] }>(`/workers/search?${params}`)
    },
    updateProfile: (data: { workerId: string; skills?: string; bio?: string; availability?: string; name?: string }) =>
      request<Worker>('/workers/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },

  dashboard: {
    overview: () => request<DashboardOverview>('/dashboard/overview'),
    pipeline: () => request<Record<string, PipelineTask[]>>('/dashboard/pipeline'),
    wallets: () => request<{ chains: string[]; chainCount: number; wallets: Record<string, string> }>('/dashboard/wallets'),
    logs: (limit?: number, action?: string) => {
      const params = new URLSearchParams()
      if (limit) params.set('limit', String(limit))
      if (action) params.set('action', action)
      return request<AgentLog[]>(`/dashboard/logs?${params}`)
    },
  },

  agent: {
    run: () => request('/agent/run', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'x-admin-key': import.meta.env.VITE_AGENT_ADMIN_KEY || '' },
    }),
    activity: (limit?: number) =>
      request<AgentLog[]>(`/agent/activity${limit ? `?limit=${limit}` : ''}`),
    reasoning: (limit?: number) =>
      request<AgentLog[]>(`/agent/reasoning${limit ? `?limit=${limit}` : ''}`),
  },

  clients: {
    register: (walletAddress: string, name?: string) =>
      request<Client>('/clients/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, name }),
      }),
    deposit: (walletAddress: string, amount: string, txHash?: string) =>
      request<{ client: Client; deposit: { amount: string; amountFormatted: string }; treasuryAddress: string }>(
        '/clients/deposit',
        { method: 'POST', body: JSON.stringify({ walletAddress, amount, txHash }) },
      ),
    request: (data: {
      walletAddress: string
      description: string
      category: string
      budget: string
      targetLat?: number
      targetLon?: number
      targetAddress?: string
      tasksRequested?: number
    }) =>
      request<{ request: ClientRequest; budgetFormatted: string; perTaskFormatted: string }>(
        '/clients/request',
        { method: 'POST', body: JSON.stringify(data) },
      ),
    get: (walletAddress: string) => request<Client>(`/clients/${walletAddress}`),
    results: (requestId: string) =>
      request<{ request: ClientRequest; tasks: Task[]; summary: { totalTasks: number; completed: number; pending: number } }>(
        `/clients/request/${requestId}/results`,
      ),
  },
}
