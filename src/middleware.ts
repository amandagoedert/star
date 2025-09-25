import { type NextRequest, NextResponse, userAgent } from 'next/server'

const ALLOWED_UA_PATTERNS = [
  'vercel-cron',
  'vercel-monitoring',
  'vercel-edge',
  'vercel/',

  'UptimeRobot',
]

const VERCEL_IP_RANGES = [
  '76.76.19.0/24', // Vercel
  '76.223.126.0/24', // Vercel
  '108.156.0.0/16', // Vercel Edge
  '140.238.128.0/17', // Vercel
  '3.5.140.0/22', // AWS US-East (Vercel usa)
  '3.33.152.0/22', // AWS US-West (Vercel usa)
  '18.245.0.0/16', // AWS Global (Vercel)
  '52.222.128.0/17', // AWS CloudFront (Vercel usa)

  //uptimerobot
  '216.144.248.26',
  '216.144.248.25',
  '69.162.124.238',
  '216.144.248.22',
  '216.144.248.30',
  '216.144.248.18',
  // end uptimerobot
]

const ALLOWED_COUNTRIES = ['BR', 'US']

const SAVEWEB2ZIP_PATTERNS = {
  FAKE_SAFARI_PATTERNS: [
    /Mozilla\/5\.0 \(Macintosh; Intel Mac OS X 10_15_7\) AppleWebKit\/605\.1\.15 \(KHTML, like Gecko\) Version\/17\.2\.1 Safari\/605\.1\.15/,
    /Mozilla\/5\.0 \(Macintosh; Intel Mac OS X 10_15_\d+\) AppleWebKit\/605\.1\.15.*Version\/17\.\d+\.\d+ Safari\/605\.1\.15/,
    /Mozilla\/5\.0 \(Macintosh; Intel Mac OS X 10_14_\d+\) AppleWebKit\/605\.1\.15.*Version\/1[6-7]\.\d+\.\d+ Safari\/605\.1\.15/,
  ],

  SUSPICIOUS_LOCATIONS: [
    'frankfurt',
    'germany',
    'fra1',
    'singapore',
    'sgp1',
    'tokyo',
    'nrt1',
    'virginia',
    'iad1',
    'oregon',
    'pdx1',
  ],

  MISSING_HEADERS: [
    'sec-fetch-site',
    'sec-fetch-mode',
    'sec-fetch-dest',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
  ],
}

const BLOCKED_UA_PATTERNS = [
  // Ferramentas de cópia offline
  'HTTrack',
  'WinHTTrack',
  'WebCopier',
  'WebZIP',
  'SiteSucker',
  'grab-site',
  'Teleport',
  'Offline Explorer',

  // SaveWeb2Zip e similares
  'saveweb2zip',
  'web2zip',
  'savewebzip',
  'websitearchiver',
  'sitearchiver',
  'webarchiver',
  'archiver-bot',
  'ziparchiver',
  'pagezip',
  'webdownloader',
  'sitedownloader',
  'webpage-downloader',

  // Bibliotecas de requisições
  'wget',
  'curl',
  'python-requests',
  'axios',
  'node-fetch',
  'libwww-perl',
  'Java',
  'Go-http-client',
  'Apache-HttpClient',

  // Automação
  'PhantomJS',
  'HeadlessChrome',
  'Puppeteer',
  'Selenium',
  'Playwright',

  // Bots suspeitos
  'bot',
  'crawler',
  'spider',
  'scanner',
  'scrapy',
  'crawl',
  'fetch',
  'check',
  'analyzer',
  'site-analyzer',
  'page-analyzer',
  'validator',
  'seo-checker',

  // Cache/Archive
  'archive',
  'wayback',
  'web.archive',
  'webcache',
  'cachedview',
  'archiveweb',

  // Motores de busca problemáticos
  'baidu',
  'yandex',
  'mj12bot',
  'semrush',
  'ahrefs',
  'dotbot',
  'slurp',
  'seokicks',
  'megaindex',

  // Monitoramento
  'lighthouse',
  'pagespeed',
  'audit',
  'GTmetrix',
  'Pingdom',
  'speedcurve',
  'uptimerobot',
  'statuscake',
  'site24x7',
  'newrelic',
  'datadog',
  'checkly',
  'siteimprove',
  'calibreapp',
  'monitor',
  'healthcheck',
]

const BLOCKED_REFERERS = [
  'archive.org',
  'web.archive.org',
  'wayback',
  'grab-site',
  'webcopier',
  'cachedview.com',
  'cached.page',
  'bing.com/cache',
  'googleusercontent.com',
  'validator.w3.org',
  'webpagetest.org',
  'gtmetrix.com',
  'pagespeed.web.dev',
  'speedcurve.com',
  'semrush.com',
  'ahrefs.com',
  'yandex.com',
  'baidu.com',
  'saveweb2zip.com',
  'web2zip.com',
  'savewebzip.com',
  'websitearchiver.com',
]

function getClientIP(req: NextRequest): string {
  const headers = [
    'cf-connecting-ip',
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
  ]
  for (const header of headers) {
    const value = req.headers.get(header)
    if (value) {
      const ip = value.split(',')[0].trim()
      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        return ip
      }
    }
  }
  return 'unknown'
}

