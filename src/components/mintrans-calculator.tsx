"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calculator, Thermometer, Calendar, Info } from "lucide-react"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"

interface MintransCoefficients {
  baseConsumption: number
  winterCoefficient: number
  summerCoefficient: number
  finalConsumption: number
  increasePercentage: number
}

interface DailyTemperature {
  day: number
  temperature: number
  season: string
  winterCoefficient: number
  summerCoefficient: number
}

interface MintransCalculatorProps {
  baseConsumption: number
  vehicleYear?: number
  month?: number
  year?: number
  onCalculationComplete?: (coefficients: MintransCoefficients & { dailyTemps: Record<string, number> }) => void
}

export function MintransCalculator({ 
  baseConsumption, 
  vehicleYear,
  month,
  year,
  onCalculationComplete 
}: MintransCalculatorProps) {
  const [loadingTemps, setLoadingTemps] = useState(false)
  const [dailyTemps, setDailyTemps] = useState<DailyTemperature[]>([])
  
  const currentYear = new Date().getFullYear()
  const vehicleAge = vehicleYear ? currentYear - vehicleYear : 0

  useEffect(() => {
    if (month && year) {
      loadMonthTemperatures()
    }
  }, [month, year])

  const loadMonthTemperatures = async () => {
    if (!month || !year) return
    
    setLoadingTemps(true)
    try {
      const response = await fetch(`/api/weather/month?month=${month}&year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setDailyTemps(data.dailyData || [])
      }
    } catch (error) {
      console.error("Error loading month temperatures:", error)
    } finally {
      setLoadingTemps(false)
    }
  }

  const getTemperatureMultiplier = (temp: number): number => {
    let multiplier = 1.0
    
    if (temp <= -25) multiplier = 1.18
    else if (temp <= -20) multiplier = 1.15
    else if (temp <= -15) multiplier = 1.12
    else if (temp <= -10) multiplier = 1.10
    else if (temp <= -5) multiplier = 1.07
    else if (temp <= 0) multiplier = 1.05
    else if (temp <= 5) multiplier = 1.03
    else if (temp >= 30) multiplier = 1.10
    else if (temp >= 27) multiplier = 1.07
    else if (temp >= 25) multiplier = 1.05
    
    if (temp < 0) {
      multiplier = multiplier * 1.05
    }
    
    return multiplier
  }

  const multiplierToPercent = (multiplier: number): number => {
    return Math.round((multiplier - 1.0) * 100)
  }

  const calculateCoefficients = (): MintransCoefficients & { dailyTemps: Record<string, number> } => {
    let avgWinterCoeff = 0
    let avgSummerCoeff = 0
    
    const dailyTempsMap: Record<string, number> = {}
    
    if (dailyTemps.length > 0) {
      const totalWinter = dailyTemps.reduce((sum, d) => {
        dailyTempsMap[d.day.toString()] = d.temperature
        return sum + d.winterCoefficient
      }, 0)
      const totalSummer = dailyTemps.reduce((sum, d) => sum + d.summerCoefficient, 0)
      avgWinterCoeff = Math.round(totalWinter / dailyTemps.length)
      avgSummerCoeff = Math.round(totalSummer / dailyTemps.length)
    }
    
    const coefficients = {
      baseConsumption,
      winterCoefficient: avgWinterCoeff,
      summerCoefficient: avgSummerCoeff,
      finalConsumption: baseConsumption,
      increasePercentage: 0,
      dailyTemps: dailyTempsMap
    }
    
    return coefficients
  }

  const coefficients = calculateCoefficients()
  
  useEffect(() => {
    if (onCalculationComplete) {
      onCalculationComplete(coefficients)
    }
  }, [dailyTemps, baseConsumption, vehicleAge])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Расчёт по методике Минтранса АМ-23-р
        </CardTitle>
        <CardDescription>
          Индивидуальный расчет для каждого дня с учётом всех коэффициентов
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {month && year && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">Температура на каждый день месяца</Label>
            </div>
            
            {loadingTemps ? (
              <div className="text-sm text-muted-foreground">Загрузка температурных данных...</div>
            ) : dailyTemps.length > 0 ? (
              <div className="space-y-2">
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">День</th>
                        <th className="p-2 text-center">Температура</th>
                        <th className="p-2 text-center">Сезон</th>
                        <th className="p-2 text-right">Темп. множитель</th>
                        <th className="p-2 text-right">Надбавка %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyTemps.map((day) => {
                        const tempMultiplier = getTemperatureMultiplier(day.temperature)
                        const tempPercent = multiplierToPercent(tempMultiplier)
                        
                        return (
                          <tr key={day.day} className="border-t hover:bg-muted/50">
                            <td className="p-2">{day.day}</td>
                            <td className="p-2 text-center">
                              <Badge variant={day.temperature < 0 ? "default" : "secondary"}>
                                {day.temperature > 0 ? "+" : ""}{day.temperature}°C
                              </Badge>
                            </td>
                            <td className="p-2 text-center text-xs text-muted-foreground">
                              {day.season === "winter" && "❄️ Зима"}
                              {day.season === "summer" && "☀️ Лето"}
                              {day.season === "spring" && "🌸 Весна"}
                              {day.season === "autumn" && "🍂 Осень"}
                            </td>
                            <td className="p-2 text-right font-mono">
                              <span className={tempMultiplier > 1.0 ? "text-orange-600 font-semibold" : ""}>
                                {tempMultiplier.toFixed(2)}x
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              {tempPercent > 0 ? (
                                <Badge className="bg-orange-600 text-xs">+{tempPercent}%</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">0%</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-300">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm space-y-2">
                    <p className="font-semibold">
                      🧮 ФОРМУЛА (все коэффициенты перемножаются):
                    </p>
                    <div className="bg-white dark:bg-gray-900 p-3 rounded border mt-2">
                      <p className="font-mono text-xs font-bold">
                        Q = (Hsn × S / 100) × Kвозраст × Kрежим × Kтемп × Kместность × Kдороги
                      </p>
                      <div className="mt-2 space-y-1 text-xs">
                        <p><strong>Hsn</strong> — базовый расход ({baseConsumption} л/100км)</p>
                        <p><strong>S</strong> — пробег за день, км</p>
                        <p><strong>Kвозраст</strong> — 1.05 если авто >5 лет, иначе 1.0</p>
                        <p><strong>Kрежим</strong> — Город: 1.15 | Трасса: 1.0 | Смешанный: 1.075</p>
                        <p><strong>Kтемп</strong> — от 1.03 до 1.18 (включая прогрев при t&lt;0°C)</p>
                        <p><strong>Kместность</strong> — Равнина: 1.0 | Холмы: 1.05 | Горы: 1.10</p>
                        <p><strong>Kдороги</strong> — Хорошие: 1.0 | Удовл.: 1.10 | Плохие: 1.20</p>
                      </div>
                    </div>
                    <p className="text-xs mt-2">
                      <strong>⚠️ ВАЖНО:</strong> Возраст авто, качество дорог и тип местности указываются ДЛЯ КАЖДОГО ДНЯ индивидуально!
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="text-sm text-destructive">Не удалось загрузить температурные данные</div>
            )}
          </div>
        )}

        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-muted-foreground" />
            <Label className="font-semibold">Итоговый расчёт</Label>
          </div>
          
          <Alert className="bg-purple-50 dark:bg-purple-950">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm space-y-2">
              <p className="font-semibold">📊 Примеры фактического расхода:</p>
              <div className="space-y-1 text-xs">
                <p>• <strong>Город, -15°C, авто 6 лет, холмы, удовл. дороги, 50 км:</strong></p>
                <p className="ml-4">Q = ({baseConsumption} × 50 / 100) × 1.05 × 1.15 × 1.12 × 1.05 × 1.10 = <span className="font-bold">{(baseConsumption * 50 / 100 * 1.05 * 1.15 * 1.12 * 1.05 * 1.10).toFixed(2)} л</span></p>
                
                <p>• <strong>Трасса, +20°C, авто 3 года, равнина, хорошие дороги, 100 км:</strong></p>
                <p className="ml-4">Q = ({baseConsumption} × 100 / 100) × 1.0 × 1.0 × 1.0 × 1.0 × 1.0 = <span className="font-bold">{(baseConsumption * 100 / 100).toFixed(2)} л</span></p>
              </div>
            </AlertDescription>
          </Alert>
          
          <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded space-y-1">
            <p><strong>📋 Нормативная база:</strong></p>
            <p>Распоряжение Минтранса России от 14.03.2008 N АМ-23-р (ред. от 30.09.2021)</p>
            <p className="pt-1"><strong>💡 Принцип расчёта:</strong></p>
            <p>• Все коэффициенты применяются ИНДИВИДУАЛЬНО для каждого дня</p>
            <p>• Коэффициенты ПЕРЕМНОЖАЮТСЯ, а не складываются</p>
            <p>• Возраст авто рассчитывается на конкретную дату записи</p>
            <p>• Качество дорог и тип местности указываются для каждого дня отдельно</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}