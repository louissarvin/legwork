import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import { useAccount } from 'wagmi'
import { api } from '@/lib/api'
import { formatUsdt, timeLeft } from '@/utils/usdt'
import Badge from '@/components/elements/Badge'
import BracketButton from '@/components/elements/BracketButton'
import Card from '@/components/elements/Card'
import Footer from '@/components/Footer'
import { FADE_IN_UP, TRANSITION_DEFAULT } from '@/config/animation'
import ExplorerLink from '@/components/elements/ExplorerLink'
import { ArrowLeft, CheckCircle, XCircle, Shield, Upload } from 'lucide-react'

export const Route = createFileRoute('/browse/$taskId')({ component: TaskDetailPage })

function TaskDetailPage() {
  const { taskId } = Route.useParams()
  const queryClient = useQueryClient()
  const { address } = useAccount()

  // Resolve worker identity from connected wallet
  const { data: workerProfile } = useQuery({
    queryKey: ['worker-by-wallet', address],
    queryFn: () => api.workers.getByWallet(address!),
    enabled: !!address,
    retry: false,
  })

  const workerId = workerProfile?.id || null

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.tasks.get(taskId),
    refetchInterval: 10_000,
  })

  if (isLoading) {
    return <div className="max-w-[1320px] mx-auto px-6 py-20 text-center font-mono text-text-secondary">LOADING_MISSION_BRIEFING...</div>
  }

  if (!task) {
    return <div className="max-w-[1320px] mx-auto px-6 py-20 text-center font-mono text-text-secondary">MISSION_NOT_FOUND</div>
  }

  const deadline = timeLeft(task.deadline)
  const isExpired = deadline === 'Expired'
  const latestSubmission = task.submissions?.[task.submissions.length - 1]

  return (
    <div className="max-w-[1320px] mx-auto px-6">
      <Link to="/browse" className="inline-flex items-center gap-2 font-mono text-sm text-text-secondary no-underline hover:text-text-primary mt-6 mb-6 transition-colors duration-100">
        <ArrowLeft size={14} /> BACK_TO_BROWSER
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 mb-16">
        {/* Left: Task info */}
        <motion.div {...FADE_IN_UP} transition={TRANSITION_DEFAULT}>
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="open">MISSION_BRIEFING</Badge>
              <span className="font-mono text-xs text-text-tertiary">ID: {task.id.slice(0, 12)}</span>
            </div>

            <h1 className="font-mono text-2xl font-bold uppercase tracking-tight mb-4">{task.description}</h1>

            <p className="font-mono text-sm text-text-secondary leading-relaxed mb-6">
              Directive: Complete the assigned task at the designated coordinates. Ensure all proof requirements are met before submission.
            </p>

            {/* Map area - OpenStreetMap embed */}
            {(() => {
              const mapLat = task.lat !== 0 ? task.lat : task.latApprox || 0
              const mapLon = task.lon !== 0 ? task.lon : task.lonApprox || 0
              const hasCoords = mapLat !== 0 && mapLon !== 0
              return (
                <div className="relative rounded-lg overflow-hidden mb-6 h-64">
                  {hasCoords ? (
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapLon - 0.005},${mapLat - 0.003},${mapLon + 0.005},${mapLat + 0.003}&layer=mapnik&marker=${mapLat},${mapLon}`}
                      className="w-full h-full border-0"
                      style={{ filter: 'hue-rotate(180deg) invert(90%) contrast(1.2)' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-elevated flex items-center justify-center">
                      <div className="w-32 h-32 border-2 border-neon rounded-full opacity-30 animate-pulse" />
                      <div className="absolute w-3 h-3 bg-neon rounded-sm" />
                    </div>
                  )}
                  {task.lat !== 0 && (
                    <div className="absolute top-3 left-3 bg-page/90 px-2.5 py-1 rounded-sm font-mono text-xs text-text-secondary">
                      GPS_LOCK: {task.lat.toFixed(4)}, {task.lon.toFixed(4)}
                    </div>
                  )}
                  {task.latApprox && !task.lat && (
                    <div className="absolute top-3 left-3 bg-page/90 px-2.5 py-1 rounded-sm font-mono text-xs text-text-secondary">
                      ZONE: {task.latApprox}, {task.lonApprox} (approximate)
                    </div>
                  )}
                  {task.radiusMeters > 0 && (
                    <div className="absolute bottom-3 right-3 bg-neon-dim border border-neon px-2.5 py-1 rounded-sm font-mono text-[10px] text-neon">
                      RADIUS: {task.radiusMeters}M GEOFENCE_ACTIVE
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Requirements */}
            <div className="mb-6">
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wide mb-3">MANDATORY_REQUIREMENTS</h3>
              <div className="space-y-3">
                {[
                  `Take a geotagged photo within ${task.radiusMeters || '?'}m of target radius.`,
                  'Capture a clear photo showing the task subject.',
                  'Submit before deadline expires.',
                ].map((req, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <CheckCircle size={14} className="text-text-tertiary mt-0.5 shrink-0" />
                    {req}
                  </div>
                ))}
              </div>
            </div>

            {/* Contract bar */}
            <div className="grid grid-cols-3 border-t border-border-subtle pt-5 gap-4">
              <div>
                <span className="font-mono text-[10px] text-text-tertiary uppercase">CONTRACT_PAYOUT</span>
                <div className="font-mono text-2xl font-bold text-neon mt-1">${formatUsdt(task.paymentAmount)} USDT</div>
              </div>
              <div>
                <span className="font-mono text-[10px] text-text-tertiary uppercase">ESCROW_LOCKED</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 bg-neon rounded-full" />
                  <ExplorerLink type="address" value={task.escrowAddress} className="!text-sm" />
                </div>
              </div>
              <div>
                <span className="font-mono text-[10px] text-text-tertiary uppercase">TERMINAL_DEADLINE</span>
                <div className={`font-mono text-lg mt-1 ${isExpired ? 'text-danger' : 'text-yellow-accent'}`}>{deadline}</div>
              </div>
            </div>
          </Card>

          <Card className="mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-border-medium rounded-lg flex items-center justify-center">
                <Shield size={18} className="text-neon" />
              </div>
              <div>
                <span className="font-mono text-[10px] text-text-tertiary uppercase">CONTRACTOR</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Legwork AI</span>
                  <Badge variant="open">VERIFIED_BOT</Badge>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Right: Submission panel */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <SubmissionPanel
            task={task}
            workerId={workerId}
            latestSubmission={latestSubmission}
            onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['task', taskId] })}
          />
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}

// Category-specific form hints
const CATEGORY_HINTS: Record<string, { photoLabel: string; extraFields: string[] }> = {
  photo: { photoLabel: 'CAPTURE LOCATION PHOTO', extraFields: [] },
  delivery: { photoLabel: 'CAPTURE DELIVERY PROOF', extraFields: ['pickupConfirmed', 'deliveryNotes'] },
  check: { photoLabel: 'CAPTURE LOCATION STATUS', extraFields: ['locationStatus'] },
  data: { photoLabel: 'CAPTURE DATA EVIDENCE', extraFields: ['dataCount', 'dataNotes'] },
  mystery: { photoLabel: 'CAPTURE DISCREET PHOTO', extraFields: ['experienceReport'] },
  event: { photoLabel: 'CAPTURE EVENT PHOTO', extraFields: ['crowdLevel', 'eventNotes'] },
}

function SubmissionPanel({ task, workerId, latestSubmission, onSubmitted }: {
  task: any
  workerId: string | null
  latestSubmission: any
  onSubmitted: () => void
}) {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [gps, setGps] = useState<{ lat: number; lon: number; accuracy: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [pipelineStep, setPipelineStep] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Category-specific state
  const [pickupConfirmed, setPickupConfirmed] = useState(false)
  const [pickupGps, setPickupGps] = useState<{ lat: number; lon: number; timestamp: string } | null>(null)
  const [locationStatus, setLocationStatus] = useState<string>('open')
  const [dataCount, setDataCount] = useState('')
  const [dataNotes, setDataNotes] = useState('')
  const [experienceReport, setExperienceReport] = useState('')
  const [crowdLevel, setCrowdLevel] = useState<string>('moderate')
  const [eventNotes, setEventNotes] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [eventCheckin, setEventCheckin] = useState<{ lat: number; lon: number; timestamp: string } | null>(null)

  // GPS capture functions are inline in CategoryFields buttons

  // Get GPS on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => setGpsError(err.message),
        { enableHighAccuracy: true, timeout: 10000 },
      )
    } else {
      setGpsError('Geolocation not available')
    }
  }, [])

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0]
    if (!file) return

    // Convert HEIC/HEIF to JPEG (browsers can't display or send HEIC to AI APIs)
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
      try {
        const heic2any = (await import('heic2any')).default
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob
        file = new File([blob], file.name.replace(/\.heic|\.heif/i, '.jpg'), { type: 'image/jpeg' })
      } catch (err) {
        console.error('HEIC conversion failed:', err)
      }
    }

    // Preview
    const previewUrl = URL.createObjectURL(file)
    setPhotoPreview(previewUrl)

    // Convert to base64
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:image/xxx;base64, prefix
      const base64 = result.split(',')[1]
      setPhotoBase64(base64)
    }
    reader.readAsDataURL(file)
  }, [])

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!photoBase64) throw new Error('No photo selected')
      const submitGps = gps || { lat: task.latApprox || task.lat || 40.7128, lon: task.lonApprox || task.lon || -74.006 }

      setPipelineStep(1) // uploading
      await new Promise(r => setTimeout(r, 300))
      setPipelineStep(2) // verify gps
      await new Promise(r => setTimeout(r, 300))
      setPipelineStep(3) // AI analysis

      if (!workerId) throw new Error('Not registered as a worker. Go to /worker_portal to register first.')

      // Accept the task first if not already accepted
      if (task.status === 'open') {
        await api.tasks.accept(task.id, workerId)
      }

      // Build category-specific report data
      const category = task.category?.toLowerCase() || 'photo'
      const report: Record<string, unknown> = { category }
      if (category === 'delivery') {
        report.pickupConfirmed = pickupConfirmed
        report.pickupGps = pickupGps
        report.dropoffGps = { lat: submitGps.lat, lon: submitGps.lon, timestamp: new Date().toISOString() }
        report.notes = deliveryNotes
      }
      if (category === 'check') { report.locationStatus = locationStatus }
      if (category === 'data') { report.count = dataCount; report.notes = dataNotes }
      if (category === 'mystery') { report.experienceReport = experienceReport }
      if (category === 'event') {
        report.crowdLevel = crowdLevel
        report.notes = eventNotes
        report.checkin = eventCheckin
        report.checkout = { lat: submitGps.lat, lon: submitGps.lon, timestamp: new Date().toISOString() }
        if (eventCheckin) {
          const durationMs = Date.now() - new Date(eventCheckin.timestamp).getTime()
          report.durationMinutes = Math.round(durationMs / 60000)
        }
      }

      const result = await api.submissions.submit(task.id, {
        workerId,
        photoBase64,
        gpsLat: submitGps.lat,
        gpsLon: submitGps.lon,
        reportData: JSON.stringify(report),
      })

      setPipelineStep(4) // scoring
      await new Promise(r => setTimeout(r, 500))
      setPipelineStep(5) // done

      return result
    },
    onSuccess: () => {
      onSubmitted()
    },
  })

  const isSubmitting = submitMutation.isPending

  return (
    <Card>
      <h2 className="font-mono text-lg font-semibold mb-4">{'> '}SUBMIT_PROOF</h2>

      {/* Photo upload - REAL file input */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border-medium rounded-lg h-48 flex flex-col items-center justify-center gap-2 mb-4 cursor-pointer hover:border-neon-border transition-colors duration-100 overflow-hidden relative"
      >
        {photoPreview ? (
          <img src={photoPreview} alt="Proof" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <Upload size={24} className="text-text-tertiary" />
            <span className="font-mono text-xs text-text-tertiary uppercase">
              {CATEGORY_HINTS[task.category?.toLowerCase()]?.photoLabel || 'CAPTURE PHOTO'}
            </span>
            <span className="font-mono text-xs text-text-tertiary uppercase">TAP TO UPLOAD</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          capture="environment"
          onChange={handlePhotoSelect}
          className="hidden"
        />
      </div>
      {photoBase64 && (
        <div className="flex items-center gap-2 mb-4 font-mono text-xs text-neon">
          <CheckCircle size={12} /> PHOTO_LOADED ({Math.round(photoBase64.length * 0.75 / 1024)}KB)
        </div>
      )}

      {/* GPS metadata - REAL geolocation */}
      <Card className="!p-4 !bg-elevated mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-text-secondary uppercase">SIGNAL_METADATA</span>
          <span className={`font-mono text-[10px] ${gps ? 'text-neon' : 'text-yellow-accent'}`}>
            {gps ? 'LIVE_FEED' : gpsError ? 'GPS_ERROR' : 'ACQUIRING...'}
          </span>
        </div>
        <div className="space-y-1.5 font-mono text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>LAT:</span>
            <span className="text-text-primary">{gps ? gps.lat.toFixed(6) : '---'}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>LONG:</span>
            <span className="text-text-primary">{gps ? gps.lon.toFixed(6) : '---'}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>ACCURACY:</span>
            <span className="text-text-primary">{gps ? `+/- ${gps.accuracy.toFixed(1)}m` : '---'}</span>
          </div>
        </div>
      </Card>

      {/* Category-specific fields */}
      <CategoryFields
        category={task.category?.toLowerCase() || 'photo'}
        pickupConfirmed={pickupConfirmed} setPickupConfirmed={setPickupConfirmed}
        pickupGps={pickupGps} setPickupGps={setPickupGps}
        locationStatus={locationStatus} setLocationStatus={setLocationStatus}
        dataCount={dataCount} setDataCount={setDataCount}
        dataNotes={dataNotes} setDataNotes={setDataNotes}
        experienceReport={experienceReport} setExperienceReport={setExperienceReport}
        crowdLevel={crowdLevel} setCrowdLevel={setCrowdLevel}
        eventNotes={eventNotes} setEventNotes={setEventNotes}
        deliveryNotes={deliveryNotes} setDeliveryNotes={setDeliveryNotes}
        eventCheckin={eventCheckin} setEventCheckin={setEventCheckin}
      />

      {!workerId && (
        <div className="mb-3 p-3 border border-yellow-border rounded bg-yellow-dim font-mono text-xs text-yellow-accent">
          Connect your wallet and <Link to="/worker" className="underline text-neon">register as a worker</Link> to submit proof.
        </div>
      )}

      <BracketButton
        onClick={() => submitMutation.mutate()}
        disabled={!photoBase64 || isSubmitting || !workerId}
        className="mb-6"
      >
        {isSubmitting ? 'PROCESSING...' : !workerId ? 'REGISTER_FIRST' : 'SUBMIT_MISSION_PROOF'}
      </BracketButton>

      {/* Submission pipeline - animated steps */}
      <div className="mb-6">
        <span className="font-mono text-[10px] text-text-tertiary uppercase block mb-3">SUBMISSION_PIPELINE</span>
        <div className="flex items-center gap-2 font-mono text-xs">
          {['UPLOAD', 'VERIFY_GPS', 'AI_ANALYSIS', 'SCORING'].map((step, i) => {
            const stepNum = i + 1
            const isActive = pipelineStep === stepNum
            const isComplete = pipelineStep > stepNum
            return (
              <span key={step} className="contents">
                {i > 0 && <span className={`w-6 h-px ${isComplete ? 'bg-neon' : 'bg-border-subtle'}`} />}
                <span className={`flex items-center gap-1 ${isComplete ? 'text-neon' : isActive ? 'text-yellow-accent' : 'text-text-tertiary'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-neon' : isActive ? 'bg-yellow-accent animate-pulse' : 'border border-text-tertiary'}`} />
                  {step}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Error display */}
      {submitMutation.isError && (
        <Card className="!border-l-2 !border-l-danger !bg-[rgba(255,59,59,0.04)] mb-4">
          <div className="flex items-center gap-2 text-danger font-mono text-sm">
            <XCircle size={14} />
            {submitMutation.error.message}
          </div>
        </Card>
      )}

      {/* Verification result from mutation */}
      {submitMutation.isSuccess && submitMutation.data && (
        <VerificationResult data={submitMutation.data} />
      )}

      {/* Verification result from existing submission */}
      {!submitMutation.data && latestSubmission && latestSubmission.verificationScore !== null && (
        <Card className={latestSubmission.status === 'approved' ? '!border-l-2 !border-l-neon !bg-[rgba(57,255,20,0.04)]' : ''}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] text-text-secondary uppercase">VERIFICATION_RESULT</span>
            <Badge variant={latestSubmission.status === 'approved' ? 'paid' : latestSubmission.status === 'rejected' ? 'rejected' : 'pending'}>
              {latestSubmission.status.toUpperCase()}
            </Badge>
          </div>
          <ScoreBar score={latestSubmission.verificationScore} />
          {latestSubmission.status === 'approved' && (
            <div className="flex items-center gap-2 text-neon font-mono text-sm mt-2">
              <CheckCircle size={14} /> Proof verified. Funds released.
            </div>
          )}
        </Card>
      )}
    </Card>
  )
}

function VerificationResult({ data }: { data: any }) {
  const sub = data.submission
  const ver = data.verification
  const payout = data.payout

  return (
    <Card className={sub?.status === 'approved' ? '!border-l-2 !border-l-neon !bg-[rgba(57,255,20,0.04)]' : sub?.status === 'rejected' ? '!border-l-2 !border-l-danger !bg-[rgba(255,59,59,0.04)]' : ''}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] text-text-secondary uppercase">VERIFICATION_RESULT</span>
        <Badge variant={sub?.status === 'approved' ? 'paid' : sub?.status === 'rejected' ? 'rejected' : 'pending'}>
          {(sub?.status || 'unknown').toUpperCase()}
        </Badge>
      </div>

      {ver && <ScoreBar score={ver.overallScore} />}

      {ver?.reason && (
        <div className="font-mono text-xs text-text-secondary mt-2 mb-2">{ver.reason}</div>
      )}

      {sub?.status === 'approved' && payout && (
        <div className="space-y-1 mt-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-neon">
            <CheckCircle size={14} /> FUNDS_RELEASED
          </div>
          <div className="text-text-secondary">
            Worker payout: <span className="text-neon">${formatUsdt(payout.workerPayout)} USDT</span>
          </div>
          <div className="text-text-secondary flex items-center gap-1">
            TX: <ExplorerLink type="tx" value={payout.workerTxHash} className="!text-xs" />
          </div>
        </div>
      )}

      {sub?.status === 'rejected' && (
        <div className="flex items-center gap-2 text-danger font-mono text-sm mt-2">
          <XCircle size={14} /> Proof does not meet requirements.
        </div>
      )}
    </Card>
  )
}

function CategoryFields({ category, ...p }: {
  category: string
  pickupConfirmed: boolean; setPickupConfirmed: (v: boolean) => void
  pickupGps: { lat: number; lon: number; timestamp: string } | null; setPickupGps: (v: { lat: number; lon: number; timestamp: string }) => void
  locationStatus: string; setLocationStatus: (v: string) => void
  dataCount: string; setDataCount: (v: string) => void
  dataNotes: string; setDataNotes: (v: string) => void
  experienceReport: string; setExperienceReport: (v: string) => void
  crowdLevel: string; setCrowdLevel: (v: string) => void
  eventNotes: string; setEventNotes: (v: string) => void
  deliveryNotes: string; setDeliveryNotes: (v: string) => void
  eventCheckin: { lat: number; lon: number; timestamp: string } | null; setEventCheckin: (v: { lat: number; lon: number; timestamp: string } | null) => void
}) {
  if (category === 'photo') return null // Photo: just the photo, no extra fields

  const inputClass = "w-full px-3 py-2 bg-input border border-border-subtle rounded font-mono text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border"

  return (
    <Card className="!p-4 !bg-elevated mb-4">
      <span className="font-mono text-[10px] text-text-secondary uppercase block mb-3">
        {category.toUpperCase()}_REPORT_DATA
      </span>

      {category === 'delivery' && (
        <div className="space-y-3">
          <div className="font-mono text-[10px] text-text-tertiary">STEP 1: Confirm pickup at origin location</div>
          {!p.pickupConfirmed ? (
            <button
              onClick={() => {
                if ('geolocation' in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      p.setPickupGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, timestamp: new Date().toISOString() })
                      p.setPickupConfirmed(true)
                    },
                    () => p.setPickupConfirmed(true),
                    { enableHighAccuracy: true, timeout: 10000 },
                  )
                } else {
                  p.setPickupConfirmed(true)
                }
              }}
              className="w-full py-2.5 px-4 border border-yellow-border rounded font-mono text-xs text-yellow-accent uppercase cursor-pointer hover:bg-yellow-dim transition-colors duration-100"
            >
              [ CONFIRM_PICKUP_GPS ]
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2 border border-neon-border rounded bg-neon-dim font-mono text-xs text-neon">
              <span className="w-2 h-2 bg-neon rounded-full" />
              PICKUP_CONFIRMED at {new Date().toLocaleTimeString()}
            </div>
          )}
          <div className="font-mono text-[10px] text-text-tertiary">STEP 2: Go to delivery location, take photo, submit</div>
          <input type="text" value={p.deliveryNotes} onChange={e => p.setDeliveryNotes(e.target.value)}
            placeholder="Delivery notes (e.g., left at front desk, handed to recipient)"
            className={inputClass} />
        </div>
      )}

      {category === 'check' && (
        <div className="space-y-2">
          <span className="font-mono text-xs text-text-secondary">LOCATION_STATUS:</span>
          <div className="flex gap-2">
            {['open', 'closed', 'limited', 'unknown'].map(s => (
              <button key={s} onClick={() => p.setLocationStatus(s)}
                className={`px-3 py-1.5 border rounded font-mono text-xs uppercase cursor-pointer transition-colors duration-100 ${
                  p.locationStatus === s ? 'border-neon-border text-neon bg-neon-dim' : 'border-border-medium text-text-secondary'
                }`}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {category === 'data' && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <span className="font-mono text-xs text-text-secondary shrink-0">COUNT:</span>
            <input type="number" value={p.dataCount} onChange={e => p.setDataCount(e.target.value)}
              placeholder="0" className={inputClass + ' !w-24'} />
          </div>
          <input type="text" value={p.dataNotes} onChange={e => p.setDataNotes(e.target.value)}
            placeholder="What did you count? (e.g., 15 tables, 42 cars, 8 items on shelf)"
            className={inputClass} />
        </div>
      )}

      {category === 'mystery' && (
        <div className="space-y-2">
          <span className="font-mono text-xs text-text-secondary">EXPERIENCE_REPORT:</span>
          <textarea value={p.experienceReport} onChange={e => p.setExperienceReport(e.target.value)}
            placeholder="Describe your experience as a customer: service quality, wait time, cleanliness, staff behavior, product quality..."
            rows={4} className={inputClass + ' resize-none'} />
        </div>
      )}

      {category === 'event' && (
        <div className="space-y-3">
          <div className="font-mono text-[10px] text-text-tertiary">STEP 1: Check in when you arrive at the event</div>
          {!p.eventCheckin ? (
            <button
              onClick={() => {
                if ('geolocation' in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => p.setEventCheckin({ lat: pos.coords.latitude, lon: pos.coords.longitude, timestamp: new Date().toISOString() }),
                    () => p.setEventCheckin({ lat: 0, lon: 0, timestamp: new Date().toISOString() }),
                    { enableHighAccuracy: true, timeout: 10000 },
                  )
                } else {
                  p.setEventCheckin({ lat: 0, lon: 0, timestamp: new Date().toISOString() })
                }
              }}
              className="w-full py-2.5 px-4 border border-yellow-border rounded font-mono text-xs text-yellow-accent uppercase cursor-pointer hover:bg-yellow-dim transition-colors duration-100"
            >
              [ CHECK_IN_AT_EVENT ]
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2 border border-neon-border rounded bg-neon-dim font-mono text-xs text-neon">
              <span className="w-2 h-2 bg-neon rounded-full" />
              CHECKED_IN at {new Date(p.eventCheckin.timestamp).toLocaleTimeString()}
              {p.eventCheckin.lat !== 0 && ` (${p.eventCheckin.lat.toFixed(4)}, ${p.eventCheckin.lon.toFixed(4)})`}
            </div>
          )}
          <div className="font-mono text-[10px] text-text-tertiary">STEP 2: Document the event, then submit when leaving</div>
          <span className="font-mono text-xs text-text-secondary">CROWD_LEVEL:</span>
          <div className="flex gap-2 flex-wrap">
            {['empty', 'sparse', 'moderate', 'crowded', 'packed'].map(l => (
              <button key={l} onClick={() => p.setCrowdLevel(l)}
                className={`px-3 py-1.5 border rounded font-mono text-xs uppercase cursor-pointer transition-colors duration-100 ${
                  p.crowdLevel === l ? 'border-neon-border text-neon bg-neon-dim' : 'border-border-medium text-text-secondary'
                }`}>{l}</button>
            ))}
          </div>
          <input type="text" value={p.eventNotes} onChange={e => p.setEventNotes(e.target.value)}
            placeholder="Event notes (e.g., estimated 200 people, live music, vendor booths)"
            className={inputClass} />
          {p.eventCheckin && (
            <div className="font-mono text-[10px] text-text-secondary">
              Duration so far: {Math.round((Date.now() - new Date(p.eventCheckin.timestamp).getTime()) / 60000)} min
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ScoreBar({ score }: { score: number }) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-text-secondary">AI_CONFIDENCE_SCORE</span>
        <span className={`font-mono text-sm ${score >= 70 ? 'text-neon' : score >= 50 ? 'text-yellow-accent' : 'text-danger'}`}>{score}%</span>
      </div>
      <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            background: score >= 70 ? '#39FF14' : score >= 50 ? '#FAFF00' : '#FF3B3B',
          }}
        />
      </div>
    </>
  )
}
