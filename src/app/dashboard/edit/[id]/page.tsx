"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Download, Plus, Trash2, Check, Shuffle, FileText, RefreshCw, Settings, Calendar, MapPin, Fuel, Navigation, FileSpreadsheet, Gauge } from "lucide-react";
import Link from "next/link";
import { REPORT_STYLES } from "@/lib/report-styles";
import { exportReportToPDF } from "@/lib/export-pdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";

interface DailyEntry {
  date: string;
  dayOfWeek: number;
  clients: string;
  mileage: number;
  fuelUsed: number;
  drivingMode?: "city" | "highway" | "mixed";
  roadQuality?: "good" | "fair" | "poor";
  terrainType?: "plain" | "hilly" | "mountain";
  isNew?: boolean;
}

interface ReportData {
  month: number;
  year: number;
  entries: DailyEntry[];
  profile?: {
    carBrand?: string;
    carModel?: string;
    engineVolume?: number;
    transmission?: string;
    fuelConsumption?: number;
    fuelType?: string;
  };
  reportDate?: string;
  employeeName?: string;
}

const MONTH_NAMES = [
"Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
"Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];


const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function EditReportPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [currentFuelConsumption, setCurrentFuelConsumption] = useState<number | null>(null);
  const [calculationMethod, setCalculationMethod] = useState<"simple" | "mintrans">("simple");
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [defaultRoadQuality, setDefaultRoadQuality] = useState<string>("fair");
  const [defaultTerrainType, setDefaultTerrainType] = useState<string>("plain");

  // КРИТИЧНО: Добавляем недостающие состояния
  const [reportMonth, setReportMonth] = useState<number>(1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [fuelPrice, setFuelPrice] = useState<string>("60");
  const [fuelPriceSource, setFuelPriceSource] = useState<string>("default");
  const [isLoadingFuelPrice, setIsLoadingFuelPrice] = useState(false);
  const [selectedFuelType, setSelectedFuelType] = useState<string>("АИ-92");
  const [deviationPercent, setDeviationPercent] = useState<string>("0");
  const [reportDate, setReportDate] = useState<string>("");
  const [employeeName, setEmployeeName] = useState<string>("");
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    const loadData = async () => {
      if (!session?.user || !reportId) return;

      const token = localStorage.getItem("bearer_token");
      setLoadError(null);

      try {
        // Load profile
        const profileRes = await fetch("/api/user-profile", {
          headers: { "Authorization": `Bearer ${token}` }
        });

        let loadedProfile = null;

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setProfileData(profile);
          loadedProfile = profile;
          // Load default values from profile
          setDefaultRoadQuality(profile.defaultRoadQuality || "fair");
          setDefaultTerrainType(profile.defaultTerrainType || "plain");
        } else {
          console.warn("Profile not loaded:", profileRes.status);
        }

        // Load weekly schedule
        const scheduleRes = await fetch("/api/weekly-schedule", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (scheduleRes.ok) {
          const schedule = await scheduleRes.json();
          setWeeklySchedule(schedule);
        } else {
          console.warn("Schedule not loaded:", scheduleRes.status);
        }

        // Load report data
        const reportRes = await fetch(`/api/reports/${reportId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (!reportRes.ok) {
          const errorText = await reportRes.text();
          console.error("Report load error:", reportRes.status, errorText);
          throw new Error(`Отчёт не найден (${reportRes.status})`);
        }

        const data = await reportRes.json();

        console.log("Loaded report data:", data);

        if (!data || !data.reportData) {
          throw new Error("Данные отчёта отсутствуют");
        }

        // КРИТИЧНО: Сохраняем месяц и год из верхнего уровня ответа
        setReportMonth(data.month);
        setReportYear(data.year);

        setReport(data.reportData);
        setEntries(data.reportData.entries || []);

        // Set calculation method from report data
        setCalculationMethod(data.reportData.calculationMethod || "simple");

        if (data.reportData.fuelPrice) {
          setFuelPrice(data.reportData.fuelPrice.toString());
          setFuelPriceSource(data.reportData.fuelPriceSource || "default");
        }
        if (data.reportData.deviationPercent !== undefined) {
          setDeviationPercent(data.reportData.deviationPercent.toString());
        }

        // Set selected fuel type from report or profile default
        const reportFuelType = data.reportData.selectedFuelType || data.reportData.profile?.fuelType || loadedProfile?.fuelType || "АИ-92";
        setSelectedFuelType(reportFuelType);

        // Set current fuel consumption based on calculation method
        const isMintrans = data.reportData.calculationMethod === "mintrans";
        if (isMintrans && data.reportData.mintransCoefficients) {
          // КРИТИЧНО: Для Минтранса показываем БАЗОВЫЙ расход, а не финальный
          setCurrentFuelConsumption(data.reportData.mintransCoefficients.baseConsumption || 0);
        } else if (loadedProfile) {
          // For simple mode - use consumption from profile based on fuel type
          const consumption = reportFuelType === "АИ-92" ?
          loadedProfile?.fuelConsumption92 :
          loadedProfile?.fuelConsumption95;
          setCurrentFuelConsumption(consumption || 0);
        }

        // Set default report date if not set
        if (data.reportData.reportDate) {
          setReportDate(data.reportData.reportDate);
        } else {
          // Формируем дату составления отчета: день из текущей даты, месяц на 1 больше месяца отчета
          const currentDate = new Date();
          const currentDay = currentDate.getDate();

          const reportMonth = data.month || new Date().getMonth() + 1;
          const reportYear = data.year || new Date().getFullYear();

          // Месяц составления = месяц отчета + 1
          let compilationMonth = reportMonth;
          let compilationYear = reportYear;

          // Если месяц декабрь (12), то следующий месяц январь (1) и год увеличивается
          if (compilationMonth === 12) {
            compilationMonth = 1;
            compilationYear = reportYear + 1;
          } else {
            compilationMonth = reportMonth + 1;
          }

          // Формируем дату в формате DD.MM.YYYY
          const calculatedDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`;
          setReportDate(calculatedDate);
        }

        // Set default employee name
        if (data.reportData.employeeName) {
          setEmployeeName(data.reportData.employeeName);
        } else if (session?.user?.name) {
          const formatUserName = (fullName: string): string => {
            const parts = fullName.trim().split(' ');
            if (parts.length >= 2) {
              const lastName = parts[0];
              const firstInitial = parts[1].charAt(0) + '.';
              const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : '';
              return `${lastName} ${firstInitial}${middleInitial}`;
            }
            return fullName;
          };
          setEmployeeName(formatUserName(session.user.name));
        }

        // Set default deviation from profile if not set
        if (data.reportData.deviationPercent === undefined && loadedProfile?.defaultDeviationPercent !== undefined) {
          setDeviationPercent(loadedProfile.defaultDeviationPercent.toString());
        }

      } catch (error) {
        console.error("Load data error:", error);
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
        setLoadError(errorMessage);
        toast.error(`Ошибка загрузки отчёта: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user) {
      loadData();
    }
  }, [session, reportId, router]);

  const getTemperatureCoefficient = (temp: number): number => {
    let multiplier = 1.0;

    if (temp <= -25) multiplier = 1.18;else
    if (temp <= -20) multiplier = 1.15;else
    if (temp <= -15) multiplier = 1.12;else
    if (temp <= -10) multiplier = 1.10;else
    if (temp <= -5) multiplier = 1.07;else
    if (temp <= 0) multiplier = 1.05;else
    if (temp <= 5) multiplier = 1.03;else
    if (temp >= 30) multiplier = 1.10;else
    if (temp >= 27) multiplier = 1.07;else
    if (temp >= 25) multiplier = 1.05;

    if (temp < 0) {
      multiplier = multiplier * 1.05;
    }

    return multiplier;
  };

  const getDrivingModeCoefficient = (mode: string): number => {
    switch (mode) {
      case "city":return 1.15;
      case "highway":return 1.0;
      case "mixed":return 1.075;
      default:return 1.15;
    }
  };

  const getRoadQualityCoefficient = (quality: string): number => {
    switch (quality) {
      case "good":return 1.0;
      case "fair":return 1.10;
      case "poor":return 1.20;
      default:return 1.10;
    }
  };

  const getTerrainTypeCoefficient = (terrain: string): number => {
    switch (terrain) {
      case "plain":return 1.0;
      case "hilly":return 1.05;
      case "mountain":return 1.10;
      default:return 1.0;
    }
  };

  const getVehicleAgeCoefficient = (vehicleYear: number, dateStr: string): number => {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return 1.0;

    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);

    const entryDate = new Date(year, month - 1, day);
    const vehicleDate = new Date(vehicleYear, 0, 1);

    const ageInYears = (entryDate.getTime() - vehicleDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    return ageInYears > 5 ? 1.05 : 1.0;
  };

  const recalculateFuel = (mileage: number, entry: DailyEntry): number => {
    if (!currentFuelConsumption) return 0;

    // Для упрощённого режима расход уже итоговый
    if (calculationMethod === "simple") {
      return mileage * currentFuelConsumption / 100;
    }

    // Для Минтранса используем формулу с коэффициентами
    if (calculationMethod === "mintrans" && report?.mintransCoefficients) {
      const dayNum = parseInt(entry.date.split('.')[0]);
      const temp = report.dailyTemperatures?.[dayNum.toString()];

      const tempCoeff = temp !== undefined ? getTemperatureCoefficient(temp) : 1.0;
      const drivingCoeff = getDrivingModeCoefficient(entry.drivingMode || "city");
      const roadCoeff = getRoadQualityCoefficient(entry.roadQuality || "fair");
      const terrainCoeff = getTerrainTypeCoefficient(entry.terrainType || "plain");
      const ageCoeff = profileData?.vehicleYear ? getVehicleAgeCoefficient(profileData.vehicleYear, entry.date) : 1.0;

      // Q = (Hsn × S / 100) × Kвозраст × Kрежим × Kтемп × Kместность × Kдороги
      return currentFuelConsumption * mileage / 100 * ageCoeff * drivingCoeff * tempCoeff * terrainCoeff * roadCoeff;
    }

    return 0;
  };

  const handleFuelTypeChange = async (newFuelType: string) => {
    if (!profileData) {
      toast.error("Профиль не загружен");
      return;
    }

    // Show loading state
    setIsLoadingFuelPrice(true);

    try {
      // Step 1: Load fuel price FIRST
      const priceResponse = await fetch("/api/fuel-prices");

      let newPrice = 60; // default
      let newPriceSource = "default";

      if (priceResponse.ok) {
        const data = await priceResponse.json();
        const prices = data.prices;

        const normalizedFuelType = newFuelType.toUpperCase().replace(/\s/g, '');

        if (normalizedFuelType.includes('92') || normalizedFuelType.includes('АИ-92') || normalizedFuelType.includes('АИ92')) {
          newPrice = prices["АИ-92"] || 60;
        } else if (normalizedFuelType.includes('95') || normalizedFuelType.includes('АИ-95') || normalizedFuelType.includes('АИ95')) {
          newPrice = prices["АИ-95"] || 65;
        } else {
          newPrice = Math.round((prices["АИ-92"] + prices["АИ-95"]) / 2);
        }

        newPriceSource = data.source;
      }

      // Step 2: Update based on calculation method
      if (calculationMethod === "mintrans") {
        // For Mintrans mode: Only update fuel type and price, DON'T recalculate entries
        // Entries were already calculated with Mintrans coefficients
        setSelectedFuelType(newFuelType);
        setFuelPrice(newPrice.toString());
        setFuelPriceSource(newPriceSource);
        setHasUnsavedChanges(true);

        toast.success(`Тип топлива изменён на ${newFuelType}. Расход рассчитан по нормам Минтранса.`);
      } else {
        // For simple mode: Get consumption and recalculate all entries
        const consumption = newFuelType === "АИ-92" ?
        profileData.fuelConsumption92 :
        profileData.fuelConsumption95;

        if (!consumption) {
          toast.error(`Расход для ${newFuelType} не указан в настройках профиля`);
          setIsLoadingFuelPrice(false);
          return;
        }

        // Recalculate all entries with new fuel consumption
        const recalculatedEntries = entries.map((entry) => ({
          ...entry,
          fuelUsed: parseFloat((entry.mileage * consumption / 100).toFixed(1))
        }));

        // Update all state together
        setSelectedFuelType(newFuelType);
        setCurrentFuelConsumption(consumption);
        setFuelPrice(newPrice.toString());
        setFuelPriceSource(newPriceSource);
        setEntries(recalculatedEntries);
        setHasUnsavedChanges(true);

        // Show success message
        if (newPriceSource === "russiabase") {
          toast.success(`${newFuelType}: расход ${consumption} л/100км, цена ${newPrice} ₽/л`);
        } else {
          toast.success(`${newFuelType}: расход ${consumption} л/100км, цена ${newPrice} ₽/л (по умолчанию)`);
        }
      }
    } catch (error) {
      console.error("Error changing fuel type:", error);
      toast.error("Ошибка при смене вида топлива");
    } finally {
      setIsLoadingFuelPrice(false);
    }
  };

  const loadFuelPrices = async (fuelType?: string) => {
    setIsLoadingFuelPrice(true);
    try {
      const response = await fetch("/api/fuel-prices");

      if (!response.ok) {
        console.error("Failed to fetch fuel prices");
        setFuelPriceSource("default");
        setIsLoadingFuelPrice(false);
        return;
      }

      const data = await response.json();
      const prices = data.prices;

      let price = 60;

      if (fuelType) {
        const normalizedFuelType = fuelType.toUpperCase().replace(/\s/g, '');

        if (normalizedFuelType.includes('92') || normalizedFuelType.includes('АИ-92') || normalizedFuelType.includes('АИ92')) {
          price = prices["АИ-92"] || 60;
        } else if (normalizedFuelType.includes('95') || normalizedFuelType.includes('АИ-95') || normalizedFuelType.includes('АИ95')) {
          price = prices["АИ-95"] || 65;
        } else {
          price = Math.round((prices["АИ-92"] + prices["АИ-95"]) / 2);
        }
      }

      setFuelPrice(price.toString());
      setFuelPriceSource(data.source);
      setHasUnsavedChanges(true);

      if (data.source === "russiabase") {
        toast.success(`Загружена актуальная цена: ${price} ₽/л`);
      } else {
        toast.info(`Используется цена по умолчанию: ${price} ₽/л`);
      }
    } catch (error) {
      console.error("Error loading fuel prices:", error);
      setFuelPriceSource("default");
      toast.error("Не удалось загрузить актуальные цены");
    } finally {
      setIsLoadingFuelPrice(false);
    }
  };

  const applyDeviation = (baseMileage: number, deviationPercent: number): number => {
    if (deviationPercent === 0) return parseFloat((Math.max(0, baseMileage)).toFixed(1));

    // Случайное равномерное отклонение в диапазоне [-p, +p]
    const randomFactor = (Math.random() * 2 - 1) * (deviationPercent / 100);
    const deviatedMileage = baseMileage * (1 + randomFactor);

    // Не допускаем отрицательных значений и округляем один раз до 0.1 км
    return parseFloat(Math.max(0, deviatedMileage).toFixed(1));
  };

  const handleRegenerateDeviations = () => {
    const deviation = parseFloat(deviationPercent) || 0;

    if (deviation === 0) {
      toast.error("Укажите процент отклонения больше 0");
      return;
    }

    const newEntries = entries.map((entry) => {
      // Find base mileage from schedule
      const scheduleEntry = weeklySchedule.find((s) => s.dayOfWeek === entry.dayOfWeek);
      const baseMileage = scheduleEntry?.dailyMileage ?? entry.mileage ?? 0;

      // Apply new random deviation (с защитами и единоразовым округлением)
      const newMileage = applyDeviation(baseMileage, deviation);
      const updatedEntry = { ...entry, mileage: newMileage } as DailyEntry;

      // Пересчёт топлива через общую формулу (simple/mintrans) + единоразовое округление
      const recalculated = recalculateFuel(newMileage, updatedEntry);
      const newFuelUsed = parseFloat((recalculated || 0).toFixed(1));

      return {
        ...updatedEntry,
        fuelUsed: newFuelUsed,
      };
    });

    setEntries(newEntries);
    setHasUnsavedChanges(true);
    toast.success("Отклонения пересчитаны");
  };

  const sortEntriesByDate = (entries: DailyEntry[]): DailyEntry[] => {
    return [...entries].sort((a, b) => {
      const parseDate = (dateStr: string): Date => {
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
        return new Date(0);
      };

      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const getDayOfWeekFromDate = (dateStr: string): number => {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      return dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday from 0 to 7
    }
    return 1;
  };

  const handleEntryChange = (index: number, field: keyof DailyEntry, value: any) => {
    const newEntries = [...entries];
    const entry = { ...newEntries[index] };

    entry[field] = value;

    if (field === "date" && value && entry.isNew && !entry.clients.trim()) {
      const dayOfWeek = getDayOfWeekFromDate(value);
      entry.dayOfWeek = dayOfWeek;

      const scheduleEntry = weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
      if (scheduleEntry) {
        entry.clients = scheduleEntry.clients || "";
        entry.mileage = scheduleEntry.dailyMileage || 0;
        entry.drivingMode = scheduleEntry.drivingMode || "city";
        entry.roadQuality = scheduleEntry.roadQuality || "fair";
        entry.terrainType = scheduleEntry.terrainType || "plain";
        entry.fuelUsed = parseFloat(recalculateFuel(entry.mileage, entry).toFixed(1));
      }
    }

    if (field === "mileage" || field === "drivingMode" || field === "roadQuality" || field === "terrainType") {
      const mileage = field === "mileage" ? parseFloat(value) || 0 : entry.mileage;
      entry.fuelUsed = parseFloat(recalculateFuel(mileage, entry).toFixed(1));
    }

    newEntries[index] = entry;
    setEntries(newEntries);
    setHasUnsavedChanges(true);
  };

  const handleAddEntry = () => {
    const lastDate = entries.length > 0 ? entries[entries.length - 1].date : null;
    let newDate = "";
    let newDayOfWeek = 1;

    if (lastDate) {
      const parts = lastDate.split(".");
      const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      date.setDate(date.getDate() + 1);
      newDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
      newDayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    } else {
      const now = new Date();
      newDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
      newDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    }

    // Find matching schedule entry for this day of week
    const scheduleEntry = weeklySchedule.find((s) => s.dayOfWeek === newDayOfWeek);

    const newEntry: DailyEntry = {
      date: newDate,
      dayOfWeek: newDayOfWeek,
      clients: scheduleEntry?.clients || "",
      mileage: scheduleEntry?.dailyMileage || 0,
      fuelUsed: 0,
      drivingMode: scheduleEntry?.drivingMode || "city",
      // Use schedule values if available, otherwise use profile defaults
      roadQuality: scheduleEntry?.roadQuality || defaultRoadQuality,
      terrainType: scheduleEntry?.terrainType || defaultTerrainType
    };

    if (calculationMethod === "mintrans" && report?.dailyTemperatures) {
      const dayNum = parseInt(newDate.split('.')[0]);
      const temp = report.dailyTemperatures[dayNum.toString()];
      if (temp !== undefined) {
        newEntry.temperature = temp;
      }
    }

    // Recalculate fuel with the new default values
    newEntry.fuelUsed = recalculateFuel(newEntry.mileage, newEntry);

    setEntries([...entries, newEntry]);
    setHasUnsavedChanges(true);
  };

  const handleSaveNewEntry = (index: number) => {
    const entry = entries[index];

    if (!entry.date) {
      toast.error("Укажите дату");
      return;
    }

    const newEntries = [...entries];
    newEntries[index] = { ...entry, isNew: false };

    const sorted = sortEntriesByDate(newEntries);
    setEntries(sorted);
    setHasUnsavedChanges(true);
    toast.success("Запись добавлена");
  };

  const handleDeleteEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    const hasUnsavedEntries = entries.some((e) => e.isNew);
    if (hasUnsavedEntries) {
      toast.error("Сохраните все новые записи перед сохранением отчёта");
      return;
    }

    setIsSaving(true);
    const token = localStorage.getItem("bearer_token");

    try {
      // Пересчитываем dailyBreakdown для режима Минтранса
      let updatedDailyBreakdown = report?.dailyBreakdown;

      if (calculationMethod === "mintrans" && report?.dailyBreakdown) {
        updatedDailyBreakdown = entries.map((entry) => {
          const dayNum = parseInt(entry.date.split('.')[0]);
          const temp = report.dailyTemperatures?.[dayNum.toString()];

          const tempCoeff = temp !== undefined ? getTemperatureCoefficient(temp) : 1.0;
          const drivingCoeff = getDrivingModeCoefficient(entry.drivingMode || "city");
          const roadCoeff = getRoadQualityCoefficient(entry.roadQuality || "fair");
          const terrainCoeff = getTerrainTypeCoefficient(entry.terrainType || "plain");
          const ageCoeff = profileData?.vehicleYear ? getVehicleAgeCoefficient(profileData.vehicleYear, entry.date) : 1.0;

          return {
            date: entry.date,
            mileage: entry.mileage,
            fuelUsed: entry.fuelUsed,
            temperature: temp,
            drivingMode: entry.drivingMode,
            roadQuality: entry.roadQuality,
            terrainType: entry.terrainType,
            coefficients: {
              base: report?.mintransCoefficients?.baseConsumption,
              vehicleAge: ageCoeff,
              terrain: terrainCoeff,
              roadCondition: roadCoeff,
              temperature: tempCoeff,
              drivingMode: drivingCoeff
            }
          };
        });
      }

      const response = await fetch(`/api/reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          reportData: {
            ...report,
            entries: entries.map((e) => ({ ...e, isNew: undefined })),
            selectedFuelType: selectedFuelType,
            fuelPrice: parseFloat(fuelPrice) || 55,
            fuelPriceSource: fuelPriceSource,
            deviationPercent: parseFloat(deviationPercent) || 0,
            reportDate: reportDate,
            employeeName: employeeName,
            dailyBreakdown: updatedDailyBreakdown,
            profile: {
              ...report?.profile,
              fuelConsumption: currentFuelConsumption,
              fuelType: selectedFuelType
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error("Ошибка сохранения");
      }

      setHasUnsavedChanges(false);
      toast.success("Отчёт сохранён");
    } catch (error) {
      toast.error("Ошибка при сохранении отчёта");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToExcel = async () => {
    if (calculationMethod === "mintrans") {
      await handleExportToExcelMintrans();
    } else {
      await handleExportToExcelSimple();
    }
  };

  const handleExportToPDF = async () => {
    await exportReportToPDF({
      month: reportMonth,
      year: reportYear,
      reportData: report,
      userName: session?.user?.name || "",
    });
  };

  const handleExportToExcelSimple = async () => {
    if (!report) return;

    try {
      const XLSX = await import("xlsx");

      // КРИТИЧНО: Используем СОХРАНЁННЫЕ данные из report, а не state
      const reportData = report;
      const entriesData = reportData.entries || [];
      const fuelPriceValue = reportData.fuelPrice || 55;

      // УПРОЩЁННЫЙ режим: фиксированная норма расхода
      const selectedFuelTypeValue = reportData.selectedFuelType || "АИ-92";
      const fixedConsumptionRate = selectedFuelTypeValue.includes("95") ?
      reportData.profile?.fuelConsumption95 || 0 :
      reportData.profile?.fuelConsumption92 || 0;

      const totalMileage = entriesData.reduce((sum: number, e: any) => sum + e.mileage, 0);
      const totalFuel = entriesData.reduce((sum: number, e: any) => sum + e.fuelUsed, 0);
      const totalCost = totalFuel * parseFloat(fuelPriceValue.toString());

      const userName = session?.user?.name || "___________";

      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
          const lastName = parts[0];
          const firstInitial = parts[1].charAt(0) + '.';
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : '';
          return `${lastName} ${firstInitial}${middleInitial}`;
        }
        return fullName;
      };

      const formattedName = formatUserName(userName);
      const monthValue = reportMonth; // Из state, но это сохраненное значение
      const yearValue = reportYear; // Из state, но это сохраненное значение

      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны");
        return;
      }

      const monthIndex = monthValue - 1;
      const monthName = MONTH_NAMES[monthIndex];

      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      let compilationMonth = monthValue;
      let compilationYear = yearValue;

      if (compilationMonth === 12) {
        compilationMonth = 1;
        compilationYear = yearValue + 1;
      } else {
        compilationMonth = monthValue + 1;
      }

      const compilationDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`;

      const headerFontSize = 14;
      const tableFontSize = 11;
      const showBorders = true;
      const tableFontFamily = REPORT_STYLES.fontFamily;
      const rowHeight = 25;
      const marginTop = 0.75;
      const marginBottom = 0.75;
      const marginLeft = 0.7;
      const marginRight = 0.7;

      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [];

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`;
      if (reportData.profile?.vehicleYear) {
        vehicleInfo += `, ${reportData.profile.vehicleYear} г.`;
      }
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`;
      }
      vehicleInfo += `, ${reportData.profile?.engineVolume || ""} см3, ${reportData.profile?.transmission || ""}`;

      if (reportData.profile?.vinNumber) {
        vehicleInfo += `\nVIN: ${reportData.profile.vinNumber}`;
      }

      let headerText = `ОТЧЕТ\nОб использовании личного автомобиля в служебных целях\nза ${monthName} ${yearValue} года\n${vehicleInfo}`;

      wsData.push([headerText]);
      wsData.push([""]);
      wsData.push([""]);
      wsData.push([""]);
      wsData.push([""]);

      wsData.push(["Дата", "Маршрут", "Пробег, км", "Норма, л/100км", "Расход, л"]);

      // УПРОЩЁННЫЙ режим: фиксированная норма для всех дней
      entriesData.forEach((entry: any) => {
        wsData.push([
        entry.date,
        entry.clients,
        entry.mileage,
        fixedConsumptionRate.toFixed(2),
        entry.fuelUsed]
        );
      });

      wsData.push([]);
      wsData.push(["ИТОГО:", "", totalMileage, "", totalFuel]);

      wsData.push([]);
      wsData.push([]);

      wsData.push(["", "", "Стоимость бензина:", parseFloat(fuelPriceValue.toString())]);
      wsData.push(["", "", "ВСЕГО:", totalCost.toFixed(2)]);

      wsData.push([]);

      const finalReportDate = reportDate || compilationDate;
      const finalEmployeeName = employeeName || formattedName;

      wsData.push([`Дата отчёта: ${finalReportDate}`, "", "", `Составитель _____________ ${finalEmployeeName}`]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Используем настройки из REPORT_STYLES
      const columnWidths = [...REPORT_STYLES.columnWidths];
      ws['!cols'] = columnWidths.map((w: number) => ({ wch: w }));

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const headerStartRow = 5;
      const dataStartRow = 6;
      const dataEndRow = 6 + entriesData.length - 1;
      const totalsStartRow = dataEndRow + 2;

      const thinBorder = showBorders ? {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      } : undefined;

      const headerFont = { name: REPORT_STYLES.fontFamily, sz: headerFontSize, bold: true, color: { rgb: "000000" } };
      const tableFontRegular = { name: tableFontFamily, sz: tableFontSize, color: { rgb: "000000" } };
      const tableFontBold = { name: tableFontFamily, sz: tableFontSize, bold: true, color: { rgb: "000000" } };
      const totalFont = { name: tableFontFamily, sz: tableFontSize + 1, bold: true, color: { rgb: "000000" } };

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' };
          if (!ws[cellAddress].s) ws[cellAddress].s = {};

          if (R === 0) {
            ws[cellAddress].s = {
              font: headerFont,
              alignment: { horizontal: "center", vertical: "center", wrapText: true }
            };
          } else
          if (R >= 1 && R <= 4) {
            ws[cellAddress].s = {
              font: { name: REPORT_STYLES.fontFamily, sz: headerFontSize, color: { rgb: "000000" } },
              alignment: { horizontal: "center", vertical: "center" }
            };
          } else
          if (R === headerStartRow) {
            ws[cellAddress].s = {
              font: tableFontBold,
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              fill: { fgColor: { rgb: "F2F2F2" } },
              border: thinBorder
            };
          } else
          if (R >= dataStartRow && R <= dataEndRow) {
            ws[cellAddress].s = {
              font: tableFontRegular,
              alignment: {
                horizontal: C === 1 ? "left" : "center",
                vertical: "top",
                wrapText: true
              },
              border: thinBorder
            };
          } else
          if (R >= totalsStartRow && R <= totalsStartRow + 2) {
            ws[cellAddress].s = {
              font: totalFont,
              alignment: { horizontal: "right", vertical: "center" },
              border: undefined
            };
          } else
          if (R === range.e.r) {
            ws[cellAddress].s = {
              font: tableFontRegular,
              alignment: { horizontal: "left", vertical: "center" }
            };
          }
        }
      }

      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 4, c: 4 } },
        { s: { r: range.e.r, c: 0 }, e: { r: range.e.r, c: 4 } }
      );

      if (!ws['!rows']) ws['!rows'] = [];
      for (let i = 0; i <= 4; i++) {
        ws['!rows'][i] = { hpt: 20 };
      }

      for (let i = dataStartRow; i <= dataEndRow; i++) {
        ws['!rows'][i] = { hpt: rowHeight };
      }

      ws['!margins'] = {
        left: REPORT_STYLES.marginLeft,
        right: REPORT_STYLES.marginRight,
        top: REPORT_STYLES.marginTop,
        bottom: REPORT_STYLES.marginBottom,
        header: 0.3,
        footer: 0.3
      };

      // Применяем настройки автомасштабирования из REPORT_STYLES
      if (!ws['!pageSetup']) ws['!pageSetup'] = {};
      ws['!pageSetup'].orientation = REPORT_STYLES.excelPageSetup.orientation;
      ws['!pageSetup'].fitToWidth = REPORT_STYLES.excelPageSetup.fitToWidth;
      ws['!pageSetup'].fitToHeight = REPORT_STYLES.excelPageSetup.fitToHeight;
      ws['!pageSetup'].paperSize = REPORT_STYLES.excelPageSetup.paperSize;
      ws['!pageSetup'].scale = REPORT_STYLES.excelPageSetup.scale;

      XLSX.utils.book_append_sheet(wb, ws, "Отчёт");

      XLSX.writeFile(wb, `Отчёт по бензину_${finalEmployeeName}_${monthName}_${yearValue}.xlsx`);
      toast.success("Отчёт экспортирован в Excel");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Ошибка экспорта в Excel");
    }
  };

  const handleExportToPDFSimple = async () => {
    if (!report) return;

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      // КРИТИЧНО: Используем СОХРАНЁННЫЕ данные из report, а не state
      const reportData = report;
      const entriesData = reportData.entries || [];
      const fuelPriceValue = reportData.fuelPrice || 55;

      // УПРОЩЁННЫЙ режим: фиксированная норма расхода
      const selectedFuelTypeValue = reportData.selectedFuelType || "АИ-92";
      const fixedConsumptionRate = selectedFuelTypeValue.includes("95") ?
      reportData.profile?.fuelConsumption95 || 0 :
      reportData.profile?.fuelConsumption92 || 0;

      const totalMileage = entriesData.reduce((sum: number, e: any) => sum + e.mileage, 0);
      const totalFuel = entriesData.reduce((sum: number, e: any) => sum + e.fuelUsed, 0);
      const totalCost = totalFuel * parseFloat(fuelPriceValue.toString());

      const userName = session?.user?.name || "___________";

      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
          const lastName = parts[0];
          const firstInitial = parts[1].charAt(0) + '.';
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : '';
          return `${lastName} ${firstInitial}${middleInitial}`;
        }
        return fullName;
      };

      const formattedName = formatUserName(userName);
      const monthValue = reportMonth; // Из state, но это сохраненное значение
      const yearValue = reportYear; // Из state, но это сохраненное значение

      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны");
        return;
      }

      const monthIndex = monthValue - 1;
      const monthName = MONTH_NAMES[monthIndex];

      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      let compilationMonth = monthValue;
      let compilationYear = yearValue;

      if (compilationMonth === 12) {
        compilationMonth = 1;
        compilationYear = yearValue + 1;
      } else {
        compilationMonth = monthValue + 1;
      }

      const compilationDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`;

      const finalReportDate = reportData.reportDate || compilationDate;
      const finalEmployeeName = reportData.employeeName || formattedName;

      // Используем настройки из REPORT_STYLES
      const headerFontSize = REPORT_STYLES.textFontSize;
      const tableFontSize = REPORT_STYLES.tableFontSize;
      const tableFontFamily = REPORT_STYLES.fontFamily;

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`;
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`;
      }

      // Эвристика: если строк слишком много, целиком переносим блок «Итого + Подписи» на новую страницу,
      // чтобы на второй странице не остались только дата/подпись. С учётом масштаба >= 75%.
      const FORCE_BREAK_THRESHOLD = 17; // в ландшафт A4 при наших полях ~17 строк
      const forceBreakBeforeSummary = entriesData.length >= FORCE_BREAK_THRESHOLD;

      const tableRowsHTML = entriesData.map((entry: any) => `
                <tr>
                  <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                  <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                  <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.mileage.toFixed(1)}</td>
                  <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${fixedConsumptionRate.toFixed(2)}</td>
                  <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.fuelUsed.toFixed(1)}</td>
                </tr>
              `).join('');

      const totalsRowHTML = `
              <tr style="font-weight: bold; background-color: ${REPORT_STYLES.backgroundColor};">
                <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">ИТОГО:</td>
                <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalMileage.toFixed(1)}</td>
                <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalFuel.toFixed(1)}</td>
              </tr>`;

      const summaryBlockHTML = `
          <div style="${forceBreakBeforeSummary ? 'page-break-before: always;' : ''} page-break-inside: avoid; break-inside: avoid;">
            <div style="margin: 10px 0; font-size: ${tableFontSize}px; text-align: right;">
              <p style="margin: 3px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPriceValue.toString()).toFixed(2)} ₽/л</p>
              <p style="margin: 3px 0; font-size: ${tableFontSize + 1}px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
            </div>
            <div style="margin-top: 12px; font-size: ${tableFontSize}px; display: flex; justify-content: space-between;">
              <div>Дата отчёта: ${finalReportDate}</div>
              <div>Составитель _____________ ${finalEmployeeName}</div>
            </div>
          </div>`;

      const htmlContent = `
        <div style="font-family: ${tableFontFamily}, serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0;">
          <!-- Заголовок по ГОСТ -->
          <div style="text-align: center; margin-bottom: 15px;">
            <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 8px 0;">ОТЧЕТ</h1>
            <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 4px 0;">об использовании личного автомобиля в служебных целях</p>
            <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 4px 0;">за ${monthName} ${yearValue} года</p>
            <p style="font-size: ${REPORT_STYLES.vehicleInfoFontSize}px; margin: ${REPORT_STYLES.vehicleInfoMarginTop} 0 0 0;">${vehicleInfo}</p>
          </div>
          <!-- Основная таблица -->
          <table style="width: 100%; border-collapse: collapse; font-size: ${tableFontSize}px; margin: 10px 0;">
            <thead>
              <tr style="font-weight: bold; background-color: ${REPORT_STYLES.backgroundColor};">
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%">Дата</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%">Маршрут</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%">Пробег,<br/>км</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%">Норма,<br/>л/100км</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%">Расход,<br/>л</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHTML}
              ${forceBreakBeforeSummary ? '' : totalsRowHTML}
            </tbody>
          </table>
          ${forceBreakBeforeSummary ? summaryBlockHTML.replace('<div style="', '<div style="') : summaryBlockHTML}
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = htmlContent;

      const opt = {
        margin: [
        REPORT_STYLES.marginTop * 25.4,
        REPORT_STYLES.marginLeft * 25.4,
        REPORT_STYLES.marginBottom * 25.4,
        REPORT_STYLES.marginRight * 25.4],

        filename: `Отчёт_${finalEmployeeName}_${monthName}_${yearValue}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: REPORT_STYLES.pdfScale, useCORS: true },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'landscape',
          putOnlyUsedFonts: true,
          compress: true
        }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("Отчёт экспортирован в PDF");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Ошибка экспорта в PDF");
    }
  };

  const handleExportToExcelMintrans = async () => {
    if (!report) return;

    try {
      const XLSX = await import("xlsx");

      // КРИТИЧНО: Используем СОХРАНЁННЫЕ данные из report, а не state
      const reportData = report;
      const entriesData = reportData.entries || [];
      const fuelPriceValue = reportData.fuelPrice || 55;
      const mintransCoeffs = reportData.mintransCoefficients;
      const dailyBreakdown = reportData.dailyBreakdown || [];

      const totalMileage = entriesData.reduce((sum: number, e: any) => sum + e.mileage, 0);
      const totalFuel = entriesData.reduce((sum: number, e: any) => sum + e.fuelUsed, 0);
      const totalCost = totalFuel * parseFloat(fuelPriceValue.toString());

      const userName = session?.user?.name || "___________";

      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
          const lastName = parts[0];
          const firstInitial = parts[1].charAt(0) + '.';
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : '';
          return `${lastName} ${firstInitial}${middleInitial}`;
        }
        return fullName;
      };

      const formattedName = formatUserName(userName);
      const monthValue = reportMonth;
      const yearValue = reportYear;

      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны");
        return;
      }

      const monthIndex = monthValue - 1;
      const monthName = MONTH_NAMES[monthIndex];

      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      let compilationMonth = monthValue;
      let compilationYear = yearValue;

      if (compilationMonth === 12) {
        compilationMonth = 1;
        compilationYear = yearValue + 1;
      } else {
        compilationMonth = monthValue + 1;
      }

      const compilationDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`;

      // Используем настройки из REPORT_STYLES
      const columnWidths = [...REPORT_STYLES.columnWidths];
      const headerFontSize = 14;
      const tableFontSize = 11;
      const showBorders = true;
      const tableFontFamily = REPORT_STYLES.fontFamily;
      const rowHeight = 25;
      const marginTop = REPORT_STYLES.marginTop;
      const marginBottom = REPORT_STYLES.marginBottom;
      const marginLeft = REPORT_STYLES.marginLeft;
      const marginRight = REPORT_STYLES.marginRight;

      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [];

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`;
      if (reportData.profile?.vehicleYear) {
        vehicleInfo += `, ${reportData.profile.vehicleYear} г.`;
      }
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`;
      }
      vehicleInfo += `, ${reportData.profile?.engineVolume || ""} см3, ${reportData.profile?.transmission || ""}`;

      if (reportData.profile?.vinNumber) {
        vehicleInfo += `\nVIN: ${reportData.profile.vinNumber}`;
      }

      let headerText = `ОТЧЕТ\nОб использовании личного автомобиля в служебных целях\nза ${monthName} ${yearValue} года\n${vehicleInfo}`;

      wsData.push([headerText]);
      wsData.push([""]);
      wsData.push([""]);
      wsData.push([""]);
      wsData.push([""]);

      wsData.push(["Дата", "Маршрут", "Пробег, км", "Норма, л/100км", "Расход, л"]);

      // РАСШИРЕННЫЙ режим: индивидуальная норма для каждого дня
      entriesData.forEach((entry: any) => {
        const individualRate = entry.mileage > 0 ? entry.fuelUsed / entry.mileage * 100 : 0;
        wsData.push([
        entry.date,
        entry.clients,
        entry.mileage,
        individualRate.toFixed(2),
        entry.fuelUsed]
        );
      });

      wsData.push([]);
      wsData.push(["ИТОГО:", "", totalMileage, "", totalFuel]);

      wsData.push([]);
      wsData.push([]);

      wsData.push(["", "", "Стоимость бензина:", parseFloat(fuelPriceValue.toString())]);
      wsData.push(["", "", "ВСЕГО:", totalCost.toFixed(2)]);

      wsData.push([]);

      const finalReportDate = reportData.reportDate || compilationDate;
      const finalEmployeeName = reportData.employeeName || formattedName;

      wsData.push([`Дата отчёта: ${finalReportDate}`, "", "", `Составитель _____________ ${finalEmployeeName}`]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = columnWidths.map((w: number) => ({ wch: w }));

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const headerStartRow = 5;
      const dataStartRow = 6;
      const dataEndRow = 6 + entriesData.length - 1;
      const totalsStartRow = dataEndRow + 2;

      const thinBorder = showBorders ? {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      } : undefined;

      const headerFont = { name: REPORT_STYLES.fontFamily, sz: headerFontSize, bold: true, color: { rgb: "000000" } };
      const tableFontRegular = { name: tableFontFamily, sz: tableFontSize, color: { rgb: "000000" } };
      const tableFontBold = { name: tableFontFamily, sz: tableFontSize, bold: true, color: { rgb: "000000" } };
      const totalFont = { name: tableFontFamily, sz: tableFontSize + 1, bold: true, color: { rgb: "000000" } };

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' };
          if (!ws[cellAddress].s) ws[cellAddress].s = {};

          if (R === 0) {
            ws[cellAddress].s = {
              font: headerFont,
              alignment: { horizontal: "center", vertical: "center", wrapText: true }
            };
          } else
          if (R >= 1 && R <= 4) {
            ws[cellAddress].s = {
              font: { name: REPORT_STYLES.fontFamily, sz: headerFontSize, color: { rgb: "000000" } },
              alignment: { horizontal: "center", vertical: "center" }
            };
          } else
          if (R === headerStartRow) {
            ws[cellAddress].s = {
              font: tableFontBold,
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              fill: { fgColor: { rgb: "F2F2F2" } },
              border: thinBorder
            };
          } else
          if (R >= dataStartRow && R <= dataEndRow) {
            ws[cellAddress].s = {
              font: tableFontRegular,
              alignment: {
                horizontal: C === 1 ? "left" : "center",
                vertical: "top",
                wrapText: true
              },
              border: thinBorder
            };
          } else
          if (R >= totalsStartRow && R <= totalsStartRow + 2) {
            ws[cellAddress].s = {
              font: totalFont,
              alignment: { horizontal: "right", vertical: "center" },
              border: undefined
            };
          } else
          if (R === range.e.r) {
            ws[cellAddress].s = {
              font: tableFontRegular,
              alignment: { horizontal: "left", vertical: "center" }
            };
          }
        }
      }

      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 4, c: 4 } },
        { s: { r: range.e.r - (dailyBreakdown.length > 0 ? dailyBreakdown.length + 15 : 0), c: 0 }, e: { r: range.e.r - (dailyBreakdown.length > 0 ? dailyBreakdown.length + 15 : 0), c: 4 } }
      );

      if (!ws['!rows']) ws['!rows'] = [];
      for (let i = 0; i <= 4; i++) {
        ws['!rows'][i] = { hpt: 20 };
      }

      for (let i = dataStartRow; i <= dataEndRow; i++) {
        ws['!rows'][i] = { hpt: rowHeight };
      }

      ws['!margins'] = {
        left: REPORT_STYLES.marginLeft,
        right: REPORT_STYLES.marginRight,
        top: REPORT_STYLES.marginTop,
        bottom: REPORT_STYLES.marginBottom,
        header: 0.3,
        footer: 0.3
      };

      // Применяем настройки автомасштабирования из REPORT_STYLES
      if (!ws['!pageSetup']) ws['!pageSetup'] = {};
      ws['!pageSetup'].orientation = REPORT_STYLES.excelPageSetup.orientation;
      ws['!pageSetup'].fitToWidth = REPORT_STYLES.excelPageSetup.fitToWidth;
      ws['!pageSetup'].fitToHeight = REPORT_STYLES.excelPageSetup.fitToHeight;
      ws['!pageSetup'].paperSize = REPORT_STYLES.excelPageSetup.paperSize;
      ws['!pageSetup'].scale = REPORT_STYLES.excelPageSetup.scale;

      XLSX.utils.book_append_sheet(wb, ws, "Отчёт");
      XLSX.writeFile(wb, `Отчёт по бензину_${finalEmployeeName}_${monthName}_${yearValue}.xlsx`);
      toast.success("Отчёт экспортирован в Excel");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Ошибка экспорта в Excel");
    }
  };

  const handleExportToPDFMintrans = async () => {
    if (!report) return;

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      // КРИТИЧНО: Используем СОХРАНЁННЫЕ данные из report, а не state
      const reportData = report;
      const entriesData = reportData.entries || [];
      const fuelPriceValue = reportData.fuelPrice || 55;
      const mintransCoeffs = reportData.mintransCoefficients;
      const dailyBreakdown = reportData.dailyBreakdown || [];

      const totalMileage = entriesData.reduce((sum: number, e: any) => sum + e.mileage, 0);
      const totalFuel = entriesData.reduce((sum: number, e: any) => sum + e.fuelUsed, 0);
      const totalCost = totalFuel * parseFloat(fuelPriceValue.toString());

      const userName = session?.user?.name || "___________";

      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
          const lastName = parts[0];
          const firstInitial = parts[1].charAt(0) + '.';
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : '';
          return `${lastName} ${firstInitial}${middleInitial}`;
        }
        return fullName;
      };

      const formattedName = formatUserName(userName);
      const monthValue = reportMonth;
      const yearValue = reportYear;

      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны");
        return;
      }

      const monthIndex = monthValue - 1;
      const monthName = MONTH_NAMES[monthIndex];

      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      let compilationMonth = monthValue;
      let compilationYear = yearValue;

      if (compilationMonth === 12) {
        compilationMonth = 1;
        compilationYear = yearValue + 1;
      } else {
        compilationMonth = monthValue + 1;
      }

      const compilationDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`;

      const finalReportDate = reportData.reportDate || compilationDate;
      const finalEmployeeName = reportData.employeeName || formattedName;

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`;
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`;
      }

      // ЛИСТ 1: Основная таблица отчёта
      const mainReportHTML = `
        <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 8px 0;">ОТЧЕТ</h1>
            <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 4px 0;">об использовании личного автомобиля в служебных целях</p>
            <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 4px 0;">за ${monthName} ${yearValue} года</p>
            <p style="font-size: ${REPORT_STYLES.vehicleInfoFontSize}px; margin: ${REPORT_STYLES.vehicleInfoMarginTop} 0 0 0;">${vehicleInfo}</p>
          </div>
          
          <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
            <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
              <thead>
                <tr>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%">Дата</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%">Маршрут</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%">Пробег,<br/>км</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%">Норма,<br/>л/100км</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%">Расход,<br/>л</th>
                </tr>
              </thead>
              <tbody>
                ${entriesData.map((entry: any) => {
        const individualRate = entry.mileage > 0 ? entry.fuelUsed / entry.mileage * 100 : 0;
        return `
                    <tr>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.mileage.toFixed(1)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${individualRate.toFixed(2)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.fuelUsed.toFixed(1)}</td>
                    </tr>
                  `;
      }).join('')}
                <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                  <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">ИТОГО:</td>
                  <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalMileage.toFixed(1)}</td>
                  <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                  <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalFuel.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Итоги + Подписи (держим вместе) -->
          <div style="page-break-inside: avoid; break-inside: avoid; page-break-before: avoid;">
            <div style="margin: ${REPORT_STYLES.summaryMargin}; font-size: ${REPORT_STYLES.summaryFontSize}px; text-align: right;">
              <p style="margin: ${REPORT_STYLES.summaryItemMargin};"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
              <p style="margin: ${REPORT_STYLES.summaryItemMargin}; font-size: ${REPORT_STYLES.summaryFontSize + 1}px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
            </div>
            <div style="margin-top: 12px; padding-bottom: ${REPORT_STYLES.signaturePaddingBottom}; font-size: ${REPORT_STYLES.signatureFontSize}px; display: flex; justify-content: space-between;">
              <div>Дата отчёта: ${finalReportDate}</div>
              <div>Составитель _____________ ${finalEmployeeName}</div>
            </div>
          </div>
        </div>
      `;

      // ЛИСТ 2: ОБОСНОВАНИЕ С МУЛЬТИПЛИКАТИВНОЙ ФОРМУЛОЙ
      let justificationAndTableHTML = "";
      if (mintransCoeffs) {
        const Hbase = mintransCoeffs.baseConsumption;

        // Формируем компактную таблицу расчетов
        let calcTableRows = "";
        if (dailyBreakdown && dailyBreakdown.length > 0) {
          calcTableRows = dailyBreakdown.map((day: any) => {
            const ageCoeff = day.coefficients?.vehicleAge || 1.0;
            const modeCoeff = day.coefficients?.drivingMode || 1.15;
            const tempCoeff = day.coefficients?.temperature || 1.0;
            const terrainCoeff = day.coefficients?.terrain || 1.0;
            const roadCoeff = day.coefficients?.roadCondition || 1.0;

            const modeLabel = day.drivingMode === "city" ? "Город" : day.drivingMode === "highway" ? "Трасса" : "Смеш.";
            const terrainLabel = day.terrainType === "plain" ? "Равн." : day.terrainType === "hilly" ? "Холм." : "Горы";
            const roadLabel = day.roadQuality === "good" ? "Хор." : day.roadQuality === "fair" ? "Уд." : "Плох.";

            const formula = `${Hbase}×${ageCoeff}×${modeCoeff}×${tempCoeff.toFixed(2)}×${terrainCoeff}×${roadCoeff}×${day.mileage || 0}`;

            return `
              <tr>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${day.date}</td>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${day.temperature > 0 ? '+' : ''}${day.temperature}</td>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${modeLabel}</td>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${ageCoeff}</td>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${terrainLabel}</td>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${roadLabel}</td>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize - 1}pt; font-family: 'Courier New', monospace; word-wrap: break-word;">0.01×${formula}</td>
                <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; font-weight: bold;">${day.fuelUsed?.toFixed(2) || 0}</td>
              </tr>
            `;
          }).join('');
        }

        justificationAndTableHTML = `
          <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; page-break-before: always;">
            <h2 style="font-size: ${REPORT_STYLES.justificationTitleFontSize}pt; font-weight: bold; text-align: center; margin: 0 0 3px 0; border-bottom: 1.5pt solid #000; padding-bottom: 2px;">
              ОБОСНОВАНИЕ РАСЧЕТА
            </h2>
            <p style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt; text-align: center; margin: 2px 0 6px 0; font-style: italic;">
              Распоряжение Минтранса России от 14.03.2008 N АМ-23-р (ред. от 30.09.2021)
            </p>
            
            <div style="border: 1pt solid #000; padding: 4px; margin: 4px 0; background: #f5f5f5;">
              <p style="font-size: ${REPORT_STYLES.justificationLabelFontSize}pt; font-weight: bold; margin: 0 0 2px 0;">ФОРМУЛА:</p>
              <div style="padding: 3px; font-family: 'Courier New', monospace; font-size: ${REPORT_STYLES.justificationFormulaFontSize}pt; text-align: center; font-weight: bold; line-height: 1.5;">
                Q = 0.01 × H<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">base</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">возраст</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">режим</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">темп</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">местн</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">дороги</sub> × S
              </div>
              <p style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt; margin: 2px 0 0 0; text-align: center; color: #0066cc;">
                Все коэффициенты применяются индивидуально для каждого дня и ПЕРЕМНОЖАЮТСЯ
              </p>
            </div>
            
            <div style="display: flex; gap: 4px; margin: 4px 0;">
              <div style="flex: 1; border: 1pt solid #000; padding: 4px;">
                <p style="font-size: ${REPORT_STYLES.justificationLabelFontSize}pt; font-weight: bold; margin: 0 0 2px 0;">БАЗОВЫЕ:</p>
                <div style="font-size: ${REPORT_STYLES.justificationTextFontSize}pt; line-height: 1.4;">
                  <p style="margin: 1px 0; line-height: 1.4;"><strong>H<sub style="font-size: 6pt;">base</sub>:</strong> ${Hbase} л/100км</p>
                </div>
              </div>
              
              <div style="flex: 2; border: 1pt solid #000; padding: 4px;">
                <p style="font-size: ${REPORT_STYLES.justificationLabelFontSize}pt; font-weight: bold; margin: 0 0 2px 0;">ИНДИВИДУАЛЬНЫЕ КОЭФФИЦИЕНТЫ ДНЯ:</p>
                <div style="font-size: ${REPORT_STYLES.justificationTextFontSize}pt; line-height: 1.4;">
                  <p style="margin: 1px 0; line-height: 1.4;"><strong>K<sub style="font-size: 6pt;">возр</sub>:</strong> 1.0 (&lt;5л) • 1.05 (≥5л)</p>
                  <p style="margin: 1px 0; line-height: 1.4;"><strong>K<sub style="font-size: 6pt;">реж</sub>:</strong> город 1.15 • трасса 1.0 • смеш. 1.075</p>
                  <p style="margin: 1px 0; line-height: 1.4;"><strong>K<sub style="font-size: 6pt;">темп</sub>:</strong> 1.03-1.18 (+ прогрев 5% при t&lt;0°C)</p>
                  <p style="margin: 1px 0; line-height: 1.4;"><strong>K<sub style="font-size: 6pt;">мест</sub>:</strong> равн. 1.0 • холмы 1.05 • горы 1.10</p>
                  <p style="margin: 1px 0; line-height: 1.4;"><strong>K<sub style="font-size: 6pt;">дор</sub>:</strong> хор. 1.0 • удовл. 1.05 • плох. 1.10</p>
                </div>
              </div>
            </div>
            
            ${calcTableRows ? `
            <div style="margin: 4px 0;">
              <table style="width: 100%; border-collapse: collapse; border: 1pt solid #000; margin: 2px 0;">
                <thead>
                  <tr style="background: #f0f0f0;">
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">Дата</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">T°C</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">Режим</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">K<sub style="font-size: ${REPORT_STYLES.tableFontSize - 2}pt;">возр</sub></th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">Местн.</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">Дор.</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">Расчет</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.4;">л</th>
                  </tr>
                </thead>
                <tbody>
                  ${calcTableRows}
                  <tr style="background: #f0f0f0; font-weight: bold;">
                    <td colspan="6" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">ИТОГО:</td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; vertical-align: middle; border: 0.5pt solid #000;"></td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${totalFuel.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ` : ''}
          </div>
        `;
      }

      const htmlContent = mainReportHTML + justificationAndTableHTML;

      const element = document.createElement('div');
      element.innerHTML = htmlContent;

      const opt = {
        margin: [
        REPORT_STYLES.marginTop * 25.4,
        REPORT_STYLES.marginLeft * 25.4,
        REPORT_STYLES.marginBottom * 25.4,
        REPORT_STYLES.marginRight * 25.4],

        filename: `Отчёт_${finalEmployeeName}_${monthName}_${yearValue}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: REPORT_STYLES.pdfScale, useCORS: true },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'landscape',
          putOnlyUsedFonts: true,
          compress: true
        }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("Отчёт экспортирован в PDF");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Ошибка экспорта в PDF");
    }
  };

  // Обработка состояний загрузки и ошибок
  if (isPending || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка отчёта...</p>
        </div>
      </div>);

  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-50 to-slate-50">
        <Card className="max-w-md w-full border border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-destructive">Ошибка загрузки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">{loadError}</p>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              <ArrowLeft className="w-4 h-4" />
              Вернуться к списку
            </Button>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="min-h-screen bg-slate-50 py-2 md:py-4">
      <div className="container max-w-6xl mx-auto px-2 sm:px-4">
        {/* Заголовок и действия */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 p-2 md:p-3 bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link href="/dashboard">
              <Button variant="outline" size="icon" className="hover:bg-slate-50 shrink-0 h-8 w-8 md:h-9 md:w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-lg font-bold text-slate-900 truncate">Редактор отчёта</h1>
              <p className="text-xs md:text-sm text-slate-600 truncate">
                {MONTH_NAMES[(reportMonth || 1) - 1]} {reportYear}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button
              onClick={handleExportToExcel}
              variant="outline"
              size="sm"
              className="text-green-700 border-green-200 hover:bg-green-50 flex-1 sm:flex-initial h-8 md:h-9 text-xs md:text-sm px-2 md:px-3">
              <FileSpreadsheet className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              onClick={handleExportToPDF}
              variant="outline"
              size="sm"
              className="text-red-700 border-red-200 hover:bg-red-50 flex-1 sm:flex-initial h-8 md:h-9 text-xs md:text-sm px-2 md:px-3">
              <FileText className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
              className="flex-1 sm:flex-initial h-8 md:h-9 text-xs md:text-sm px-2 md:px-3">
              <Save className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{isSaving ? "Сохранение..." : "Сохранить"}</span>
            </Button>
          </div>
        </div>

        {hasUnsavedChanges && (
          <div className="mb-2 md:mb-3 p-2 md:p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs md:text-sm text-yellow-800">
            ⚠️ У вас есть несохранённые изменения
          </div>
        )}

        {/* Итоги по отчёту (перемещено выше настроек) */}
        <Card className="mb-3 md:mb-4 border border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-2 px-3 md:py-2 md:px-4">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-emerald-100 rounded">
                <Check className="w-4 h-4 text-emerald-700" />
              </div>
              <CardTitle className="text-sm md:text-base text-slate-900">Итого</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-3 md:py-3 md:px-4">
            {(() => {
              const totalMileage = entries.reduce((s, e) => s + (e.mileage || 0), 0);
              const totalFuel = entries.reduce((s, e) => s + (e.fuelUsed || 0), 0);
              const price = parseFloat(fuelPrice || "0") || 0;
              const totalCost = totalFuel * price;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 text-sm">
                  <div className="rounded border border-slate-200 bg-white p-2">
                    <div className="text-xs text-slate-500">Пробег всего</div>
                    <div className="font-semibold text-slate-900">{totalMileage.toFixed(1)} км</div>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2">
                    <div className="text-xs text-slate-500">Расход всего</div>
                    <div className="font-semibold text-slate-900">{totalFuel.toFixed(1)} л</div>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2">
                    <div className="text-xs text-slate-500">Сумма к возмещению</div>
                    <div className="font-semibold text-slate-900">{totalCost.toFixed(2)} ₽</div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Настройки отчёта - КРИТИЧНО: Компактная desktop версия */}
        <Card className="mb-3 md:mb-4 border shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 py-2 px-3 md:py-1.5 md:px-4">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/10 rounded">
                <Settings className="w-4 h-4 md:w-4 md:h-4 text-primary shrink-0" />
              </div>
              <CardTitle className="text-sm md:text-sm text-slate-900">Настройки отчёта</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-1.5 pt-2 p-2 md:pt-1.5 md:p-3 md:max-h-[420px] overflow-auto">
            {/* Параметры топлива */}
            <div className="space-y-1.5 md:space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="p-0.5 bg-green-100 rounded">
                  <Fuel className="w-3 h-3 md:w-3.5 md:h-3.5 text-green-600" />
                </div>
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">Параметры топлива</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-2">
                <div>
                  <Label className="text-xs md:text-sm font-medium mb-0.5 flex items-center gap-1">
                    <Fuel className="w-3 h-3 md:w-3.5 md:h-3.5 text-green-600 shrink-0" />
                    <span>Вид топлива</span>
                  </Label>
                  <Select
                    value={selectedFuelType}
                    onValueChange={handleFuelTypeChange}
                    disabled={isLoadingFuelPrice}>
                    <SelectTrigger className="bg-white h-8 md:h-8 border-green-200 focus:border-green-500 text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="АИ-92">АИ-92</SelectItem>
                      <SelectItem value="АИ-95">АИ-95</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs md:text-sm font-medium mb-0.5 flex items-center gap-1">
                    <Gauge className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600 shrink-0" />
                    <span>Норма (л/100км)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={currentFuelConsumption || ""}
                    disabled
                    className="bg-slate-50 border-slate-200 h-8 md:h-8 text-xs md:text-sm" />
                </div>

                <div>
                  <Label className="text-xs md:text-sm font-medium mb-0.5 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-600 shrink-0" />
                    <span>Цена (₽/л)</span>
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={fuelPrice}
                      onChange={(e) => {
                        setFuelPrice(e.target.value);
                        setFuelPriceSource("manual");
                        setHasUnsavedChanges(true);
                      }}
                      className={`bg-white h-8 md:h-8 focus:border-amber-500 text-xs md:text-sm ${
                        fuelPriceSource === "russiabase" 
                          ? "border-green-500" 
                          : "border-amber-200"
                      }`} />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => loadFuelPrices(selectedFuelType)}
                      disabled={isLoadingFuelPrice}
                      className="shrink-0 h-8 w-8 md:h-8 md:w-8 border-amber-200 hover:bg-amber-50">
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isLoadingFuelPrice ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  {fuelPriceSource === "russiabase" && (
                    <p className="text-xs md:text-xs text-green-600 mt-0.5 flex items-center gap-1">
                      <Check className="w-3 h-3 md:w-3 md:h-3" />
                      Актуальная
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Параметры расчёта */}
            <div className="space-y-1.5 md:space-y-1 pt-2 md:pt-1.5 border-t border-slate-200">
              <div className="flex items-center gap-1.5">
                <div className="p-0.5 bg-purple-100 rounded">
                  <Shuffle className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-600" />
                </div>
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">Параметры расчёта</h3>
              </div>
              
              <div>
                <Label className="text-xs md:text-sm font-medium mb-0.5 flex items-center gap-1">
                  <Shuffle className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-600 shrink-0" />
                  <span>Отклонение пробега (%)</span>
                </Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="1"
                    value={deviationPercent}
                    onChange={(e) => {
                      setDeviationPercent(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="0"
                    className="bg-white h-8 md:h-8 border-purple-200 focus:border-purple-500 text-xs md:text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRegenerateDeviations}
                    disabled={!deviationPercent || parseFloat(deviationPercent) === 0}
                    className="shrink-0 h-8 w-8 md:h-8 md:w-8 border-purple-200 hover:bg-purple-50">
                    <Shuffle className="w-3.5 h-3.5 text-purple-600" />
                  </Button>
                </div>
                <p className="text-xs md:text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 md:w-3 md:h-3" />
                  Случайное отклонение для каждого дня
                </p>
              </div>
            </div>

            {/* Информация о документе */}
            <div className="space-y-1.5 md:space-y-1 pt-2 md:pt-1.5 border-t border-slate-200">
              <div className="flex items-center gap-1.5">
                <div className="p-0.5 bg-slate-100 rounded">
                  <FileText className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-600" />
                </div>
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">Информация о документе</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-2">
                <div>
                  <Label className="text-xs md:text-sm font-medium mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500 shrink-0" />
                    <span>Дата составления</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="ДД.ММ.ГГГГ"
                    value={reportDate}
                    onChange={(e) => {
                      setReportDate(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="bg-white h-8 md:h-8 border-slate-300 text-xs md:text-sm" />
                </div>

                <div>
                  <Label className="text-xs md:text-sm font-medium mb-0.5 flex items-center gap-1">
                    <FileText className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500 shrink-0" />
                    <span>Составитель</span>
                  </Label>
                  <Input
                    type="text"
                    value={employeeName}
                    onChange={(e) => {
                      setEmployeeName(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Фамилия И.О."
                    className="bg-white h-8 md:h-8 border-slate-300 text-xs md:text-sm" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Записи о поездках */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-slate-50 p-3 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 md:w-5 md:h-5 text-slate-700 shrink-0" />
                <CardTitle className="text-sm md:text-base text-slate-900">Записи о поездках</CardTitle>
              </div>
              <Button onClick={handleAddEntry} size="sm" className="gap-1.5 w-full sm:w-auto h-8 md:h-9 text-xs md:text-sm">
                <Plus className="w-4 h-4" />
                Добавить запись
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
            <div className="space-y-3 md:space-y-4">
              {entries.map((entry, index) => (
                <div
                  key={index}
                  className={`p-3 md:p-4 rounded border-2 bg-white ${
                    entry.isNew 
                      ? 'border-amber-300 bg-amber-50/30' 
                      : 'border-slate-200'
                  }`}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3">
                    <div>
                      <Label className="text-xs md:text-sm font-bold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                        <span className="truncate">Дата</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="ДД.ММ.ГГГГ"
                        value={entry.date}
                        onChange={(e) => handleEntryChange(index, "date", e.target.value)}
                        disabled={!entry.isNew}
                        className="text-xs md:text-sm font-bold text-slate-900 h-9 md:h-10" />
                    </div>

                    <div>
                      <Label className="text-xs md:text-sm font-bold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                        <span className="truncate">День</span>
                      </Label>
                      <Input
                        type="text"
                        value={DAY_NAMES[entry.dayOfWeek === 7 ? 0 : entry.dayOfWeek]}
                        disabled
                        className="bg-slate-50 font-bold text-slate-900 text-xs md:text-sm h-9 md:h-10" />
                    </div>

                    <div>
                      <Label className="text-xs md:text-sm font-medium mb-1 flex items-center gap-1">
                        <Navigation className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                        <span className="truncate">Пробег</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={entry.mileage}
                        onChange={(e) => handleEntryChange(index, "mileage", parseFloat(e.target.value) || 0)}
                        className="text-xs md:text-sm h-9 md:h-10" />
                    </div>

                    <div>
                      <Label className="text-xs md:text-sm font-medium mb-1 flex items-center gap-1">
                        <Fuel className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                        <span className="truncate">Расход</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={entry.fuelUsed}
                        disabled
                        className="bg-slate-50 text-xs md:text-sm h-9 md:h-10" />
                    </div>
                  </div>

                  {calculationMethod === "mintrans" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3 mb-3 p-2 md:p-3 rounded bg-blue-50 border border-blue-200">
                      <div>
                        <Label className="text-xs md:text-sm font-medium mb-1">Режим движения</Label>
                        <Select
                          value={entry.drivingMode || "city"}
                          onValueChange={(value) => handleEntryChange(index, "drivingMode", value)}>
                          <SelectTrigger className="bg-white text-xs md:text-sm h-9 md:h-10 border-blue-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="city">Город</SelectItem>
                            <SelectItem value="highway">Трасса</SelectItem>
                            <SelectItem value="mixed">Смешанный</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs md:text-sm font-medium mb-1">Качество дорог</Label>
                        <Select
                          value={entry.roadQuality || "fair"}
                          onValueChange={(value) => handleEntryChange(index, "roadQuality", value)}>
                          <SelectTrigger className="bg-white text-xs md:text-sm h-9 md:h-10 border-blue-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Хорошее</SelectItem>
                            <SelectItem value="fair">Удовлетворительное</SelectItem>
                            <SelectItem value="poor">Плохое</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs md:text-sm font-medium mb-1">Тип местности</Label>
                        <Select
                          value={entry.terrainType || "plain"}
                          onValueChange={(value) => handleEntryChange(index, "terrainType", value)}>
                          <SelectTrigger className="bg-white text-xs md:text-sm h-9 md:h-10 border-blue-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plain">Равнина</SelectItem>
                            <SelectItem value="hilly">Холмистая</SelectItem>
                            <SelectItem value="mountain">Горная</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <Label className="text-xs md:text-sm font-medium mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                      <span>Маршрут (клиенты)</span>
                    </Label>
                    <Textarea
                      value={entry.clients}
                      onChange={(e) => handleEntryChange(index, "clients", e.target.value)}
                      placeholder="Введите список клиентов или маршрут..."
                      rows={2}
                      className="text-xs md:text-sm" />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
                    {entry.isNew && (
                      <Button
                        onClick={() => handleSaveNewEntry(index)}
                        size="sm"
                        variant="default"
                        className="gap-1.5 w-full sm:w-auto h-8 md:h-9 text-xs md:text-sm">
                        <Check className="w-4 h-4" />
                        Сохранить запись
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDeleteEntry(index)}
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 w-full sm:w-auto h-8 md:h-9 text-xs md:text-sm">
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </Button>
                  </div>
                </div>
              ))}

              {entries.length === 0 && (
                <div className="text-center py-8 md:py-10 text-slate-500 bg-slate-50 rounded border border-slate-200">
                  <div className="flex flex-col items-center gap-3">
                    <Navigation className="w-10 h-10 md:w-12 md:h-12 text-slate-400" />
                    <p className="font-medium text-sm md:text-base">Нет записей о поездках</p>
                    <Button onClick={handleAddEntry} variant="outline" className="gap-1.5 mt-1 h-8 md:h-9 text-xs md:text-sm">
                      <Plus className="w-4 h-4" />
                      Добавить первую запись
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}