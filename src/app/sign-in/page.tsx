"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { authClient, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import Link from "next/link"

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refetch } = useSession()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("Аккаунт создан! Проверьте email и войдите в систему.")
    }
    if (searchParams.get("reset") === "success") {
      toast.success("Пароль успешно изменён! Войдите с новым паролем.")
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data, error } = await authClient.signIn.email({
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      })

      if (error?.code) {
        toast.error("Неверный email или пароль. Убедитесь, что вы зарегистрированы и попробуйте снова.")
        setIsLoading(false)
        return
      }

      // Обновляем сессию ПЕРЕД редиректом
      await refetch()
      
      toast.success("Вход выполнен успешно!")
      
      // Даём время на обновление UI
      setTimeout(() => {
        router.push("/dashboard")
      }, 100)
    } catch (error) {
      toast.error("Ошибка входа. Попробуйте снова.")
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    const { data, error } = await authClient.signIn.social({
      provider: "google"
    })
    if (error?.code) {
      toast.error("Ошибка входа через Google")
      return
    }
    router.push("/dashboard")
  }

  return (
    <Card className="w-full max-w-md mx-4">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-xl sm:text-2xl">Вход в систему</CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Введите ваши данные для входа
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="text-sm sm:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm sm:text-base">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="off"
                className="text-sm sm:text-base pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={formData.rememberMe}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, rememberMe: checked as boolean })
                }
              />
              <label
                htmlFor="rememberMe"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Запомнить меня
              </label>
            </div>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Забыли пароль?
            </Link>
          </div>

          <Button type="submit" className="w-full text-sm sm:text-base" disabled={isLoading}>
            {isLoading ? "Вход..." : "Войти"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Нет аккаунта? </span>
            <Link href="/register" className="text-primary hover:underline">
              Зарегистрироваться
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Suspense fallback={
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle>Вход в систему</CardTitle>
            <CardDescription>Загрузка...</CardDescription>
          </CardHeader>
        </Card>
      }>
        <SignInForm />
      </Suspense>
    </div>
  )
}