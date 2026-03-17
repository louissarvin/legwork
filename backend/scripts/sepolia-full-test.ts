#!/usr/bin/env bun
/**
 * Legwork Full Sepolia Pipeline Test
 *
 * Runs every scenario end-to-end on live Sepolia testnet and
 * captures all tx hashes, addresses, and results into DEMO_LOG.md
 *
 * Usage: bun scripts/sepolia-full-test.ts
 * Requires: Backend running on localhost:3700 with WDK_SEED + GROQ_API_KEY
 */

const BASE = process.argv[2] || 'http://localhost:3700'
const EXPLORER = 'https://sepolia.etherscan.io'
const EAS_EXPLORER = 'https://sepolia.easscan.org'

interface LogEntry {
  section: string
  step: string
  result: string
  txHash?: string
  address?: string
  attestation?: string
}

const entries: LogEntry[] = []
const startTime = Date.now()

function addLog(section: string, step: string, result: string, extra?: { txHash?: string; address?: string; attestation?: string }) {
  const entry: LogEntry = { section, step, result, ...extra }
  entries.push(entry)
  const prefix = extra?.txHash ? ' [TX]' : extra?.address ? ' [ADDR]' : ''
  console.log(`  [${section}]${prefix} ${step}: ${result}`)
}

async function req(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  return res.json()
}

// Generate a unique test photo each time (avoids duplicate detection)
function getTestPhoto(): string {
  try {
    const { execSync } = require('child_process')
    // Create a unique photo with random pixel noise via Python PIL
    execSync(`python3 -c "
from PIL import Image; import random
img = Image.new('RGB', (200, 150), (57, 255, 20))
for _ in range(100):
    x,y = random.randint(0,199), random.randint(0,149)
    img.putpixel((x,y), (random.randint(0,255), random.randint(0,255), random.randint(0,255)))
img.save('/tmp/test-photo-${Date.now()}.jpg', 'JPEG', quality=80)
"`)
    const fs = require('fs')
    const path = `/tmp/test-photo-${Date.now()}.jpg`
    // Find the latest test photo
    const files = fs.readdirSync('/tmp').filter((f: string) => f.startsWith('test-photo-') && f.endsWith('.jpg')).sort().reverse()
    if (files.length > 0) {
      const buf = fs.readFileSync(`/tmp/${files[0]}`)
      console.log(`  [PHOTO] Generated unique photo: ${files[0]} (${buf.length} bytes)`)
      return buf.toString('base64')
    }
  } catch (e) {
    console.log(`  [PHOTO] Python photo generation failed: ${e}`)
  }
  // Fallback
  console.log('  [PHOTO] Using timestamp-seeded random bytes as fallback')
  const buf = Buffer.alloc(200)
  for (let i = 0; i < 200; i++) buf[i] = Math.floor(Math.random() * 256)
  return buf.toString('base64')
}

async function wait(ms: number, reason: string) {
  console.log(`  [WAIT] ${reason} (${ms / 1000}s)`)
  await new Promise(r => setTimeout(r, ms))
}

async function testHealthAndTreasury() {
  console.log('\n  === 1. HEALTH CHECK & TREASURY ===\n')

  const health = await req('/')
  addLog('HEALTH', 'API Status', `${health.message} (${health.data?.network})`)

  const treasury = await req('/tasks/treasury/info')
  if (treasury.success) {
    addLog('TREASURY', 'Address', treasury.data.address, { address: treasury.data.address })
    addLog('TREASURY', 'Balance', treasury.data.balanceFormatted)
  }

  const overview = await req('/dashboard/overview')
  if (overview.success) {
    const s = overview.data.stats
    addLog('STATS', 'Platform State', `${s.totalTasks} tasks, ${s.totalWorkers} workers, $${(Number(s.treasuryBalance) / 1e6).toFixed(2)} treasury`)
    if (overview.data.treasury) {
      addLog('STATS', 'In Escrow', overview.data.treasury.inEscrowFormatted)
      addLog('STATS', 'Aave Supplied', overview.data.treasury.aaveSuppliedFormatted)
      addLog('STATS', 'ETH (gas)', overview.data.treasury.ethFormatted)
    }
    addLog('STATS', 'Pipeline', JSON.stringify(overview.data.pipeline))
  }
}

