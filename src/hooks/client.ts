import { useEffect, useState } from 'react'

export const useClientOnly = () => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}

export const useClientId = (prefix = 'id') => {
  const [id, setId] = useState('')
  const isClient = useClientOnly()

  useEffect(() => {
    if (isClient) {
      setId(
        `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      )
    }
  }, [isClient, prefix])

  return id
}

export const ClientOnly = ({
  children,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) => {
  const isClient = useClientOnly()

  return isClient ?? children
}
