"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const { refetch } = useSession()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  const validatePassword = (password: string) => {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push("Минимум 8 символов")
    }
    if (!/[a-zA-Z]/.test(password)) {
      errors.push("Должен содержать буквы")
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Должен содержать цифры")
    }
    if (/^\d+$/.test(password)) {
      errors.push("Не может состоять только из цифр")
    }
    
    return errors
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value
    setFormData({ ...formData, password: newPassword })
    setPasswordErrors(validatePassword(newPassword))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordErrors.length > 0) {
      toast.error("Пароль не соответствует требованиям")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Пароли не совпадают")
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await authClient.signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name
      })

      if (error?.code) {
        const errorMap: Record<string, string> = {
          USER_ALREADY_EXISTS: "Email уже зарегистрирован"
        }
        toast.error(errorMap[error.code] || "Ошибка регистрации")
        return
      }

      // Send welcome email (don't fail registration if it fails)
      try {
        await fetch("/api/send-welcome-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name
          })
        })
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError)
        // Continue with registration even if email fails
      }

      // Обновляем сессию перед редиректом
      await refetch()

      toast.success("Аккаунт создан! Проверьте email и войдите в систему.")
      
      // Даём время на обновление UI
      setTimeout(() => {
        router.push("/sign-in?registered=true")
      }, 100)
    } catch (error) {
      toast.error("Ошибка регистрации. Попробуйте снова.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-xl sm:text-2xl">Регистрация</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Создайте аккаунт для доступа к системе отчётов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm sm:text-base">ФИО</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Иванов Иван Иванович"
                className="text-sm sm:text-base"
              />
            </div>

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
                  onChange={handlePasswordChange}
                  required
                  autoComplete="off"
                  className={`text-sm sm:text-base pr-10 ${passwordErrors.length > 0 && formData.password ? "border-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordErrors.length > 0 && formData.password && (
                <div className="text-xs text-red-500 space-y-1">
                  <p className="font-medium">Требования к паролю:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {passwordErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {formData.password && passwordErrors.length === 0 && (
                <p className="text-xs text-green-600">✓ Пароль соответствует всем требованиям</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm sm:text-base">Подтвердите пароль</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  autoComplete="off"
                  className={`text-sm sm:text-base pr-10 ${
                    formData.confirmPassword && 
                    formData.password !== formData.confirmPassword
                      ? "border-red-500"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500">Пароли не совпадают</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full text-sm sm:text-base"
              disabled={isLoading || passwordErrors.length > 0}
            >
              {isLoading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Уже есть аккаунт? </span>
              <Link href="/sign-in" className="text-primary hover:underline">
                Войти
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}