import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify'
import { T402_ENDPOINTS, T402_FACILITATOR, T402_NETWORK, getPaymentRequiredResponse } from '../lib/t402/setup.ts'
import { getTreasuryAddress } from '../lib/wdk/treasury.ts'
import { runVerificationPipeline } from '../lib/verification/pipeline.ts'
import { prismaQuery } from '../lib/prisma.ts'
import { handleError } from '../utils/errorHandler.ts'

export const t402Routes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  // Show all t402 paywalled endpoints and their pricing
  app.get('/endpoints', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const treasuryAddress = await getTreasuryAddress().catch(() => 'not-available')

      const endpoints = Object.entries(T402_ENDPOINTS).map(([endpoint, config]) => ({
        endpoint,
        ...config,
        payTo: treasuryAddress,
      }))

      return reply.send({
        success: true,
        error: null,
        data: {
          protocol: 't402',
          version: '2.7.1',
          description: 'Tether HTTP payment protocol using USDT0 via EIP-3009',
          facilitator: T402_FACILITATOR,
          network: T402_NETWORK,
          wdkPackages: {
            server: '@t402/fastify',
            client: '@t402/fetch + @t402/wdk',
            signer: 'T402WDK from @t402/wdk',
          },
          note: 'On mainnet, these endpoints require USDT0 payment via t402 protocol. Treasury receives all payments.',
          endpoints,
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to list endpoints', 'T402_ENDPOINTS_FAILED', error)
    }
  })

  // Demo: verification endpoint with 402 payment flow
  app.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const paymentSignature = request.headers['payment-signature'] as string | undefined

    if (!paymentSignature) {
      const treasuryAddress = await getTreasuryAddress().catch(() => '')
      const paymentRequired = getPaymentRequiredResponse('POST /t402/verify', treasuryAddress)

      if (paymentRequired) {
        return reply
          .status(402)
          .header('X-Payment-Required', paymentRequired.headers['X-Payment-Required'])
          .send(paymentRequired.body)
      }
    }

    // Payment received (or demo mode) - run real verification pipeline
    const body = request.body as {
      photoBase64?: string
      gpsLat?: number
      gpsLon?: number
      taskDescription?: string
      taskLat?: number
      taskLon?: number
      taskRadiusMeters?: number
    } || {}

    // Log the t402 payment + revenue
    await prismaQuery.agentLog.create({
      data: {
        action: 'execute',
        details: JSON.stringify({
          type: 't402_payment_received',
          endpoint: 'POST /t402/verify',
          paymentSignature: paymentSignature ? 'present' : 'demo_mode',
          revenue: 0.25,
        }),
      },
    })

    // If photo provided, run real verification pipeline
    if (body.photoBase64 && body.gpsLat != null && body.gpsLon != null) {
      try {
        const result = await runVerificationPipeline({
          photoBase64: body.photoBase64,
          gpsLat: body.gpsLat,
          gpsLon: body.gpsLon,
          taskDescription: body.taskDescription || 'Verify submitted photo',
          taskLat: body.taskLat || body.gpsLat,
          taskLon: body.taskLon || body.gpsLon,
          taskRadiusMeters: body.taskRadiusMeters || 200,
        })

        return reply.send({
          success: true,
          error: null,
          data: {
            verification: {
              passed: result.passed,
              overallScore: result.overallScore,
              gps: result.gps,
              vision: {
                confidence: result.vision.confidence,
                verified: result.vision.verified,
                recommendation: result.vision.recommendation,
                evidence: result.vision.evidence,
                concerns: result.vision.concerns,
              },
              reason: result.reason,
            },
            paymentReceived: !!paymentSignature,
            protocol: 't402',
            price: '$0.25 USDT',
          },
        })
      } catch (error) {
        return handleError(reply, 500, 'Verification pipeline failed', 'VERIFICATION_FAILED', error)
      }
    }

    // No photo provided: return service info
    return reply.send({
      success: true,
      error: null,
      data: {
        message: 'Verification service accessed via t402. Send photoBase64, gpsLat, gpsLon, taskDescription for full verification.',
        paymentReceived: !!paymentSignature,
        protocol: 't402',
        price: '$0.25 USDT',
        requiredFields: ['photoBase64', 'gpsLat', 'gpsLon', 'taskDescription'],
        optionalFields: ['taskLat', 'taskLon', 'taskRadiusMeters'],
      },
    })
  })

  // Demo: reputation query with 402 payment flow
  app.get('/reputation/:address', async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    const paymentSignature = request.headers['payment-signature'] as string | undefined

    if (!paymentSignature) {
      const treasuryAddress = await getTreasuryAddress().catch(() => '')
      const paymentRequired = getPaymentRequiredResponse('GET /t402/reputation/:address', treasuryAddress)

      if (paymentRequired) {
        return reply
          .status(402)
          .header('X-Payment-Required', paymentRequired.headers['X-Payment-Required'])
          .send(paymentRequired.body)
      }
    }

    // Log revenue
    await prismaQuery.agentLog.create({
      data: {
        action: 'execute',
        details: JSON.stringify({
          type: 't402_payment_received',
          endpoint: 'GET /t402/reputation/:address',
          paymentSignature: paymentSignature ? 'present' : 'demo_mode',
          revenue: 0.10,
        }),
      },
    })

    // Look up worker reputation
    const worker = await prismaQuery.worker.findFirst({
      where: { walletAddress: request.params.address },
      select: { reputationScore: true, tasksCompleted: true, totalEarned: true },
    })

    return reply.send({
      success: true,
      error: null,
      data: {
        address: request.params.address,
        reputation: worker || { reputationScore: 0, tasksCompleted: 0, totalEarned: '0' },
        paymentReceived: !!paymentSignature,
        protocol: 't402',
      },
    })
  })

  // Demo: analytics with 402 payment flow
  app.get('/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
    const paymentSignature = request.headers['payment-signature'] as string | undefined

    if (!paymentSignature) {
      const treasuryAddress = await getTreasuryAddress().catch(() => '')
      const paymentRequired = getPaymentRequiredResponse('GET /t402/analytics', treasuryAddress)

      if (paymentRequired) {
        return reply
          .status(402)
          .header('X-Payment-Required', paymentRequired.headers['X-Payment-Required'])
          .send(paymentRequired.body)
      }
    }

    // Log revenue
    await prismaQuery.agentLog.create({
      data: {
        action: 'execute',
        details: JSON.stringify({
          type: 't402_payment_received',
          endpoint: 'GET /t402/analytics',
          paymentSignature: paymentSignature ? 'present' : 'demo_mode',
          revenue: 1.00,
        }),
      },
    })

    const [totalTasks, completedTasks, totalWorkers, totalPayouts] = await Promise.all([
      prismaQuery.task.count(),
      prismaQuery.task.count({ where: { status: 'paid' } }),
      prismaQuery.worker.count(),
      prismaQuery.submission.count({ where: { status: 'approved' } }),
    ])

    return reply.send({
      success: true,
      error: null,
      data: {
        analytics: { totalTasks, completedTasks, totalWorkers, totalPayouts },
        paymentReceived: !!paymentSignature,
        protocol: 't402',
      },
    })
  })

  done()
}
