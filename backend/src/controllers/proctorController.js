import { createClient } from '@supabase/supabase-js'
import multer from 'multer'

// Supabase admin client using service role key (never sent to client)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Multer: memory storage, 100 KB limit, jpeg only
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 102400 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'image/jpeg') cb(null, true)
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG images are accepted.'))
  },
}).single('image')

// ─── Helper: extract and verify JWT from Authorization header ─────────────────
async function verifyJwt(req) {
  const match = req.headers.authorization?.match(/^Bearer (\S+)$/)
  if (!match) return null
  const { data, error } = await supabase.auth.getUser(match[1])
  if (error || !data?.user) return null
  return data.user
}

// ─── upload ──────────────────────────────────────────────────────────────────
// POST /api/proctor/upload
// Accepts either:
//   - multipart/form-data: captureId, attemptId, examId, flags (JSON array), image (JPEG ≤ 100 KB)
//   - application/json: { captureId, attemptId, examId, flags, missed: true } when camera denied/unavailable
export async function upload(req, res) {
  if (req.is('application/json')) {
    try {
      const user = await verifyJwt(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized.' })

      const { captureId, attemptId, examId, flags = [], missed } = req.body || {}
      if (!missed || !captureId || !attemptId || !examId)
        return res.status(400).json({ error: 'captureId, attemptId, examId, and missed=true are required.' })

      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (![captureId, attemptId, examId].every(v => uuidRe.test(v)))
        return res.status(400).json({ error: 'Invalid UUID format.' })

      const { data: attempt, error: attemptErr } = await supabase
        .schema('examroom')
        .from('attempts')
        .select('id, candidate_id, exam_id, submitted_at, deadline')
        .eq('id', attemptId)
        .eq('candidate_id', user.id)
        .is('submitted_at', null)
        .gt('deadline', new Date().toISOString())
        .single()

      if (attemptErr || !attempt)
        return res.status(403).json({ error: 'Active attempt not found or access denied.' })

      const { error: dbErr } = await supabase
        .schema('examroom')
        .from('proctor_captures')
        .upsert({
          id:           captureId,
          attempt_id:   attemptId,
          exam_id:      examId,
          candidate_id: user.id,
          storage_path: null,
          flags:        Array.isArray(flags) ? flags : ['camera_unavailable'],
          status:       'missed',
        }, { onConflict: 'id' })

      if (dbErr)
        return res.status(500).json({ error: 'Database insert failed: ' + dbErr.message })

      return res.json({ ok: true, missed: true })
    } catch {
      return res.status(500).json({ error: 'Internal server error.' })
    }
  }

  multerUpload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        error: err instanceof multer.MulterError
          ? err.message || 'File upload error.'
          : 'Only JPEG images are accepted.',
      })
    }

    try {
      // 1. Auth
      const user = await verifyJwt(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized.' })

      // 2. Validate required fields
      const { captureId, attemptId, examId, flags: flagsRaw } = req.body
      if (!captureId || !attemptId || !examId)
        return res.status(400).json({ error: 'captureId, attemptId, and examId are required.' })

      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (![captureId, attemptId, examId].every(v => uuidRe.test(v)))
        return res.status(400).json({ error: 'Invalid UUID format.' })

      let flags = []
      if (flagsRaw) {
        try { flags = JSON.parse(flagsRaw) } catch { flags = [] }
      }
      if (!Array.isArray(flags)) flags = []

      // 3. File validation
      if (!req.file) return res.status(400).json({ error: 'Image file is required.' })
      if (req.file.mimetype !== 'image/jpeg')
        return res.status(400).json({ error: 'Only JPEG images are accepted.' })
      if (req.file.size > 102400)
        return res.status(400).json({ error: 'Image exceeds the 100 KB limit.' })

      // 4. Verify attempt belongs to caller, is active, and exam uses snapshots proctoring
      const { data: attempt, error: attemptErr } = await supabase
        .schema('examroom')
        .from('attempts')
        .select('id, candidate_id, exam_id, submitted_at, deadline')
        .eq('id', attemptId)
        .eq('candidate_id', user.id)
        .is('submitted_at', null)
        .gt('deadline', new Date().toISOString())
        .single()

      if (attemptErr || !attempt)
        return res.status(403).json({ error: 'Active attempt not found or access denied.' })

      // 5. Confirm exam proctoring mode
      const { data: exam, error: examErr } = await supabase
        .schema('examroom')
        .from('exams')
        .select('id, proctoring_mode')
        .eq('id', examId)
        .single()

      if (examErr || !exam)
        return res.status(403).json({ error: 'Exam not found.' })

      if (exam.proctoring_mode !== 'snapshots')
        return res.status(403).json({ error: 'Proctoring is not enabled for this exam.' })

      // 6. Upload to Supabase Storage
      const storagePath = `${examId}/${attemptId}/${captureId}.jpg`
      const { error: storageErr } = await supabase.storage
        .from('proctor-captures')
        .upload(storagePath, req.file.buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (storageErr)
        return res.status(500).json({ error: 'Storage upload failed: ' + storageErr.message })

      // 7. Upsert proctor_captures row
      const { error: dbErr } = await supabase
        .schema('examroom')
        .from('proctor_captures')
        .upsert({
          id:           captureId,
          attempt_id:   attemptId,
          exam_id:      examId,
          candidate_id: user.id,
          storage_path: storagePath,
          flags,
          status:       'pending',
        }, { onConflict: 'id' })

      if (dbErr)
        return res.status(500).json({ error: 'Database insert failed: ' + dbErr.message })

      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: 'Internal server error.' })
    }
  })
}

