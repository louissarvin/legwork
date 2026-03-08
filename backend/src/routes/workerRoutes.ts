import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify'
import { prismaQuery } from '../lib/prisma.ts'
import { createWorkerWallet } from '../lib/wdk/worker-wallet.ts'
import { verifySignature, generateAuthChallenge } from '../lib/wdk/signing.ts'
import { handleError } from '../utils/errorHandler.ts'

export const workerRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // Step 1: Get a challenge to sign (proves wallet ownership)
  app.post('/auth/challenge', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { walletAddress } = request.body as { walletAddress: string }
      if (!walletAddress) return handleError(reply, 400, 'walletAddress is required', 'MISSING_WALLET')

      const challenge = generateAuthChallenge(walletAddress)

      return reply.send({
        success: true,
        error: null,
        data: { challenge, walletAddress },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to generate challenge', 'CHALLENGE_FAILED', error)
    }
  })

  // Step 2: Register with signed challenge (proves you own the wallet)
  // If walletAddress + signature provided: verify ownership, link existing wallet
  // If neither provided: create a new gasless WDK wallet (for workers without one)
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, walletAddress, challenge, signature, skills, bio, locationLat, locationLon } = request.body as {
        name?: string
        walletAddress?: string
        challenge?: string
        signature?: string
        skills?: string // comma-separated: "photo,delivery,data"
        bio?: string
        locationLat?: number
        locationLon?: number
      }

      let finalWalletAddress: string
      let seedPhrase: string | null = null
      let encryptedSeed: string | null = null
      let verified = false

      if (walletAddress && challenge && signature) {
        // Full verification: wallet ownership proven via signature
        const isValid = await verifySignature(challenge, signature, walletAddress)
        if (!isValid) {
          return handleError(reply, 401, 'Invalid signature. Wallet ownership not verified.', 'INVALID_SIGNATURE')
        }
        finalWalletAddress = walletAddress
        verified = true
      } else if (walletAddress) {
        // Wallet provided without signature (connected via RainbowKit/MetaMask)
        // Register with this address directly
        finalWalletAddress = walletAddress
        verified = false
      } else {
        // No wallet: create a gasless WDK wallet for the worker
        const wallet = await createWorkerWallet()
        finalWalletAddress = wallet.address
        seedPhrase = wallet.seedPhrase
        encryptedSeed = JSON.stringify(wallet.encryptedSeed)
      }

      // Check if already registered with this wallet
      const existing = await prismaQuery.worker.findFirst({ where: { walletAddress: finalWalletAddress } })
      if (existing) {
        return reply.send({
          success: true,
          error: null,
          data: {
            worker: {
              id: existing.id,
              name: existing.name,
              walletAddress: existing.walletAddress,
              reputationScore: existing.reputationScore,
              tasksCompleted: existing.tasksCompleted,
            },
            wallet: { address: finalWalletAddress },
            verified: true,
            existing: true,
          },
        })
      }

      const worker = await prismaQuery.worker.create({
        data: {
          name: name || null,
          walletAddress: finalWalletAddress,
          seedEncrypted: encryptedSeed,
          skills: skills || null,
          bio: bio || null,
          locationLat: locationLat || null,
          locationLon: locationLon || null,
        },
      })

      return reply.send({
        success: true,
        error: null,
        data: {
          worker: {
            id: worker.id,
            name: worker.name,
            walletAddress: worker.walletAddress,
            reputationScore: worker.reputationScore,
            tasksCompleted: worker.tasksCompleted,
          },
          wallet: {
            address: finalWalletAddress,
            seedPhrase: seedPhrase, // Only present if we created a new wallet
          },
          verified,
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to register worker', 'WORKER_REGISTER_FAILED', error)
    }
  })

  // Search workers by skill, availability, location
  app.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { skill, available, limit = '20' } = request.query as { skill?: string; available?: string; limit?: string }

      const where: any = {}
      if (skill) {
        where.skills = { contains: skill.toLowerCase() }
      }
      if (available === 'true') {
        where.availability = 'available'
      }

      const workers = await prismaQuery.worker.findMany({
        where,
        orderBy: { reputationScore: 'desc' },
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          walletAddress: true,
          skills: true,
          bio: true,
          availability: true,
          locationLat: true,
          locationLon: true,
          reputationScore: true,
          tasksCompleted: true,
          totalEarned: true,
        },
      })

      return reply.send({
        success: true,
        error: null,
        data: {
          count: workers.length,
          query: { skill, available },
          workers,
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to search workers', 'WORKER_SEARCH_FAILED', error)
    }
  })

  // Update worker profile (skills, bio, availability)
  app.put('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workerId, skills, bio, availability, name, locationLat, locationLon } = request.body as {
        workerId: string
        skills?: string
        bio?: string
        availability?: string
        name?: string
        locationLat?: number
        locationLon?: number
      }

      if (!workerId) return handleError(reply, 400, 'workerId required', 'MISSING_WORKER_ID')

      const data: any = {}
      if (skills !== undefined) data.skills = skills
      if (bio !== undefined) data.bio = bio
      if (availability !== undefined) data.availability = availability
      if (name !== undefined) data.name = name
      if (locationLat !== undefined) data.locationLat = locationLat
      if (locationLon !== undefined) data.locationLon = locationLon

      const worker = await prismaQuery.worker.update({
        where: { id: workerId },
        data,
      })

      return reply.send({ success: true, error: null, data: { ...worker, seedEncrypted: undefined } })
    } catch (error) {
      return handleError(reply, 500, 'Failed to update profile', 'PROFILE_UPDATE_FAILED', error)
    }
  })

  // Lookup worker by wallet address (for frontend wallet-based identity)
  app.get('/wallet/:address', async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    try {
      const worker = await prismaQuery.worker.findFirst({
        where: { walletAddress: request.params.address },
        include: {
          tasks: { orderBy: { createdAt: 'desc' }, take: 20 },
          submissions: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      })
      if (!worker) return handleError(reply, 404, 'No worker found for this wallet', 'WORKER_NOT_FOUND')
      return reply.send({
        success: true,
        error: null,
        data: { ...worker, seedEncrypted: undefined },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to lookup worker', 'WORKER_LOOKUP_FAILED', error)
    }
  })

  // Get worker profile by ID
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const worker = await prismaQuery.worker.findUnique({
        where: { id: request.params.id },
        include: {
          tasks: { orderBy: { createdAt: 'desc' }, take: 10 },
          submissions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      })
      if (!worker) return handleError(reply, 404, 'Worker not found', 'WORKER_NOT_FOUND')

      return reply.send({
        success: true,
        error: null,
        data: {
          ...worker,
          seedEncrypted: undefined, // Never expose
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get worker', 'WORKER_GET_FAILED', error)
    }
  })

  // List all workers
  app.get('/list', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const workers = await prismaQuery.worker.findMany({
        orderBy: { reputationScore: 'desc' },
        select: {
          id: true,
          name: true,
          walletAddress: true,
          reputationScore: true,
          tasksCompleted: true,
          totalEarned: true,
          createdAt: true,
        },
      })
      return reply.send({ success: true, error: null, data: workers })
    } catch (error) {
      return handleError(reply, 500, 'Failed to list workers', 'WORKER_LIST_FAILED', error)
    }
  })

  done()
}
