"use client"

import {
  createElement,
  type ElementType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

interface TypingTextProps {
  className?: string
  showCursor?: boolean
  hideCursorWhileTyping?: boolean
  cursorCharacter?: string | React.ReactNode
  cursorBlinkDuration?: number
  cursorClassName?: string
  text: string | string[]
  as?: ElementType
  typingSpeed?: number
  initialDelay?: number
  pauseDuration?: number
  deletingSpeed?: number
  loop?: boolean
  textColors?: string[]
  variableSpeed?: { min: number; max: number }
  onSentenceComplete?: (sentence: string, index: number) => void
  startOnVisible?: boolean
  reverseMode?: boolean
}

const TypingText = ({
  text,
  as: Component = "div",
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorClassName = "",
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}: TypingTextProps & React.HTMLAttributes<HTMLElement>) => {
  const [displayedText, setDisplayedText] = useState("")
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(!startOnVisible)
  const [isFinished, setIsFinished] = useState(false)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLElement>(null)

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text])
  const hasText = textArray.length > 0

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) {
      return typingSpeed
    }
    const { min, max } = variableSpeed
    return Math.random() * (max - min) + min
  }, [variableSpeed, typingSpeed])

  const getCurrentTextColor = () => {
    if (textColors.length === 0) {
      return "currentColor"
    }
    return textColors[currentTextIndex % textColors.length]
  }

  useEffect(() => {
    if (!(startOnVisible && containerRef.current)) {
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.1 },
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [startOnVisible])

  useEffect(() => {
    const cursorElement = cursorRef.current
    if (!showCursor || !cursorElement) {
      return
    }

    cursorElement.style.opacity = "1"
    const duration = Math.max(120, cursorBlinkDuration * 1000)
    const animation = cursorElement.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration,
        iterations: Infinity,
        direction: "alternate",
        easing: "ease-in-out",
      },
    )

    return () => {
      animation.cancel()
      cursorElement.style.opacity = "1"
    }
  }, [showCursor, cursorBlinkDuration])

  useEffect(() => {
    if (!isVisible || !hasText || isFinished) {
      return
    }

    let timeout: ReturnType<typeof setTimeout> | undefined

    const currentText = textArray[currentTextIndex]
    const processedText = reverseMode ? currentText.split("").reverse().join("") : currentText

    const executeTypingAnimation = () => {
      if (isDeleting) {
        if (displayedText === "") {
          setIsDeleting(false)
          if (currentTextIndex === textArray.length - 1 && !loop) {
            setIsFinished(true)
            return
          }

          if (onSentenceComplete) {
            onSentenceComplete(textArray[currentTextIndex], currentTextIndex)
          }

          setCurrentTextIndex(prev => (prev + 1) % textArray.length)
          setCurrentCharIndex(0)
          timeout = setTimeout(() => {
            // intentional pause between sentences
          }, pauseDuration)
        } else {
          timeout = setTimeout(() => {
            setDisplayedText(prev => prev.slice(0, -1))
          }, deletingSpeed)
        }
      } else if (currentCharIndex < processedText.length) {
        timeout = setTimeout(
          () => {
            setDisplayedText(prev => prev + processedText[currentCharIndex])
            setCurrentCharIndex(prev => prev + 1)
          },
          variableSpeed ? getRandomSpeed() : typingSpeed,
        )
      } else if (textArray.length > 1 && (loop || currentTextIndex < textArray.length - 1)) {
        timeout = setTimeout(() => {
          setIsDeleting(true)
        }, pauseDuration)
      }
    }

    if (currentCharIndex === 0 && !isDeleting && displayedText === "") {
      timeout = setTimeout(executeTypingAnimation, initialDelay)
    } else {
      executeTypingAnimation()
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    textArray,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    isFinished,
    hasText,
    reverseMode,
    variableSpeed,
    onSentenceComplete,
    getRandomSpeed,
  ])

  const currentTextLength = hasText ? textArray[currentTextIndex]?.length ?? 0 : 0
  const shouldHideCursor = hideCursorWhileTyping && (currentCharIndex < currentTextLength || isDeleting)

  return (
    <span ref={containerRef}>
      {createElement(
        Component,
        {
          className: `inline-block whitespace-pre-wrap tracking-tight ${className}`,
          ...props,
        },
        <span className="inline" style={{ color: getCurrentTextColor() }}>
          {displayedText}
        </span>,
        showCursor && (
          <span
            className={`inline-block ${shouldHideCursor ? "hidden" : ""} ${
              cursorCharacter === "|"
                ? `h-5 w-[1px] translate-y-1 bg-foreground ${cursorClassName}`
                : `ml-1 ${cursorClassName}`
            }`}
            ref={cursorRef}
          >
            {cursorCharacter === "|" ? "" : cursorCharacter}
          </span>
        ),
      )}
    </span>
  )
}

export default TypingText
