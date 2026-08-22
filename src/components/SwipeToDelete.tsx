'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { useHaptic } from '@/components/TelegramProvider'

// --- Context: ensures only one item open at a time ---

interface SwipeDeleteContextType {
  openId: string | null
  setOpenId: (id: string | null) => void
}

const SwipeDeleteContext = createContext<SwipeDeleteContextType>({
  openId: null,
  setOpenId: () => {},
})

export function SwipeDeleteProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <SwipeDeleteContext.Provider value={{ openId, setOpenId }}>
      {children}
    </SwipeDeleteContext.Provider>
  )
}

// --- SwipeToDelete wrapper ---

interface SwipeToDeleteProps {
  id: string
  /**
   * Performs the delete. Return the promise (don't fire-and-forget) so the row
   * stays on screen until the request resolves — if it rejects the row is
   * restored. Callers are expected to surface the failure themselves (toast)
   * and rethrow so this component knows to put the row back.
   */
  onDelete: () => void | Promise<void>
  children: React.ReactNode
  disabled?: boolean
  borderRadius?: string
}

const DELETE_BUTTON_WIDTH = 80
const SNAP_THRESHOLD = 0.4

export default function SwipeToDelete({ id, onDelete, children, disabled, borderRadius }: SwipeToDeleteProps) {
  const haptic = useHaptic()
  const { openId, setOpenId } = useContext(SwipeDeleteContext)
  const containerRef = useRef<HTMLDivElement>(null)
  const inFlightRef = useRef(false)
  const [deleting, setDeleting] = useState(false)

  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-DELETE_BUTTON_WIDTH, 0], [1, 0])
  const deleteScale = useTransform(x, [-DELETE_BUTTON_WIDTH, 0], [1, 0.8])

  const isOpen = openId === id

  const snapOpen = useCallback(() => {
    animate(x, -DELETE_BUTTON_WIDTH, { type: 'spring', stiffness: 500, damping: 30 })
    setOpenId(id)
    haptic.impact('light')
  }, [x, id, setOpenId, haptic])

  const snapClosed = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 })
    if (openId === id) setOpenId(null)
  }, [x, id, openId, setOpenId])

  // Close this item if another one opened. Kept in an effect — animating from
  // the render body fires during React's render phase (and twice in StrictMode).
  useEffect(() => {
    if (isOpen || deleting || x.get() === 0) return
    const controls = animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 })
    return () => controls.stop()
  }, [isOpen, deleting, x])

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const containerWidth = containerRef.current?.offsetWidth ?? 300
    const threshold = containerWidth * SNAP_THRESHOLD
    const shouldOpen = info.offset.x < -threshold || info.velocity.x < -500

    if (shouldOpen) {
      snapOpen()
    } else {
      snapClosed()
    }
  }

  async function handleDelete() {
    if (inFlightRef.current) return
    inFlightRef.current = true
    haptic.notification('warning')
    setDeleting(true)
    animate(x, -(containerRef.current?.offsetWidth ?? 300), {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    })
    try {
      await onDelete()
      // The row is gone — leaving `openId` pointing at it would keep every
      // other row's "close because another opened" effect pinned to a ghost.
      if (openId === id) setOpenId(null)
    } catch (err) {
      // The delete failed — put the row back rather than leaving a phantom gap.
      // The caller has already shown the error, so swallow it here (throwing
      // from an onClick handler would only become an unhandled rejection).
      console.error('Delete failed, restoring row:', err)
      setDeleting(false)
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 })
      if (openId === id) setOpenId(null)
    } finally {
      inFlightRef.current = false
    }
  }

  function handleContentTap() {
    if (isOpen) {
      snapClosed()
    }
  }

  if (disabled) {
    return <>{children}</>
  }

  return (
    <AnimatePresence>
      {!deleting && (
        <motion.div
          layout
          // `initial={false}` keeps the row at its natural size on first paint,
          // and the explicit `animate` gives the exit somewhere to come back
          // *from*: without it a delete that rejects fast restored the row with
          // the collapsed height/opacity the exit had already applied.
          initial={false}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
          transition={{ duration: 0.2 }}
          ref={containerRef}
          style={{ position: 'relative', overflow: 'hidden', borderRadius }}
        >
          {/* Delete button behind — wrapper centers it vertically */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: DELETE_BUTTON_WIDTH,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.button
              type="button"
              aria-label="Delete"
              tabIndex={isOpen ? 0 : -1}
              onClick={handleDelete}
              style={{
                width: '100%',
                height: 'calc(100% - 20px)',
                backgroundColor: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                padding: 0,
                borderRadius: '12px',
                opacity: deleteOpacity,
                scale: deleteScale,
                cursor: 'pointer',
              }}
            >
              <span style={{
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
              }}>
                Delete
              </span>
            </motion.button>
          </div>

          {/* Draggable content */}
          <motion.div
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: -DELETE_BUTTON_WIDTH, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            onClick={handleContentTap}
            style={{ x, position: 'relative', zIndex: 1, backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
