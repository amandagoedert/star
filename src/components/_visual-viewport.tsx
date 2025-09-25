'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react/jsx-runtime'

interface VisualViewportProps extends React.HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements
  children: React.ReactNode
  style?: React.CSSProperties
}

export const VisualViewport: React.FC<VisualViewportProps> = ({
  as: Element = 'div',
  children,
  style = {},
  ...props
}) => {
  const ref = useRef<HTMLElement>(null)

  const [viewport, setViewport] = useState({
    maxHeight: '100vh',
    maxWidth: '100vw',
  })

  const updateViewport = () => {
    if (window.visualViewport) {
      setViewport({
        maxHeight: `${window.visualViewport.height}px`,
        maxWidth: `${window.visualViewport.width}px`,
      })
    }
  }

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.visualViewport !== 'undefined'
    ) {
      updateViewport()

      window.visualViewport?.addEventListener('resize', updateViewport)

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', updateViewport)
        }
      }
    }
  }, [])

  return React.createElement(
    Element,
    {
      ref,
      style: { ...style, ...viewport },
      ...props,
    },
    children
  )
}
