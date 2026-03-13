/**
 * WDK Transaction Logger
 * Wraps WDK transfer/send operations with automatic logging to AgentLog table
 */

import { prismaQuery } from '../prisma.ts'

export interface TxLogEntry {
  action: string
  tool: string
  from: string
  to: string
  amount: string
  token: string
  txHash: string
  fee?: string
  chain: string
}

export async function logTransaction(entry: TxLogEntry): Promise<void> {
  await prismaQuery.agentLog.create({
    data: {
      action: 'execute',
      details: JSON.stringify({
        type: 'wdk_transaction',
        ...entry,
        timestamp: new Date().toISOString(),
      }),
      txHash: entry.txHash,
    },
  })
}

export async function logWdkOperation(operation: string, details: Record<string, unknown>, txHash?: string): Promise<void> {
  await prismaQuery.agentLog.create({
    data: {
      action: 'execute',
      details: JSON.stringify({
        type: 'wdk_operation',
        operation,
        ...details,
        timestamp: new Date().toISOString(),
      }),
      txHash: txHash || null,
    },
  })
}

export async function getTransactionLog(limit: number = 50): Promise<any[]> {
  const logs = await prismaQuery.agentLog.findMany({
    where: {
      txHash: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return logs
}
