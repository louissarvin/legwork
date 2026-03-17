#!/usr/bin/env bun
/**
 * Legwork End-to-End Test Script
 *
 * Tests the full pipeline on a running backend:
 * - Scenario A: Agent posts task, worker completes, verification, payout
 * - Scenario B: Client deposits, requests tasks, agent fulfills
 * - Scenario C: t402 API call with revenue tracking
 *
 * Usage:
 *   bun scripts/e2e-test.ts                    # Run against localhost:3700
 *   bun scripts/e2e-test.ts http://host:port   # Custom backend URL
 */

const BASE = process.argv[2] || 'http://localhost:3700'

async function request(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  const json = await res.json()
  return json
}

function log(label: string, msg: string) {
  console.log(`  [${label}] ${msg}`)
}

function section(title: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('='.repeat(60))
}

async function testHealthCheck() {
  section('HEALTH CHECK')
  const res = await request('/')
  log('OK', `${res.message} (v${res.data.version}, ${res.data.network})`)
}

async function testTreasuryInfo() {
  section('TREASURY INFO')
  const res = await request('/tasks/treasury/info')
  if (res.success) {
    log('OK', `Address: ${res.data.address}`)
    log('OK', `Balance: ${res.data.balanceFormatted}`)
    return res.data
  }
  log('WARN', `Treasury check failed: ${res.error?.message || 'unknown'}`)
  return null
}

async function testScenarioA() {
  section('SCENARIO A: AUTONOMOUS AGENT PIPELINE')

  // 1. Register a worker
  log('STEP', 'Registering worker...')
  const workerRes = await request('/workers/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'E2E_TestWorker' }),
  })
  if (!workerRes.success) {
    log('FAIL', `Worker registration failed: ${workerRes.error?.message}`)
    return null
  }
  const worker = workerRes.data.worker
  log('OK', `Worker: ${worker.id} (${worker.walletAddress})`)
  log('OK', `Seed phrase: ${workerRes.data.wallet.seedPhrase.split(' ').slice(0, 3).join(' ')}...`)

  // 2. List open tasks
  log('STEP', 'Listing open tasks...')
  const tasksRes = await request('/tasks/list')
  log('OK', `Open tasks: ${tasksRes.data?.length || 0}`)

  // 3. If no open tasks, try triggering agent (it will create tasks if treasury has funds)
  if (!tasksRes.data?.length) {
    log('STEP', 'No open tasks. Triggering agent cycle...')
    const agentRes = await request('/agent/run', { method: 'POST' })
    if (agentRes.success) {
      log('OK', `Agent ran: ${agentRes.data.iterations} iterations, ${agentRes.data.decisions?.reduce((s: number, d: any) => s + d.toolCalls.length, 0) || 0} tool calls`)
    } else {
      log('WARN', `Agent cycle failed: ${agentRes.error?.message}`)
    }

    // Re-check tasks
    const tasksRes2 = await request('/tasks/list')
    log('OK', `Open tasks after agent: ${tasksRes2.data?.length || 0}`)

    if (!tasksRes2.data?.length) {
      log('SKIP', 'No tasks available. Treasury may be empty. Skipping worker flow.')
      return null
    }
  }

  // 4. Accept first open task
  const openTasks = (await request('/tasks/list')).data
  const task = openTasks[0]
  log('STEP', `Accepting task ${task.id.slice(0, 8)}... ($${(Number(task.paymentAmount) / 1e6).toFixed(2)} USDT)`)

  const acceptRes = await request(`/tasks/${task.id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ workerId: worker.id }),
  })
  if (!acceptRes.success) {
    log('FAIL', `Accept failed: ${acceptRes.error?.message}`)
    return { worker, task: null }
  }
  log('OK', 'Task accepted')

  // 5. Submit proof (fake photo for testing)
  log('STEP', 'Submitting proof (test data)...')
  const fakePhoto = Buffer.from('fake-photo-for-testing').toString('base64')
  const submitRes = await request(`/submissions/${task.id}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      workerId: worker.id,
      photoBase64: fakePhoto,
      gpsLat: task.lat + 0.0001, // Slightly offset (within radius)
      gpsLon: task.lon + 0.0001,
    }),
  })

  if (submitRes.success) {
    const sub = submitRes.data
    log('OK', `Verification score: ${sub.verification?.overallScore || sub.submission?.verificationScore || 'N/A'}`)
    log('OK', `Status: ${sub.submission?.status}`)
    if (sub.payout) {
      log('OK', `Payout TX: ${sub.payout.workerTxHash}`)
      log('OK', `Worker received: ${Number(sub.payout.workerPayout) / 1e6} USDT`)
      log('OK', `Platform fee: ${Number(sub.payout.platformFee) / 1e6} USDT`)
    }
    if (sub.attestation?.uid) {
      log('OK', `EAS Attestation: ${sub.attestation.uid}`)
    }
  } else {
    log('WARN', `Submission failed: ${submitRes.error?.message}`)
  }

  return { worker, task }
}

