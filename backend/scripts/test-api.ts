#!/usr/bin/env bun
/**
 * Legwork API Test Script
 *
 * Tests the backend API endpoints to verify everything works.
 * Run the server first: bun dev
 * Then: bun scripts/test-api.ts
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3700'

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return { status: res.status, data }
}

function log(label: string, result: { status: number; data: any }) {
  const icon = result.status < 400 ? 'OK' : 'FAIL'
  console.log(`[${icon}] ${label} (${result.status})`)
  if (result.data?.data) {
    console.log(`     ${JSON.stringify(result.data.data).slice(0, 200)}`)
  }
  console.log('')
}

async function main() {
  console.log(`=== Legwork API Test ===`)
  console.log(`Server: ${BASE_URL}\n`)

  // 1. Health check
  log('GET /', await request('GET', '/'))

  // 2. Dashboard overview
  log('GET /dashboard/overview', await request('GET', '/dashboard/overview'))

  // 3. Treasury info
  log('GET /tasks/treasury/info', await request('GET', '/tasks/treasury/info'))

  // 4. List tasks
  log('GET /tasks/list', await request('GET', '/tasks/list'))

  // 5. List workers
  log('GET /workers/list', await request('GET', '/workers/list'))

  // 6. Register a test worker
  const worker = await request('POST', '/workers/register', { name: 'Test Worker' })
  log('POST /workers/register', worker)

  // 7. Agent activity
  log('GET /agent/activity', await request('GET', '/agent/activity'))

  // 8. t402 endpoints
  log('GET /t402/endpoints', await request('GET', '/t402/endpoints'))

  // 9. t402 verify (should get 402)
  const t402 = await request('POST', '/t402/verify', {})
  log('POST /t402/verify (expect 402)', t402)

  // 10. Trigger agent cycle (requires ANTHROPIC_API_KEY)
  console.log('--- Agent Cycle Test ---')
  console.log('To trigger the agent manually:')
  console.log(`  curl -X POST ${BASE_URL}/agent/run`)
  console.log('')

  // 11. Create a task (requires funded treasury)
  console.log('--- Task Creation Test ---')
  console.log('To create a test task (requires USDT in treasury):')
  console.log(`  curl -X POST ${BASE_URL}/tasks/create \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -d '{"description":"Photo of the nearest coffee shop","category":"photo","lat":40.7128,"lon":-74.0060,"paymentAmount":"5000000","deadlineHours":24}'`)
  console.log('')

  console.log('=== Test Complete ===')
}

main().catch(console.error)
