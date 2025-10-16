"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Smartphone, Play, Download, ExternalLink, RefreshCcw } from "lucide-react"

export const AppPageClient = () => {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [run, setRun] = useState<null | {
    id: number
    status: string
    conclusion: string | null
    html_url: string
    created_at: string
    updated_at: string
    head_branch: string
    head_sha: string
  }>(null)
  const [artifacts, setArtifacts] = useState<Array<{
    id: number
    name: string
    size_in_bytes: number
    expired: boolean
    created_at: string
    expires_at: string | null
    archive_download_url: string
  }>>([])

  const isPrivileged = useMemo(() => session?.user?.email === "89045219234@mail.ru", [session?.user?.email])

  useEffect(() => {
    if (!isPending) {
      if (!session?.user) {
        router.push("/sign-in")
      } else if (!isPrivileged) {
        router.push("/dashboard")
      }
    }
  }, [isPending, session?.user, isPrivileged, router])

  const fetchStatus = async () => {
    setStatusLoading(true)
    setErrorMsg(null)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null
      const res = await fetch("/api/app-build/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Ошибка запроса статуса")
      }
      setRun(data.run)
      setArtifacts(data.artifacts || [])
    } catch (e: any) {
      setErrorMsg(e?.message || "Не удалось получить статус")
    } finally {
      setStatusLoading(false)
    }
  }

  const triggerBuild = async () => {
    setTriggerLoading(true)
    setErrorMsg(null)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null
      const res = await fetch("/api/app-build/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Ошибка запуска сборки")
      }
      // После удачного запуска обновим статус
      await fetchStatus()
    } catch (e: any) {
      setErrorMsg(e?.message || "Не удалось запустить сборку")
    } finally {
      setTriggerLoading(false)
    }
  }

  useEffect(() => {
    // Загружаем статус при входе, если доступ есть
    if (session?.user && isPrivileged) {
      fetchStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, isPrivileged])

  if (isPending) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Загрузка…</div>
    )
  }

  if (!session?.user || !isPrivileged) {
    return null
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <Smartphone className="w-6 h-6" />
        <h1 className="text-2xl sm:text-3xl font-bold">Приложение</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Управление сборкой Android</CardTitle>
          <CardDescription>
            Здесь запуск сборки, обновление статуса и ссылка на CI. Скачивание артефактов возможно через страницу CI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button onClick={triggerBuild} disabled={triggerLoading} className="gap-2">
              <Play className="w-4 h-4" /> {triggerLoading ? "Запуск…" : "Запустить сборку"}
            </Button>
            <Button onClick={fetchStatus} variant="outline" disabled={statusLoading} className="gap-2">
              <RefreshCcw className="w-4 h-4" /> {statusLoading ? "Обновление…" : "Обновить статус"}
            </Button>
            <Button variant="outline" className="gap-2" disabled>
              <Download className="w-4 h-4" /> Скачать APK/AAB (через CI)
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {run?.html_url ? (
              <a
                href={run.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Открыть CI / историю билдов
              </a>
            ) : (
              <Button variant="ghost" className="gap-2" disabled>
                <ExternalLink className="w-4 h-4" /> Открыть CI / историю билдов
              </Button>
            )}
          </div>
          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
          <div className="space-y-1 text-sm">
            <div className="text-muted-foreground">Текущий статус:</div>
            {run ? (
              <div className="rounded-md border p-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="text-muted-foreground">ID:</span> {run.id}</span>
                  <span><span className="text-muted-foreground">Статус:</span> {run.status}</span>
                  <span><span className="text-muted-foreground">Результат:</span> {run.conclusion ?? "—"}</span>
                  <span><span className="text-muted-foreground">Ветка:</span> {run.head_branch}</span>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">Нет запусков</div>
            )}
          </div>
          {artifacts?.length ? (
            <div className="space-y-1 text-sm">
              <div className="text-muted-foreground">Артефакты последнего билда:</div>
              <ul className="list-disc pl-5 space-y-1">
                {artifacts.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>{a.name} <span className="text-muted-foreground">({Math.round(a.size_in_bytes/1024)} КБ)</span></span>
                    <span className="text-muted-foreground">доступно через CI</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Примечание: загрузка APK/AAB напрямую потребует проксирования скачивания с GitHub с использованием токена. Пока используйте ссылку на CI.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default AppPageClient