async function testScenarioB() {
  section('SCENARIO B: CLIENT-FUNDED TASKS')

  // 1. Register client
  const clientWallet = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  log('STEP', `Registering client ${clientWallet.slice(0, 10)}...`)

  const regRes = await request('/clients/register', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: clientWallet, name: 'E2E_TestClient' }),
  })
  if (!regRes.success) {
    log('FAIL', `Client registration failed: ${regRes.error?.message}`)
    return
  }
  log('OK', `Client registered: ${regRes.data.id}`)

  // 2. Deposit USDT
  log('STEP', 'Depositing 100 USDT...')
  const depositRes = await request('/clients/deposit', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: clientWallet, amount: '100000000' }), // 100 USDT
  })
  if (!depositRes.success) {
    log('FAIL', `Deposit failed: ${depositRes.error?.message}`)
    return
  }
  log('OK', `Deposited: ${depositRes.data.deposit.amountFormatted}`)
  log('OK', `Client balance: ${Number(depositRes.data.client.balance) / 1e6} USDT`)
  log('OK', `Treasury address: ${depositRes.data.treasuryAddress}`)

  // 3. Submit task request
  log('STEP', 'Submitting task request: "Photograph 3 coffee shops in downtown"...')
  const reqRes = await request('/clients/request', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: clientWallet,
      description: 'Photograph 3 coffee shops in downtown Manhattan',
      category: 'photo',
      budget: '75000000', // 75 USDT
      tasksRequested: 3,
      targetAddress: 'Manhattan, NY',
    }),
  })
  if (!reqRes.success) {
    log('FAIL', `Request failed: ${reqRes.error?.message}`)
    return
  }
  log('OK', `Request created: ${reqRes.data.request.id}`)
  log('OK', `Budget: ${reqRes.data.budgetFormatted}, Per task: ${reqRes.data.perTaskFormatted}`)
  log('OK', `Status: ${reqRes.data.request.status}`)

  // 4. Check client profile
  const profileRes = await request(`/clients/${clientWallet}`)
  if (profileRes.success) {
    log('OK', `Balance after request: ${Number(profileRes.data.balance) / 1e6} USDT`)
    log('OK', `Pending requests: ${profileRes.data.requests.filter((r: any) => r.status === 'pending').length}`)
  }

  // 5. Trigger agent to fulfill the request
  log('STEP', 'Triggering agent cycle to fulfill client request...')
  const agentRes = await request('/agent/run', { method: 'POST' })
  if (agentRes.success) {
    log('OK', `Agent ran: ${agentRes.data.iterations} iterations`)
    // Check if agent created tasks
    const resultsRes = await request(`/clients/request/${reqRes.data.request.id}/results`)
    if (resultsRes.success) {
      log('OK', `Tasks created: ${resultsRes.data.summary.totalTasks}`)
      log('OK', `Completed: ${resultsRes.data.summary.completed}`)
      log('OK', `Pending: ${resultsRes.data.summary.pending}`)
    }
  } else {
    log('WARN', `Agent cycle failed: ${agentRes.error?.message}`)
  }
}

