'use client'

// import Banner2 from '@/assets/images/banner-2.png'
import Banner2 from '@/assets/images/banner-2-v2.jpg'
// import Banner3 from '@/assets/images/banner-3.png'
import Banner3 from '@/assets/images/banner-3-v2.jpg'
// import Banner from '@/assets/images/banner-header.png'
import Banner from '@/assets/images/banner-header-v2.jpg'
import Image2 from '@/assets/images/chip-starlink.png'
import IconQuestion from '@/assets/images/icon-question.svg'
import IconTarget from '@/assets/images/icon-target.svg'
import Image1 from '@/assets/images/image-1.png'
import { applyCepMask, removeCepMask } from '@/hooks/cep'
import { setAddress } from '@/hooks/storage'
import { ChevronUp, LoaderCircle } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import Footer from './_footer'
import Menu from './_menu'
import { useTrackedRouter } from './_tracker-push'
import { VisualViewport } from './_visual-viewport'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

const FAQ: {
  question: string
  answer: React.ReactNode
}[] = [
  {
    question: 'O que é o Chip Infinity M3?',
    answer: (
      <span>
        O Infinity M3 oferece internet, ligações e sms ilimitados para sempre
        com um pagamento único. Não há necessidade de recargas, assinaturas ou
        contratos, permitindo que você se conecte sem preocupações, de forma
        contínua e sem surpresas.
      </span>
    ),
  },
  {
    question: 'Como funciona a ativação do Infinity M3?',
    answer: (
      <span>
        A ativação é simples e rápida: insira o chip no seu dispositivo
        compatível, siga as instruções de ativação e, em poucos minutos, você
        estará conectado. Todo o processo é descomplicado, sem burocracia,
        garantindo que você comece a usar imediatamente.
      </span>
    ),
  },
  {
    question: 'Como o pagamento único funciona e quais garantias ele oferece?',
    answer: (
      <span>
        Com o Infinity M3, você paga uma única vez e obtém conectividade
        ilimitada para sempre. Sem fatura, sem surpresas e sem complicações com
        contratos mensais.
      </span>
    ),
  },
  {
    question:
      'Qual a cobertura do Infinity M3 e como posso ter certeza de sua confiabilidade?',
    answer: (
      <span>
        Cobertura global com dados ilimitados, funcionando em todos países. Além
        disso, nossa equipe de suporte está disponível 24/7 para atender
        quaisquer dúvidas ou problemas, garantindo segurança e confiança em cada
        conexão.
      </span>
    ),
  },
  {
    question: 'Posso fazer a portabilidade do meu número para o Infinity M3?',
    answer: (
      <div className="flex flex-col gap-6">
        <span>
          Sim! Para transferir seu número atual para o Infinity M3, basta
          inserir o chip no seu celular e enviar um SMS com a palavra
          “PORTABILIDADE” para o número indicado no manual. Em seguida, você
          receberá uma mensagem solicitando a confirmação dos seus dados e do
          número que deseja portar.
        </span>
        <span>
          Após confirmar, o processo de migração será iniciado e poderá levar 24
          horas. Durante esse período, seu número atual continuará funcionando
          normalmente. Assim que a portabilidade for concluída, você receberá
          uma notificação e já poderá usar o Infinity M3 com seu número antigo,
          sem interrupções.
        </span>
      </div>
    ),
  },
]

