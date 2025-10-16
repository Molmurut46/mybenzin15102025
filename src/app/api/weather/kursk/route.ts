import { NextResponse } from "next/server"

// Координаты Курска, Курской области
const KURSK_LAT = 51.73
const KURSK_LON = 36.19

export async function GET() {
  try {
    // OpenWeatherMap API для России (требует NEXT_PUBLIC_OPENWEATHER_API_KEY в .env)
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || "demo"
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${KURSK_LAT}&lon=${KURSK_LON}&units=metric&lang=ru&appid=${apiKey}`

    const response = await fetch(url, {
      next: { revalidate: 3600 } // Кэш на 1 час
    })

    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`)
    }

    const data = await response.json()
    const temperature = Math.round(data.main.temp)

    // Определяем сезон и коэффициенты по методике Минтранса
    let season = "spring"
    let winterCoefficient = 0
    let summerCoefficient = 0
    let climateZone = "Умеренная (III климатическая зона)"

    // Зимний период: с 1 ноября по 31 марта
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    const isWinter = month >= 11 || month <= 3

    if (isWinter) {
      season = "winter"

      // Зимние надбавки по температуре (методика Минтранса)
      if (temperature <= -25) {
        winterCoefficient = 18
      } else if (temperature <= -20) {
        winterCoefficient = 15
      } else if (temperature <= -15) {
        winterCoefficient = 12
      } else if (temperature <= -10) {
        winterCoefficient = 10
      } else if (temperature <= -5) {
        winterCoefficient = 7
      } else if (temperature <= 0) {
        winterCoefficient = 5
      }
    } else if (month >= 6 && month <= 8) {
      // Летний период: июнь-август
      season = "summer"

      // Летние надбавки при использовании кондиционера
      if (temperature >= 30) {
        summerCoefficient = 10
      } else if (temperature >= 25) {
        summerCoefficient = 7
      } else if (temperature >= 20) {
        summerCoefficient = 5
      }
    } else if (month >= 4 && month <= 5) {
      season = "spring"
    } else {
      season = "autumn"
    }

    return NextResponse.json({
      temperature,
      season,
      winterCoefficient,
      summerCoefficient,
      climateZone,
      location: "Курск, Курская область",
      description: data.weather[0]?.description || "",
      source: "OpenWeatherMap"
    })
  } catch (error) {
    console.error("Error fetching weather:", error)

    // Fallback - возвращаем данные по умолчанию для Курска
    const now = new Date()
    const month = now.getMonth() + 1
    const isWinter = month >= 11 || month <= 3

    return NextResponse.json({
      temperature: isWinter ? -5 : 15,
      season: isWinter ? "winter" : "summer",
      winterCoefficient: isWinter ? 7 : 0,
      summerCoefficient: isWinter ? 0 : 5,
      climateZone: "Умеренная (III климатическая зона)",
      location: "Курск, Курская область",
      description: "Данные недоступны",
      source: "OpenWeatherMap (fallback)",
      error: "Не удалось получить актуальные данные"
    })
  }
}