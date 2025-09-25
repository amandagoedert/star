import Logo from '@/assets/images/logo-starlink.svg'
import Image from 'next/image'
import { useEffect } from 'react'

interface LoadingProps {
  isLoading: boolean
  timer?: number
  onTimerEnd?: () => void
}

export default function Loader({
  isLoading = true,
  timer,
  onTimerEnd,
}: LoadingProps) {
  useEffect(() => {
    if (!isLoading || !timer) return

    const timeoutId = setTimeout(() => {
      if (onTimerEnd) {
        onTimerEnd()
      }
    }, timer)

    return () => clearTimeout(timeoutId)
  }, [isLoading, timer, onTimerEnd])

  if (!isLoading) return null

  return (
    <div className="relative z-[170] bg-black text-white h-svh w-full">
      <div className="w-full h-full flex flex-col items-center justify-center">
        <Image alt="Starlink" src={Logo} width={178} className="h-auto mb-4" />
        <div
          className="relative w-full max-w-[178px] h-[6px] bg-[#727272] overflow-hidden
        before:absolute before:w-full before:max-w-[40%] before:h-full before:bg-white before:animate-infinite animate-loader-bar"
        />
      </div>
    </div>
  )
}
