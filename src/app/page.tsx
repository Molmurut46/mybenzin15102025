"use client"

import { useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { FileText, Settings, TrendingUp, Clock } from "lucide-react"

export default function Home() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && session?.user) {
      router.push("/dashboard")
    }
  }, [session, isPending, router])

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  if (session?.user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
            Сервис формирования отчётов по бензину
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-3xl mx-auto px-4">
            Автоматизируйте создание отчётов о расходе топлива. Создавайте персональные профили,
            настраивайте график движения и генерируйте типовые отчёты в один клик.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
                Начать работу
              </Button>
            </Link>
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
                Войти
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-12 sm:mt-20">
          <Card>
            <CardHeader>
              <FileText className="w-10 h-10 mb-4 text-primary" />
              <CardTitle>Умные отчёты</CardTitle>
              <CardDescription>
                Автоматическая генерация отчётов на основе вашего графика движения
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Settings className="w-10 h-10 mb-4 text-primary" />
              <CardTitle>Профили пользователей</CardTitle>
              <CardDescription>
                Каждый специалист работает со своими данными независимо
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="w-10 h-10 mb-4 text-primary" />
              <CardTitle>Автоматический расчёт</CardTitle>
              <CardDescription>
                Система сама рассчитывает расход топлива по вашим данным
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="w-10 h-10 mb-4 text-primary" />
              <CardTitle>История отчётов</CardTitle>
              <CardDescription>
                Все отчёты сохраняются и доступны в любое время с любого устройства
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* How it works */}
        <div className="mt-12 sm:mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Как это работает</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-3">Регистрация</h3>
              <p className="text-muted-foreground">
                Создайте аккаунт, указав ФИО и придумав пароль
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-3">Настройка профиля</h3>
              <p className="text-muted-foreground">
                Заполните данные автомобиля и график движения по клиентам
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-3">Создание отчётов</h3>
              <p className="text-muted-foreground">
                Генерируйте типовые отчёты в один клик и экспортируйте в Excel
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 sm:mt-20 text-center px-4">
          <Card className="max-w-2xl mx-auto bg-primary/5">
            <CardContent className="pt-6 sm:pt-8 pb-6 sm:pb-8 px-4 sm:px-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">Готовы начать?</h2>
              <p className="text-muted-foreground mb-6">
                Создайте аккаунт прямо сейчас и получите доступ ко всем функциям сервиса
              </p>
              <Link href="/register" className="inline-block w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
                  Зарегистрироваться бесплатно
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}