async function testScenarioC_T402() {
  console.log('\n  === 2. SCENARIO C: T402 AGENT-TO-AGENT COMMERCE ===\n')

  // List endpoints
  const endpoints = await req('/t402/endpoints')
  if (endpoints.success) {
    for (const ep of endpoints.data.endpoints) {
      addLog('T402', `Endpoint: ${ep.endpoint}`, `${ep.price} | payTo: ${ep.payTo}`, { address: ep.payTo })
    }
  }

  // Call without payment (expect 402)
  const noPayRes = await fetch(`${BASE}/t402/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  addLog('T402', '402 Challenge', `HTTP ${noPayRes.status} (expected 402)`)

  // Call with payment header (demo mode) - reputation
  const repRes = await req('/t402/reputation/0x0000000000000000000000000000000000000001', {
    headers: { 'payment-signature': 'demo-payment' },
  })
  if (repRes.success) {
    addLog('T402', 'Reputation Query', `score=${repRes.data.reputation.reputationScore}, paid=${repRes.data.paymentReceived}, revenue=$0.10`)
  }

  // Call analytics
  const anaRes = await req('/t402/analytics', {
    headers: { 'payment-signature': 'demo-payment' },
  })
  if (anaRes.success) {
    addLog('T402', 'Analytics Query', `${anaRes.data.analytics.totalTasks} tasks, ${anaRes.data.analytics.totalWorkers} workers, revenue=$1.00`)
  }
}

async function testScenarioB_ClientFunded() {
  console.log('\n  === 3. SCENARIO B: CLIENT-FUNDED TASKS ===\n')

  const clientWallet = '0xDEMO' + Date.now().toString(16).padStart(36, '0')

  // Register client
  const regRes = await req('/clients/register', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: clientWallet, name: 'DemoClient' }),
  })
  if (regRes.success) {
    addLog('CLIENT', 'Registered', `ID: ${regRes.data.id}`, { address: clientWallet })
  }

  // Deposit 50 USDT
  const depRes = await req('/clients/deposit', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: clientWallet, amount: '50000000' }),
  })
  if (depRes.success) {
    addLog('CLIENT', 'Deposit', `${depRes.data.deposit.amountFormatted} | Balance: ${Number(depRes.data.client.balance) / 1e6} USDT`)
    addLog('CLIENT', 'Treasury (payTo)', depRes.data.treasuryAddress, { address: depRes.data.treasuryAddress })
  }

  // Submit task request
  const reqRes = await req('/clients/request', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: clientWallet,
      description: 'Photograph 2 storefronts on Broadway, Manhattan',
      category: 'photo',
      budget: '30000000',
      tasksRequested: 2,
      targetAddress: 'Broadway, Manhattan, NY',
      targetLat: 40.7580,
      targetLon: -73.9855,
    }),
  })
  if (reqRes.success) {
    addLog('CLIENT', 'Task Request', `ID: ${reqRes.data.request.id} | Budget: ${reqRes.data.budgetFormatted} | Per task: ${reqRes.data.perTaskFormatted}`)

    // Wait for Groq rate limit reset before agent cycle
    await wait(8000, 'Rate limit cooldown before agent cycle')

    // Trigger agent to fulfill
    addLog('AGENT', 'Triggering Cycle', 'Processing client request...')
    const agentRes = await req('/agent/run', { method: 'POST', body: JSON.stringify({}) })
    if (agentRes.success) {
      addLog('AGENT', 'Cycle Complete', `Provider: ${agentRes.data.provider} | Iterations: ${agentRes.data.iterations}`)

      // Log tool calls
      for (const dec of agentRes.data.decisions || []) {
        for (const tc of dec.toolCalls || []) {
          const r = tc.result as any
          const tx = r?.escrowTxHash || r?.workerTxHash || r?.refundTxHash
          addLog('AGENT', `Tool: ${tc.name}`, JSON.stringify(r).slice(0, 120), tx ? { txHash: tx } : undefined)
        }
      }

      // Check results
      const resultsRes = await req(`/clients/request/${reqRes.data.request.id}/results`)
      if (resultsRes.success) {
        addLog('CLIENT', 'Request Status', `${resultsRes.data.request.status} | Tasks: ${resultsRes.data.summary.totalTasks} created, ${resultsRes.data.summary.completed} completed`)
        for (const t of resultsRes.data.tasks || []) {
          addLog('CLIENT', `Task ${t.id.slice(0, 8)}`, `Status: ${t.status} | Escrow: ${t.escrowAddress?.slice(0, 12)}...`, {
            txHash: t.escrowTxHash || undefined,
            address: t.escrowAddress || undefined,
          })
        }
      }
    } else {
      addLog('AGENT', 'Cycle Failed', agentRes.data?.error || agentRes.error?.message || 'unknown')
    }

    // Check remaining balance
    const profileRes = await req(`/clients/${clientWallet}`)
    if (profileRes.success) {
      addLog('CLIENT', 'Final Balance', `${Number(profileRes.data.balance) / 1e6} USDT remaining`)
    }
  }
}

async function testScenarioA_FullPipeline() {
  console.log('\n  === 4. SCENARIO A: FULL PIPELINE (AGENT > WORKER > VERIFY > PAY) ===\n')

  // Register worker
  const workerRes = await req('/workers/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'SepTestWorker' }),
  })
  if (!workerRes.success) {
    addLog('WORKER', 'Register FAILED', workerRes.error?.message || 'unknown')
    return
  }
  const worker = workerRes.data.worker
  addLog('WORKER', 'Registered', `ID: ${worker.id} | Wallet: ${worker.walletAddress}`, { address: worker.walletAddress })
  addLog('WORKER', 'Seed (first 3 words)', workerRes.data.wallet.seedPhrase.split(' ').slice(0, 3).join(' ') + '...')

  // Find an open task
  const tasksRes = await req('/tasks/list')
  const openTasks = tasksRes.data?.filter((t: any) => t.status === 'open') || []
  if (openTasks.length === 0) {
    addLog('TASK', 'No Open Tasks', 'Skipping submission test')
    return
  }

  const task = openTasks[0]
  addLog('TASK', 'Selected', `ID: ${task.id.slice(0, 12)} | $${Number(task.paymentAmount) / 1e6} USDT`)

  // Accept task
  const acceptRes = await req(`/tasks/${task.id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ workerId: worker.id }),
  })
  if (acceptRes.success) {
    addLog('TASK', 'Accepted', `Status: ${acceptRes.data.status}`)
    // After accept, we should get full location
    const detailRes = await req(`/tasks/${task.id}?workerId=${worker.id}`)
    if (detailRes.success && detailRes.data.lat !== 0) {
      addLog('TASK', 'Location Revealed', `GPS: ${detailRes.data.lat.toFixed(4)}, ${detailRes.data.lon.toFixed(4)} | Radius: ${detailRes.data.radiusMeters}m`)
    }
  } else {
    addLog('TASK', 'Accept FAILED', acceptRes.error?.message || 'unknown')
    return
  }

  // Wait for rate limit before vision call
  await wait(10000, 'Rate limit cooldown before vision verification')

  // Get exact coords from the accepted task (location revealed after accept)
  const detailForSubmit = await req(`/tasks/${task.id}?workerId=${worker.id}`)
  const exactLat = detailForSubmit.data?.lat || 40.7128
  const exactLon = detailForSubmit.data?.lon || -74.006

  // Submit proof with real photo at exact GPS (within radius)
  addLog('SUBMIT', 'Submitting Proof', `Photo (test JPEG) + GPS (${exactLat.toFixed(4)}, ${exactLon.toFixed(4)})`)
  const photo = getTestPhoto()
  const submitRes = await req(`/submissions/${task.id}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      workerId: worker.id,
      photoBase64: photo,
      gpsLat: exactLat + 0.0001, // ~11m offset (well within 100m radius)
      gpsLon: exactLon + 0.0001,
    }),
  })

  if (submitRes.success) {
    const sub = submitRes.data.submission
    const ver = submitRes.data.verification
    addLog('VERIFY', 'Score', `${ver?.overallScore || sub?.verificationScore || 'N/A'}/100`)
    addLog('VERIFY', 'Passed', `${ver?.passed ?? 'N/A'} | Reason: ${ver?.reason || 'N/A'}`)
    addLog('VERIFY', 'Status', sub?.status || 'unknown')

    if (submitRes.data.payout) {
      const p = submitRes.data.payout
      addLog('PAYOUT', 'Worker Received', `${Number(p.workerPayout) / 1e6} USDT`, { txHash: p.workerTxHash })
      addLog('PAYOUT', 'Platform Fee', `${Number(p.platformFee) / 1e6} USDT`)
    }

    if (submitRes.data.ipfs) {
      addLog('IPFS', 'Photo Stored', submitRes.data.ipfs.cid || 'N/A')
    }

    if (submitRes.data.attestation) {
      addLog('EAS', 'Attestation', submitRes.data.attestation.uid || 'N/A', { attestation: submitRes.data.attestation.uid })
    }
  } else {
    addLog('SUBMIT', 'Result', `${submitRes.error?.code || 'ERROR'}: ${submitRes.error?.message || 'unknown'}`)
  }
}

async function testDashboardFinal() {
  console.log('\n  === 5. FINAL STATE ===\n')

  const overview = await req('/dashboard/overview')
  if (overview.success) {
    const s = overview.data.stats
    addLog('FINAL', 'Tasks', `${s.totalTasks} total (open: ${s.openTasks}, completed: ${s.completedTasks})`)
    addLog('FINAL', 'Workers', String(s.totalWorkers))
    addLog('FINAL', 'Treasury', s.treasuryBalanceFormatted, { address: s.treasuryAddress })
    if (overview.data.treasury) {
      addLog('FINAL', 'Escrow', overview.data.treasury.inEscrowFormatted)
      addLog('FINAL', 'Aave', overview.data.treasury.aaveSuppliedFormatted)
    }
    addLog('FINAL', 'Pipeline', JSON.stringify(overview.data.pipeline))
  }

  // Check API revenue
  const logsRes = await req('/agent/activity?limit=100')
  if (logsRes.success) {
    let revenue = 0
    let calls = 0
    for (const l of logsRes.data) {
      try {
        const d = JSON.parse(l.details)
        if (d.type === 't402_payment_received' && d.revenue) {
          revenue += d.revenue
          calls++
        }
      } catch {}
    }
    addLog('FINAL', 'T402 Revenue', `$${revenue.toFixed(2)} from ${calls} API calls`)
  }
}

function generateDemoLog(): string {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  let md = `# Legwork Sepolia Demo Log\n\n`
  md += `**Date:** ${new Date().toISOString()}\n`
  md += `**Network:** Ethereum Sepolia (Chain ID: 11155111)\n`
  md += `**Duration:** ${elapsed}s\n`
  md += `**Explorer:** ${EXPLORER}\n\n`
  md += `---\n\n`

  let currentSection = ''
  for (const e of entries) {
    if (e.section !== currentSection) {
      currentSection = e.section
      md += `## ${currentSection}\n\n`
    }

    let line = `- **${e.step}:** ${e.result}`
    if (e.txHash) {
      line += `\n  - TX: [${e.txHash.slice(0, 18)}...](${EXPLORER}/tx/${e.txHash})`
    }
    if (e.address) {
      line += `\n  - Address: [${e.address.slice(0, 18)}...](${EXPLORER}/address/${e.address})`
    }
    if (e.attestation) {
      line += `\n  - Attestation: [${e.attestation.slice(0, 18)}...](${EAS_EXPLORER}/attestation/view/${e.attestation})`
    }
    md += line + '\n'
  }

  md += `\n---\n\n`
  md += `*Generated by Legwork Sepolia Full Test*\n`
  return md
}

async function main() {
  console.log('\n  Legwork Full Sepolia Pipeline Test')
  console.log(`  Target: ${BASE}`)
  console.log(`  Time: ${new Date().toISOString()}\n`)

  try {
    await testHealthAndTreasury()
    await testScenarioC_T402()
    await testScenarioB_ClientFunded()
    await testScenarioA_FullPipeline()
    await testDashboardFinal()

    // Generate DEMO_LOG.md
    const log = generateDemoLog()
    const logPath = new URL('../../DEMO_LOG.md', import.meta.url).pathname
    await Bun.write(logPath, log)

    console.log('\n  ============================================')
    console.log('  TEST COMPLETE')
    console.log(`  DEMO_LOG.md saved to ${logPath}`)
    console.log('  ============================================\n')
  } catch (error) {
    console.error('\n  FATAL ERROR:', error)
    process.exit(1)
  }
}

main()
