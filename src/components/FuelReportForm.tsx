"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"

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

interface FuelReportFormProps {
  formData: {
    month: string
    year: string
    carName: string
    carNumber: string
    fuelPrices: FuelPrice[]
    consumption: string
    clients: Client[]
    employeeName: string
  }
  onFormChange: (data: any) => void
}

export default function FuelReportForm({ formData, onFormChange }: FuelReportFormProps) {
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ]

  const daysOfWeek = [
    "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"
  ]

  const addFuelPrice = () => {
    onFormChange({
      ...formData,
      fuelPrices: [...formData.fuelPrices, { id: Date.now().toString(), price: "" }]
    })
  }

  const removeFuelPrice = (id: string) => {
    onFormChange({
      ...formData,
      fuelPrices: formData.fuelPrices.filter((p: FuelPrice) => p.id !== id)
    })
  }

  const updateFuelPrice = (id: string, price: string) => {
    onFormChange({
      ...formData,
      fuelPrices: formData.fuelPrices.map((p: FuelPrice) => 
        p.id === id ? { ...p, price } : p
      )
    })
  }

  const addClient = () => {
    onFormChange({
      ...formData,
      clients: [...formData.clients, { id: Date.now().toString(), day: "", name: "", mileage: "" }]
    })
  }

  const removeClient = (id: string) => {
    onFormChange({
      ...formData,
      clients: formData.clients.filter((c: Client) => c.id !== id)
    })
  }

  const updateClient = (id: string, field: string, value: string) => {
    onFormChange({
      ...formData,
      clients: formData.clients.map((c: Client) => 
        c.id === id ? { ...c, [field]: value } : c
      )
    })
  }

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border">
      <h2 className="text-2xl font-bold">Форма отчёта</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="month">Месяц</Label>
          <select
            id="month"
            className="w-full h-10 px-3 rounded-md border border-input bg-background"
            value={formData.month}
            onChange={(e) => onFormChange({ ...formData, month: e.target.value })}
          >
            <option value="">Выберите месяц</option>
            {months.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="year">Год</Label>
          <Input
            id="year"
            type="number"
            placeholder="2024"
            value={formData.year}
            onChange={(e) => onFormChange({ ...formData, year: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="carName">Название автомобиля</Label>
          <Input
            id="carName"
            placeholder="Toyota Camry"
            value={formData.carName}
            onChange={(e) => onFormChange({ ...formData, carName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="carNumber">Номер автомобиля</Label>
          <Input
            id="carNumber"
            placeholder="А123БВ777"
            value={formData.carNumber}
            onChange={(e) => onFormChange({ ...formData, carNumber: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="consumption">Расход на 100 км (л)</Label>
          <Input
            id="consumption"
            type="number"
            step="0.1"
            placeholder="8.5"
            value={formData.consumption}
            onChange={(e) => onFormChange({ ...formData, consumption: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeName">Фамилия сотрудника</Label>
          <Input
            id="employeeName"
            placeholder="Иванов"
            value={formData.employeeName}
            onChange={(e) => onFormChange({ ...formData, employeeName: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label>Цены на бензин за месяц</Label>
          <Button onClick={addFuelPrice} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Добавить цену
          </Button>
        </div>
        <div className="space-y-2">
          {formData.fuelPrices.map((price: FuelPrice, index: number) => (
            <div key={price.id} className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                placeholder={`Цена ${index + 1} (руб/л)`}
                value={price.price}
                onChange={(e) => updateFuelPrice(price.id, e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => removeFuelPrice(price.id)} 
                size="icon" 
                variant="destructive"
                disabled={formData.fuelPrices.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label>Клиенты</Label>
          <Button onClick={addClient} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Добавить клиента
          </Button>
        </div>
        <div className="space-y-2">
          {formData.clients.map((client: Client) => (
            <div key={client.id} className="flex gap-2">
              <select
                className="h-10 px-3 rounded-md border border-input bg-background"
                value={client.day}
                onChange={(e) => updateClient(client.id, 'day', e.target.value)}
              >
                <option value="">День недели</option>
                {daysOfWeek.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <Input
                placeholder="Имя клиента"
                value={client.name}
                onChange={(e) => updateClient(client.id, 'name', e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                step="0.1"
                placeholder="Пробег (км)"
                value={client.mileage}
                onChange={(e) => updateClient(client.id, 'mileage', e.target.value)}
                className="w-32"
              />
              <Button 
                onClick={() => removeClient(client.id)} 
                size="icon" 
                variant="destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}