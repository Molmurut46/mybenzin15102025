"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { ArrowLeft, FileText } from "lucide-react"
import Link from "next/link"
import { MintransCalculator } from "@/components/mintrans-calculator"

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
]

interface DailyEntry {
  date: string
  dayOfWeek: number
  clients: string
  mileage: number
  fuelUsed: number
  temperature?: number
  drivingMode?: "city" | "highway" | "mixed"
  roadQuality?: "good" | "fair" | "poor"
  terrainType?: "plain" | "hilly" | "mountain"
}

export default function CreateReportPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [month, setMonth] = useState("")
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [useTemplate, setUseTemplate] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [profileData, setProfileData] = useState<any>(null)
  const [scheduleData, setScheduleData] = useState<any[]>([])
  const [deviationPercent, setDeviationPercent] = useState("0")
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [existingReportId, setExistingReportId] = useState<number | null>(null)
  const [pendingReportData, setPendingReportData] = useState<any>(null)
  const [fuelPrice, setFuelPrice] = useState<number | null>(null)
  const [fuelPriceSource, setFuelPriceSource] = useState<string>("default")
  
  // Новые состояния для метода расчета
  const [calculationMethod, setCalculationMethod] = useState<"simple" | "mintrans">("simple")
  const [mintransCoefficients, setMintransCoefficients] = useState<any>(null)
  const [dailyTemperatures, setDailyTemperatures] = useState<Record<string, number>>({})
  const [selectedFuelType, setSelectedFuelType] = useState<string>("АИ-92")
  const [defaultRoadQuality, setDefaultRoadQuality] = useState<string>("fair")
  const [defaultTerrainType, setDefaultTerrainType] = useState<string>("plain")
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([])

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/sign-in")
    }
  }, [session, isPending, router])

  useEffect(() => {
    const loadProfileData = async () => {
      const token = localStorage.getItem("bearer_token")
      const res = await fetch("/api/user-profile", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfileData(data)
        setSelectedFuelType(data.fuelType || "АИ-92")
        
        // Set default road quality and terrain type from profile
        setDefaultRoadQuality(data.defaultRoadQuality || "fair")
        setDefaultTerrainType(data.defaultTerrainType || "plain")
      }
    }
    loadProfileData()
  }, [])

  useEffect(() => {
    const loadProfileAndSchedule = async () => {
      if (!session?.user) return

      const token = localStorage.getItem("bearer_token")

      try {
        const profileRes = await fetch("/api/user-profile", {
          headers: { "Authorization": `Bearer ${token}` }
        })

        if (profileRes.ok) {
          const profile = await profileRes.json()
          setProfileData(profile)
          setHasProfile(true)
          // Set default deviation from profile
          if (profile.defaultDeviationPercent !== undefined && profile.defaultDeviationPercent !== null) {
            setDeviationPercent(profile.defaultDeviationPercent.toString())
          }
          
          // Set default fuel type from profile
          setSelectedFuelType(profile.fuelType || "АИ-92")
          
          // Load fuel prices
          loadFuelPrices(profile.fuelType)
        }

        const scheduleRes = await fetch("/api/weekly-schedule", {
          headers: { "Authorization": `Bearer ${token}` }
        })

        if (scheduleRes.ok) {
          const schedule = await scheduleRes.json()
          setScheduleData(schedule)
          setWeeklySchedule(schedule)
        }
      } catch (error) {
        console.error("Error loading data:", error)
      }
    }

    if (session?.user) {
      loadProfileAndSchedule()
    }
  }, [session])

  const loadFuelPrices = async (fuelType?: string) => {
    try {
      const response = await fetch("/api/fuel-prices")
      
      if (!response.ok) {
        console.error("Failed to fetch fuel prices")
        setDefaultFuelPrice(fuelType)
        return
      }

      const data = await response.json()
      const prices = data.prices
      
      // Выбираем цену в зависимости от типа топлива
      let price = 60 // default for АИ-92
      
      if (fuelType) {
        const normalizedFuelType = fuelType.toUpperCase().replace(/\s/g, '')
        
        if (normalizedFuelType.includes('92') || normalizedFuelType.includes('АИ-92') || normalizedFuelType.includes('АИ92')) {
          price = prices["АИ-92"] || 60
        } else if (normalizedFuelType.includes('95') || normalizedFuelType.includes('АИ-95') || normalizedFuelType.includes('АИ95')) {
          price = prices["АИ-95"] || 65
        } else {
          // Если тип не распознан, используем среднее
          price = Math.round((prices["АИ-92"] + prices["АИ-95"]) / 2)
        }
      }
      
      setFuelPrice(price)
      setFuelPriceSource(data.source)
      
      if (data.source === "russiabase") {
        toast.success(`Загружена актуальная цена: ${price} ₽/л`)
      }
    } catch (error) {
      console.error("Error loading fuel prices:", error)
      setDefaultFuelPrice(fuelType)
    }
  }

  const setDefaultFuelPrice = (fuelType?: string) => {
    let price = 60
    
    if (fuelType) {
      const normalizedFuelType = fuelType.toUpperCase().replace(/\s/g, '')
      
      if (normalizedFuelType.includes('95') || normalizedFuelType.includes('АИ-95') || normalizedFuelType.includes('АИ95')) {
        price = 65
      }
    }
    
    setFuelPrice(price)
    setFuelPriceSource("default")
  }

  const applyDeviation = (baseMileage: number, deviationPercent: number): number => {
    if (deviationPercent === 0) return baseMileage
    
    // Generate random deviation between -deviationPercent and +deviationPercent
    const randomFactor = (Math.random() * 2 - 1) * (deviationPercent / 100)
    const deviatedMileage = baseMileage * (1 + randomFactor)
    
    return parseFloat(deviatedMileage.toFixed(1))
  }

  const handleMintransCalculation = (coefficients: any) => {
    setMintransCoefficients(coefficients)
    if (coefficients.dailyTemps) {
      setDailyTemperatures(coefficients.dailyTemps)
    }
  }

  const getTemperatureCoefficient = (temp: number): number => {
    // Базовый температурный коэффициент
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
    
    // Прогрев двигателя при температуре ниже 0
    if (temp < 0) {
      multiplier = multiplier * 1.05
    }
    
    return multiplier
  }

  const getDrivingModeCoefficient = (mode: string): number => {
    switch (mode) {
      case "city": return 1.15
      case "highway": return 1.0
      case "mixed": return 1.075
      default: return 1.15
    }
  }

  const getRoadQualityCoefficient = (quality: string): number => {
    switch (quality) {
      case "good": return 1.0
      case "fair": return 1.10
      case "poor": return 1.20
      default: return 1.10
    }
  }

  const getTerrainTypeCoefficient = (terrain: string): number => {
    switch (terrain) {
      case "plain": return 1.0
      case "hilly": return 1.05
      case "mountain": return 1.10
      default: return 1.0
    }
  }

  const getVehicleAgeCoefficient = (vehicleYear: number, dateStr: string): number => {
    // Парсим дату записи
    const parts = dateStr.split('.')
    if (parts.length !== 3) return 1.0
    
    const day = parseInt(parts[0])
    const month = parseInt(parts[1])
    const year = parseInt(parts[2])
    
    const entryDate = new Date(year, month - 1, day)
    const vehicleDate = new Date(vehicleYear, 0, 1)
    
    const ageInYears = (entryDate.getTime() - vehicleDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    
    return ageInYears > 5 ? 1.05 : 1.0
  }

  const generateTypicalReport = () => {
    if (!month || !year) {
      toast.error("Выберите месяц и год")
      return null
    }

    const monthNum = parseInt(month)
    const yearNum = parseInt(year)
    const deviation = parseFloat(deviationPercent) || 0

    const activeDaysOfWeek = scheduleData
      .filter(s => s.clients || s.dailyMileage)
      .map(s => s.dayOfWeek)

    if (activeDaysOfWeek.length === 0) {
      toast.error("В графике нет заполненных дней. Заполните график в настройках профиля.")
      return null
    }

    const entries: DailyEntry[] = []
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate()

    let baseFuelConsumption = 0
    
    if (calculationMethod === "simple") {
      if (selectedFuelType.includes("95")) {
        baseFuelConsumption = profileData?.fuelConsumption95 || 0
      } else {
        baseFuelConsumption = profileData?.fuelConsumption92 || 0
      }
    } else if (calculationMethod === "mintrans" && mintransCoefficients) {
      baseFuelConsumption = profileData?.baseConsumptionMintrans || 0
      
      if (!baseFuelConsumption) {
        toast.error("Базовый расход Минтранса не указан в профиле")
        return null
      }
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(yearNum, monthNum - 1, day)
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay()

      if (activeDaysOfWeek.includes(dayOfWeek)) {
        const scheduleEntry = scheduleData.find(s => s.dayOfWeek === dayOfWeek)
        const baseMileage = scheduleEntry?.dailyMileage || 0
        const drivingMode = scheduleEntry?.drivingMode || "city"
        // Use values from schedule, or fall back to profile defaults
        const roadQuality = scheduleEntry?.roadQuality || defaultRoadQuality
        const terrainType = scheduleEntry?.terrainType || defaultTerrainType
        
        const mileage = applyDeviation(baseMileage, deviation)
        
        let fuelUsed = 0
        const dateStr = `${day.toString().padStart(2, '0')}.${month.padStart(2, '0')}.${year}`
        
        if (calculationMethod === "mintrans" && mintransCoefficients) {
          // МУЛЬТИПЛИКАТИВНАЯ ФОРМУЛА
          const dayTemp = dailyTemperatures[day.toString()]
          const tempCoeff = dayTemp !== undefined ? getTemperatureCoefficient(dayTemp) : 1.0
          const drivingCoeff = getDrivingModeCoefficient(drivingMode)
          const roadCoeff = getRoadQualityCoefficient(roadQuality)
          const terrainCoeff = getTerrainTypeCoefficient(terrainType)
          const ageCoeff = profileData?.vehicleYear ? getVehicleAgeCoefficient(profileData.vehicleYear, dateStr) : 1.0
          
          // Q = (Hsn × S / 100) × Kвозраст × Kрежим × Kтемп × Kместность × Kдороги
          fuelUsed = (baseFuelConsumption * mileage / 100) * ageCoeff * drivingCoeff * tempCoeff * terrainCoeff * roadCoeff
        } else {
          fuelUsed = baseFuelConsumption 
            ? (mileage * baseFuelConsumption) / 100
            : 0
        }

        const entry: DailyEntry = {
          date: dateStr,
          dayOfWeek,
          clients: scheduleEntry?.clients || "",
          mileage,
          fuelUsed: parseFloat(fuelUsed.toFixed(1)),
          drivingMode,
          roadQuality,
          terrainType
        }
        
        if (calculationMethod === "mintrans" && dailyTemperatures[day.toString()] !== undefined) {
          entry.temperature = dailyTemperatures[day.toString()]
        }
        
        entries.push(entry)
      }
    }

    return entries
  }

  const checkExistingReport = async (month: number, year: number) => {
    const token = localStorage.getItem("bearer_token")
    
    try {
      const response = await fetch("/api/reports", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      if (!response.ok) return null

      const reports = await response.json()
      const existing = reports.find((r: any) => r.month === month && r.year === year)
      
      return existing || null
    } catch (error) {
      console.error("Error checking existing report:", error)
      return null
    }
  }

  const createOrUpdateReport = async (reportData: any, existingId?: number) => {
    const token = localStorage.getItem("bearer_token")
    const isUpdate = !!existingId

    try {
      const response = await fetch(
        isUpdate ? `/api/reports/${existingId}` : "/api/reports",
        {
          method: isUpdate ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(reportData)
        }
      )

      if (!response.ok) {
        throw new Error(isUpdate ? "Ошибка обновления отчёта" : "Ошибка создания отчёта")
      }

      const report = await response.json()
      toast.success(isUpdate ? "Отчёт перезаписан" : "Отчёт создан")
      router.push(`/dashboard/edit/${report.id}`)
    } catch (error) {
      toast.error(isUpdate ? "Ошибка при обновлении отчёта" : "Ошибка при создании отчёта")
    }
  }

  const handleCreateReport = async () => {
    if (!month || !year) {
      toast.error("Выберите месяц и год")
      return
    }

    let entries: any[] = []
    let profile: any = null

    if (useTemplate && hasProfile) {
      const generatedEntries = generateTypicalReport()
      if (!generatedEntries) return
      
      entries = generatedEntries
      profile = {
        carBrand: profileData?.carBrand,
        carModel: profileData?.carModel,
        engineVolume: profileData?.engineVolume,
        transmission: profileData?.transmission,
        fuelConsumption92: profileData?.fuelConsumption92,
        fuelConsumption95: profileData?.fuelConsumption95,
        fuelType: selectedFuelType,
        vehicleYear: profileData?.vehicleYear,
        licensePlate: profileData?.licensePlate,
        vinNumber: profileData?.vinNumber,
        baseConsumptionMintrans: profileData?.baseConsumptionMintrans
      }
    }

    // Calculate default report date
    const currentDay = new Date().getDate()
    const reportMonth = parseInt(month)
    const reportYear = parseInt(year)
    
    let nextMonth = reportMonth + 1
    let nextYear = reportYear
    if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    
    const defaultReportDate = `${currentDay.toString().padStart(2, '0')}.${nextMonth.toString().padStart(2, '0')}.${nextYear}`

    const reportPayload = {
      month: parseInt(month),
      year: parseInt(year),
      reportData: {
        entries,
        profile,
        reportDate: defaultReportDate,
        deviationPercent: parseFloat(deviationPercent) || 0,
        fuelPrice: fuelPrice || 60,
        selectedFuelType,
        calculationMethod,
        mintransCoefficients: calculationMethod === "mintrans" ? mintransCoefficients : undefined,
        dailyTemperatures: calculationMethod === "mintrans" ? dailyTemperatures : undefined,
        dailyBreakdown: calculationMethod === "mintrans" ? entries.map(entry => {
          const tempCoeff = entry.temperature !== undefined ? getTemperatureCoefficient(entry.temperature) : 1.0
          const drivingCoeff = getDrivingModeCoefficient(entry.drivingMode || "city")
          const roadCoeff = getRoadQualityCoefficient(entry.roadQuality || "fair")
          const terrainCoeff = getTerrainTypeCoefficient(entry.terrainType || "plain")
          const ageCoeff = profileData?.vehicleYear ? getVehicleAgeCoefficient(profileData.vehicleYear, entry.date) : 1.0
          
          return {
            date: entry.date,
            mileage: entry.mileage,
            fuelUsed: entry.fuelUsed,
            temperature: entry.temperature,
            drivingMode: entry.drivingMode,
            roadQuality: entry.roadQuality,
            terrainType: entry.terrainType,
            coefficients: {
              base: profileData?.baseConsumptionMintrans,
              vehicleAge: ageCoeff,
              terrain: terrainCoeff,
              roadCondition: roadCoeff,
              temperature: tempCoeff,
              drivingMode: drivingCoeff
            }
          }
        }) : undefined
      }
    }

    setIsLoading(true)

    const existing = await checkExistingReport(parseInt(month), parseInt(year))
    
    if (existing) {
      setExistingReportId(existing.id)
      setPendingReportData(reportPayload)
      setShowConflictDialog(true)
      setIsLoading(false)
      return
    }

    await createOrUpdateReport(reportPayload)
    setIsLoading(false)
  }

  const handleOverwrite = async () => {
    setShowConflictDialog(false)
    setIsLoading(true)
    await createOrUpdateReport(pendingReportData, existingReportId!)
    setIsLoading(false)
  }

  const handleKeepBoth = async () => {
    setShowConflictDialog(false)
    setIsLoading(true)
    await createOrUpdateReport(pendingReportData)
    setIsLoading(false)
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Назад к отчётам
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Создание нового отчёта
              </CardTitle>
              <CardDescription>
                Выберите месяц и год для создания отчёта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Месяц *</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger id="month">
                      <SelectValue placeholder="Выберите месяц" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, index) => (
                        <SelectItem key={index + 1} value={(index + 1).toString()}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Год *</Label>
                  <Input
                    id="year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    min="2020"
                    max="2100"
                  />
                </div>
              </div>

              {fuelPrice !== null && (
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                          Цена топлива: {fuelPrice} ₽/л
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          {fuelPriceSource === "russiabase" 
                            ? "✓ Актуальная цена из russiabase.ru (Курск, Лукойл)"
                            : "ℹ️ Цена по умолчанию (не удалось загрузить актуальные данные)"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {hasProfile && (
                <>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="useTemplate"
                          checked={useTemplate}
                          onCheckedChange={(checked) => setUseTemplate(checked as boolean)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="useTemplate" className="text-base font-semibold cursor-pointer">
                            Создать типовой отчёт
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Автоматически заполнить отчёт на основе вашего графика движения и данных автомобиля. 
                            Будут созданы записи только для тех дней недели, которые указаны в вашем графике.
                          </p>
                        </div>
                      </div>

                      {useTemplate && (
                        <>
                          <div className="space-y-3 pt-2 border-t">
                            <Label className="text-sm font-semibold">Тип топлива для отчёта</Label>
                            <p className="text-xs text-muted-foreground">
                              Выбранный тип топлива будет отображаться в шапке отчёта. Для упрощённого расчёта расход берётся из настроек профиля.
                            </p>
                            <RadioGroup value={selectedFuelType} onValueChange={setSelectedFuelType}>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="АИ-92" id="fuel-92" />
                                <Label htmlFor="fuel-92" className="cursor-pointer font-normal">
                                  АИ-92
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="АИ-95" id="fuel-95" />
                                <Label htmlFor="fuel-95" className="cursor-pointer font-normal">
                                  АИ-95
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                          
                          <div className="space-y-3 pt-2 border-t">
                            <Label htmlFor="deviation" className="text-sm font-semibold">
                              Отклонение пробега (%)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Случайное отклонение пробега для каждого дня от типового значения в графике. 
                              0% = точный пробег из графика. Например, 5% = ±5% от базового пробега.
                            </p>
                            <div className="flex gap-2">
                              <Input
                                id="deviation"
                                type="number"
                                min="0"
                                max="50"
                                step="1"
                                value={deviationPercent}
                                onChange={(e) => setDeviationPercent(e.target.value)}
                                placeholder="0"
                                className="max-w-[120px]"
                              />
                              <span className="flex items-center text-sm text-muted-foreground">%</span>
                            </div>
                            {parseFloat(deviationPercent) > 0 && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                ℹ️ При создании отчёта пробег каждого дня будет случайным образом изменён в пределах ±{deviationPercent}%
                              </p>
                            )}
                          </div>

                          <div className="space-y-3 pt-2 border-t">
                            <Label className="text-sm font-semibold">Метод расчета расхода топлива</Label>
                            <RadioGroup value={calculationMethod} onValueChange={(v) => setCalculationMethod(v as "simple" | "mintrans")}>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="simple" id="simple" />
                                <Label htmlFor="simple" className="cursor-pointer font-normal">
                                  Упрощённый режим (фактический расход из профиля)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="mintrans" id="mintrans" />
                                <Label htmlFor="mintrans" className="cursor-pointer font-normal">
                                  Расширенный режим Минтранса АМ-23-р (с коэффициентами и надбавками)
                                </Label>
                              </div>
                            </RadioGroup>
                            
                            {/* Показываем используемый расход в зависимости от режима */}
                            {calculationMethod === "simple" && (
                              <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 mt-3">
                                <CardContent className="pt-4">
                                  <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                                    📊 Примерный расход для упрощённого режима:
                                  </p>
                                  <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                                    <p>• АИ-92: <span className="font-semibold">{profileData?.fuelConsumption92 || "не указан"} л/100км</span></p>
                                    <p>• АИ-95: <span className="font-semibold">{profileData?.fuelConsumption95 || "не указан"} л/100км</span></p>
                                  </div>
                                  <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                                    Расход уже включает все коэффициенты и надбавки
                                  </p>
                                </CardContent>
                              </Card>
                            )}
                            
                            {calculationMethod === "mintrans" && (
                              <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 mt-3">
                                <CardContent className="pt-4">
                                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">
                                    🧮 Базовый расход Минтранса:
                                  </p>
                                  <p className="text-sm text-purple-800 dark:text-purple-200">
                                    <span className="font-semibold text-lg">{profileData?.baseConsumptionMintrans || "не указан"} л/100км</span>
                                  </p>
                                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
                                    К базовому расходу будут применены коэффициенты: возраст авто, местность, дороги, температура, прогрев, режим эксплуатации
                                  </p>
                                  {!profileData?.baseConsumptionMintrans && (
                                    <p className="text-xs text-destructive font-semibold mt-2">
                                      ⚠️ Базовый расход не указан в профиле! Перейдите в настройки профиля для указания.
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {!hasProfile && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                  <CardContent className="pt-6">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                      Для создания типового отчёта необходимо заполнить данные автомобиля и график движения
                    </p>
                    <Link href="/wizard">
                      <Button variant="default" size="sm">
                        Настроить профиль
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleCreateReport} 
                  disabled={isLoading || !month || !year}
                  className="gap-2"
                >
                  {isLoading ? "Создание..." : "Создать отчёт"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Калькулятор Минтранса */}
          {hasProfile && useTemplate && calculationMethod === "mintrans" && profileData && month && year && (
            <MintransCalculator
              baseConsumption={profileData.baseConsumptionMintrans || profileData.fuelConsumption}
              vehicleYear={profileData.vehicleYear}
              month={parseInt(month)}
              year={parseInt(year)}
              onCalculationComplete={handleMintransCalculation}
            />
          )}
        </div>
      </div>

      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отчёт уже существует</DialogTitle>
            <DialogDescription>
              За {MONTH_NAMES[parseInt(month) - 1]} {year} уже есть отчёт. 
              Что вы хотите сделать?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConflictDialog(false)}
              className="w-full sm:w-auto"
            >
              Отмена
            </Button>
            <Button
              variant="default"
              onClick={handleKeepBoth}
              className="w-full sm:w-auto"
            >
              Сохранить оба
            </Button>
            <Button
              variant="destructive"
              onClick={handleOverwrite}
              className="w-full sm:w-auto"
            >
              Перезаписать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}