'use client'

import { useEffect, useState } from 'react'

export default function DesktopBlocker({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkDevice = () => {
      // Verifica se é desktop baseado em:
      // 1. Largura da tela
      // 2. User Agent (ausência de indicadores mobile)
      // 3. Tipo de ponteiro (mouse vs touch)
      
      const width = window.innerWidth
      const userAgent = navigator.userAgent.toLowerCase()
      
      const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const isLargeScreen = width >= 1024 // Considera desktop se largura >= 1024px
      
      // É desktop se: tela grande E (não tem indicadores mobile OU não tem touch)
      const desktop = isLargeScreen && (!isMobileUserAgent || !hasTouch)
      
      setIsDesktop(desktop)
      setIsLoading(false)
    }

    // Verifica imediatamente
    checkDevice()
    
    // Verifica quando a tela redimensiona
    window.addEventListener('resize', checkDevice)
    
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  // Mostra loading enquanto detecta
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    )
  }

  // Bloqueia desktop
  if (isDesktop) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center text-white">
          <div className="mb-6">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
            <p className="text-gray-300 mb-4">
              Este site está disponível apenas para dispositivos móveis.
            </p>
            <p className="text-sm text-gray-400">
              Para a melhor experiência, acesse através do seu smartphone ou tablet.
            </p>
          </div>
          
          <div className="border border-gray-600 rounded-lg p-4 bg-gray-900">
            <p className="text-xs text-gray-400 mb-2">Como acessar:</p>
            <ul className="text-sm text-gray-300 space-y-1 text-left">
              <li>• Use seu smartphone ou tablet</li>
              <li>• Abra o navegador móvel</li>
              <li>• Digite o mesmo endereço</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Permite acesso em mobile
  return <>{children}</>
}