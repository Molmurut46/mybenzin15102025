import { NextRequest, NextResponse } from "next/server"

const DEFAULT_PRICES = {
  "АИ-92": 60,
  "АИ-95": 65
}

// In-memory cache для цен (кеш на 1 час)
let cachedPrices: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 час в миллисекундах

export async function GET(request: NextRequest) {
  try {
    // Проверяем кеш
    const now = Date.now()
    if (cachedPrices && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        ...cachedPrices,
        cached: true
      })
    }

    const url = "https://russiabase.ru/prices?raion=1649&brand=119"
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 3600 } // Кеширование на 1 час
    })
    
    if (!response.ok) {
      console.error("Failed to fetch prices from russiabase.ru")
      const result = { 
        prices: DEFAULT_PRICES,
        source: "default"
      }
      // Кешируем даже дефолтные значения
      cachedPrices = result
      cacheTimestamp = now
      return NextResponse.json(result)
    }
    
    const html = await response.text()
    
    // Парсинг цен из HTML
    const prices: { [key: string]: number } = {}
    
    // Ищем паттерны для АИ-92 и АИ-95
    const ai92Match = html.match(/АИ-92[^\d]*(\d+[.,]\d+)/i) || html.match(/92[^\d]*(\d+[.,]\d+)/i)
    const ai95Match = html.match(/АИ-95[^\d]*(\d+[.,]\d+)/i) || html.match(/95[^\d]*(\d+[.,]\d+)/i)
    
    if (ai92Match) {
      prices["АИ-92"] = parseFloat(ai92Match[1].replace(',', '.'))
    }
    
    if (ai95Match) {
      prices["АИ-95"] = parseFloat(ai95Match[1].replace(',', '.'))
    }
    
    // Если не удалось спарсить - используем значения по умолчанию
    if (Object.keys(prices).length === 0) {
      console.log("No prices found in HTML, using defaults")
      const result = {
        prices: DEFAULT_PRICES,
        source: "default"
      }
      cachedPrices = result
      cacheTimestamp = now
      return NextResponse.json(result)
    }
    
    // Добавляем недостающие цены из дефолтных значений
    if (!prices["АИ-92"]) prices["АИ-92"] = DEFAULT_PRICES["АИ-92"]
    if (!prices["АИ-95"]) prices["АИ-95"] = DEFAULT_PRICES["АИ-95"]
    
    const result = {
      prices,
      source: "russiabase",
      timestamp: new Date().toISOString()
    }
    
    // Сохраняем в кеш
    cachedPrices = result
    cacheTimestamp = now
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching fuel prices:", error)
    const result = {
      prices: DEFAULT_PRICES,
      source: "default",
      error: String(error)
    }
    // Кешируем ошибку, чтобы не перегружать внешний сервис
    cachedPrices = result
    cacheTimestamp = Date.now()
    return NextResponse.json(result)
  }
}