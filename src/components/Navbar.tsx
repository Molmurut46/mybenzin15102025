"use client"

import { useSession, authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LogOut, User, FileText, Settings, Menu, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export const Navbar = () => {
  const { data: session, isPending, refetch } = useSession()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    const { error } = await authClient.signOut()
    if (error?.code) {
      toast.error("Ошибка при выходе")
    } else {
      localStorage.removeItem("bearer_token")
      refetch()
      router.push("/sign-in")
      toast.success("Вы вышли из системы")
    }
    setMobileMenuOpen(false)
  }

  // Trigger session refetch when bearer_token appears (after sign-in) and on cross-tab updates
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null
    if (!isPending && token && !session?.user) {
      refetch()
    }
  }, [isPending, session?.user, refetch])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "bearer_token") {
        refetch()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refetch])

  const isPrivileged = session?.user?.email === "89045219234@mail.ru"

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4 sm:space-x-8">
            <Link href="/" className="text-lg sm:text-xl font-bold truncate">
              Mybenzin
            </Link>
            {session?.user && (
              <div className="hidden md:flex space-x-4">
                <Link href="/dashboard">
                  <Button variant="ghost" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Мои отчёты
                  </Button>
                </Link>
                <Link href="/wizard">
                  <Button variant="ghost" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Настройка профиля
                  </Button>
                </Link>
                {isPrivileged && (
                  <Link href="/app">
                    <Button variant="ghost" className="gap-2">
                      <Smartphone className="w-4 h-4" />
                      Приложение
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {isPending ? (
              <div className="text-sm text-muted-foreground">Загрузка...</div>
            ) : session?.user ? (
              <>
                {/* Desktop menu */}
                <div className="hidden md:flex items-center space-x-4">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4" />
                    <span className="font-medium">{session.user.name}</span>
                  </div>
                  <Button onClick={handleSignOut} variant="outline" className="gap-2">
                    <LogOut className="w-4 h-4" />
                    Выход
                  </Button>
                </div>

                {/* Mobile menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="outline" size="icon">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {session.user.name}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-3 mt-6">
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start gap-2">
                          <FileText className="w-4 h-4" />
                          Мои отчёты
                        </Button>
                      </Link>
                      <Link href="/wizard" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start gap-2">
                          <Settings className="w-4 h-4" />
                          Настройка профиля
                        </Button>
                      </Link>
                      {isPrivileged && (
                        <Link href="/app" onClick={() => setMobileMenuOpen(false)}>
                          <Button variant="ghost" className="w-full justify-start gap-2">
                            <Smartphone className="w-4 h-4" />
                            Приложение
                          </Button>
                        </Link>
                      )}
                      <Button onClick={handleSignOut} variant="outline" className="w-full justify-start gap-2 mt-4">
                        <LogOut className="w-4 h-4" />
                        Выход
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <div className="flex space-x-2">
                <Link href="/sign-in">
                  <Button variant="outline" size="sm" className="sm:size-default">Вход</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="sm:size-default">Регистрация</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}