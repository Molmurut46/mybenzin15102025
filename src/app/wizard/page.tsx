"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { 
  Loader2, 
  ArrowLeft, 
  Check, 
  Car, 
  Gauge, 
  Settings, 
  Fuel, 
  Calendar, 
  MapPin, 
  Navigation, 
  Mountain, 
  Construction,
  Hash,
  CreditCard,
  Save,
  Sparkles,
  Route,
  TrendingUp,
  Wind,
  Shuffle
} from "lucide-react"

interface ScheduleData {
  dayOfWeek: number
  clients: string
  dailyMileage: number
  drivingMode: "city" | "highway" | "mixed"
  roadQuality: "good" | "fair" | "poor"
  terrainType: "plain" | "hilly" | "mountain"
}

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]

export default function WizardPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  // Шаг 1: Данные автомобиля
  const [carBrand, setCarBrand] = useState("")
  const [carModel, setCarModel] = useState("")
  const [engineVolume, setEngineVolume] = useState("")
  const [transmission, setTransmission] = useState("")
  const [fuelConsumption, setFuelConsumption] = useState("")
  const [fuelConsumption92, setFuelConsumption92] = useState("")
  const [fuelConsumption95, setFuelConsumption95] = useState("")
  const [fuelType, setFuelType] = useState("АИ-92")
  const [defaultDeviation, setDefaultDeviation] = useState("")
  const [vehicleYear, setVehicleYear] = useState("")
  const [vinNumber, setVinNumber] = useState("")
  const [licensePlate, setLicensePlate] = useState("")
  const [baseConsumptionMintrans, setBaseConsumptionMintrans] = useState("")
  const [defaultRoadQuality, setDefaultRoadQuality] = useState<"good" | "fair" | "poor">("fair")
  const [defaultTerrainType, setDefaultTerrainType] = useState<"plain" | "hilly" | "mountain">("plain")
  const [defaultDrivingMode, setDefaultDrivingMode] = useState<"city" | "highway" | "mixed">("city")

  // Шаг 2: График движения
  const [scheduleData, setScheduleData] = useState<ScheduleData[]>(
    DAYS.map((_, index) => ({
      dayOfWeek: index + 1,
      clients: "",
      dailyMileage: 0,
      drivingMode: "city",
      roadQuality: "fair",
      terrainType: "plain"
    }))
  )

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/sign-in")
    }
  }, [session, isPending, router])

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) return
      
      setIsLoading(true)
      const token = localStorage.getItem("bearer_token")

      try {
        const profileRes = await fetch("/api/user-profile", {
          headers: { "Authorization": `Bearer ${token}` }
        })

        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data)
          
          // Load profile data into form
          setCarBrand(data.carBrand || "")
          setCarModel(data.carModel || "")
          setEngineVolume(data.engineVolume?.toString() || "")
          setTransmission(data.transmission || "")
          setFuelConsumption92(data.fuelConsumption92?.toString() || "")
          setFuelConsumption95(data.fuelConsumption95?.toString() || "")
          setFuelType(data.fuelType || "АИ-92")
          setDefaultDeviation(data.defaultDeviationPercent?.toString() || "")
          setVehicleYear(data.vehicleYear?.toString() || "")
          setVinNumber(data.vinNumber || "")
          setLicensePlate(data.licensePlate || "")
          setBaseConsumptionMintrans(data.baseConsumptionMintrans?.toString() || "")
          setDefaultRoadQuality(data.defaultRoadQuality || "fair")
          setDefaultTerrainType(data.defaultTerrainType || "plain")
          setDefaultDrivingMode(data.defaultDrivingMode || "city")
        }

        // Load schedule data
        const scheduleRes = await fetch("/api/weekly-schedule", {
          headers: { "Authorization": `Bearer ${token}` }
        })

        if (scheduleRes.ok) {
          const data = await scheduleRes.json()
          if (data.length > 0) {
            const scheduleMap = new Map(data.map((item: any) => [item.dayOfWeek, item]))
            setScheduleData(prev => 
              prev.map(day => {
                const existing = scheduleMap.get(day.dayOfWeek)
                return existing ? {
                  dayOfWeek: day.dayOfWeek,
                  clients: existing.clients || "",
                  dailyMileage: existing.dailyMileage || 0,
                  drivingMode: existing.drivingMode || "city",
                  roadQuality: existing.roadQuality || "fair",
                  terrainType: existing.terrainType || "plain"
                } : day
              })
            )
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [session])

  const handleScheduleChange = (dayIndex: number, field: keyof ScheduleData, value: string | number) => {
    setScheduleData(prev => 
      prev.map((day, idx) => 
        idx === dayIndex ? { ...day, [field]: value } : day
      )
    )
  }

  const handleNext = () => {
    if (step === 1) {
      if (!carBrand || !carModel || !engineVolume || !transmission) {
        toast.error("Пожалуйста, заполните все обязательные поля")
        return
      }
      if (!fuelConsumption92 && !fuelConsumption95) {
        toast.error("Укажите расход хотя бы для одного типа топлива")
        return
      }
    }
    setStep(prev => prev + 1)
  }

  const handleBack = () => {
    setStep(prev => prev - 1)
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      const token = localStorage.getItem("bearer_token")

      const response = await fetch("/api/user-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          carBrand,
          carModel,
          engineVolume: engineVolume ? Number(engineVolume) : null,
          transmission,
          fuelConsumption: fuelConsumption ? Number(fuelConsumption) : null,
          fuelConsumption92: fuelConsumption92 ? Number(fuelConsumption92) : null,
          fuelConsumption95: fuelConsumption95 ? Number(fuelConsumption95) : null,
          fuelType,
          defaultDeviationPercent: defaultDeviation ? Number(defaultDeviation) : 0,
          vehicleYear: vehicleYear ? Number(vehicleYear) : null,
          vinNumber,
          licensePlate,
          baseConsumptionMintrans: baseConsumptionMintrans ? Number(baseConsumptionMintrans) : null,
          defaultRoadQuality,
          defaultTerrainType,
          defaultDrivingMode,
        }),
      })

      if (!response.ok) {
        throw new Error("Не удалось сохранить профиль")
      }

      toast.success("Профиль успешно сохранён")
    } catch (error) {
      console.error(error)
      toast.error("Ошибка при сохранении профиля")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSchedule = async () => {
    setIsLoading(true)
    const token = localStorage.getItem("bearer_token")

    try {
      // Сохранение графика
      const scheduleRes = await fetch("/api/weekly-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(scheduleData)
      })

      if (!scheduleRes.ok) {
        throw new Error("Ошибка сохранения графика")
      }

      toast.success("График сохранён")
      router.push("/dashboard")
    } catch (error) {
      toast.error("Ошибка при сохранении графика")
    } finally {
      setIsLoading(false)
    }
  }

  if (isPending || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Настройка профиля и графика</h1>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-3 text-sm">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              step === 1 
                ? "bg-primary text-white font-semibold shadow-sm" 
                : "bg-slate-100 text-slate-600"
            }`}>
              <Car className="w-4 h-4" />
              <span>Шаг 1: Данные автомобиля</span>
            </div>
            <div className="h-0.5 w-8 bg-slate-300"></div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              step === 2 
                ? "bg-primary text-white font-semibold shadow-sm" 
                : "bg-slate-100 text-slate-600"
            }`}>
              <Calendar className="w-4 h-4" />
              <span>Шаг 2: График движения</span>
            </div>
          </div>
        </div>

        {/* Step 1: Profile Settings */}
        {step === 1 && (
          <Card className="mb-6 sm:mb-8 border border-slate-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                <CardTitle className="text-slate-900">Данные автомобиля</CardTitle>
              </div>
              <CardDescription>
                Заполните информацию о вашем автомобиле и параметры расчёта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Basic Car Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Основная информация
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="carBrand" className="flex items-center gap-2 font-medium">
                      <Car className="w-3.5 h-3.5 text-slate-500" />
                      Марка автомобиля *
                    </Label>
                    <Input
                      id="carBrand"
                      value={carBrand}
                      onChange={(e) => setCarBrand(e.target.value)}
                      placeholder="Toyota"
                      className="border-slate-300 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carModel" className="flex items-center gap-2 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                      Модель автомобиля *
                    </Label>
                    <Input
                      id="carModel"
                      value={carModel}
                      onChange={(e) => setCarModel(e.target.value)}
                      placeholder="Camry"
                      className="border-slate-300 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Technical Specs */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Технические характеристики
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="engineVolume" className="flex items-center gap-2 font-medium">
                      <Gauge className="w-3.5 h-3.5 text-slate-500" />
                      Объём двигателя (см³) *
                    </Label>
                    <Input
                      id="engineVolume"
                      type="number"
                      value={engineVolume}
                      onChange={(e) => setEngineVolume(e.target.value)}
                      placeholder="2000"
                      className="border-slate-300 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transmission" className="flex items-center gap-2 font-medium">
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      Коробка передач *
                    </Label>
                    <Select value={transmission} onValueChange={setTransmission}>
                      <SelectTrigger className="border-slate-300">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="МКПП">МКПП</SelectItem>
                        <SelectItem value="АКПП">АКПП</SelectItem>
                        <SelectItem value="Вариатор">Вариатор</SelectItem>
                        <SelectItem value="Робот">Робот</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Fuel Consumption */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Fuel className="w-4 h-4" />
                  Расход топлива
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fuelConsumption92" className="flex items-center gap-2 font-medium text-sm">
                      <Fuel className="w-3.5 h-3.5 text-green-600" />
                      Расход АИ-92 (л/100км)
                    </Label>
                    <Input
                      id="fuelConsumption92"
                      type="number"
                      step="0.1"
                      value={fuelConsumption92}
                      onChange={(e) => setFuelConsumption92(e.target.value)}
                      placeholder="8.5"
                      className="border-green-300 focus:border-green-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuelConsumption95" className="flex items-center gap-2 font-medium text-sm">
                      <Fuel className="w-3.5 h-3.5 text-blue-600" />
                      Расход АИ-95 (л/100км)
                    </Label>
                    <Input
                      id="fuelConsumption95"
                      type="number"
                      step="0.1"
                      value={fuelConsumption95}
                      onChange={(e) => setFuelConsumption95(e.target.value)}
                      placeholder="8.2"
                      className="border-blue-300 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuelType" className="flex items-center gap-2 font-medium text-sm">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                      Тип топлива по умолчанию
                    </Label>
                    <Select value={fuelType} onValueChange={setFuelType}>
                      <SelectTrigger className="border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="АИ-92">АИ-92</SelectItem>
                        <SelectItem value="АИ-95">АИ-95</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Vehicle Details */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Регистрационные данные
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleYear" className="flex items-center gap-2 font-medium text-sm">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Год выпуска
                    </Label>
                    <Input
                      id="vehicleYear"
                      type="number"
                      value={vehicleYear}
                      onChange={(e) => setVehicleYear(e.target.value)}
                      placeholder="2020"
                      className="border-slate-300 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licensePlate" className="flex items-center gap-2 font-medium text-sm">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                      Гос. номер
                    </Label>
                    <Input
                      id="licensePlate"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      placeholder="А123БВ777"
                      className="border-slate-300 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vinNumber" className="flex items-center gap-2 font-medium text-sm">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      VIN-номер
                    </Label>
                    <Input
                      id="vinNumber"
                      value={vinNumber}
                      onChange={(e) => setVinNumber(e.target.value)}
                      placeholder="1HGBH41JXMN109186"
                      className="border-slate-300 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Mintrans Base Consumption */}
              <div className="space-y-2 pt-4 border-t border-slate-200">
                <Label htmlFor="baseConsumptionMintrans" className="flex items-center gap-2 font-medium">
                  <Gauge className="w-4 h-4 text-orange-600" />
                  Базовый расход для расчёта Минтранса (л/100км)
                </Label>
                <Input
                  id="baseConsumptionMintrans"
                  type="number"
                  step="0.1"
                  value={baseConsumptionMintrans}
                  onChange={(e) => setBaseConsumptionMintrans(e.target.value)}
                  placeholder="7.2"
                  className="border-orange-300 focus:border-orange-500"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Норма расхода от производителя для расчёта по методике Минтранса
                </p>
              </div>

              {/* Default Parameters */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Параметры по умолчанию</h3>
                    <p className="text-xs text-slate-600">
                      Эти значения будут использоваться при создании отчётов
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultDeviation" className="flex items-center gap-2 font-medium text-sm">
                      <Shuffle className="w-3.5 h-3.5 text-purple-600" />
                      Отклонение от пробега (%)
                    </Label>
                    <Input
                      id="defaultDeviation"
                      type="number"
                      step="1"
                      value={defaultDeviation}
                      onChange={(e) => setDefaultDeviation(e.target.value)}
                      placeholder="0"
                      className="border-purple-300 focus:border-purple-500"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Случайное отклонение пробега для каждого дня
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="defaultDrivingMode" className="flex items-center gap-2 font-medium text-sm">
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      Режим эксплуатации
                    </Label>
                    <Select value={defaultDrivingMode} onValueChange={(value: "city" | "highway" | "mixed") => setDefaultDrivingMode(value)}>
                      <SelectTrigger id="defaultDrivingMode" className="border-blue-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="city">🏙️ Город</SelectItem>
                        <SelectItem value="highway">🛣️ Трасса</SelectItem>
                        <SelectItem value="mixed">🔀 Смешанный</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="defaultRoadQuality" className="flex items-center gap-2 font-medium text-sm">
                      <Construction className="w-3.5 h-3.5 text-orange-600" />
                      Качество дорог
                    </Label>
                    <Select value={defaultRoadQuality} onValueChange={(value: "good" | "fair" | "poor") => setDefaultRoadQuality(value)}>
                      <SelectTrigger id="defaultRoadQuality" className="border-orange-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">✨ Хорошие</SelectItem>
                        <SelectItem value="fair">➖ Удовлетворительные</SelectItem>
                        <SelectItem value="poor">⚠️ Плохие</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultTerrainType" className="flex items-center gap-2 font-medium text-sm">
                      <Mountain className="w-3.5 h-3.5 text-green-600" />
                      Тип местности
                    </Label>
                    <Select value={defaultTerrainType} onValueChange={(value: "plain" | "hilly" | "mountain") => setDefaultTerrainType(value)}>
                      <SelectTrigger id="defaultTerrainType" className="border-green-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plain">🌾 Равнина</SelectItem>
                        <SelectItem value="hilly">⛰️ Холмистая</SelectItem>
                        <SelectItem value="mountain">🏔️ Горная</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving} 
                  variant="outline" 
                  className="flex-1 border-slate-300 hover:bg-slate-50"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {!saving && <Save className="mr-2 h-4 w-4" />}
                  Сохранить профиль
                </Button>
                <Button onClick={handleNext} className="flex-1 bg-primary hover:bg-primary/90">
                  Далее: График движения
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Weekly Schedule */}
        {step === 2 && (
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <CardTitle className="text-slate-900">График движения</CardTitle>
              </div>
              <CardDescription>Укажите типовые маршруты для каждого дня недели</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {DAYS.map((day, index) => (
                <div key={index} className="border-2 border-slate-200 rounded-xl p-5 space-y-4 bg-white hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900">{day}</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`clients-${index}`} className="flex items-center gap-2 font-medium">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      Маршрут / Клиенты
                    </Label>
                    <Textarea
                      id={`clients-${index}`}
                      value={scheduleData[index].clients}
                      onChange={(e) => handleScheduleChange(index, "clients", e.target.value)}
                      placeholder="ООО «Компания», ИП Иванов, Магазин «Продукты»..."
                      rows={3}
                      className="resize-none border-purple-200 focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`mileage-${index}`} className="flex items-center gap-2 font-medium">
                      <Route className="w-4 h-4 text-blue-600" />
                      Пробег (км)
                    </Label>
                    <Input
                      id={`mileage-${index}`}
                      type="number"
                      value={scheduleData[index].dailyMileage}
                      onChange={(e) => handleScheduleChange(index, "dailyMileage", parseFloat(e.target.value) || 0)}
                      placeholder="50"
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`drivingMode-${index}`} className="flex items-center gap-2 font-medium text-sm">
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        Режим эксплуатации
                      </Label>
                      <Select
                        value={scheduleData[index].drivingMode}
                        onValueChange={(value) => handleScheduleChange(index, "drivingMode", value)}
                      >
                        <SelectTrigger id={`drivingMode-${index}`} className="border-blue-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="city">🏙️ Город</SelectItem>
                          <SelectItem value="highway">🛣️ Трасса</SelectItem>
                          <SelectItem value="mixed">🔀 Смешанный</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`roadQuality-${index}`} className="flex items-center gap-2 font-medium text-sm">
                        <Construction className="w-3.5 h-3.5 text-orange-600" />
                        Качество дорог
                      </Label>
                      <Select
                        value={scheduleData[index].roadQuality}
                        onValueChange={(value) => handleScheduleChange(index, "roadQuality", value)}
                      >
                        <SelectTrigger id={`roadQuality-${index}`} className="border-orange-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">✨ Хорошие</SelectItem>
                          <SelectItem value="fair">➖ Удовлетворительные</SelectItem>
                          <SelectItem value="poor">⚠️ Плохие</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`terrainType-${index}`} className="flex items-center gap-2 font-medium text-sm">
                        <Mountain className="w-3.5 h-3.5 text-green-600" />
                        Тип местности
                      </Label>
                      <Select
                        value={scheduleData[index].terrainType}
                        onValueChange={(value) => handleScheduleChange(index, "terrainType", value)}
                      >
                        <SelectTrigger id={`terrainType-${index}`} className="border-green-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plain">🌾 Равнина</SelectItem>
                          <SelectItem value="hilly">⛰️ Холмистая</SelectItem>
                          <SelectItem value="mountain">🏔️ Горная</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t border-slate-200">
                <Button variant="outline" onClick={handleBack} className="flex-1 sm:flex-initial border-slate-300">
                  <ArrowLeft className="mr-2 w-4 h-4" /> Назад
                </Button>
                <Button onClick={handleSaveSchedule} disabled={saving} className="flex-1 sm:flex-initial bg-green-600 hover:bg-green-700">
                  {saving ? "Сохранение..." : "Завершить"} <Check className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}