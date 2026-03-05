"use client"

import * as React from "react"

type WritingTransition = {
  delay?: number
  duration?: number
  [key: string]: unknown
}

type WritingTextProps = Omit<React.ComponentProps<"span">, "children"> & {
  transition?: WritingTransition
  inView?: boolean
  inViewMargin?: string
  inViewOnce?: boolean
  spacing?: number | string
  text: string
}

const WritingText = React.forwardRef<HTMLSpanElement, WritingTextProps>(function WritingText(
  {
    inView = false,
    inViewMargin = "0px",
    inViewOnce = true,
    spacing = 5,
    text,
    transition = { duration: 0.9, delay: 0.08 },
    ...props
  },
  ref,
) {
  const localRef = React.useRef<HTMLSpanElement>(null)
  const [isInView, setIsInView] = React.useState(false)

  React.useEffect(() => {
    if (!inView) {
      const frame = window.requestAnimationFrame(() => {
        setIsInView(true)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    setIsInView(false)
    const element = localRef.current
    if (!element) {
      return
    }

    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true)
          if (inViewOnce) {
            observer.disconnect()
          }
          return
        }

        if (!inViewOnce) {
          setIsInView(false)
        }
      },
      { rootMargin: inViewMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [inView, inViewMargin, inViewOnce])

  const setRefs = React.useCallback(
    (node: HTMLSpanElement | null) => {
      localRef.current = node
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref],
  )

  const words = React.useMemo(() => text.split(" "), [text])
  const delayStep = Number(transition?.delay ?? 0)
  const duration = Number(transition?.duration ?? 0.9)

  return (
    <span data-slot="writing-text" ref={setRefs} {...props}>
      {words.map((word, index) => (
        <span
          className="inline-block"
          key={`${word}-${index}`}
          style={{
            opacity: isInView ? 1 : 0,
            transform: isInView ? "translateY(0px)" : "translateY(10px)",
            transitionProperty: "opacity, transform",
            transitionDuration: `${duration}s`,
            transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            transitionDelay: `${index * delayStep}s`,
            willChange: "opacity, transform",
            marginRight: index === words.length - 1 ? undefined : spacing,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  )
})

export { WritingText, type WritingTextProps }
export default WritingText