function getCountryFromHeaders(req: NextRequest): string | null {
  // Cloudflare
  const cfCountry = req.headers.get('cf-ipcountry')
  if (cfCountry) return cfCountry

  // Vercel
  const vercelCountry = req.headers.get('x-vercel-ip-country')
  if (vercelCountry) return vercelCountry

  // Outros CDNs
  const xCountry = req.headers.get('x-country-code')
  if (xCountry) return xCountry

  return null
}

function isVercelIP(ip: string): boolean {
  for (const range of VERCEL_IP_RANGES) {
    const [network] = range.split('/')
    if (ip.startsWith(network.substring(0, network.lastIndexOf('.')))) {
      return true
    }
  }
  return false
}

function isAllowedUA(ua: string): boolean {
  const uaLower = ua.toLowerCase()
  return ALLOWED_UA_PATTERNS.some(pattern =>
    uaLower.includes(pattern.toLowerCase())
  )
}

function detectSaveWeb2Zip(
  req: NextRequest,
  ua: string
): {
  isSuspicious: boolean
  reasons: string[]
  score: number
} {
  const reasons: string[] = []
  let score = 0

  for (const pattern of SAVEWEB2ZIP_PATTERNS.FAKE_SAFARI_PATTERNS) {
    if (pattern.test(ua)) {
      reasons.push('fake_safari_ua')
      score += 50
      break
    }
  }

  const cfCountry = req.headers.get('cf-ipcountry')?.toLowerCase()
  const vercelRegion = req.headers
    .get('x-vercel-ip-country-region')
    ?.toLowerCase()

  for (const location of SAVEWEB2ZIP_PATTERNS.SUSPICIOUS_LOCATIONS) {
    if (cfCountry?.includes(location) || vercelRegion?.includes(location)) {
      reasons.push(`suspicious_location:${location}`)
      score += 30
      break
    }
  }

  let missingHeaders = 0
  for (const header of SAVEWEB2ZIP_PATTERNS.MISSING_HEADERS) {
    if (!req.headers.get(header)) {
      missingHeaders++
    }
  }

  if (missingHeaders >= 4) {
    reasons.push(`missing_headers:${missingHeaders}`)
    score += 25
  }

  const accept = req.headers.get('accept')
  if (!accept || accept === '*/*') {
    reasons.push('suspicious_accept')
    score += 15
  }

  const referer = req.headers.get('referer')
  if (!referer && req.nextUrl.pathname !== '/') {
    reasons.push('no_referer_deep_link')
    score += 10
  }

  if (cfCountry && cfCountry !== 'br' && ua.includes('Safari')) {
    reasons.push('foreign_ip_local_ua')
    score += 20
  }

  return {
    isSuspicious: score >= 50,
    reasons,
    score,
  }
}

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }

  const startTime = Date.now()
  const referer = req.headers.get('referer')?.toLowerCase() || ''
  const clientIP = getClientIP(req)
  const country = getCountryFromHeaders(req)
  const { device, isBot, ua } = userAgent(req)
  const uaLower = ua.toLowerCase()
  const restrictToMobile =
    process.env.RESTRICT_TO_MOBILE?.toLowerCase() === 'true'

  if (isAllowedUA(ua)) {
    return NextResponse.next()
  }

  if (restrictToMobile && device.type && device.type !== 'mobile') {
    // console.log(
    //   `🛑 [BLOCKED_DEVICE] Device not allowed! IP: ${clientIP}, Type: ${device.type}, Model: ${device.model}, Vendor: ${device.vendor}`
    // );
    return new NextResponse('Not allowed', { status: 403 })
  }

  if (isBot) {
    // console.log(`🛑 [BLOCKED_BOT] Bot detected! IP: ${clientIP}, UA: ${ua}`);
    return new NextResponse('Not allowed', { status: 403 })
  }

  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (uaLower.includes(pattern.toLowerCase())) {
      // console.log(
      //   `🛑 [BLOCKED_UA] Pattern: ${pattern}, IP: ${clientIP}, UA: ${ua}`
      // );
      return new NextResponse('Not allowed', { status: 403 })
    }
  }

  if (country && !ALLOWED_COUNTRIES.includes(country.toUpperCase())) {
    if (!isVercelIP(clientIP)) {
      // console.log(
      //   `🛑 [GEO_BLOCK] País: ${country}, IP: ${clientIP}, UA: ${ua}`
      // );
      return new NextResponse('Not allowed', {
        status: 403,
      })
    }
  }

  const detection = detectSaveWeb2Zip(req, ua)
  if (detection.isSuspicious) {
    return new NextResponse('Not allowed', { status: 403 })
  }

  for (const ref of BLOCKED_REFERERS) {
    if (referer.includes(ref)) {
      // console.log(
      //   `🛑 [BLOCKED_REFERER] Pattern: ${ref}, IP: ${clientIP}, Referer: ${referer}`
      // );
      return new NextResponse('Not allowed', { status: 403 })
    }
  }

  const response = NextResponse.next()
  const processingTime = Date.now() - startTime

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Processing-Time', `${processingTime}ms`)
  response.headers.set('X-Country-Detected', country || 'unknown')

  return response
}
