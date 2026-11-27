import { useEffect } from 'react'

export default function useLandingEffects(pageRef) {
  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const header = page.querySelector('.top')
    const timeline = page.querySelector('#how-timeline')
    const fill = page.querySelector('#how-progress-line')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    function updateScroll() {
      frame = 0
      header?.classList.toggle('is-scrolled', window.scrollY > 18)
      if (timeline && fill) {
        const rect = timeline.getBoundingClientRect()
        const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.72 - rect.top) / Math.max(1, rect.height)))
        fill.style.transform = `scaleY(${progress})`
      }
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(updateScroll)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    updateScroll()

    const reveals = [...page.querySelectorAll('.reveal-3d')]
    let observer
    if ('IntersectionObserver' in window && !reducedMotion.matches) {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
      reveals.forEach(element => observer.observe(element))
    } else {
      reveals.forEach(element => element.classList.add('is-visible'))
    }

    function onMove(event) {
      if (event.pointerType !== 'mouse' || reducedMotion.matches) return
      const card = event.currentTarget
      const rect = card.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      card.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`)
      card.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`)
    }
    function onLeave(event) {
      event.currentTarget.style.setProperty('--rx', '0deg')
      event.currentTarget.style.setProperty('--ry', '0deg')
    }
    const cards = [...page.querySelectorAll('.tilt-3d')]
    cards.forEach(card => {
      card.addEventListener('pointermove', onMove)
      card.addEventListener('pointerleave', onLeave)
    })

    const anchor = window.location.hash.slice(1)
    if (anchor) page.querySelectorAll('[id]').forEach(element => {
      if (element.id === anchor) element.scrollIntoView()
    })

    return () => {
      observer?.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cards.forEach(card => {
        card.removeEventListener('pointermove', onMove)
        card.removeEventListener('pointerleave', onLeave)
      })
    }
  }, [pageRef])
}
