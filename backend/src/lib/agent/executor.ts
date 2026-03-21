import { prismaQuery } from '../prisma.ts'
import { getTreasuryBalance, getTreasuryAddress, getEthBalance, getTreasuryTokenBalances } from '../wdk/treasury.ts'
import { lockEscrow, getEscrowAddress, releaseEscrow, refundEscrow } from '../wdk/escrow.ts'
import { supplyToAave, withdrawFromAave, getAavePosition } from '../wdk/lending.ts'
import { getCurrentPrice, calculateTaskPrice } from '../wdk/pricing.ts'
import { getTransferHistory, verifyPaymentLanded } from '../wdk/indexer.ts'
import { quoteSwapEstimate } from '../wdk/swap.ts'
import { quoteEscrowLock } from '../wdk/escrow.ts'
import { createTaskAttestation } from '../attestation/eas.ts'
import { checkWorkerBalance, monitorEscrowBalances } from '../wdk/monitor.ts'
import { getTransactionLog } from '../wdk/tx-logger.ts'

export async function executeToolCall(toolName: string, input: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case 'check_treasury_balance': {
      const balance = await getTreasuryBalance()
      return { balance: balance.toString(), formatted: `${Number(balance) / 1e6} USDT` }
    }
    case 'check_eth_balance': {
      const balance = await getEthBalance()
      return { balance: balance.toString(), formatted: `${Number(balance) / 1e18} ETH` }
    }
    case 'get_treasury_address': {
      const address = await getTreasuryAddress()
      return { address }
    }
    case 'list_open_tasks': {
      const tasks = await prismaQuery.task.findMany({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
      })
      return {
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          description: t.description,
          payment: `${Number(t.paymentAmount) / 1e6} USDT`,
          deadline: t.deadline,
        })),
      }
    }
    case 'list_pending_submissions': {
      const submissions = await prismaQuery.submission.findMany({
        where: { status: 'pending' },
        include: { task: true, worker: true },
        orderBy: { createdAt: 'desc' },
      })
      return {
        count: submissions.length,
        submissions: submissions.map(s => ({
          id: s.id,
          taskId: s.taskId,
          taskDescription: s.task.description,
          workerName: s.worker.name,
        })),
      }
    }
    case 'list_expired_tasks': {
      const tasks = await prismaQuery.task.findMany({
        where: {
          status: { in: ['open', 'accepted'] },
          deadline: { lt: new Date() },
        },
      })
      return {
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          description: t.description,
          payment: t.paymentAmount,
          deadline: t.deadline,
        })),
      }
    }
    case 'create_task': {
      const raw = input as Record<string, unknown>
      const description = String(raw.description)
      const category = String(raw.category)
      const lat = Number(raw.lat)
      const lon = Number(raw.lon)
      const address = raw.address ? String(raw.address) : undefined
      const paymentAmount = String(raw.paymentAmount)
      const deadlineHours = Number(raw.deadlineHours) || 24
      const radiusMeters = raw.radiusMeters ? Number(raw.radiusMeters) : 100

      const taskCount = await prismaQuery.task.count()
      const escrowIndex = taskCount + 1
      const escrowAddress = await getEscrowAddress(escrowIndex)
      const escrowTxHash = await lockEscrow(escrowIndex, BigInt(paymentAmount))
      const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000)
      const task = await prismaQuery.task.create({
        data: {
          description,
          category,
          lat,
          lon,
          address,
          radiusMeters,
          // Delivery: pickup location
          pickupLat: raw.pickupLat ? Number(raw.pickupLat) : null,
          pickupLon: raw.pickupLon ? Number(raw.pickupLon) : null,
          pickupAddress: raw.pickupAddress ? String(raw.pickupAddress) : null,
          pickupRadiusMeters: raw.pickupRadiusMeters ? Number(raw.pickupRadiusMeters) : null,
          // Event: minimum duration
          minDurationMinutes: raw.minDurationMinutes ? Number(raw.minDurationMinutes) : null,
          paymentAmount,
          escrowAccountIndex: escrowIndex,
          escrowAddress,
          escrowTxHash,
          deadline,
        },
      })
      return {
        taskId: task.id,
        escrowAddress,
        escrowTxHash,
        payment: `${Number(paymentAmount) / 1e6} USDT`,
      }
    }
    case 'verify_submission': {
      const { submission_id } = input as { submission_id: string }
      const sub = await prismaQuery.submission.findUnique({
        where: { id: submission_id },
        include: { task: true },
      })
      if (!sub) return { error: 'Submission not found' }
      if (!sub.gpsLat || !sub.gpsLon) return { error: 'Submission missing GPS data' }
      if (sub.verificationScore !== null) {
        return {
          alreadyVerified: true,
          score: sub.verificationScore,
          status: sub.status,
          result: sub.verificationResult ? JSON.parse(sub.verificationResult) : null,
        }
      }
      return { error: 'No photo data available for verification. Submission needs photo base64 data.' }
    }
    case 'approve_and_pay': {
      const { submission_id } = input as { submission_id: string }
      const sub = await prismaQuery.submission.findUnique({
        where: { id: submission_id },
        include: { task: true, worker: true },
      })
      if (!sub) return { error: 'Submission not found' }
      if (!sub.worker?.walletAddress) return { error: 'Worker has no wallet' }
      const payout = await releaseEscrow(
        sub.task.escrowAccountIndex,
        sub.worker.walletAddress,
        BigInt(sub.task.paymentAmount)
      )
      await prismaQuery.submission.update({
        where: { id: submission_id },
        data: { status: 'approved', payoutTxHash: payout.workerTxHash },
      })
      await prismaQuery.task.update({
        where: { id: sub.taskId },
        data: { status: 'paid' },
      })
      await prismaQuery.worker.update({
        where: { id: sub.workerId },
        data: {
          tasksCompleted: { increment: 1 },
          totalEarned: (BigInt(sub.worker.totalEarned) + payout.workerPayout).toString(),
        },
      })
      return {
        success: true,
        workerTxHash: payout.workerTxHash,
        workerPayout: `${Number(payout.workerPayout) / 1e6} USDT`,
        platformFee: `${Number(payout.platformFee) / 1e6} USDT`,
      }
    }
    case 'reject_submission': {
      const { submission_id, reason } = input as { submission_id: string; reason: string }
      const sub = await prismaQuery.submission.findUnique({
        where: { id: submission_id },
        include: { task: true },
      })
      if (!sub) return { error: 'Submission not found' }
      await prismaQuery.submission.update({
        where: { id: submission_id },
        data: {
          status: 'rejected',
          verificationResult: JSON.stringify({ rejected: true, reason }),
        },
      })
      await prismaQuery.task.update({
        where: { id: sub.taskId },
        data: { status: 'open', workerId: null },
      })
      return { success: true, reason }
    }
    case 'refund_expired_task': {
      const { task_id } = input as { task_id: string }
      const task = await prismaQuery.task.findUnique({ where: { id: task_id } })
      if (!task) return { error: 'Task not found' }
      const txHash = await refundEscrow(task.escrowAccountIndex)
      await prismaQuery.task.update({
        where: { id: task_id },
        data: { status: 'expired' },
      })
      return { success: true, refundTxHash: txHash }
    }
    case 'get_platform_stats': {
      const [totalTasks, openTasks, paidTasks, totalWorkers, totalSubmissions] = await Promise.all([
        prismaQuery.task.count(),
        prismaQuery.task.count({ where: { status: 'open' } }),
        prismaQuery.task.count({ where: { status: 'paid' } }),
        prismaQuery.worker.count(),
        prismaQuery.submission.count(),
      ])
      // Batch token balance check (USDT + Aave USDT + ETH in parallel)
      const balances = await getTreasuryTokenBalances().catch(() => ({ usdt: '0', aaveUsdt: '0', eth: '0' }))
      return {
        totalTasks,
        openTasks,
        paidTasks,
        totalWorkers,
        totalSubmissions,
        treasury: {
          usdt: `${Number(balances.usdt) / 1e6} USDT`,
          aaveUsdt: `${Number(balances.aaveUsdt) / 1e6} aUSDT (in Aave)`,
          eth: `${Number(balances.eth) / 1e18} ETH`,
        },
      }
    }
    case 'check_aave_position': {
      try {
        const position = await getAavePosition()
        return {
          totalCollateral: position.totalCollateralBase,
          totalDebt: position.totalDebtBase,
          availableBorrows: position.availableBorrowsBase,
          healthFactor: position.healthFactor,
        }
      } catch (error) {
        return { error: `Aave position check failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    case 'supply_to_aave': {
      const { amount } = input as { amount: string }
      try {
        const result = await supplyToAave(BigInt(amount))
        return { success: true, txHash: result.hash, fee: result.fee, amount: `${Number(amount) / 1e6} USDT` }
      } catch (error) {
        return { error: `Aave supply failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    case 'withdraw_from_aave': {
      const { amount } = input as { amount: string }
      try {
        const result = await withdrawFromAave(BigInt(amount))
        return { success: true, txHash: result.hash, fee: result.fee, amount: `${Number(amount) / 1e6} USDT` }
      } catch (error) {
        return { error: `Aave withdraw failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    case 'get_current_price': {
      const { base, quote } = input as { base: string; quote: string }
      const price = await getCurrentPrice(base, quote)
      if (price === null) return { error: 'Price feed unavailable' }
      return { pair: `${base}/${quote}`, price }
    }
    case 'calculate_task_price': {
      const { base_rate_usd, urgency } = input as { base_rate_usd: number; urgency: 'normal' | 'urgent' | 'emergency' }
      const openTasks = await prismaQuery.task.count({ where: { status: 'open' } })
      const activeWorkers = await prismaQuery.worker.count()
      const result = await calculateTaskPrice({
        baseRateUsd: base_rate_usd,
        urgency,
        pendingTasks: openTasks,
        availableWorkers: activeWorkers,
      })
      return {
        priceUsdt: result.priceUsdt,
        priceBaseUnits: result.priceBaseUnits,
        surgeMultiplier: result.surgeMultiplier,
        openTasks,
        activeWorkers,
      }
    }
    case 'quote_bridge': {
      const { target_chain, amount } = input as { target_chain: string; amount: string }
      // Bridge is mainnet only, but we show the architecture
      return {
        note: 'USDT0 bridging via LayerZero is available on mainnet. On Sepolia testnet, this shows the architecture.',
        targetChain: target_chain,
        amount: `${Number(amount) / 1e6} USDT0`,
        estimatedFee: '0.03% protocol fee + ~$0.50 relay fee',
        estimatedTime: '30 seconds to 3 minutes',
        supportedChains: ['arbitrum', 'polygon', 'optimism', 'base', 'berachain', 'ink', 'avalanche'],
      }
    }
    case 'check_transfer_history': {
      const { address, limit } = input as { address: string; limit?: number }
      const transfers = await getTransferHistory(address, limit || 10)
      if (!transfers) return { error: 'Indexer not available. Set WDK_INDEXER_API_KEY.' }
      return { address, transfers, count: transfers.length }
    }
    case 'verify_payment_landed': {
      const { address, expected_amount } = input as { address: string; expected_amount: string }
      const landed = await verifyPaymentLanded(address, expected_amount)
      return { address, expectedAmount: expected_amount, landed }
    }
    case 'quote_swap': {
      const { token_in, token_out, amount_in } = input as { token_in: string; token_out: string; amount_in: string }
      return quoteSwapEstimate(token_in, token_out, BigInt(amount_in))
    }
    case 'quote_escrow_fee': {
      const { task_index, amount } = input as { task_index: number; amount: string }
      try {
        const quote = await quoteEscrowLock(task_index, BigInt(amount))
        return { fee: quote.fee, escrowAddress: quote.escrowAddress, feeFormatted: `${Number(quote.fee) / 1e18} ETH` }
      } catch (error) {
        return { error: `Fee estimation failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    case 'create_attestation': {
      const { task_id, worker_address, amount, verification_score, photo_ipfs_hash, payout_tx_hash } = input as {
        task_id: string; worker_address: string; amount: string; verification_score: number; photo_ipfs_hash?: string; payout_tx_hash: string
      }
      try {
        const result = await createTaskAttestation({
          taskId: task_id,
          workerAddress: worker_address,
          verified: true,
          amount: BigInt(amount),
          verificationScore: verification_score,
          photoIpfsHash: photo_ipfs_hash || '',
          payoutTxHash: payout_tx_hash,
        })
        return { success: true, attestationUid: result.uid, txHash: result.txHash, explorerUrl: result.explorerUrl }
      } catch (error) {
        return { error: `Attestation failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    case 'check_worker_balance': {
      const { address } = input as { address: string }
      const balance = await checkWorkerBalance(address)
      return {
        address,
        eth: balance.eth,
        ethFormatted: `${Number(balance.eth) / 1e18} ETH`,
        usdt: balance.usdt,
        usdtFormatted: `${Number(balance.usdt) / 1e6} USDT`,
        hasGas: balance.hasGas,
      }
    }
    case 'monitor_escrow_balances': {
      const activeTasks = await prismaQuery.task.findMany({
        where: { status: { in: ['open', 'accepted', 'submitted'] } },
        select: { id: true, escrowAddress: true, paymentAmount: true },
      })
      if (activeTasks.length === 0) return { message: 'No active escrow wallets', escrows: [] }
      const balances = await monitorEscrowBalances(activeTasks.map(t => t.escrowAddress))
      return {
        count: balances.length,
        escrows: balances.map((b, i) => ({
          ...b,
          taskId: activeTasks[i].id,
          expectedAmount: activeTasks[i].paymentAmount,
          usdtFormatted: `${Number(b.usdt) / 1e6} USDT`,
        })),
      }
    }
    case 'get_transaction_log': {
      const { limit } = input as { limit?: number }
      const logs = await getTransactionLog(limit || 20)
      return { count: logs.length, transactions: logs }
    }
    // Scenario B: Client-funded task creation
    case 'list_client_requests': {
      const requests = await prismaQuery.clientRequest.findMany({
        where: { status: 'pending' },
        include: { client: { select: { name: true, walletAddress: true } } },
        orderBy: { createdAt: 'asc' },
      })
      return {
        count: requests.length,
        requests: requests.map((r: any) => ({
          id: r.id,
          clientName: r.client.name || r.client.walletAddress,
          description: r.description,
          category: r.category,
          budget: `${Number(r.budget) / 1e6} USDT`,
          budgetBaseUnits: r.budget,
          tasksRequested: r.tasksRequested,
          tasksCreated: r.tasksCreated,
          maxPricePerTask: r.maxPricePerTask ? `${Number(r.maxPricePerTask) / 1e6} USDT` : null,
          targetLat: r.targetLat,
          targetLon: r.targetLon,
          targetAddress: r.targetAddress,
        })),
      }
    }
    case 'fulfill_client_request': {
      const raw = input as Record<string, unknown>
      const request_id = String(raw.request_id)
      const price_per_task = String(raw.price_per_task)
      const deadline_hours = Number(raw.deadline_hours) || 24
      const radius_meters = raw.radius_meters ? Number(raw.radius_meters) : undefined
      const clientReq = await prismaQuery.clientRequest.findUnique({
        where: { id: request_id },
        include: { client: true },
      })
      if (!clientReq) return { error: 'Client request not found' }
      if (clientReq.status !== 'pending') return { error: `Request is ${clientReq.status}, not pending` }

      const pricePerTask = BigInt(price_per_task)
      const budget = BigInt(clientReq.budget)
      const maxTasks = clientReq.tasksRequested
      const tasksToCreate = Math.min(maxTasks - clientReq.tasksCreated, Number(budget / pricePerTask))

      if (tasksToCreate <= 0) return { error: 'No tasks to create (budget exhausted or all tasks created)' }

      // Check if max price constraint is met
      if (clientReq.maxPricePerTask && pricePerTask > BigInt(clientReq.maxPricePerTask)) {
        return { error: `Price ${Number(pricePerTask) / 1e6} exceeds client max ${Number(clientReq.maxPricePerTask) / 1e6} USDT` }
      }

      const createdTasks: Array<{ taskId: string; escrowTxHash: string }> = []
      const deadline = new Date(Date.now() + deadline_hours * 60 * 60 * 1000)
      const baseTaskCount = await prismaQuery.task.count()

      for (let i = 0; i < tasksToCreate; i++) {
        try {
          const escrowIndex = baseTaskCount + i + 1
          const escrowAddress = await getEscrowAddress(escrowIndex)
          const escrowTxHash = await lockEscrow(escrowIndex, pricePerTask)

          const task = await prismaQuery.task.create({
            data: {
              description: clientReq.description,
              category: clientReq.category,
              lat: clientReq.targetLat || 40.7128,
              lon: clientReq.targetLon || -74.006,
              address: clientReq.targetAddress,
              radiusMeters: radius_meters || 100,
              paymentAmount: price_per_task,
              escrowAccountIndex: escrowIndex,
              escrowAddress,
              escrowTxHash,
              deadline,
              clientRequestId: clientReq.id,
            },
          })

          createdTasks.push({ taskId: task.id, escrowTxHash })
        } catch (err) {
          // Stop creating tasks on first failure (likely insufficient treasury funds)
          break
        }
      }

      // Update client request progress
      const newStatus = clientReq.tasksCreated + createdTasks.length >= maxTasks ? 'active' : 'pending'
      await prismaQuery.clientRequest.update({
        where: { id: request_id },
        data: {
          tasksCreated: { increment: createdTasks.length },
          pricePerTask: price_per_task,
          status: newStatus,
        },
      })

      return {
        success: true,
        requestId: request_id,
        tasksCreated: createdTasks.length,
        totalCost: `${(Number(pricePerTask) * createdTasks.length) / 1e6} USDT`,
        tasks: createdTasks,
        requestStatus: newStatus,
      }
    }

    // Scenario C: t402 API revenue tracking
    case 'check_api_revenue': {
      const revenueLogs = await prismaQuery.agentLog.findMany({
        where: {
          action: 'execute',
          details: { contains: 't402_payment' },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })

      let totalRevenue = 0
      const endpointCounts: Record<string, { calls: number; revenue: number }> = {}

      for (const log of revenueLogs) {
        try {
          const details = JSON.parse(log.details)
          if (details.type === 't402_payment_received' && details.revenue) {
            totalRevenue += details.revenue
            const ep = details.endpoint || 'unknown'
            if (!endpointCounts[ep]) endpointCounts[ep] = { calls: 0, revenue: 0 }
            endpointCounts[ep].calls++
            endpointCounts[ep].revenue += details.revenue
          }
        } catch { /* skip malformed logs */ }
      }

      return {
        totalRevenue: `${totalRevenue.toFixed(2)} USDT`,
        totalCalls: revenueLogs.length,
        byEndpoint: endpointCounts,
        note: 'Revenue from external AI agents paying for verification, reputation, and analytics APIs via t402 protocol.',
      }
    }

    // Multi-chain + XAU₮ treasury
    case 'list_treasury_wallets': {
      const { getAllTreasuryAddresses, registeredChains } = await import('../wdk/setup.ts')
      const addresses = await getAllTreasuryAddresses()
      return {
        chains: registeredChains,
        chainCount: registeredChains.length,
        wallets: addresses,
        note: 'All wallets derived from a single WDK seed. Same self-custodial key controls assets across all chains.',
      }
    }
    case 'check_xaut_balance': {
      try {
        const { getWdk } = await import('../wdk/setup.ts')
        const { XAUT_MAINNET } = await import('../../config/contracts.ts')
        const wdk = getWdk()
        const account = await wdk.getAccount('ethereum', 0)
        const balance = await account.getTokenBalance(XAUT_MAINNET)
        return {
          token: 'XAU₮ (Tether Gold)',
          contract: XAUT_MAINNET,
          balance: balance.toString(),
          balanceFormatted: `${Number(balance) / 1e6} XAU₮`,
          balanceOzGold: `~${(Number(balance) / 1e6).toFixed(4)} troy oz`,
          note: 'XAU₮ is backed 1:1 by physical gold stored in Swiss vaults. Used as treasury reserve hedge.',
        }
      } catch (error) {
        return { balance: '0', balanceFormatted: '0 XAU₮', note: 'XAU₮ check requires Ethereum mainnet wallet. On Sepolia, balance is 0.', error: error instanceof Error ? error.message : String(error) }
      }
    }
    case 'get_xaut_price': {
      const price = await getCurrentPrice('XAU', 'USD').catch(() => null)
      const xautUsdt = await getCurrentPrice('XAU', 'UST').catch(() => null)
      return {
        xautUsd: price || 'unavailable',
        xautUsdt: xautUsdt || 'unavailable',
        note: 'XAU₮ tracks the London Good Delivery gold price. ~$2,600-2,800 per troy oz.',
      }
    }

    // Worker search + direct booking
    case 'search_workers': {
      const { skill, available_only } = input as { skill?: string; available_only?: string }
      const where: any = {}
      if (skill) where.skills = { contains: skill.toLowerCase() }
      if (available_only === 'true') where.availability = 'available'

      const workers = await prismaQuery.worker.findMany({
        where,
        orderBy: { reputationScore: 'desc' },
        take: 10,
        select: { id: true, name: true, skills: true, availability: true, reputationScore: true, tasksCompleted: true, walletAddress: true },
      })
      return {
        count: workers.length,
        query: { skill, available_only },
        workers: workers.map(w => ({
          id: w.id,
          name: w.name,
          skills: w.skills,
          availability: w.availability,
          reputation: w.reputationScore,
          tasksCompleted: w.tasksCompleted,
        })),
      }
    }
    case 'assign_worker_to_task': {
      const { task_id, worker_id } = input as { task_id: string; worker_id: string }
      const task = await prismaQuery.task.findUnique({ where: { id: task_id } })
      if (!task) return { error: 'Task not found' }
      if (task.status !== 'open') return { error: `Task is ${task.status}, not open` }

      const worker = await prismaQuery.worker.findUnique({ where: { id: worker_id } })
      if (!worker) return { error: 'Worker not found' }
      if (worker.availability === 'offline') return { error: 'Worker is offline' }

      await prismaQuery.task.update({
        where: { id: task_id },
        data: { status: 'accepted', workerId: worker_id },
      })
      await prismaQuery.worker.update({
        where: { id: worker_id },
        data: { availability: 'busy' },
      })

      return {
        success: true,
        taskId: task_id,
        workerId: worker_id,
        workerName: worker.name,
        method: 'direct_booking',
      }
    }

    case 'retry_stuck_payouts': {
      // Find approved submissions with no payout TX
      const stuckSubs = await prismaQuery.submission.findMany({
        where: { status: 'approved', payoutTxHash: null },
        include: { task: true, worker: true },
      })

      if (stuckSubs.length === 0) return { message: 'No stuck payouts found', count: 0 }

      const results: Array<{ submissionId: string; success: boolean; txHash?: string; error?: string }> = []

      for (const sub of stuckSubs) {
        if (!sub.worker?.walletAddress) {
          results.push({ submissionId: sub.id, success: false, error: 'Worker has no wallet' })
          continue
        }

        try {
          const payout = await releaseEscrow(
            sub.task.escrowAccountIndex,
            sub.worker.walletAddress,
            BigInt(sub.task.paymentAmount)
          )

          // Update submission
          await prismaQuery.submission.update({
            where: { id: sub.id },
            data: { payoutTxHash: payout.workerTxHash },
          })

          // Update task to paid
          await prismaQuery.task.update({
            where: { id: sub.taskId },
            data: { status: 'paid' },
          })

          // Update worker stats
          await prismaQuery.worker.update({
            where: { id: sub.workerId },
            data: {
              tasksCompleted: { increment: 1 },
              totalEarned: (BigInt(sub.worker.totalEarned) + payout.workerPayout).toString(),
              reputationScore: { increment: (sub.verificationScore || 0) / 100 },
            },
          })

          results.push({
            submissionId: sub.id,
            success: true,
            txHash: payout.workerTxHash,
          })
        } catch (err) {
          results.push({
            submissionId: sub.id,
            success: false,
            error: err instanceof Error ? err.message.slice(0, 80) : String(err),
          })
        }
      }

      return {
        found: stuckSubs.length,
        processed: results.length,
        succeeded: results.filter(r => r.success).length,
        results,
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