// ─── signedUrl ────────────────────────────────────────────────────────────────
// GET /api/proctor/image/:captureId
// Examiner retrieves a 60-second signed URL for a capture
export async function signedUrl(req, res) {
  try {
    const user = await verifyJwt(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized.' })

    const { captureId } = req.params
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRe.test(captureId))
      return res.status(400).json({ error: 'Invalid captureId.' })

    // Fetch capture
    const { data: capture, error: capErr } = await supabase
      .schema('examroom')
      .from('proctor_captures')
      .select('id, exam_id, storage_path')
      .eq('id', captureId)
      .single()

    if (capErr || !capture)
      return res.status(404).json({ error: 'Capture not found.' })

    // Verify requesting user is examiner who owns the exam (or admin)
    const { data: exam } = await supabase
      .schema('examroom')
      .from('exams')
      .select('id, owner_id')
      .eq('id', capture.exam_id)
      .single()

    if (!exam || exam.owner_id !== user.id) {
      const { data: prof } = await supabase
        .schema('examroom')
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!prof || prof.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied.' })
    }

    if (!capture.storage_path)
      return res.status(410).json({ error: 'Image has been deleted.' })

    // Generate signed URL (60 seconds)
    const { data: signed, error: signErr } = await supabase.storage
      .from('proctor-captures')
      .createSignedUrl(capture.storage_path, 60)

    if (signErr || !signed?.signedUrl)
      return res.status(500).json({ error: 'Could not generate signed URL.' })

    return res.json({ url: signed.signedUrl })
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error.' })
  }
}

