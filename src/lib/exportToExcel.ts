import * as XLSX from 'xlsx'

interface FuelPrice {
  id: string
  price: string
}

interface Client {
  id: string
  day: string
  name: string
  mileage: string
}

interface ReportData {
  month: string
  year: string
  carName: string
  carNumber: string
  fuelPrices: FuelPrice[]
  consumption: string
  clients: Client[]
  employeeName: string
}

const months = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
]



export function exportReportToExcel(data: ReportData) {
  // Calculate average fuel price
  const prices = data.fuelPrices
    .map(p => parseFloat(p.price))
    .filter(p => !isNaN(p))
  
  const avgPrice = prices.length > 0 
    ? (prices.reduce((acc, p) => acc + p, 0) / prices.length).toFixed(2)
    : "0.00"

  // Calculate fuel consumed: (mileage * consumption) / 100
  const calculateFuelConsumed = (mileage: string) => {
    const mileageNum = parseFloat(mileage)
    const consumptionNum = parseFloat(data.consumption)
    
    if (isNaN(mileageNum) || isNaN(consumptionNum)) return 0
    
    return (mileageNum * consumptionNum) / 100
  }

  const monthName = data.month ? months[parseInt(data.month) - 1] : ""
  const monthNameGenitive = data.month ? monthsGenitive[parseInt(data.month) - 1] : ""

  // Create worksheet data
  const worksheetData: any[] = [
    ['ОТЧЁТ ПО РАСХОДУ ТОПЛИВА'],
    [],
    ['Период:', `за ${monthNameGenitive} ${data.year} года`],
    ['Автомобиль:', data.carName],
    ['Гос. номер:', data.carNumber],
    ['Средний расход (л/100км):', data.consumption],
    ['Средняя цена топлива (руб/л):', avgPrice],
    [],
    ['№', 'День недели', 'Маршрут', 'Пробег (км)', 'Расход топлива (л)', 'Стоимость (руб)']
  ]

  // Add client rows
  let totalMileage = 0
  let totalFuel = 0
  let totalCost = 0

  data.clients.forEach((client, index) => {
    const mileage = parseFloat(client.mileage) || 0
    const fuelConsumed = calculateFuelConsumed(client.mileage)
    const cost = fuelConsumed * parseFloat(avgPrice)

    totalMileage += mileage
    totalFuel += fuelConsumed
    totalCost += cost

    worksheetData.push([
      index + 1,
      client.day,
      client.name,
      mileage.toFixed(2),
      fuelConsumed.toFixed(2),
      cost.toFixed(2)
    ])
  })

  // Add totals row
  worksheetData.push([
    '', '', 'ИТОГО:',
    totalMileage.toFixed(2),
    totalFuel.toFixed(2),
    totalCost.toFixed(2)
  ])

  // Add footer
  worksheetData.push(
    [],
    ['Ответственный сотрудник:', data.employeeName],
    ['Подпись:', '_________________']
  )

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(worksheetData)

  // Set column widths with auto-wrap for Маршрут column
  ws['!cols'] = [
    { wch: 5 },  // №
    { wch: 15 }, // День недели
    { wch: 60 }, // Маршрут - увеличена ширина для более комфортного отображения
    { wch: 15 }, // Пробег
    { wch: 18 }, // Расход топлива
    { wch: 18 }  // Стоимость
  ]

  // Enable text wrap for all cells in the Маршрут column (column C, index 2)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let row = range.s.r; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 }) // Column C (Маршрут)
    if (ws[cellAddress]) {
      if (!ws[cellAddress].s) ws[cellAddress].s = {}
      ws[cellAddress].s = {
        alignment: {
          wrapText: true,
          vertical: 'top'
        }
      }
    }
  }

  // Set row heights to auto (will adjust based on content)
  if (!ws['!rows']) ws['!rows'] = []
  for (let i = 0; i <= range.e.r; i++) {
    if (!ws['!rows'][i]) ws['!rows'][i] = {}
    ws['!rows'][i].hpt = undefined // Auto height
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Отчёт')

  // Generate filename
  const filename = `Отчёт_${monthName}_${data.year}_${data.carNumber}.xlsx`

  // Write file
  XLSX.writeFile(wb, filename)
}