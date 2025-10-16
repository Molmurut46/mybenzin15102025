"use client"

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

interface FuelReportPreviewProps {
  data: ReportData
}

export default function FuelReportPreview({ data }: FuelReportPreviewProps) {
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ]

  // Calculate average fuel price
  const calculateAverageFuelPrice = () => {
    const prices = data.fuelPrices
      .map((p: FuelPrice) => parseFloat(p.price))
      .filter((p: number) => !isNaN(p))
    
    if (prices.length === 0) return 0
    const sum = prices.reduce((acc: number, p: number) => acc + p, 0)
    return (sum / prices.length).toFixed(2)
  }

  // Calculate fuel consumed for a given mileage: (mileage * consumption) / 100
  const calculateFuelConsumed = (mileage: string) => {
    const mileageNum = parseFloat(mileage)
    const consumptionNum = parseFloat(data.consumption)
    
    if (isNaN(mileageNum) || isNaN(consumptionNum)) return "0.00"
    
    return ((mileageNum * consumptionNum) / 100).toFixed(2)
  }

  // Calculate total mileage
  const getTotalMileage = () => {
    return data.clients
      .map((c: Client) => parseFloat(c.mileage) || 0)
      .reduce((acc: number, val: number) => acc + val, 0)
      .toFixed(2)
  }

  // Calculate total fuel
  const getTotalFuel = () => {
    return data.clients
      .map((c: Client) => parseFloat(calculateFuelConsumed(c.mileage)))
      .reduce((acc: number, val: number) => acc + val, 0)
      .toFixed(2)
  }

  // Calculate total cost
  const getTotalCost = () => {
    const avgPrice = parseFloat(calculateAverageFuelPrice())
    const totalFuel = parseFloat(getTotalFuel())
    return (avgPrice * totalFuel).toFixed(2)
  }

  const avgPrice = calculateAverageFuelPrice()
  const monthName = data.month ? months[parseInt(data.month) - 1] : ""

  return (
    <div className="bg-white text-black p-8 rounded-lg border-2 border-gray-300" id="report-preview">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-4">ОТЧЁТ ПО РАСХОДУ ТОПЛИВА</h1>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-right font-semibold">Период:</div>
          <div className="text-left">{monthName} {data.year}</div>
          
          <div className="text-right font-semibold">Автомобиль:</div>
          <div className="text-left">{data.carName}</div>
          
          <div className="text-right font-semibold">Гос. номер:</div>
          <div className="text-left">{data.carNumber}</div>
          
          <div className="text-right font-semibold">Расход (л/100км):</div>
          <div className="text-left">{data.consumption}</div>
          
          <div className="text-right font-semibold">Средняя цена топлива:</div>
          <div className="text-left">{avgPrice} руб/л</div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse border-2 border-black mb-6">
        <thead>
          <tr className="bg-gray-200">
            <th className="border-2 border-black p-2 text-sm font-bold">№</th>
            <th className="border-2 border-black p-2 text-sm font-bold">День недели</th>
            <th className="border-2 border-black p-2 text-sm font-bold">Клиент</th>
            <th className="border-2 border-black p-2 text-sm font-bold">Пробег (км)</th>
            <th className="border-2 border-black p-2 text-sm font-bold">Расход топлива (л)</th>
            <th className="border-2 border-black p-2 text-sm font-bold">Стоимость (руб)</th>
          </tr>
        </thead>
        <tbody>
          {data.clients.map((client: Client, index: number) => {
            const fuelConsumed = calculateFuelConsumed(client.mileage)
            const cost = (parseFloat(fuelConsumed) * parseFloat(avgPrice)).toFixed(2)
            
            return (
              <tr key={client.id}>
                <td className="border-2 border-black p-2 text-center text-sm">{index + 1}</td>
                <td className="border-2 border-black p-2 text-sm">{client.day}</td>
                <td className="border-2 border-black p-2 text-sm">{client.name}</td>
                <td className="border-2 border-black p-2 text-right text-sm">{client.mileage}</td>
                <td className="border-2 border-black p-2 text-right text-sm">{fuelConsumed}</td>
                <td className="border-2 border-black p-2 text-right text-sm">{cost}</td>
              </tr>
            )
          })}
          {data.clients.length === 0 && (
            <tr>
              <td colSpan={6} className="border-2 border-black p-4 text-center text-gray-500 text-sm">
                Нет данных
              </td>
            </tr>
          )}
          {/* Totals row */}
          {data.clients.length > 0 && (
            <tr className="bg-gray-100 font-bold">
              <td colSpan={3} className="border-2 border-black p-2 text-right text-sm">ИТОГО:</td>
              <td className="border-2 border-black p-2 text-right text-sm">{getTotalMileage()}</td>
              <td className="border-2 border-black p-2 text-right text-sm">{getTotalFuel()}</td>
              <td className="border-2 border-black p-2 text-right text-sm">{getTotalCost()}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-8 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Ответственный сотрудник:</span>
          <span className="text-sm">{data.employeeName}</span>
        </div>
        <div className="flex justify-between items-center border-t-2 border-black pt-4">
          <span className="text-sm font-semibold">Подпись:</span>
          <div className="border-b-2 border-black w-64 h-8"></div>
        </div>
      </div>
    </div>
  )
}