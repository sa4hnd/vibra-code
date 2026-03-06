"use client"

import { motion } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface TimelineContentProps {
  children: React.ReactNode
  animationNum: number
  timelineRef: React.RefObject<HTMLElement | null> | React.RefObject<HTMLDivElement | null>
  customVariants?: any
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export function TimelineContent({
  children,
  animationNum,
  timelineRef,
  customVariants,
  className,
  as: Component = "div",
  ...props
}: TimelineContentProps) {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -100px 0px",
      }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current)
      }
    }
  }, [])

  const defaultVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: animationNum * 0.1,
        ease: "easeOut",
      },
    },
  }

  const variants = customVariants || defaultVariants

  return (
    <motion.div
      ref={elementRef as any}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={variants}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
