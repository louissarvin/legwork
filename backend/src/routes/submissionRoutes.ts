import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify'
import { prismaQuery } from '../lib/prisma.ts'
import { runVerificationPipeline } from '../lib/verification/pipeline.ts'
import { releaseEscrow } from '../lib/wdk/escrow.ts'
import { handleError } from '../utils/errorHandler.ts'
import { hashPhoto } from '../utils/photoHash.ts'

export const submissionRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  // Worker submits proof for a task
  app.post('/:taskId/submit', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    try {
      const { workerId, photoBase64, gpsLat, gpsLon, reportData } = request.body as {
        workerId: string
        photoBase64: string
        gpsLat: number
        gpsLon: number
        reportData?: string // Category-specific JSON (delivery proof, check status, counts, reports)
      }

      const task = await prismaQuery.task.findUnique({ where: { id: request.params.taskId } })
      if (!task) return handleError(reply, 404, 'Task not found', 'TASK_NOT_FOUND')
      if (task.status !== 'accepted') return handleError(reply, 400, 'Task is not in accepted state', 'TASK_NOT_ACCEPTED')
      if (task.workerId !== workerId) return handleError(reply, 403, 'Not assigned to this task', 'NOT_ASSIGNED')

      // Duplicate photo detection: hash the photo and check against all previous submissions
      const photoDigest = hashPhoto(photoBase64)
      const duplicate = await prismaQuery.submission.findFirst({
        where: {
          photoHash: photoDigest,
          status: { in: ['approved', 'pending'] },
        },
        select: { id: true, taskId: true, workerId: true, createdAt: true },
      })

      if (duplicate) {
        const sameWorker = duplicate.workerId === workerId
        return handleError(
          reply,
          400,
          sameWorker
            ? `This photo was already submitted for task ${duplicate.taskId.slice(0, 8)}. Each task requires a unique photo.`
            : 'This photo has already been submitted by another worker. Submissions must contain original photos.',
          'DUPLICATE_PHOTO',
        )
      }

      // Update task status
      await prismaQuery.task.update({
        where: { id: task.id },
        data: { status: 'submitted' },
      })

      // Create submission record with photo hash + category report data
      const submission = await prismaQuery.submission.create({
        data: {
          taskId: task.id,
          workerId,
          photoHash: photoDigest,
          photoUrl: null,
          gpsLat,
          gpsLon,
          reportData: reportData || null,
          status: 'pending',
        },
      })

      // Parse reportData for category-specific GPS validation
      let parsedReport: Record<string, any> = {}
      try { if (reportData) parsedReport = JSON.parse(reportData) } catch {}

      // Run verification pipeline with category-specific data
      const verification = await runVerificationPipeline({
        photoBase64,
        gpsLat,
        gpsLon,
        taskDescription: task.description,
        taskLat: task.lat,
        taskLon: task.lon,
        taskRadiusMeters: task.radiusMeters,
        // Category-specific
        taskCategory: task.category,
        // Delivery: pickup location from task + worker's reported pickup GPS
        pickupLat: (task as any).pickupLat || null,
        pickupLon: (task as any).pickupLon || null,
        pickupRadiusMeters: (task as any).pickupRadiusMeters || null,
        reportPickupLat: parsedReport.pickupGps?.lat || null,
        reportPickupLon: parsedReport.pickupGps?.lon || null,
        // Event: duration from task requirement + worker's reported duration
        minDurationMinutes: (task as any).minDurationMinutes || null,
        reportDurationMinutes: parsedReport.durationMinutes || null,
      })

      // Update submission with verification results
      await prismaQuery.submission.update({
        where: { id: submission.id },
        data: {
          verificationScore: verification.overallScore,
          verificationResult: JSON.stringify(verification),
          status: verification.passed ? 'approved' : 'rejected',
        },
      })

      // Log verification
      await prismaQuery.agentLog.create({
        data: {
          action: 'decide',
          details: JSON.stringify({
            type: 'verification_complete',
            taskId: task.id,
            submissionId: submission.id,
            score: verification.overallScore,
            passed: verification.passed,
            reason: verification.reason,
          }),
        },
      })

      // If approved, release escrow
      if (verification.passed) {
        const worker = await prismaQuery.worker.findUnique({ where: { id: workerId } })
        if (!worker?.walletAddress) {
          return handleError(reply, 400, 'Worker has no wallet address', 'NO_WALLET')
        }

        const payout = await releaseEscrow(
          task.escrowAccountIndex,
          worker.walletAddress,
          BigInt(task.paymentAmount)
        )

        // Update submission with payout info
        await prismaQuery.submission.update({
          where: { id: submission.id },
          data: { payoutTxHash: payout.workerTxHash },
        })

        // Update task status
        await prismaQuery.task.update({
          where: { id: task.id },
          data: { status: 'paid' },
        })

        // Update worker stats
        await prismaQuery.worker.update({
          where: { id: workerId },
          data: {
            tasksCompleted: { increment: 1 },
            totalEarned: (BigInt(worker.totalEarned) + payout.workerPayout).toString(),
            reputationScore: { increment: verification.overallScore / 100 },
          },
        })

        // Upload photo to IPFS for immutable proof
        let ipfsResult = null
        try {
          const { uploadPhotoToIpfs } = await import('../lib/storage/ipfs.ts')
          ipfsResult = await uploadPhotoToIpfs(photoBase64, task.id)
          if (ipfsResult) {
            await prismaQuery.submission.update({
              where: { id: submission.id },
              data: { photoIpfsHash: ipfsResult.cid, photoUrl: ipfsResult.gatewayUrl },
            })
          }
        } catch (e) {
          console.error('[IPFS] Upload failed, continuing without:', e)
        }

        // Create on-chain attestation via EAS
        let attestation = null
        try {
          const { createTaskAttestation } = await import('../lib/attestation/eas.ts')
          attestation = await createTaskAttestation({
            taskId: task.id,
            workerAddress: worker.walletAddress!,
            verified: true,
            amount: BigInt(task.paymentAmount),
            verificationScore: Math.round(verification.overallScore),
            photoIpfsHash: ipfsResult?.cid || '',
            payoutTxHash: payout.workerTxHash,
          })
          if (attestation) {
            await prismaQuery.submission.update({
              where: { id: submission.id },
              data: { attestationUid: attestation.uid },
            })
          }
        } catch (e) {
          console.error('[EAS] Attestation failed, continuing without:', e)
        }

        // Log payout
        await prismaQuery.agentLog.create({
          data: {
            action: 'execute',
            details: JSON.stringify({
              type: 'payout_released',
              taskId: task.id,
              workerPayout: payout.workerPayout.toString(),
              platformFee: payout.platformFee.toString(),
            }),
            txHash: payout.workerTxHash,
          },
        })

        return reply.send({
          success: true,
          error: null,
          data: {
            submission: { ...submission, status: 'approved', verificationScore: verification.overallScore },
            verification,
            payout: {
              workerTxHash: payout.workerTxHash,
              workerPayout: payout.workerPayout.toString(),
              platformFee: payout.platformFee.toString(),
            },
            ipfs: ipfsResult,
            attestation,
          },
        })
      }

      // Rejected
      await prismaQuery.task.update({
        where: { id: task.id },
        data: { status: 'rejected' },
      })

      return reply.send({
        success: true,
        error: null,
        data: {
          submission: { ...submission, status: 'rejected', verificationScore: verification.overallScore },
          verification,
          payout: null,
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to submit proof', 'SUBMISSION_FAILED', error)
    }
  })

  done()
}
