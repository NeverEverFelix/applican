"use client"

import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import gsap from "gsap"
import { Observer } from "gsap/all"
import styles from "./ScrollSections.module.css"

gsap.registerPlugin(Observer)

type ScrollSectionItem = {
  id: string
  content: ReactNode
}

type ScrollSectionsProps = {
  sections: ScrollSectionItem[]
}

export default function ScrollSections({ sections: items }: ScrollSectionsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageCount = items.length

  useEffect(() => {
    if (!containerRef.current || stageCount === 0) {
      return
    }

    let observer: Observer | null = null

    const ctx = gsap.context(() => {
      const stages = gsap.utils.toArray<HTMLElement>("[data-scroll-stage]")
      const panels = gsap.utils.toArray<HTMLElement>("[data-scroll-panel]")
      const outerWrappers = gsap.utils.toArray<HTMLElement>("[data-scroll-outer]")
      const innerWrappers = gsap.utils.toArray<HTMLElement>("[data-scroll-inner]")

      let currentIndex = -1
      const clamp = gsap.utils.clamp(0, stages.length - 1)
      let animating = false

      gsap.set(stages, { autoAlpha: 0, zIndex: 0, pointerEvents: "none" })
      gsap.set(outerWrappers, { yPercent: 100 })
      gsap.set(innerWrappers, { yPercent: -100 })

      function gotoSection(index: number, direction: number) {
        index = clamp(index)

        if (index === currentIndex) {
          return
        }

        animating = true

        const fromTop = direction === -1
        const dFactor = fromTop ? -1 : 1

        const tl = gsap.timeline({
          defaults: { duration: 1.25, ease: "power1.inOut" },
          onComplete: () => {
            animating = false
          },
        })

        if (currentIndex >= 0 && stages[currentIndex]) {
          gsap.set(stages[currentIndex], { zIndex: 0, pointerEvents: "none" })

          tl.to(panels[currentIndex], { yPercent: -15 * dFactor }, 0)
            .to(
              stages[currentIndex],
              { autoAlpha: 0, duration: 0.55, ease: "power2.out" },
              0
            )
        }

        gsap.set(stages[index], { zIndex: 1, pointerEvents: "auto" })

        tl.fromTo(
          [outerWrappers[index], innerWrappers[index]],
          {
            yPercent: (i: number) => (i ? -100 * dFactor : 100 * dFactor),
          },
          { yPercent: 0 },
          0
        )
          .fromTo(panels[index], { yPercent: 15 * dFactor }, { yPercent: 0 }, 0)
          .fromTo(
            stages[index],
            { autoAlpha: currentIndex < 0 ? 1 : 0 },
            { autoAlpha: 1, duration: 0.55, ease: "power2.out" },
            0
          )

        currentIndex = index
      }

      observer = Observer.create({
        target: containerRef.current,
        type: "wheel,touch",
        wheelSpeed: -1,
        tolerance: 10,
        preventDefault: true,
        onUp: () => {
          if (!animating) {
            gotoSection(currentIndex + 1, 1)
          }
        },
        onDown: () => {
          if (!animating) {
            gotoSection(currentIndex - 1, -1)
          }
        },
      })

      gotoSection(0, 1)
    }, containerRef)

    return () => {
      observer?.kill()
      ctx.revert()
    }
  }, [stageCount])

  return (
    <div ref={containerRef} className={styles.scrollFlow}>
      {items.map((item) => (
        <section key={item.id} data-scroll-stage className={styles.stage}>
          <div data-scroll-outer className={styles.outer}>
            <div data-scroll-inner className={styles.inner}>
              <div data-scroll-panel className={styles.panel}>
                {item.content}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
