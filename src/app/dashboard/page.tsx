"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Plus, FileText, Trash2, Eye, Settings, LayoutGrid, List, ArrowUpDown, FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { REPORT_STYLES } from "@/lib/report-styles"
import { exportReportToPDF } from "@/lib/export-pdf"

interface Report {
  id: number
  month: number
  year: number
  reportData: any
  createdAt: string
  updatedAt: string
}

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
]

type ViewMode = "grid" | "list"
type SortMode = "updatedAt" | "chronological" | "name"
type SortDirection = "asc" | "desc"

export default function DashboardPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortMode, setSortMode] = useState<SortMode>("updatedAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<number | null>(null)

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/sign-in")
    }
  }, [session, isPending, router])

  useEffect(() => {
    const loadData = async () => {
      if (!session?.user) return

      setIsLoading(true)
      const token = localStorage.getItem("bearer_token")

      try {
        // Check if profile exists
        const profileRes = await fetch("/api/user-profile", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })

        setHasProfile(profileRes.ok)

        // Load reports
        const reportsRes = await fetch("/api/reports", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })

        if (reportsRes.ok) {
          const data = await reportsRes.json()
          setReports(data)
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Ошибка загрузки данных")
      } finally {
        setIsLoading(false)
      }
    }

    if (session?.user) {
      loadData()
    }
  }, [session])

  const calculateReportTotal = (report: Report) => {
    const entries = report.reportData?.entries || []
    const fuelPrice = report.reportData?.fuelPrice || 55
    const totalFuel = entries.reduce((sum: number, e: any) => sum + e.fuelUsed, 0)
    return totalFuel * parseFloat(fuelPrice.toString())
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const sortReports = (reportsToSort: Report[]) => {
    const sorted = [...reportsToSort]
    
    switch (sortMode) {
      case "updatedAt":
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      case "chronological":
        sorted.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })
        break
      case "name":
        sorted.sort((a, b) => {
          const nameA = `${MONTH_NAMES[a.month - 1]} ${a.year}`
          const nameB = `${MONTH_NAMES[b.month - 1]} ${b.year}`
          return nameA.localeCompare(nameB, "ru")
        })
        break
    }
    
    // Применяем направление сортировки
    if (sortDirection === "asc") {
      return sorted.reverse()
    }
    return sorted
  }

  const sortedReports = useMemo(() => sortReports(reports), [reports, sortMode, sortDirection])

  const handleDeleteReport = async (id: number) => {
    setReportToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteReport = async () => {
    if (reportToDelete === null) return

    const token = localStorage.getItem("bearer_token")

    try {
      const response = await fetch(`/api/reports/${reportToDelete}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error("Ошибка удаления отчёта")
      }

      toast.success("Отчёт удалён")
      setReports(reports.filter(r => r.id !== reportToDelete))
    } catch (error) {
      toast.error("Ошибка при удалении отчёта")
    } finally {
      setDeleteDialogOpen(false)
      setReportToDelete(null)
    }
  }

  const handleExportToExcel = async (report: Report) => {
    const isMintrans = report.reportData?.calculationMethod === "mintrans"
    
    if (isMintrans) {
      await handleExportToExcelMintrans(report)
    } else {
      await handleExportToExcelSimple(report)
    }
  }

  const handleExportToExcelSimple = async (report: Report) => {
    setExportingId(report.id)

    try {
      const XLSX = await import("xlsx")

      // Собираем данные для УПРОЩЁННОГО режима
      const currentReportData = {
        ...report.reportData,
        month: report.month,
        year: report.year,
        entries: report.reportData.entries || [],
        selectedFuelType: report.reportData.selectedFuelType,
        fuelPrice: report.reportData.fuelPrice || 55,
        profile: {
          ...report.reportData.profile,
          fuelConsumption92: report.reportData.profile?.fuelConsumption92,
          fuelConsumption95: report.reportData.profile?.fuelConsumption95
        }
      }

      const reportData = currentReportData
      const entriesData = reportData.entries || []
      const fuelPriceValue = reportData.fuelPrice || 55
      
      // УПРОЩЁННЫЙ режим: фиксированная норма расхода
      const selectedFuelTypeValue = reportData.selectedFuelType || "АИ-92"
      const fixedConsumptionRate = selectedFuelTypeValue.includes("95")
        ? (reportData.profile?.fuelConsumption95 || 0)
        : (reportData.profile?.fuelConsumption92 || 0)

      const totalMileage = entriesData.reduce((sum: number, e: any) => sum + e.mileage, 0)
      const totalFuel = entriesData.reduce((sum: number, e: any) => sum + e.fuelUsed, 0)
      const totalCost = totalFuel * parseFloat(fuelPriceValue.toString())

      const userName = session?.user?.name || "___________"
      
      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ')
        if (parts.length >= 2) {
          const lastName = parts[0]
          const firstInitial = parts[1].charAt(0) + '.'
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : ''
          return `${lastName} ${firstInitial}${middleInitial}`
        }
        return fullName
      }

      const formattedName = formatUserName(userName)
      const monthValue = reportData.month
      const yearValue = reportData.year
      
      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны")
        setExportingId(null)
        return
      }
      
      const monthIndex = monthValue - 1
      const monthName = MONTH_NAMES[monthIndex]

      const currentDate = new Date()
      const currentDay = currentDate.getDate()
      let compilationMonth = monthValue
      let compilationYear = yearValue
      
      if (compilationMonth === 12) {
        compilationMonth = 1
        compilationYear = yearValue + 1
      } else {
        compilationMonth = monthValue + 1
      }
      
      const compilationDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`

      const headerFontSize = 14
      const tableFontSize = 11
      const showBorders = true
      const tableFontFamily = REPORT_STYLES.fontFamily
      const rowHeight = 25
      const marginTop = 0.75
      const marginBottom = 0.75
      const marginLeft = 0.7
      const marginRight = 0.7

      const wb = XLSX.utils.book_new()
      const wsData: any[][] = []

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`
      if (reportData.profile?.vehicleYear) {
        vehicleInfo += `, ${reportData.profile.vehicleYear} г.`
      }
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`
      }
      vehicleInfo += `, ${reportData.profile?.engineVolume || ""} см3, ${reportData.profile?.transmission || ""}`
      
      if (reportData.profile?.vinNumber) {
        vehicleInfo += `\nVIN: ${reportData.profile.vinNumber}`
      }

      let headerText = `ОТЧЕТ\nОб использовании личного автомобиля в служебных целях\nза ${monthName} ${yearValue} года\n${vehicleInfo}`
      
      wsData.push([headerText])
      wsData.push([""])
      wsData.push([""])
      wsData.push([""])
      wsData.push([""])

      wsData.push(["Дата", "Маршрут", "Пробег, км", "Норма, л/100км", "Расход, л"])

      // УПРОЩЁННЫЙ режим: фиксированная норма для всех дней
      entriesData.forEach((entry: any) => {
        wsData.push([
          entry.date,
          entry.clients,
          entry.mileage,
          fixedConsumptionRate.toFixed(2),
          entry.fuelUsed
        ])
      })

      wsData.push([])
      wsData.push(["ИТОГО:", "", totalMileage, "", totalFuel])
      
      wsData.push([])
      wsData.push([])
      
      wsData.push(["", "", "Стоимость бензина:", parseFloat(fuelPriceValue.toString())])
      wsData.push(["", "", "ВСЕГО:", totalCost.toFixed(2)])
      
      wsData.push([])
      
      const finalReportDate = reportData.reportDate || compilationDate
      const finalEmployeeName = reportData.employeeName || formattedName
      
      wsData.push([`Дата отчёта: ${finalReportDate}`, "", "", `Составитель _____________ ${finalEmployeeName}`])

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      
      // Используем настройки из REPORT_STYLES
      const columnWidths = [...REPORT_STYLES.columnWidths]
      ws['!cols'] = columnWidths.map((w: number) => ({ wch: w }))

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      const headerStartRow = 5
      const dataStartRow = 6
      const dataEndRow = 6 + entriesData.length - 1
      const totalsStartRow = dataEndRow + 2

      const thinBorder = showBorders ? {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      } : undefined

      const headerFont = { name: tableFontFamily, sz: headerFontSize, bold: true, color: { rgb: "000000" } }
      const tableFontRegular = { name: tableFontFamily, sz: tableFontSize, color: { rgb: "000000" } }
      const tableFontBold = { name: tableFontFamily, sz: tableFontSize, bold: true, color: { rgb: "000000" } }
      const totalFont = { name: tableFontFamily, sz: tableFontSize + 1, bold: true, color: { rgb: "000000" } }

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' }
          if (!ws[cellAddress].s) ws[cellAddress].s = {}

          if (R === 0) {
            ws[cellAddress].s = {
              font: headerFont,
              alignment: { horizontal: "center", vertical: "center", wrapText: true }
            }
          }
          else if (R >= 1 && R <= 4) {
            ws[cellAddress].s = {
              font: { name: tableFontFamily, sz: headerFontSize, color: { rgb: "000000" } },
              alignment: { horizontal: "center", vertical: "center" }
            }
          }
          else if (R === headerStartRow) {
            ws[cellAddress].s = {
              font: tableFontBold,
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              fill: { fgColor: { rgb: "F2F2F2" } },
              border: thinBorder
            }
          }
          else if (R >= dataStartRow && R <= dataEndRow) {
            ws[cellAddress].s = {
              font: tableFontRegular,
              alignment: { 
                horizontal: C === 1 ? "left" : "center", 
                vertical: "top",
                wrapText: true
              },
              border: thinBorder
            }
          }
          else if (R >= totalsStartRow && R <= totalsStartRow + 2) {
            ws[cellAddress].s = {
              font: totalFont,
              alignment: { horizontal: "right", vertical: "center" },
              border: undefined
            }
          }
        }
      }

      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 4, c: 4 } },
        { s: { r: range.e.r, c: 0 }, e: { r: range.e.r, c: 4 } }
      )

      if (!ws['!rows']) ws['!rows'] = []
      for (let i = 0; i <= 4; i++) {
        ws['!rows'][i] = { hpt: 20 }
      }
      
      for (let i = dataStartRow; i <= dataEndRow; i++) {
        ws['!rows'][i] = { hpt: rowHeight }
      }

      ws['!margins'] = { 
        left: REPORT_STYLES.marginLeft, 
        right: REPORT_STYLES.marginRight, 
        top: REPORT_STYLES.marginTop, 
        bottom: REPORT_STYLES.marginBottom, 
        header: 0.3, 
        footer: 0.3 
      }

      // Применяем настройки автомасштабирования из REPORT_STYLES
      if (!ws['!pageSetup']) ws['!pageSetup'] = {}
      ws['!pageSetup'].orientation = REPORT_STYLES.excelPageSetup.orientation
      ws['!pageSetup'].fitToWidth = REPORT_STYLES.excelPageSetup.fitToWidth
      ws['!pageSetup'].fitToHeight = REPORT_STYLES.excelPageSetup.fitToHeight
      ws['!pageSetup'].paperSize = REPORT_STYLES.excelPageSetup.paperSize
      ws['!pageSetup'].scale = REPORT_STYLES.excelPageSetup.scale

      XLSX.utils.book_append_sheet(wb, ws, "Отчёт")
      
      XLSX.writeFile(wb, `Отчёт по бензину_${finalEmployeeName}_${monthName}_${yearValue}.xlsx`)
      toast.success("Отчёт экспортирован в Excel")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Ошибка экспорта в Excel")
    } finally {
      setExportingId(null)
    }
  }

  const handleExportToExcelMintrans = async (report: Report) => {
    setExportingId(report.id)

    try {
      const XLSX = await import("xlsx")

      const reportData = report.reportData
      const entries = reportData.entries || []
      const fuelPrice = reportData.fuelPrice || 55
      const mintransCoeffs = reportData.mintransCoefficients
      const dailyBreakdown = reportData.dailyBreakdown || []

      const totalMileage = entries.reduce((sum: number, e: any) => sum + e.mileage, 0)
      const totalFuel = entries.reduce((sum: number, e: any) => sum + e.fuelUsed, 0)
      const totalCost = totalFuel * parseFloat(fuelPrice.toString())

      const userName = session?.user?.name || "___________"
      
      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ')
        if (parts.length >= 2) {
          const lastName = parts[0]
          const firstInitial = parts[1].charAt(0) + '.'
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : ''
          return `${lastName} ${firstInitial}${middleInitial}`
        }
        return fullName
      }

      const formattedName = formatUserName(userName)
      
      const monthValue = report.month || reportData.month
      const yearValue = report.year || reportData.year
      
      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны")
        setExportingId(null)
        return
      }
      
      const monthIndex = monthValue - 1
      const monthName = MONTH_NAMES[monthIndex]

      // Используем дату создания отчёта вместо текущей даты
      const reportCreatedDate = new Date(report.createdAt)
      const reportDay = reportCreatedDate.getDate()
      const reportMonth = reportCreatedDate.getMonth() + 1
      const reportYear = reportCreatedDate.getFullYear()
      
      const finalReportDate = reportData.reportDate || `${reportDay.toString().padStart(2, '0')}.${reportMonth.toString().padStart(2, '0')}.${reportYear}`
      const finalEmployeeName = reportData.employeeName || formattedName
      
      const wb = XLSX.utils.book_new()

      // ЛИСТ 1: ОСНОВНОЙ ОТЧЁТ
      const wsData: any[][] = []

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`
      if (reportData.profile?.vehicleYear) {
        vehicleInfo += `, ${reportData.profile.vehicleYear} г.`
      }
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`
      }
      vehicleInfo += `, ${reportData.profile?.engineVolume || ""} см3, ${reportData.profile?.transmission || ""}`
      
      if (reportData.profile?.vinNumber) {
        vehicleInfo += `\nVIN: ${reportData.profile.vinNumber}`
      }

      let headerText = `ОТЧЕТ\nОб использовании личного автомобиля в служебных целях\nза ${monthName} ${yearValue} года\n${vehicleInfo}`
      
      wsData.push([headerText])
      wsData.push([""])
      wsData.push([""])
      wsData.push([""])
      wsData.push([""])

      wsData.push(["Дата", "Маршрут", "Пробег, км", "Норма, л/100км", "Расход, л"])

      entries.forEach((entry: any) => {
        const individualRate = entry.mileage > 0 ? (entry.fuelUsed / entry.mileage) * 100 : 0
        wsData.push([
          entry.date,
          entry.clients,
          entry.mileage,
          individualRate.toFixed(2),
          entry.fuelUsed
        ])
      })

      wsData.push([])
      wsData.push(["ИТОГО:", "", totalMileage, "", totalFuel])
      
      wsData.push([])
      wsData.push([])
      
      wsData.push(["", "", "Стоимость бензина:", parseFloat(fuelPrice.toString())])
      wsData.push(["", "", "ВСЕГО:", totalCost.toFixed(2)])
      
      wsData.push([])
      
      wsData.push([`Дата отчёта: ${finalReportDate}`, "", "", `Составитель _____________ ${finalEmployeeName}`])

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      
      // Используем настройки из REPORT_STYLES
      const columnWidths = [...REPORT_STYLES.columnWidths]
      ws['!cols'] = columnWidths.map((w: number) => ({ wch: w }))

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      const headerStartRow = 5
      const dataStartRow = 6
      const dataEndRow = 6 + entries.length - 1
      const totalsStartRow = dataEndRow + 2

      const thinBorder = REPORT_STYLES.showBorders ? {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      } : undefined

      // Исправлено: используем настройки из REPORT_STYLES
      const headerFont = { name: REPORT_STYLES.fontFamily, sz: REPORT_STYLES.headerFontSize, bold: true, color: { rgb: "000000" } }
      const tableFontRegular = { name: REPORT_STYLES.fontFamily, sz: REPORT_STYLES.tableFontSize, color: { rgb: "000000" } }
      const tableFontBold = { name: REPORT_STYLES.fontFamily, sz: REPORT_STYLES.tableFontSize, bold: true, color: { rgb: "000000" } }
      const totalFont = { name: REPORT_STYLES.fontFamily, sz: REPORT_STYLES.tableFontSize + 1, bold: true, color: { rgb: "000000" } }

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' }

          if (!ws[cellAddress].s) ws[cellAddress].s = {}

          if (R === 0) {
            ws[cellAddress].s = {
              font: headerFont,
              alignment: { horizontal: "center", vertical: "center", wrapText: true }
            }
          }
          else if (R >= 1 && R <= 4) {
            ws[cellAddress].s = {
              font: { name: REPORT_STYLES.fontFamily, sz: REPORT_STYLES.headerFontSize, color: { rgb: "000000" } },
              alignment: { horizontal: "center", vertical: "center" }
            }
          }
          else if (R === headerStartRow) {
            ws[cellAddress].s = {
              font: tableFontBold,
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              fill: { fgColor: { rgb: "F2F2F2" } },
              border: thinBorder
            }
          }
          else if (R >= dataStartRow && R <= dataEndRow) {
            ws[cellAddress].s = {
              font: tableFontRegular,
              alignment: { 
                horizontal: C === 1 ? "left" : "center", 
                vertical: "top",
                wrapText: true
              },
              border: thinBorder
            }
          }
          else if (R >= totalsStartRow && R <= totalsStartRow + 2) {
            ws[cellAddress].s = {
              font: totalFont,
              alignment: { horizontal: "right", vertical: "center" },
              border: undefined
            }
          }
          else if (R === range.e.r) {
            ws[cellAddress].s = {
              font: tableFontRegular,
              alignment: { horizontal: "left", vertical: "center" }
            }
          }
        }
      }

      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 4, c: 4 } },
        { s: { r: range.e.r, c: 0 }, e: { r: range.e.r, c: 4 } }
      )

      if (!ws['!rows']) ws['!rows'] = []
      for (let i = 0; i <= 4; i++) {
        ws['!rows'][i] = { hpt: 20 }
      }
      
      for (let i = dataStartRow; i <= dataEndRow; i++) {
        ws['!rows'][i] = { hpt: REPORT_STYLES.rowHeight }
      }

      ws['!margins'] = { 
        left: REPORT_STYLES.marginLeft, 
        right: REPORT_STYLES.marginRight, 
        top: REPORT_STYLES.marginTop, 
        bottom: REPORT_STYLES.marginBottom, 
        header: 0.3, 
        footer: 0.3 
      }

      XLSX.utils.book_append_sheet(wb, ws, "Отчёт")

      // УБРАНО: Второй лист "Обоснование" больше не создаётся в Excel
      // Таблица обоснования остаётся только в PDF-экспорте

      XLSX.writeFile(wb, `Отчёт по бензину_${finalEmployeeName}_${MONTH_NAMES[monthIndex]}_${yearValue}.xlsx`)
      toast.success("Отчёт экспортирован в Excel (режим Минтранса)")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Ошибка экспорта в Excel")
    } finally {
      setExportingId(null)
    }
  }

  // Функция расчёта оптимального масштаба для вмещения на одну страницу
  const calculatePDFScale = (rowCount: number): { scale: number; shouldFitOnePage: boolean } => {
    const maxRowsOnePage = REPORT_STYLES.pdfMaxRowsOnePage // 25
    const minScale = REPORT_STYLES.pdfAutoScaleThreshold // 0.75
    
    if (rowCount <= 20) {
      return { scale: 1.0, shouldFitOnePage: true } // Полный размер
    }
    
    if (rowCount <= maxRowsOnePage) {
      // Линейное уменьшение масштаба от 1.0 (20 строк) до minScale (25 строк)
      const scaleRange = 1.0 - minScale // 0.25
      const rowRange = maxRowsOnePage - 20 // 5
      const rowsOverBase = rowCount - 20
      const calculatedScale = 1.0 - (scaleRange * rowsOverBase / rowRange)
      
      return { 
        scale: Math.max(calculatedScale, minScale), 
        shouldFitOnePage: calculatedScale >= minScale 
      }
    }
    
    // Больше 25 строк - разбивка на страницы
    return { scale: 1.0, shouldFitOnePage: false }
  }

  const handleExportToPDF = async (report: Report) => {
    setExportingId(report.id)
    try {
      await exportReportToPDF({
        month: report.month || report.reportData?.month,
        year: report.year || report.reportData?.year,
        reportData: report.reportData,
        userName: session?.user?.name || "",
        createdAt: report.createdAt,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Ошибка экспорта в PDF")
    } finally {
      setExportingId(null)
    }
  }

  const handleExportToPDFSimple = async (report: Report) => {
    setExportingId(report.id)

    try {
      const html2pdf = (await import("html2pdf.js")).default

      const reportData = report.reportData
      const entries = reportData.entries || []
      const fuelPrice = reportData.fuelPrice || 55
      
      const selectedFuelType = reportData.selectedFuelType || reportData.profile?.fuelType || "АИ-92"
      const fixedConsumptionRate = selectedFuelType.includes("95")
        ? (reportData.profile?.fuelConsumption95 || 0)
        : (reportData.profile?.fuelConsumption92 || 0)

      const totalMileage = entries.reduce((sum: number, e: any) => sum + e.mileage, 0)
      const totalFuel = entries.reduce((sum: number, e: any) => sum + e.fuelUsed, 0)
      const totalCost = totalFuel * parseFloat(fuelPrice.toString())

      const userName = session?.user?.name || "___________"
      
      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ')
        if (parts.length >= 2) {
          const lastName = parts[0]
          const firstInitial = parts[1].charAt(0) + '.'
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : ''
          return `${lastName} ${firstInitial}${middleInitial}`
        }
        return fullName
      }

      const formattedName = formatUserName(userName)
      
      const monthValue = report.month || reportData.month
      const yearValue = report.year || reportData.year
      
      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны")
        setExportingId(null)
        return
      }
      
      const monthIndex = monthValue - 1
      const monthName = MONTH_NAMES[monthIndex]

      const reportCreatedDate = new Date(report.createdAt)
      const reportDay = reportCreatedDate.getDate()
      const reportMonth = reportCreatedDate.getMonth() + 1
      const reportYear = reportCreatedDate.getFullYear()
      
      const finalReportDate = reportData.reportDate || `${reportDay.toString().padStart(2, '0')}.${reportMonth.toString().padStart(2, '0')}.${reportYear}`
      const finalEmployeeName = reportData.employeeName || formattedName

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`
      }

      // РАСЧЁТ МАСШТАБА для автовмещения
      const { scale, shouldFitOnePage } = calculatePDFScale(entries.length)
      const scalePercent = Math.round(scale * 100)
      
      console.log(`📊 PDF масштабирование: ${entries.length} строк → ${scalePercent}% (${shouldFitOnePage ? 'одна страница' : 'несколько страниц'})`)
      
      let htmlContent = ''

      if (shouldFitOnePage) {
        // Вмещаем на одну страницу с автомасштабированием
        htmlContent = `
          <div style="transform: scale(${scale}); transform-origin: top center; width: ${100 / scale}%; font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0;">
            <div style="text-align: center; margin-bottom: 15px;">
              <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 6px 0;">ОТЧЕТ</h1>
              <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 3px 0;">об использовании личного автомобиля в служебных целях</p>
              <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 3px 0;">за ${monthName} ${yearValue} года</p>
              <p style="font-size: ${REPORT_STYLES.vehicleInfoFontSize}px; margin: 8px 0 0 0;">${vehicleInfo}</p>
            </div>
            
            <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
              <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
                <thead>
                  <tr>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%;">Дата</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%;">Маршрут</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%;">Пробег,<br/>км</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%;">Норма,<br/>л/100км</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%;">Расход,<br/>л</th>
                  </tr>
                </thead>
                <tbody>
                  ${entries.map((entry: any) => `
                    <tr>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.mileage.toFixed(1)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${fixedConsumptionRate.toFixed(2)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.fuelUsed.toFixed(1)}</td>
                    </tr>
                  `).join('')}
                  <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                    <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">ИТОГО:</td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalMileage.toFixed(1)}</td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalFuel.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div style="margin: 12px 0; font-size: ${REPORT_STYLES.summaryFontSize}px; text-align: right;">
              <p style="margin: 4px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
              <p style="margin: 4px 0; font-size: ${REPORT_STYLES.summaryFontSize + 1}px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
            </div>
            
            <div style="margin-top: 20px; padding-bottom: 15px; font-size: ${REPORT_STYLES.signatureFontSize}px; display: flex; justify-content: space-between;">
              <div>Дата отчёта: ${finalReportDate}</div>
              <div>Составитель _____________ ${finalEmployeeName}</div>
            </div>
          </div>
        `
      } else {
        // Больше строк - разбиваем на страницы
        const maxRowsPerPage = REPORT_STYLES.maxRowsPerPage
        const pages: any[][] = []
        for (let i = 0; i < entries.length; i += maxRowsPerPage) {
          pages.push(entries.slice(i, i + maxRowsPerPage))
        }

        htmlContent = pages.map((pageEntries, pageIndex) => {
          const isLastPage = pageIndex === pages.length - 1
          const pageMileage = pageEntries.reduce((sum: number, e: any) => sum + e.mileage, 0)
          const pageFuel = pageEntries.reduce((sum: number, e: any) => sum + e.fuelUsed, 0)

          return `
            <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; ${pageIndex > 0 ? 'page-break-before: always;' : ''}">
              <div style="text-align: center; margin-bottom: 15px;">
                <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 6px 0;">ОТЧЕТ${pageIndex > 0 ? ' (продолжение)' : ''}</h1>
                <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 3px 0;">об использовании личного автомобиля в служебных целях</p>
                <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 3px 0;">за ${monthName} ${yearValue} года</p>
                <p style="font-size: 11px; margin: 8px 0 0 0;">${vehicleInfo}</p>
                ${pageIndex > 0 ? `<p style="font-size: 10px; margin: 4px 0; color: #666;">Страница ${pageIndex + 1} из ${pages.length}</p>` : ''}
              </div>
              
              <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
                <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
                  <thead>
                    <tr>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%;">Дата</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%;">Маршрут</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%;">Пробег,<br/>км</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%;">Норма,<br/>л/100км</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%;">Расход,<br/>л</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageEntries.map((entry: any) => `
                      <tr>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.mileage.toFixed(1)}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${fixedConsumptionRate.toFixed(2)}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.fuelUsed.toFixed(1)}</td>
                      </tr>
                    `).join('')}
                    <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                      <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${isLastPage ? 'ИТОГО:' : 'Итого на странице:'}</td>
                      <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageMileage.toFixed(1)}</td>
                      <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                      <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageFuel.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              ${isLastPage ? `
                <div style="margin: 12px 0; font-size: 12px; text-align: right;">
                  <p style="margin: 4px 0;"><strong>ИТОГО за весь период:</strong> Пробег ${totalMileage.toFixed(1)} км, Расход ${totalFuel.toFixed(1)} л</p>
                  <p style="margin: 4px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
                  <p style="margin: 4px 0; font-size: 13px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
                </div>
                
                <div style="margin-top: 30px; padding-bottom: 20px; font-size: 11px; display: flex; justify-content: space-between;">
                  <div>Дата отчёта: ${finalReportDate}</div>
                  <div>Составитель _____________ ${finalEmployeeName}</div>
                </div>
              ` : `
                <div style="margin: 8px 0; font-size: 10px; text-align: center; color: #666;">
                  <p style="margin: 0;">Продолжение на следующей странице...</p>
                </div>
              `}
            </div>
          `
        }).join('')
      }

      const element = document.createElement('div')
      element.innerHTML = htmlContent

      const marginTopMm = REPORT_STYLES.marginTop * 25.4
      const marginBottomMm = REPORT_STYLES.marginBottom * 25.4
      const marginLeftMm = REPORT_STYLES.marginLeft * 25.4
      const marginRightMm = REPORT_STYLES.marginRight * 25.4

      const opt = {
        margin: [marginTopMm, marginLeftMm, marginBottomMm, marginRightMm],
        filename: `Отчёт_${finalEmployeeName}_${monthName}_${yearValue}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: REPORT_STYLES.pdfScale, 
          useCORS: true 
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'landscape',
          putOnlyUsedFonts: true,
          compress: true
        },
        pagebreak: { 
          mode: shouldFitOnePage ? 'avoid-all' : (REPORT_STYLES.pdfPageBreakMode as any)
        }
      }

      await html2pdf().set(opt).from(element).save()
      
      if (scalePercent < 100) {
        toast.success(`Отчёт экспортирован в PDF (масштаб ${scalePercent}%)`)
      } else {
        toast.success("Отчёт экспортирован в PDF")
      }
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Ошибка экспорта в PDF")
    } finally {
      setExportingId(null)
    }
  }

  const handleExportToPDFMintrans = async (report: Report) => {
    setExportingId(report.id)

    try {
      const html2pdf = (await import("html2pdf.js")).default

      const reportData = report.reportData
      const entries = reportData.entries || []
      const fuelPrice = reportData.fuelPrice || 55
      const mintransCoeffs = reportData.mintransCoefficients
      const dailyBreakdown = reportData.dailyBreakdown || []

      const totalMileage = entries.reduce((sum: number, e: any) => sum + e.mileage, 0)
      const totalFuel = entries.reduce((sum: number, e: any) => sum + e.fuelUsed, 0)
      const totalCost = totalFuel * parseFloat(fuelPrice.toString())

      const userName = session?.user?.name || "___________"
      
      const formatUserName = (fullName: string): string => {
        const parts = fullName.trim().split(' ')
        if (parts.length >= 2) {
          const lastName = parts[0]
          const firstInitial = parts[1].charAt(0) + '.'
          const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : ''
          return `${lastName} ${firstInitial}${middleInitial}`
        }
        return fullName
      }

      const formattedName = formatUserName(userName)
      
      const monthValue = report.month || reportData.month
      const yearValue = report.year || reportData.year
      
      if (!monthValue || !yearValue) {
        toast.error("Ошибка: месяц или год отчета не указаны")
        setExportingId(null)
        return
      }
      
      const monthIndex = monthValue - 1
      const monthName = MONTH_NAMES[monthIndex]

      const reportCreatedDate = new Date(report.createdAt)
      const reportDay = reportCreatedDate.getDate()
      const reportMonth = reportCreatedDate.getMonth() + 1
      const reportYear = reportCreatedDate.getFullYear()
      
      const finalReportDate = reportData.reportDate || `${reportDay.toString().padStart(2, '0')}.${reportMonth.toString().padStart(2, '0')}.${reportYear}`
      const finalEmployeeName = reportData.employeeName || formattedName

      let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`
      if (reportData.profile?.licensePlate) {
        vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`
      }

      // СТРАНИЦА 1: Основной отчёт (компактно)
      const mainReportHTML = `
        <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0;">
          <div style="text-align: center; margin-bottom: 15px;">
            <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 6px 0;">ОТЧЕТ</h1>
            <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 3px 0;">об использовании личного автомобиля в служебных целях</p>
            <p style="font-size: ${REPORT_STYLES.textFontSize}px; font-weight: normal; margin: 3px 0;">за ${monthName} ${yearValue} года</p>
            <p style="font-size: 12px; margin: 8px 0 0 0;">${vehicleInfo}</p>
          </div>
          
          <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
            <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
              <thead>
                <tr>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%;">Дата</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%;">Маршрут</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%;">Пробег,<br/>км</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%;">Норма,<br/>л/100км</th>
                  <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; font-weight: bold; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%;">Расход,<br/>л</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map((entry: any) => {
                  const individualRate = entry.mileage > 0 ? (entry.fuelUsed / entry.mileage) * 100 : 0
                  return `
                    <tr>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.mileage.toFixed(1)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${individualRate.toFixed(2)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; vertical-align: middle; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.fuelUsed.toFixed(1)}</td>
                    </tr>
                  `
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
          
          <div style="margin: 12px 0; font-size: 12px; text-align: right;">
            <p style="margin: 4px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
          </div>
          
          <div style="margin-top: 20px; font-size: 11px; display: flex; justify-content: space-between;">
            <div>Дата отчёта: ${finalReportDate}</div>
            <div>Составитель _____________ ${finalEmployeeName}</div>
          </div>
        </div>
      `

      // СТРАНИЦА 2: ОБОСНОВАНИЕ (компактно)
      let justificationHTML = ""
      if (mintransCoeffs) {
        const Hbase = mintransCoeffs.baseConsumption
        
        let calcTableRows = ""
        if (dailyBreakdown && dailyBreakdown.length > 0) {
          calcTableRows = dailyBreakdown.map((day: any) => {
            const ageCoeff = day.coefficients?.vehicleAge || 1.0
            const modeCoeff = day.coefficients?.drivingMode || 1.15
            const tempCoeff = day.coefficients?.temperature || 1.0
            const terrainCoeff = day.coefficients?.terrain || 1.0
            const roadCoeff = day.coefficients?.roadCondition || 1.0
            
            const modeLabel = day.drivingMode === "city" ? "Город" : day.drivingMode === "highway" ? "Трасса" : "Смеш."
            const terrainLabel = day.terrainType === "plain" ? "Равн." : day.terrainType === "hilly" ? "Холм." : "Горы"
            const roadLabel = day.roadQuality === "good" ? "Хор." : day.roadQuality === "fair" ? "Уд." : "Плох."
            
            const formula = `${Hbase}×${ageCoeff}×${modeCoeff}×${tempCoeff.toFixed(2)}×${terrainCoeff}×${roadCoeff}×${day.mileage || 0}`
            
            return `
              <tr>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${day.date}</td>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${day.temperature > 0 ? '+' : ''}${day.temperature}</td>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${modeLabel}</td>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${ageCoeff}</td>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${terrainLabel}</td>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${roadLabel}</td>
                <td style="padding: 4px 3px; text-align: left; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize - 1}pt; font-family: 'Courier New', monospace; word-wrap: break-word;">0.01×${formula}</td>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; font-weight: bold;">${day.fuelUsed?.toFixed(2) || 0}</td>
              </tr>
            `
          }).join('')
        }
        
        justificationHTML = `
          <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; page-break-before: always;">
            <h2 style="font-size: ${REPORT_STYLES.justificationTitleFontSize}pt; font-weight: bold; text-align: center; margin: 0 0 3px 0; border-bottom: 1.5pt solid #000; padding-bottom: 2px;">
              ОБОСНОВАНИЕ РАСЧЕТА
            </h2>
            <p style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt; text-align: center; margin: 1px 0 4px 0; font-style: italic;">
              Распоряжение Минтранса России от 14.03.2008 N АМ-23-р (ред. от 30.09.2021)
            </p>
            
            <div style="border: 1pt solid #000; padding: 3px; margin: 3px 0; background: #f5f5f5;">
              <p style="font-size: ${REPORT_STYLES.justificationLabelFontSize}pt; font-weight: bold; margin: 0 0 1px 0;">ФОРМУЛА:</p>
              <div style="padding: 2px; font-family: 'Courier New', monospace; font-size: ${REPORT_STYLES.justificationFormulaFontSize}pt; text-align: center; font-weight: bold; line-height: 1.4;">
                Q = 0.01 × H<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">base</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">возраст</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">режим</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">темп</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">местн</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">дороги</sub> × S
              </div>
              <p style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt; margin: 1px 0 0 0; text-align: center; color: #0066cc;">
                Все коэффициенты применяются индивидуально для каждого дня и ПЕРЕМНОЖАЮТСЯ
              </p>
            </div>
            
            <div style="display: flex; gap: 3px; margin: 3px 0;">
              <div style="flex: 1; border: 1pt solid #000; padding: 3px;">
                <p style="font-size: ${REPORT_STYLES.justificationLabelFontSize}pt; font-weight: bold; margin: 0 0 1px 0;">БАЗОВЫЕ:</p>
                <div style="font-size: ${REPORT_STYLES.justificationTextFontSize}pt; line-height: 1.3;">
                  <p style="margin: 0.5px 0; line-height: 1.3;"><strong>H<sub style="font-size: 5pt;">base</sub>:</strong> ${Hbase} л/100км</p>
                </div>
              </div>
              
              <div style="flex: 2; border: 1pt solid #000; padding: 3px;">
                <p style="font-size: ${REPORT_STYLES.justificationLabelFontSize}pt; font-weight: bold; margin: 0 0 1px 0;">ИНДИВИДУАЛЬНЫЕ КОЭФФИЦИЕНТЫ ДНЯ:</p>
                <div style="font-size: ${REPORT_STYLES.justificationTextFontSize}pt; line-height: 1.3;">
                  <p style="margin: 0.5px 0; line-height: 1.3;"><strong>K<sub style="font-size: 5pt;">возр</sub>:</strong> 1.0 (&lt;5л) • 1.05 (≥5л)</p>
                  <p style="margin: 0.5px 0; line-height: 1.3;"><strong>K<sub style="font-size: 5pt;">реж</sub>:</strong> город 1.15 • трасса 1.0 • смеш. 1.075</p>
                  <p style="margin: 0.5px 0; line-height: 1.3;"><strong>K<sub style="font-size: 5pt;">темп</sub>:</strong> 1.03-1.18 (+ прогрев 5% при t&lt;0°C)</p>
                  <p style="margin: 0.5px 0; line-height: 1.3;"><strong>K<sub style="font-size: 5pt;">мест</sub>:</strong> равн. 1.0 • холмы 1.05 • горы 1.10</p>
                  <p style="margin: 0.5px 0; line-height: 1.3;"><strong>K<sub style="font-size: 5pt;">дор</sub>:</strong> хор. 1.0 • удовл. 1.05 • плох. 1.10</p>
                </div>
              </div>
            </div>
            
            ${calcTableRows ? `
            <div style="margin: 3px 0;">
              <table style="width: 100%; border-collapse: collapse; border: 1pt solid #000; margin: 2px 0;">
                <thead>
                  <tr style="background: #f0f0f0;">
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Дата</th>
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">T°C</th>
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Режим</th>
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">K<sub style="font-size: ${REPORT_STYLES.tableFontSize - 2}pt;">возр</sub></th>
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Местн.</th>
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Дор.</th>
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Расчет</th>
                    <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">л</th>
                  </tr>
                </thead>
                <tbody>
                  ${calcTableRows}
                  <tr style="background: #f0f0f0; font-weight: bold;">
                    <td colspan="6" style="padding: 4px 3px; text-align: right; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">ИТОГО:</td>
                    <td style="padding: 4px 3px; vertical-align: middle; border: 0.5pt solid #000;"></td>
                    <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${totalFuel.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ` : ''}
          </div>
        `
      }

      const htmlContent = mainReportHTML + justificationHTML

      const element = document.createElement('div')
      element.innerHTML = htmlContent

      const marginTopMm = REPORT_STYLES.marginTop * 25.4
      const marginBottomMm = REPORT_STYLES.marginBottom * 25.4
      const marginLeftMm = REPORT_STYLES.marginLeft * 25.4
      const marginRightMm = REPORT_STYLES.marginRight * 25.4

      const opt = {
        margin: [marginTopMm, marginLeftMm, marginBottomMm, marginRightMm],
        filename: `Отчёт_${finalEmployeeName}_${monthName}_${yearValue}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: REPORT_STYLES.pdfScale, 
          useCORS: true 
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'landscape',
          putOnlyUsedFonts: true,
          compress: true
        },
        pagebreak: { mode: 'css' as any }
      }

      await html2pdf().set(opt).from(element).save()
      toast.success("Отчёт экспортирован в PDF")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Ошибка экспорта в PDF")
    } finally {
      setExportingId(null)
    }
  }

  if (isPending || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-4 sm:py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Мои отчёты</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Управление отчётами по расходу топлива</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {!hasProfile && (
              <Link href="/wizard" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto gap-2 text-sm sm:text-base">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Настроить профиль</span>
                  <span className="sm:hidden">Профиль</span>
                </Button>
              </Link>
            )}
            <Link href="/dashboard/create" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto gap-2 text-sm sm:text-base">
                <Plus className="w-4 h-4" />
                Новый отчёт
              </Button>
            </Link>
          </div>
        </div>

        {!hasProfile && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <CardHeader>
              <CardTitle className="text-yellow-900 dark:text-yellow-100 text-lg sm:text-xl">
                Настройте профиль
              </CardTitle>
              <CardDescription className="text-yellow-800 dark:text-yellow-200 text-sm sm:text-base">
                Для создания типовых отчётов необходимо заполнить данные автомобиля и график движения
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/wizard">
                <Button variant="default" className="w-full sm:w-auto">
                  Перейти к настройке
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Нет отчётов</h3>
              <p className="text-muted-foreground mb-4">Создайте свой первый отчёт</p>
              <Link href="/dashboard/create">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Создать отчёт
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                  title={sortDirection === "asc" ? "По возрастанию" : "По убыванию"}
                  className="flex-shrink-0"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
                <Select value={sortMode} onValueChange={(value: string) => setSortMode(value as SortMode)}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updatedAt">По дате изменения</SelectItem>
                    <SelectItem value="chronological">По порядку месяцев</SelectItem>
                    <SelectItem value="name">По названию</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedReports.map((report) => {
                  const totalCost = calculateReportTotal(report)
                  const isMintrans = report.reportData?.calculationMethod === "mintrans"
                  return (
                    <Card key={report.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <FileText className="w-5 h-5 flex-shrink-0" />
                            <span className="truncate">{MONTH_NAMES[report.month - 1]} {report.year}</span>
                          </CardTitle>
                          <div className="text-right">
                            <div className="text-lg font-bold whitespace-nowrap">
                              {totalCost.toFixed(2)} ₽
                            </div>
                            {isMintrans && (
                              <div className="text-[10px] font-bold text-green-600 dark:text-green-400 mt-0.5">
                                Минтранс
                              </div>
                            )}
                          </div>
                        </div>
                        <CardDescription className="space-y-1 text-xs sm:text-sm">
                          <div className="truncate">Создан: {formatDateTime(report.createdAt)}</div>
                          <div className="truncate">Изменён: {formatDateTime(report.updatedAt)}</div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Link href={`/dashboard/edit/${report.id}`} className="flex-1">
                              <Button variant="outline" className="w-full gap-2 text-sm sm:text-base">
                                <Eye className="w-4 h-4" />
                                Открыть
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleExportToExcel(report)}
                              title="Экспорт в Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteReport(report.id)}
                              className="flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 gap-1 sm:gap-2 text-xs sm:text-sm"
                              onClick={() => handleExportToPDF(report)}
                              disabled={exportingId === report.id}
                            >
                              <FileText className="w-4 h-4" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedReports.map((report) => {
                  const totalCost = calculateReportTotal(report)
                  const isMintrans = report.reportData?.calculationMethod === "mintrans"
                  return (
                    <Card key={report.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                          <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground flex-shrink-0 mt-1 sm:mt-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-base sm:text-lg truncate">
                                  {MONTH_NAMES[report.month - 1]} {report.year}
                                  {isMintrans && (
                                    <span className="ml-2 text-[10px] font-bold text-green-600 dark:text-green-400">
                                      Минтранс
                                    </span>
                                  )}
                                </h3>
                                <div className="text-base sm:text-lg font-bold whitespace-nowrap">
                                  {totalCost.toFixed(2)} ₽
                                </div>
                              </div>
                              <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5">
                                <div className="truncate">Создан: {formatDateTime(report.createdAt)}</div>
                                <div className="truncate">Изменён: {formatDateTime(report.updatedAt)}</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex sm:hidden flex-col gap-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleExportToExcel(report)}
                                title="Экспорт в Excel"
                              >
                                <FileSpreadsheet className="w-4 h-4 mr-1" />
                                Excel
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleExportToPDF(report)}
                                disabled={exportingId === report.id}
                                title="Экспорт в PDF"
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                PDF
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Link href={`/dashboard/edit/${report.id}`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full gap-2">
                                  <Eye className="w-4 h-4" />
                                  Открыть
                                </Button>
                              </Link>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteReport(report.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="hidden sm:flex gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleExportToExcel(report)}
                              title="Экспорт в Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleExportToPDF(report)}
                              disabled={exportingId === report.id}
                              title="Экспорт в PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Link href={`/dashboard/edit/${report.id}`}>
                              <Button variant="outline" className="gap-2">
                                <Eye className="w-4 h-4" />
                                Открыть
                              </Button>
                            </Link>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteReport(report.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Удалить отчёт?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить этот отчёт? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteReport}
              className="w-full sm:w-auto"
            >
              Да, удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}