export default function HomePage() {
  const { push } = useTrackedRouter()

  const [scrollY, setScrollY] = useState(0)
  const [showPopup, setShowPopup] = useState(false)
  const [inputCep, setInputCep] = useState('')
  const [isLoadingCep, setIsLoadingCep] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)

  const onScroll = useCallback(() => {
    const { pageYOffset } = window
    setScrollY(pageYOffset)
  }, [])

  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [onScroll])

  useEffect(() => {
    if (showPopup) {
      document.body.classList.add('overflow-y-hidden')
    } else {
      document.body.classList.remove('overflow-y-hidden')
    }
  }, [showPopup])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (isSuccess) {
      push('/order')
    }
  }, [isSuccess])

  const handleCepChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const rawValue = e.target.value
      const maskedValue = applyCepMask(rawValue)

      setInputCep(maskedValue)
    },
    []
  )

  const handleSearchCep = async () => {
    const cleanCep = removeCepMask(inputCep)
    setIsLoadingCep(true)

    try {
      const viaCepResponse = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`
      )

      if (viaCepResponse.ok) {
        const viaCepData = await viaCepResponse.json()

        if (!viaCepData.erro) {
          const addressData = {
            cep: viaCepData.cep,
            rua: viaCepData.logradouro,
            endereco: viaCepData.logradouro,
            complemento: viaCepData.complemento || '',
            bairro: viaCepData.bairro,
            cidade: viaCepData.localidade,
            estado: viaCepData.uf,
          }

          setAddress(addressData)

          setIsSuccess(true)

          return addressData
        }
      }
    } catch (_viaCepError) {
      try {
        const openCepResponse = await fetch(
          `https://opencep.com/v1/${cleanCep}`
        )

        if (openCepResponse.ok) {
          const openCepData = await openCepResponse.json()

          const addressData = {
            cep: openCepData.cep,
            rua: openCepData.logradouro,
            endereco: openCepData.logradouro,
            complemento: openCepData.complemento || '',
            bairro: openCepData.bairro,
            cidade: openCepData.cidade,
            estado: openCepData.estado,
          }

          setAddress(addressData)

          setIsSuccess(true)

          return addressData
        }
      } catch (_openCepError) {
        alert('Não foi possível consultar o CEP. Tente novamente mais tarde.')
      }
    } finally {
      setTimeout(() => {
        setIsLoadingCep(false)
      }, 5000)
    }
  }

  return (
    <>
      <main className="w-full max-w-3xl mx-auto bg-black">
        <header className="relative w-full overflow-hidden">
          <Menu className="animate-delay-[1000ms] animate-fade animate-once animate-ease-out animate-fill-both" />

          <div
            className="absolute z-20 top-0 left-0 w-full h-full
            animate-ping animate-once animate-ease-in animate-reverse animate-fill-both"
            style={{
              background:
                'linear-gradient(180deg, rgba(0, 0, 0, 0) 50%, #000000 100%)',
            }}
          />
          <div
            className="absolute top-0 left-0 w-full h-full
            animate-ping animate-once animate-ease-in animate-reverse animate-fill-both"
          >
            <Image
              alt="Banner"
              src={Banner}
              fill
              priority
              sizes="100vw"
              className="object-center object-cover"
            />
          </div>
          <div className="relative z-30 flex flex-col pt-9 px-5 pb-10">
            <div
              className="w-full 
              animate-delay-[1100ms] animate-fade-down animate-once animate-ease-out animate-fill-both"
            >
              <h1 className="font-bold text-[32px] text-center mb-4 uppercase">
                CHIP INFINITY M3
              </h1>
              <p className="text-center">
                Internet, ligações e sms ILIMITADOS PARA SEMPRE em qualquer
                lugar do mundo, sem recargas ou mensalidades. Com um único
                pagamento, você garante conexão estável e sem restrições.
              </p>
            </div>
            <div
              className="mt-[133px] backdrop-blur-[8px] rounded-[8px] p-5 border border-[#FFF]/12 flex flex-col gap-8
              animate-delay-[1250ms] animate-fade-up animate-once animate-ease-out animate-fill-both"
            >
              <div className="flex flex-col gap-3">
                <p className="font-bold text-2xl uppercase">Chip infinity m3</p>
                <p className="text-sm">
                  Internet, ligações e sms ILIMITADOS PARA SEMPRE.
                </p>
                <p className="font-bold">por apenas R$ 197,90.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => setShowPopup(true)}
                  className="w-full h-auto rounded-[4px] text-sm font-bold px-8 py-3 uppercase bg-white text-black"
                >
                  Pedir agora
                </Button>
                <Button className="w-full h-auto rounded-[4px] text-sm font-bold px-8 py-3 uppercase bg-transparent text-white border border-white">
                  Saiba mais
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section
          className="relative px-5 pt-10
          animate-fade-up animate-once animate-duration-[600ms] animate-delay-[1300ms] animate-ease-out animate-normal animate-fill-both"
        >
          <div className="absolute top-0 left-0 w-full h-full">
            <Image
              alt="Banner 2"
              src={Banner2}
              fill
              priority
              sizes="100vw"
              className="object-center object-cover"
            />
          </div>
          <div className="relative z-20 min-h-[780px]">
            <h2 className="text-2xl font-bold uppercase pb-4 text-balance">
              a nova forma do mundo se conectar
            </h2>
            <p>
              Streaming, chamadas de vídeo, jogos on-line, trabalho remoto e
              muito mais. Agora isso é possível mesmo nos locais mais remotos,
              graças ao sistema de internet mais avançado do mundo.
            </p>
          </div>
        </section>

        <section className="bg-black px-5 pt-10">
          <h3 className="text-lg uppercase pb-10">chip infinity m3</h3>

          <div className="w-full pb-10">
            <h2 className="text-[22px] uppercase font-bold mb-5">
              INTERNET ILIMITADA
            </h2>
            <p>
              Acesse a internet em qualquer lugar com velocidade 5G, sem
              depender de Wi-Fi ou redes terrestres. O Chip Infinity M3 utiliza
              conexão via satélite de baixa órbita (LEO) para fornecer internet
              estável, sem interrupções e sem redução de velocidade. Não há
              franquias, limites ou necessidade de recargas – apenas internet
              ilimitada para sempre disponível.
            </p>
          </div>

          <div className="w-full pb-10">
            <h2 className="text-[22px] uppercase font-bold mb-5">
              LIGAÇÕES ILIMITADAS
            </h2>
            <p>
              Realize chamadas ilimitadas com conectividade direta via rede
              global, sem depender de infraestrutura tradicional de operadoras.
              O Chip Infinity M3 oferece suporte para chamadas de alta qualidade
              em qualquer localidade, eliminando custos com roaming e garantindo
              comunicação confiável mesmo em áreas remotas.
            </p>
          </div>

          <div className="w-full pb-10">
            <h2 className="text-[22px] uppercase font-bold mb-5">
              SMS ILIMITADOS
            </h2>
            <p>
              Envie mensagens ilimitadas para qualquer número, independentemente
              da sua localização. O Chip Infinity M3 mantém sua conectividade
              ativa mesmo onde redes móveis tradicionais falham, garantindo o
              envio e recebimento de sms ilimitados, sem restrições ou tarifas
              adicionais.
            </p>
          </div>
        </section>

        <section className="bg-black px-5 pt-10">
          <Image alt="Imagem 1" src={Image1} className="w-full pb-10" />

          <div className="w-full pb-10">
            <h2 className="text-[22px] uppercase font-bold mb-5 max-w-[255px]">
              trabalhe e divirta-se em locais remotos
            </h2>
            <p>
              Trabalhe, viaje e viva intensamente, sempre conectado. Internet
              sem limites para sempre, onde quer que você esteja. Sem
              mensalidades, sem interrupções – apenas liberdade.
            </p>
          </div>
        </section>

        <section className="bg-black px-5 pt-10">
          <Image
            alt="Imagem 1"
            src={Image2}
            className="w-full pb-10
            intersect:animate-fade-down intersect:animate-once intersect:animate-ease-out intersect:animate-fill-both"
          />

          <div className="w-full pb-8">
            <h2 className="text-[22px] uppercase font-bold mb-5 max-w-[255px]">
              CONECTE-SE EM POUCOS MINUTOS
            </h2>
            <p>Ative o Chip Infinity M3 em apenas três passos.</p>
          </div>

          <div className="w-full pb-10">
            <div className="flex flex-col gap-3 w-full">
              <p className="border-l-[2px] border-[#303030] w-full px-3 py-2 text-xl font-bold uppercase">
                1 - CONECTE O CHIP NO CELULAR
              </p>
              <p className="border-l-[2px] border-[#303030] w-full px-3 py-2 text-xl font-bold uppercase">
                2 - cadastre-se
              </p>
              <p className="border-l-[2px] border-[#303030] w-full px-3 py-2 text-xl font-bold uppercase">
                3 - TENHA TODOS DADOS ILIMITADOS
              </p>
            </div>
            <p className="pt-[23px]">
              Internet, ligações e sms ILIMITADOS PARA SEMPRE. Sem contratos
              mensais.
            </p>
          </div>
        </section>

        <section className="relative px-5 pt-10">
          <div className="absolute top-0 left-0 w-full h-full">
            <Image
              alt="Banner 3"
              src={Banner3}
              fill
              priority
              sizes="100vw"
              className="object-center object-cover"
            />
          </div>

          <div className="relative z-20 min-h-[780px]">
            <h2 className="text-2xl font-bold uppercase pb-4 text-balance">
              mais privacidade
            </h2>
            <p>
              O Chip Starlink M3 garante comunicação segura através de
              protocolos avançados de proteção via satélite, mantendo sua
              privacidade em qualquer lugar. Ao contrário das operadoras
              tradicionais, nossa tecnologia oferece uma conexão mais confiável
              e livre de interceptações.
            </p>
          </div>
        </section>

        <section className="bg-black px-5 pt-10">
          <div className="w-full pb-10">
            <h2 className="text-[22px] uppercase font-bold mb-5 max-w-[255px]">
              perguntas frequentes
            </h2>
          </div>

          <div className="w-full pb-10">
            <Accordion
              type="multiple"
              defaultValue={['item-0']}
              className="space-y-3"
            >
              {FAQ.map(({ answer, question }, index) => (
                <AccordionItem
                  key={question}
                  value={`item-${index}`}
                  className="flex items-start gap-2.5 bg-[#171717] p-3.5 rounded-[10px] border-none"
                >
                  <Image
                    alt="Questão"
                    src={IconQuestion}
                    className="mt-1 w-[20px] h-[20px]"
                  />
                  <div className="w-full">
                    <AccordionTrigger
                      title={question}
                      className="flex items-center font-bold text-lg p-0 w-full"
                    >
                      {question}
                    </AccordionTrigger>
                    <AccordionContent className="p-0 mt-1.5 text-white text-sm font-normal">
                      {answer}
                    </AccordionContent>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="bg-black relative px-5 py-10">
          <div className="w-full">
            <h2 className="text-2xl font-bold uppercase pb-4 text-balance text-center">
              sem limites
            </h2>
            <p className="text-center">Não se limite, viva a liberdade.</p>
            <p className="text-center">
              <b>Adquira agora o Chip Infinity M3.</b>
            </p>
          </div>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
          <div onClick={() => setShowPopup(true)} className="pt-10">
            <Label className="font-bold text-base text-white mb-2">
              Endereço de uso do serviço
            </Label>
            <div className="flex justify-between items-center gap-4 pl-7 pr-5 py-3.5 bg-[#272727] border-[2px] border-white/60 rounded-lg">
              <Input
                readOnly
                disabled
                type="text"
                placeholder="DIGITE SEU CEP"
                className="bg-transparent border-0 p-0 focus-visible:ring-0 w-full h-auto justify-between text-sm text-white placeholder:text-white placeholder:text-sm"
              />
              <Button asChild className="bg-transparent p-0 m-0 w-auto h-auto">
                <Image alt="Localização" src={IconTarget} className="w-5 h-5" />
              </Button>
            </div>
            <Button className="py-3.5 px-6 h-auto w-full bg-white text-black text-base uppercase font-bold mt-4 rounded-lg">
              Pedir agora
            </Button>
          </div>
        </section>
      </main>

      {showPopup && (
        <VisualViewport
          className={`fixed z-50 inset-0 flex flex-col justify-end ${
            showPopup
              ? 'animate-fade-up animate-duration-[100ms] animate-once animate-ease-out animate-fill-both'
              : 'animate-fade-down'
          }`}
        >
          {/* Backdrop */}
          <div
            onClick={() => setShowPopup(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                setShowPopup(false)
              }
            }}
            className="absolute inset-0 bg-[#121212]/60"
          />

          {/* Modal Content */}
          <div
            className={`relative z-10 w-full backdrop-blur-md border-t border-white/12 rounded-t-lg p-4 pb-6 ${
              isIOS && isInputFocused ? '' : ' self-center'
            }`}
          >
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="font-bold text-2xl uppercase">Chip infinity m3</p>
                <p className="text-sm">
                  Internet, ligações e sms ILIMITADOS PARA SEMPRE.
                </p>
                <p className="font-bold">por apenas R$ 197,90.</p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="w-full">
                  <Label
                    htmlFor="location"
                    className="font-bold text-base text-white mb-2 block"
                  >
                    Endereço de uso do serviço
                  </Label>
                  <div className="flex justify-between items-center gap-4 pr-5 bg-[#272727] border-[2px] border-white/60 rounded-lg">
                    <Input
                      autoFocus={showPopup}
                      name="location"
                      type="text"
                      placeholder="DIGITE SEU CEP"
                      value={inputCep}
                      onChange={handleCepChange}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      maxLength={9}
                      className="bg-transparent border-0 p-0 focus-visible:ring-0 transition-colors
                w-full h-auto justify-between text-sm text-white placeholder:text-white placeholder:text-sm
                focus-visible:placeholder:text-white/50 pl-7 py-3.5"
                      inputMode="numeric"
                    />
                    <Button
                      asChild
                      className="bg-transparent p-0 m-0 w-auto h-auto"
                    >
                      <Image
                        alt="Localização"
                        src={IconTarget}
                        className="w-5 h-5"
                      />
                    </Button>
                  </div>
                </div>

                <Button
                  className="py-3.5 px-6 h-auto w-full bg-white text-black text-base uppercase font-bold rounded-lg"
                  disabled={inputCep.length < 9 || isLoadingCep}
                  onClick={handleSearchCep}
                >
                  {isLoadingCep ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Pesquisando...
                    </>
                  ) : (
                    'Pedir agora'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </VisualViewport>
      )}

      {!showPopup && scrollY > 500 && (
        <div
          className={`w-full fixed z-50 backdrop-blur-[5px] bg-black/34 bottom-0
        flex flex-col items-center justify-between animate-duration-[175ms]
        ${showPopup ? 'p-5 pb-12 min-h-[calc(50dvh)]' : 'px-5 py-3'}
        ${
          scrollY > 500 || showPopup
            ? 'animate-fade-up border-t border-white/12'
            : 'hidden'
        }
      `}
        >
          <div
            onClick={() => setShowPopup(!showPopup)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                setShowPopup(!showPopup)
              }
            }}
            className="w-full flex items-center justify-between"
          >
            <>
              <ChevronUp
                className={`text-white size-5 transition-transform ${
                  showPopup ? 'rotate-180' : 'rotate-0'
                }`}
              />
              <Button
                variant="outline"
                className="h-auto w-auto uppercase px-8 py-3 text-black font-bold"
              >
                Pedir agora
              </Button>
            </>
          </div>
        </div>
      )}

      <Footer className="pb-20" />
    </>
  )
}