async function testScenarioC() {
  section('SCENARIO C: T402 AGENT-TO-AGENT COMMERCE')

  // 1. List t402 endpoints
  log('STEP', 'Querying t402 endpoints...')
  const endpointsRes = await request('/t402/endpoints')
  if (endpointsRes.success) {
    for (const ep of endpointsRes.data.endpoints) {
      log('OK', `${ep.endpoint}: ${ep.price} (${ep.description.slice(0, 50)})`)
    }
  }

  // 2. Call /t402/verify without payment (get 402)
  log('STEP', 'Calling /t402/verify without payment...')
  const noPayRes = await fetch(`${BASE}/t402/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  log('OK', `Status: ${noPayRes.status} (expected 402)`)
  if (noPayRes.status === 402) {
    const body = await noPayRes.json()
    log('OK', `Payment required: ${body.paymentRequired?.price} to ${body.paymentRequired?.payTo?.slice(0, 10)}...`)
  }

  // 3. Call with payment header (demo mode)
  log('STEP', 'Calling /t402/verify with payment header (demo mode)...')
  const paidRes = await request('/t402/verify', {
    method: 'POST',
    headers: { 'payment-signature': 'demo-signature-for-testing' },
    body: JSON.stringify({
      taskDescription: 'Verify this storefront photo',
      gpsLat: 40.7128,
      gpsLon: -74.006,
    }),
  })
  if (paidRes.success) {
    log('OK', `Response: ${paidRes.data.message || 'Service accessed'}`)
    log('OK', `Payment received: ${paidRes.data.paymentReceived}`)
  }

  // 4. Call /t402/reputation
  log('STEP', 'Calling /t402/reputation (demo mode)...')
  const repRes = await request('/t402/reputation/0x1234567890abcdef', {
    headers: { 'payment-signature': 'demo-signature' },
  })
  if (repRes.success) {
    log('OK', `Reputation: score=${repRes.data.reputation.reputationScore}, tasks=${repRes.data.reputation.tasksCompleted}`)
  }

  // 5. Call /t402/analytics
  log('STEP', 'Calling /t402/analytics (demo mode)...')
  const anaRes = await request('/t402/analytics', {
    headers: { 'payment-signature': 'demo-signature' },
  })
  if (anaRes.success) {
    log('OK', `Analytics: ${anaRes.data.analytics.totalTasks} tasks, ${anaRes.data.analytics.totalWorkers} workers`)
  }

  // 6. Check agent activity for revenue logs
  log('STEP', 'Checking agent logs for t402 revenue...')
  const logsRes = await request('/agent/activity?limit=10')
  if (logsRes.success) {
    const revenueLogs = logsRes.data.filter((l: any) => {
      try { return JSON.parse(l.details).type === 't402_payment_received' } catch { return false }
    })
    log('OK', `Revenue log entries: ${revenueLogs.length}`)
    let total = 0
    for (const rl of revenueLogs) {
      try { total += JSON.parse(rl.details).revenue } catch {}
    }
    log('OK', `Total t402 revenue tracked: $${total.toFixed(2)}`)
  }
}

async function testDashboard() {
  section('DASHBOARD OVERVIEW')
  const res = await request('/dashboard/overview')
  if (res.success) {
    const s = res.data.stats
    log('OK', `Total tasks: ${s.totalTasks}`)
    log('OK', `Open: ${s.openTasks}, Completed: ${s.completedTasks}`)
    log('OK', `Workers: ${s.totalWorkers}`)
    log('OK', `Treasury: ${s.treasuryBalanceFormatted}`)
    log('OK', `Recent logs: ${res.data.recentLogs.length}`)
  } else {
    log('WARN', `Dashboard failed: ${res.error?.message}`)
  }
}

// Main
async function main() {
  console.log('\n  Legwork E2E Test')
  console.log(`  Target: ${BASE}`)
  console.log(`  Time: ${new Date().toISOString()}\n`)

  try {
    await testHealthCheck()
    await testTreasuryInfo()
    await testScenarioC()    // t402 first (no treasury funds needed)
    await testScenarioB()    // Client deposit (no treasury funds needed for deposit/request)
    await testScenarioA()    // Full pipeline (needs treasury funds)
    await testDashboard()

    section('TEST COMPLETE')
    console.log('  All scenarios executed. Check results above for any FAIL/WARN entries.\n')
  } catch (error) {
    console.error('\n  FATAL ERROR:', error)
    process.exit(1)
  }
}

main()