// ─── review ───────────────────────────────────────────────────────────────────
// POST /api/proctor/review
// Body: { captureId, note, action } where action is 'reviewed' | 'escalated'
export async function review(req, res) {
  try {
    const user = await verifyJwt(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized.' })

    const { captureId, note, action } = req.body
    if (!captureId || !action)
      return res.status(400).json({ error: 'captureId and action are required.' })
    if (!['reviewed', 'escalated'].includes(action))
      return res.status(400).json({ error: 'action must be "reviewed" or "escalated".' })

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRe.test(captureId))
      return res.status(400).json({ error: 'Invalid captureId.' })

    // Fetch capture
    const { data: capture, error: capErr } = await supabase
      .schema('examroom')
      .from('proctor_captures')
      .select('*')
      .eq('id', captureId)
      .single()

    if (capErr || !capture)
      return res.status(404).json({ error: 'Capture not found.' })

    // Verify requesting user is examiner who owns the exam (or admin)
    const { data: exam, error: examErr } = await supabase
      .schema('examroom')
      .from('exams')
      .select('id, owner_id')
      .eq('id', capture.exam_id)
      .single()

    if (examErr || !exam)
      return res.status(404).json({ error: 'Exam not found.' })

    if (exam.owner_id !== user.id) {
      const { data: prof } = await supabase
        .schema('examroom')
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!prof || prof.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied.' })
    }

    // Idempotency: if already reviewed, return ok without re-deleting
    if (capture.status === 'reviewed' && action === 'reviewed') {
      return res.json({ ok: true, capture })
    }

    if (action === 'reviewed') {
      // 1. Delete image from storage (only if path exists)
      if (capture.storage_path) {
        const { error: delErr } = await supabase.storage
          .from('proctor-captures')
          .remove([capture.storage_path])

        if (delErr) {
          return res.status(500).json({
            ok: false,
            error: 'Storage deletion failed. Image not yet deleted. Try again.',
          })
        }
      }

      // 2. Update capture row (only after successful storage delete)
      const { data: updated, error: updErr } = await supabase
        .schema('examroom')
        .from('proctor_captures')
        .update({
          status:           'reviewed',
          reviewer_id:      user.id,
          reviewed_at:      new Date().toISOString(),
          reviewer_note:    note ?? null,
          image_deleted_at: new Date().toISOString(),
          storage_path:     null,
        })
        .eq('id', captureId)
        .select()
        .single()

      if (updErr)
        return res.status(500).json({ error: 'Database update failed: ' + updErr.message })

      // 3. Audit log
      await supabase.schema('examroom').from('audit_log').insert({
        exam_id:     capture.exam_id,
        actor_id:    user.id,
        action:      'proctor.review',
        entity_id:   captureId,
        before_data: { status: capture.status, storage_path: capture.storage_path },
        after_data:  { status: 'reviewed', storage_path: null },
      }).catch(() => {}) // audit log failure is non-fatal

      return res.json({ ok: true, capture: updated })

    } else {
      // action === 'escalated' — do NOT delete image
      const { data: updated, error: updErr } = await supabase
        .schema('examroom')
        .from('proctor_captures')
        .update({
          status:        'escalated',
          reviewer_id:   user.id,
          reviewed_at:   new Date().toISOString(),
          reviewer_note: note ?? null,
        })
        .eq('id', captureId)
        .select()
        .single()

      if (updErr)
        return res.status(500).json({ error: 'Database update failed: ' + updErr.message })

      // Audit log
      await supabase.schema('examroom').from('audit_log').insert({
        exam_id:     capture.exam_id,
        actor_id:    user.id,
        action:      'proctor.escalate',
        entity_id:   captureId,
        before_data: { status: capture.status },
        after_data:  { status: 'escalated' },
      }).catch(() => {})

      return res.json({ ok: true, capture: updated })
    }
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error.' })
  }
}

// ─── cleanup ──────────────────────────────────────────────────────────────────
// POST /api/proctor/cleanup
// Safety-net cleanup: deletes storage objects of pending captures older than 14 days
// for completed (published) exams. Skips escalated captures.
export async function cleanup(req, res) {
  try {
    const user = await verifyJwt(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized.' })

    const { data: prof } = await supabase
      .schema('examroom')
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single()

    if (!prof?.active || !['examiner', 'administrator'].includes(prof.role)) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: stale, error: qErr } = await supabase
      .schema('examroom')
      .from('proctor_captures')
      .select('id, exam_id, storage_path')
      .eq('status', 'pending')
      .lt('taken_at', cutoff)
      .not('storage_path', 'is', null)

    if (qErr) return res.status(500).json({ error: qErr.message })

    let cleaned = 0
    for (const cap of stale || []) {
      const { data: exam } = await supabase
        .schema('examroom')
        .from('exams')
        .select('id, results_published, owner_id')
        .eq('id', cap.exam_id)
        .single()

      if (!exam?.results_published) continue
      if (prof.role !== 'administrator' && exam.owner_id !== user.id) continue

      const { error: delErr } = await supabase.storage
        .from('proctor-captures')
        .remove([cap.storage_path])
      if (delErr) continue

      await supabase
        .schema('examroom')
        .from('proctor_captures')
        .update({
          image_deleted_at: new Date().toISOString(),
          storage_path: null,
          status: 'reviewed',
          reviewer_note: 'Auto-cleaned after 14 days',
        })
        .eq('id', cap.id)

      cleaned++
    }

    return res.json({ ok: true, cleaned })
  } catch {
    return res.status(500).json({ error: 'Internal server error.' })
  }
}
