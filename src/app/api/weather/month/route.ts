import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Координаты Курска
const KURSK_LAT = 51.73
const KURSK_LON = 36.19

// Среднестатистические температуры для Курска по месяцам (на случай ошибки API)
const AVERAGE_TEMPS_KURSK: { [key: number]: number } = {
  1: -8,   // Январь
  2: -7,   // Февраль
  3: -1,   // Март
  4: 8,    // Апрель
  5: 16,   // Май
  6: 20,   // Июнь
  7: 22,   // Июль
  8: 21,   // Август
  9: 15,   // Сентябрь
  10: 7,   // Октябрь
  11: 0,   // Ноябрь
  12: -5   // Декабрь
}

// Кеш для температур (кеш на 6 часов)
let cachedMonthTemps: Map<string, { data: any, timestamp: number }> = new Map()
const CACHE_DURATION = 6 * 60 * 60 * 1000 // 6 часов

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get("month") || "")
    const year = parseInt(searchParams.get("year") || "")

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid month or year parameter" },
        { status: 400 }
      )
    }

    // Проверяем кеш
    const cacheKey = `${year}-${month}`
    const now = Date.now()
    const cached = cachedMonthTemps.get(cacheKey)
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        ...cached.data,
        cached: true
      })
    }

    // Определяем диапазон дат для месяца
    const daysInMonth = new Date(year, month, 0).getDate()
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${daysInMonth.toString().padStart(2, '0')}`

    const today = new Date()
    const requestDate = new Date(year, month - 1, 1)
    const isPastMonth = requestDate < new Date(today.getFullYear(), today.getMonth(), 1)
    const isFutureMonth = requestDate > today

    let dailyTemperatures: { [key: string]: number } = {}

    if (isPastMonth) {
      // Для прошедших месяцев используем исторические данные из Open-Meteo
      try {
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${KURSK_LAT}&longitude=${KURSK_LON}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean&timezone=Europe/Moscow`
        
        const response = await fetch(url)
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.daily && data.daily.time && data.daily.temperature_2m_mean) {
            data.daily.time.forEach((date: string, index: number) => {
              const day = parseInt(date.split('-')[2])
              dailyTemperatures[day] = Math.round(data.daily.temperature_2m_mean[index])
            })
          }
        }
      } catch (error) {
        console.error("Error fetching historical data from Open-Meteo:", error)
      }
    } else if (isFutureMonth) {
      // Для будущих месяцев используем среднестатистические температуры
      const avgTemp = AVERAGE_TEMPS_KURSK[month] || 10
      for (let day = 1; day <= daysInMonth; day++) {
        // Добавляем небольшую вариацию ±3°C
        const variation = Math.floor(Math.random() * 7) - 3
        dailyTemperatures[day] = avgTemp + variation
      }
    } else {
      // Для текущего месяца: исторические данные + прогноз
      try {
        // Получаем исторические данные с начала месяца до вчерашнего дня
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        if (yesterday.getMonth() === month - 1 && yesterday.getDate() > 0) {
          const histEndDate = `${year}-${month.toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`
          
          const histUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${KURSK_LAT}&longitude=${KURSK_LON}&start_date=${startDate}&end_date=${histEndDate}&daily=temperature_2m_mean&timezone=Europe/Moscow`
          
          const histResponse = await fetch(histUrl)
          
          if (histResponse.ok) {
            const histData = await histResponse.json()
            
            if (histData.daily && histData.daily.time && histData.daily.temperature_2m_mean) {
              histData.daily.time.forEach((date: string, index: number) => {
                const day = parseInt(date.split('-')[2])
                dailyTemperatures[day] = Math.round(histData.daily.temperature_2m_mean[index])
              })
            }
          }
        }

        // Получаем прогноз на оставшиеся дни месяца (до 7 дней)
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${KURSK_LAT}&longitude=${KURSK_LON}&daily=temperature_2m_mean&timezone=Europe/Moscow&forecast_days=16`
        
        const forecastResponse = await fetch(forecastUrl)
        
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json()
          
          if (forecastData.daily && forecastData.daily.time && forecastData.daily.temperature_2m_mean) {
            forecastData.daily.time.forEach((date: string, index: number) => {
              const forecastDate = new Date(date)
              if (forecastDate.getMonth() === month - 1) {
                const day = forecastDate.getDate()
                if (!dailyTemperatures[day]) {
                  dailyTemperatures[day] = Math.round(forecastData.daily.temperature_2m_mean[index])
                }
              }
            })
          }
        }

        // Для дней, для которых нет прогноза, используем среднестатистическую температуру
        const avgTemp = AVERAGE_TEMPS_KURSK[month] || 10
        for (let day = 1; day <= daysInMonth; day++) {
          if (!dailyTemperatures[day]) {
            const variation = Math.floor(Math.random() * 7) - 3
            dailyTemperatures[day] = avgTemp + variation
          }
        }
      } catch (error) {
        console.error("Error fetching current month data:", error)
      }
    }

    // Если не удалось получить данные, используем среднестатистические
    if (Object.keys(dailyTemperatures).length === 0) {
      const avgTemp = AVERAGE_TEMPS_KURSK[month] || 10
      for (let day = 1; day <= daysInMonth; day++) {
        const variation = Math.floor(Math.random() * 7) - 3
        dailyTemperatures[day] = avgTemp + variation
      }
    }

    // Определяем сезон и коэффициенты для каждого дня
    const dailyData = Object.keys(dailyTemperatures).map(day => {
      const temp = dailyTemperatures[parseInt(day)]
      let season = "spring"
      let winterCoefficient = 0
      let summerCoefficient = 0

      // Зимний период: температура ниже +5°C
      if (temp < 5) {
        season = "winter"
        if (temp < -10) winterCoefficient = 10
        else if (temp < -5) winterCoefficient = 7
        else if (temp < 0) winterCoefficient = 5
        else winterCoefficient = 3
      }
      // Летний период: температура выше +25°C (для кондиционера)
      else if (temp > 25) {
        season = "summer"
        if (temp > 30) summerCoefficient = 7
        else summerCoefficient = 5
      }
      // Переходные периоды
      else if (month >= 3 && month <= 5) {
        season = "spring"
      } else if (month >= 9 && month <= 11) {
        season = "autumn"
      }

      return {
        day: parseInt(day),
        temperature: temp,
        season,
        winterCoefficient,
        summerCoefficient
      }
    })

    const result = {
      month,
      year,
      dailyData: dailyData.sort((a, b) => a.day - b.day),
      source: isPastMonth ? "historical" : isFutureMonth ? "average" : "mixed",
      timestamp: new Date().toISOString()
    }

    // Сохраняем в кеш
    cachedMonthTemps.set(cacheKey, {
      data: result,
      timestamp: now
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in weather/month API:", error)
    return NextResponse.json(
      { error: "Internal server error: " + error },
      { status: 500 }
    )
  }
}