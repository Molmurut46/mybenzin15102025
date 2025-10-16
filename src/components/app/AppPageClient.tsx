"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Smartphone, Play, Download, ExternalLink, RefreshCcw, AlertCircle, FileText, Settings, Upload, Check, Zap, Loader2, Clock, FileSearch, FilePlus, FileEdit, FileX } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import JSZip from "jszip"

interface FileComparison {
  changed: string[]
  new: string[]
  unchanged: string[]
  deleted: string[]
}

interface ComparisonSummary {
  changedCount: number
  newCount: number
  unchangedCount: number
  deletedCount: number
  totalLocal: number
}

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
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [errorSnippet, setErrorSnippet] = useState<string | null>(null)
  const [owner, setOwner] = useState("")
  const [repo, setRepo] = useState("")
  const [refName, setRefName] = useState("")
  const [workflowId, setWorkflowId] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [downloadId, setDownloadId] = useState<number | null>(null)
  const [workflowHints, setWorkflowHints] = useState<Array<{ id: number; name: string; path: string; state: string }> | null>(null)
  const [githubToken, setGithubToken] = useState("")
  const [isUploadingToGithub, setIsUploadingToGithub] = useState(false)
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null)
  const [autoUploadMode, setAutoUploadMode] = useState<"auto" | "manual">("auto")
  const isMountedRef = useRef(true)
  const [downloadingProject, setDownloadingProject] = useState(false)
  const [uploadAsZip, setUploadAsZip] = useState(true)
  const [zipName, setZipName] = useState("")
  const [manualFolderMode, setManualFolderMode] = useState(false)
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<File[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, currentFile: "" })
  const [batchDelay, setBatchDelay] = useState(100)
  
  // New: comparison state
  const [isComparing, setIsComparing] = useState(false)
  const [comparison, setComparison] = useState<FileComparison | null>(null)
  const [comparisonSummary, setComparisonSummary] = useState<ComparisonSummary | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  
  // New: delete files option
  const [deleteRemovedFiles, setDeleteRemovedFiles] = useState(false)
  
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

  useEffect(() => {
    if (typeof window === "undefined") return
    const token = localStorage.getItem("gh_upload_token") || ""
    setGithubToken(token)

    const loadEnvSettings = async () => {
      try {
        const res = await fetch("/api/app-build/github-settings")
        if (res.ok) {
          const envSettings = await res.json()
          
          if (!token && envSettings.token) {
            setGithubToken(envSettings.token)
            localStorage.setItem("gh_upload_token", envSettings.token)
            toast.success("Токен GitHub загружен из .env")
          }
          
          const o = localStorage.getItem("gh_owner") || ""
          const r = localStorage.getItem("gh_repo") || ""
          const rf = localStorage.getItem("gh_ref") || ""
          const wf = localStorage.getItem("gh_workflowId") || ""
          
          if (!o && envSettings.owner) {
            setOwner(envSettings.owner)
            localStorage.setItem("gh_owner", envSettings.owner)
          } else if (o) {
            setOwner(o)
          }
          if (!r && envSettings.repo) {
            setRepo(envSettings.repo)
            localStorage.setItem("gh_repo", envSettings.repo)
          } else if (r) {
            setRepo(r)
          }
          if (!rf && (envSettings.branch || envSettings.ref)) {
            const ref = envSettings.branch || envSettings.ref
            setRefName(ref)
            localStorage.setItem("gh_ref", ref)
          } else if (rf) {
            setRefName(rf)
          }
          if (!wf && envSettings.workflowId) {
            setWorkflowId(envSettings.workflowId)
            localStorage.setItem("gh_workflowId", envSettings.workflowId)
          } else if (wf) {
            setWorkflowId(wf)
          }
        }
      } catch (error) {
        console.error("Failed to load GitHub settings from .env:", error)
      }
    }

    loadEnvSettings()
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    
    const loadStatus = async () => {
      if (session?.user && isPrivileged && isMountedRef.current) {
        try {
          await fetchStatus()
        } catch (error) {
          console.error("Failed to load initial status:", error)
        }
      }
    }
    
    loadStatus()
    
    return () => {
      isMountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.user, isPrivileged])

  const makeDefaultZipName = () => {
    const repoName = (repo?.trim() || "mybenzin15102025").replace(/\s+/g, "-")
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${repoName}_${yyyy}-${mm}-${dd}.zip`
  }

  const buildStatusUrl = () => {
    const params = new URLSearchParams()
    if (owner) params.set("owner", owner)
    if (repo) params.set("repo", repo)
    if (refName) params.set("ref", refName)
    if (workflowId) params.set("workflowId", workflowId)
    const qs = params.toString()
    return qs ? `/api/app-build/status?${qs}` : "/api/app-build/status"
  }

  const fetchStatus = async () => {
    setStatusLoading(true)
    setErrorMsg(null)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null
      const res = await fetch(buildStatusUrl(), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        const base = data?.error || "Ошибка запроса статуса"
        const details = data?.details || data?.message || (Array.isArray(data?.missing) ? `Missing: ${data.missing.join(", ")}` : "")
        const msg = details ? `${base}: ${details}` : base
        throw new Error(msg)
      }
      setRun(data.run)
      setArtifacts(data.artifacts || [])
      setErrorSnippet(data.errorSnippet || null)
      if (data?.used) {
        const { owner: uo, repo: ur, ref: uf, workflowId: uw } = data.used as { owner?: string; repo?: string; ref?: string; workflowId?: string }
        if (!owner && uo) setOwner(uo)
        if (!repo && ur) setRepo(ur)
        if (!refName && uf) setRefName(uf)
        if (!workflowId && uw) setWorkflowId(String(uw))
      }
      const finished = data.run && (data.run.status === "completed" || data.run.conclusion)
      if (finished && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        setAutoRefresh(false)
      }
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
      const body: any = {}
      if (owner) body.owner = owner
      if (repo) body.repo = repo
      if (refName) body.ref = refName
      if (workflowId) body.workflowId = workflowId
      const res = await fetch("/api/app-build/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const base = data?.error || "Ошибка запуска сборки"
        const details = data?.details || data?.message || (Array.isArray(data?.missing) ? `Missing: ${data.missing.join(", ")}` : "")
        const msg = details ? `${base}: ${details}` : base
        if (Array.isArray(data?.workflows)) {
          setWorkflowHints(data.workflows as Array<{ id: number; name: string; path: string; state: string }>)
        }
        if (data?.reason === "Workflow is missing workflow_dispatch trigger" && data?.fix?.ymlSnippet) {
          setErrorMsg(`${msg}\n\n${data?.fix?.message || "Добавьте блок workflow_dispatch в YAML"}`)
          setErrorSnippet(String(data.fix.ymlSnippet))
        }
        throw new Error(msg)
      }
      if (data?.used) {
        const { owner: uo, repo: ur, ref: uf, workflowId: uw } = data.used as { owner?: string; repo?: string; ref?: string; workflowId?: string }
        if (uo) setOwner(uo)
        if (ur) setRepo(ur)
        if (uf) setRefName(uf)
        if (uw) setWorkflowId(String(uw))
      }
      setWorkflowHints(null)
      await fetchStatus()
      startAutoRefresh()
    } catch (e: any) {
      setErrorMsg(e?.message || "Не удалось запустить сборку")
    } finally {
      setTriggerLoading(false)
    }
  }

  const startAutoRefresh = () => {
    if (intervalRef.current) return
    setAutoRefresh(true)
    intervalRef.current = setInterval(() => {
      fetchStatus()
    }, 5000)
  }

  const stopAutoRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setAutoRefresh(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith(".zip")) {
        toast.error("Выберите ZIP файл")
        return
      }
      setSelectedZipFile(file)
      toast.success(`Файл выбран: ${file.name}`)
    }
  }

  const handleDownload = async (id: number, filenameHint?: string) => {
    try {
      setDownloadId(id)
      setErrorMsg(null)
      const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null
      const qs = new URLSearchParams()
      if (owner) qs.set("owner", owner)
      if (repo) qs.set("repo", repo)
      const url = `/api/app-build/download/${id}${qs.toString() ? `?${qs.toString()}` : ""}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        let details = ""
        try { details = await res.text() } catch {}
        throw new Error(details || "Не удалось скачать файл")
      }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const cd = res.headers.get("Content-Disposition") || ""
      let filename = filenameHint || "artifact.apk"
      const m = /filename="([^"]+)"/i.exec(cd)
      if (m?.[1]) filename = m[1]
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (e: any) {
      setErrorMsg(e?.message || "Не удалось скачать файл")
    } finally {
      setDownloadId(null)
    }
  }

  const handleUploadToGithub = async () => {
    if (!githubToken || !owner || !repo) {
      toast.error("Заполните все настройки GitHub")
      return
    }

    if (autoUploadMode === "manual" && !selectedZipFile && !manualFolderMode) {
      toast.error("Выберите ZIP файл проекта")
      return
    }

    setIsUploadingToGithub(true)
    
    try {
      const formData = new FormData()
      formData.append("githubToken", githubToken)
      formData.append("owner", owner)
      formData.append("repo", repo)
      formData.append("branch", refName || "main")

      formData.append("uploadAsZip", String(uploadAsZip))
      if (uploadAsZip) {
        const finalZipName = (zipName?.trim() || makeDefaultZipName())
        formData.append("zipName", finalZipName)
      }
      
      if (autoUploadMode === "auto") {
        formData.append("autoMode", "true")
      } else {
        formData.append("autoMode", "false")
        if (selectedZipFile) {
          formData.append("projectZip", selectedZipFile)
        }
        if (manualFolderMode) {
          formData.set("uploadAsZip", "false")
          formData.append("manualFolder", "true")
          formData.append("replaceAll", "true")
          selectedFolderFiles.forEach((file) => {
            const rel = (file as any).webkitRelativePath || file.name
            formData.append("folderFiles", file)
            formData.append("paths[]", rel)
          })
        }
      }

      const response = await fetch("/api/app-build/upload-to-github", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка загрузки")
      }

      toast.success(data.message)
      if (data.commitUrl) {
        window.open(data.commitUrl, "_blank")
      }
      setSelectedZipFile(null)
    } catch (error: any) {
      console.error("Upload error:", error)
      toast.error(error.message || "Ошибка загрузки на GitHub")
      if (autoUploadMode === "auto") {
        toast.info("Попробуйте ручную загрузку ZIP файла", { duration: 5000 })
      }
    } finally {
      setIsUploadingToGithub(false)
    }
  }

  const handleDownloadProject = async () => {
    try {
      setDownloadingProject(true)
      const res = await fetch("/api/app-build/download-project")
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Не удалось сформировать ZIP проекта")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const cd = res.headers.get("Content-Disposition") || ""
      let filename = "project-export.zip"
      const m = /filename="([^"]+)"/i.exec(cd)
      if (m?.[1]) filename = m[1]
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e?.message || "Ошибка скачивания ZIP проекта")
    } finally {
      setDownloadingProject(false)
    }
  }

  // NEW: Compare files with GitHub
  const handleCompare = async () => {
    if (!githubToken || !owner || !repo) {
      toast.error("Заполните все настройки GitHub")
      return
    }

    setIsComparing(true)
    setComparison(null)
    setComparisonSummary(null)
    
    try {
      toast.info("Сравнение файлов с GitHub...")
      const res = await fetch("/api/app-build/download-project")
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Не удалось получить ZIP проекта")
      }
      const blob = await res.blob()
      
      const formData = new FormData()
      formData.append("githubToken", githubToken)
      formData.append("owner", owner)
      formData.append("repo", repo)
      formData.append("branch", refName || "main")
      formData.append("compareOnly", "true")
      formData.append("autoMode", "false")
      formData.append("projectZip", new File([blob], "project.zip"))

      const response = await fetch("/api/app-build/upload-to-github", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка сравнения")
      }

      setComparison(data.comparison)
      setComparisonSummary(data.summary)
      setShowComparison(true)
      
      const total = data.summary.changedCount + data.summary.newCount
      toast.success(`Найдено изменений: ${total} файлов`)
    } catch (error: any) {
      console.error("Compare error:", error)
      toast.error(error.message || "Ошибка сравнения с GitHub")
    } finally {
      setIsComparing(false)
    }
  }

  // UPDATED: Sync with changes only
  const handleSync = async () => {
    if (!githubToken || !owner || !repo) {
      toast.error("Заполните все настройки GitHub")
      return
    }

    setIsSyncing(true)
    setSyncProgress({ current: 0, total: 0, currentFile: "" })
    
    try {
      toast.info("Загрузка архива проекта...")
      const res = await fetch("/api/app-build/download-project")
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Не удалось получить ZIP проекта")
      }
      const blob = await res.blob()
      
      toast.info("Распаковка архива...")
      const zip = await JSZip.loadAsync(blob)
      
      const allFiles: File[] = []
      const allPaths: string[] = []
      
      const filePromises: Promise<void>[] = []
      
      zip.forEach((relativePath, file) => {
        if (file.dir) return
        
        // Извлекаем имя файла
        const fileName = relativePath.split("/").pop() || ""
        
        if (
          relativePath.includes("node_modules/") ||
          relativePath.includes(".git/") ||
          relativePath.includes(".next/") ||
          relativePath.startsWith("__MACOSX/") ||
          relativePath === ".DS_Store" ||
          (fileName.startsWith(".env") && fileName !== ".env.example") || // Разрешить .env.example
          fileName === ".npmrc" ||
          fileName === ".yarnrc" ||
          fileName === ".yarnrc.yml" ||
          fileName.endsWith(".key") || // Криптографические ключи
          fileName.endsWith(".pem") || // SSL сертификаты
          fileName.startsWith("secrets.") || // Файлы секретов
          fileName === ".secrets" ||
          relativePath === "bun.lock" ||
          relativePath === "package-lock.json"
        ) {
          return
        }

        const promise = (async () => {
          const blob = await file.async("blob")
          const fileObj = new File([blob], fileName, { type: blob.type })
          allFiles.push(fileObj)
          allPaths.push(relativePath)
        })()

        filePromises.push(promise)
      })
      
      await Promise.all(filePromises)
      
      if (allFiles.length === 0) {
        throw new Error("ZIP не содержит файлов проекта")
      }
      
      toast.info(`Подготовлено файлов: ${allFiles.length}`)
      
      // Сравнение с GitHub для определения изменённых файлов
      toast.info("Сравнение с GitHub...")
      const compareFormData = new FormData()
      compareFormData.append("githubToken", githubToken)
      compareFormData.append("owner", owner)
      compareFormData.append("repo", repo)
      compareFormData.append("branch", refName || "main")
      compareFormData.append("compareOnly", "true")
      compareFormData.append("autoMode", "false")
      compareFormData.append("projectZip", new File([blob], "project.zip"))

      const compareRes = await fetch("/api/app-build/upload-to-github", {
        method: "POST",
        body: compareFormData,
      })

      if (!compareRes.ok) {
        // Если сравнение не удалось, загружаем все файлы
        toast.warning("Не удалось сравнить файлы, загружаем всё")
        const files = allFiles
        const paths = allPaths
        setSyncProgress({ current: 0, total: files.length, currentFile: "" })
        
        let uploadedCount = 0
        
        // ИСПРАВЛЕНО: используем правильный цикл с индексами
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const relativePath = paths[i]
          const fileName = relativePath.split("/").pop() || ""
          
          if (
            relativePath.includes("node_modules/") ||
            relativePath.includes(".git/") ||
            relativePath.includes(".next/") ||
            relativePath.startsWith("__MACOSX/") ||
            relativePath === ".DS_Store" ||
            (fileName.startsWith(".env") && fileName !== ".env.example") ||
            fileName === ".npmrc" ||
            fileName === ".yarnrc" ||
            fileName === ".yarnrc.yml" ||
            fileName.endsWith(".key") ||
            fileName.endsWith(".pem") ||
            fileName.startsWith("secrets.") ||
            fileName === ".secrets" ||
            relativePath === "bun.lock" ||
            relativePath === "package-lock.json"
          ) {
            continue
          }
          
          setSyncProgress({ current: uploadedCount + 1, total: files.length, currentFile: relativePath })
          
          const formData = new FormData()
          formData.append("githubToken", githubToken)
          formData.append("owner", owner)
          formData.append("repo", repo)
          formData.append("branch", refName || "main")
          formData.append("singleFile", "true")
          formData.append("file", file)
          formData.append("path", relativePath)
          
          try {
            const response = await fetch("/api/app-build/upload-to-github", {
              method: "POST",
              body: formData,
            })
            
            const data = await response.json()
            
            if (response.ok) {
              uploadedCount++
            }
          } catch (error) {
            console.error(`Error uploading ${relativePath}:`, error)
          }
          
          if (uploadedCount < files.length - 1 && batchDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, batchDelay))
          }
        }

        toast.success(`✅ Синхронизация завершена: ${uploadedCount} из ${files.length} файлов`)
      } else {
        const compareData = await compareRes.json()
        const comparison = compareData.comparison as FileComparison
        
        // Определяем файлы для загрузки (новые + изменённые)
        const filesToUpload = [...comparison.new, ...comparison.changed]
        
        // Удаляем файлы, если включена опция
        if (deleteRemovedFiles && comparison.deleted.length > 0) {
          toast.info(`Удаление ${comparison.deleted.length} файлов из репозитория...`)
          
          const deleteFormData = new FormData()
          deleteFormData.append("githubToken", githubToken)
          deleteFormData.append("owner", owner)
          deleteFormData.append("repo", repo)
          deleteFormData.append("branch", refName || "main")
          deleteFormData.append("deleteFiles", "true")
          deleteFormData.append("filesToDelete", JSON.stringify(comparison.deleted))
          
          try {
            const deleteRes = await fetch("/api/app-build/upload-to-github", {
              method: "POST",
              body: deleteFormData,
            })
            
            if (deleteRes.ok) {
              const deleteData = await deleteRes.json()
              toast.success(`Удалено ${deleteData.deletedCount || comparison.deleted.length} файлов`)
            } else {
              toast.error("Ошибка удаления файлов")
            }
          } catch (error) {
            console.error("Delete error:", error)
            toast.error("Ошибка удаления файлов")
          }
        }
        
        if (filesToUpload.length === 0) {
          const message = deleteRemovedFiles && comparison.deleted.length > 0
            ? "✅ Все файлы актуальны"
            : "✅ Все файлы актуальны, загрузка не требуется"
          toast.success(message)
          setIsSyncing(false)
          setSyncProgress({ current: 0, total: 0, currentFile: "" })
          return
        }
        
        toast.info(`Найдено изменений: ${filesToUpload.length} файлов (${comparison.new.length} новых, ${comparison.changed.length} изменённых)`)
        setSyncProgress({ current: 0, total: filesToUpload.length, currentFile: "" })
        
        let uploadedCount = 0
        
        // Загружаем только изменённые файлы (используем индексы для правильного доступа к путям)
        for (let i = 0; i < allFiles.length; i++) {
          const file = allFiles[i]
          const relativePath = allPaths[i]
          const fileName = relativePath.split("/").pop() || ""
          
          if (
            relativePath.includes("node_modules/") ||
            relativePath.includes(".git/") ||
            relativePath.includes(".next/") ||
            relativePath.startsWith("__MACOSX/") ||
            relativePath === ".DS_Store" ||
            (fileName.startsWith(".env") && fileName !== ".env.example") ||
            fileName === ".npmrc" ||
            fileName === ".yarnrc" ||
            fileName === ".yarnrc.yml" ||
            fileName.endsWith(".key") ||
            fileName.endsWith(".pem") ||
            fileName.startsWith("secrets.") ||
            fileName === ".secrets" ||
            relativePath === "bun.lock" ||
            relativePath === "package-lock.json"
          ) {
            continue
          }
          
          // КРИТИЧНО: Загружаем ТОЛЬКО если файл в списке изменённых
          if (!filesToUpload.includes(relativePath)) {
            continue // Пропускаем неизменённые файлы
          }
          
          setSyncProgress({ current: uploadedCount + 1, total: filesToUpload.length, currentFile: relativePath })
          
          const formData = new FormData()
          formData.append("githubToken", githubToken)
          formData.append("owner", owner)
          formData.append("repo", repo)
          formData.append("branch", refName || "main")
          formData.append("singleFile", "true")
          formData.append("file", file)
          formData.append("path", relativePath)
          
          try {
            const response = await fetch("/api/app-build/upload-to-github", {
              method: "POST",
              body: formData,
            })
            
            const data = await response.json()
            
            if (response.ok) {
              uploadedCount++
            } else {
              console.error(`Failed to upload ${relativePath}:`, data.error)
            }
          } catch (error) {
            console.error(`Error uploading ${relativePath}:`, error)
          }
          
          if (uploadedCount < filesToUpload.length - 1 && batchDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, batchDelay))
          }
        }

        const deletedInfo = deleteRemovedFiles && comparison.deleted.length > 0 
          ? `, удалено ${comparison.deleted.length}` 
          : ""
        toast.success(`✅ Синхронизация завершена: ${uploadedCount} из ${filesToUpload.length} файлов (пропущено ${comparison.unchanged.length} без изменений${deletedInfo})`)
      }
      
      // Финальный коммит
      const formData = new FormData()
      formData.append("githubToken", githubToken)
      formData.append("owner", owner)
      formData.append("repo", repo)
      formData.append("branch", refName || "main")
      formData.append("finalizeSync", "true")
      
      const finalRes = await fetch("/api/app-build/upload-to-github", {
        method: "POST",
        body: formData,
      })
      
      if (finalRes.ok) {
        const finalData = await finalRes.json()
        if (finalData.commitUrl) {
          window.open(finalData.commitUrl, "_blank")
        }
      }
    } catch (error: any) {
      console.error("Sync error:", error)
      toast.error(error.message || "Ошибка синхронизации с GitHub")
    } finally {
      setIsSyncing(false)
      setSyncProgress({ current: 0, total: 0, currentFile: "" })
    }
  }

  if (isPending) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Загрузка…</div>
    )
  }

  if (!session?.user || !isPrivileged) {
    return null
  }

  const isMissingEnvError = errorMsg?.includes("Missing environment variables") || errorMsg?.includes("Missing:")
  const isBadCredentialsError = errorMsg?.includes("Bad credentials") || errorMsg?.includes("401")
  const isBuilding = run && (run.status === "queued" || run.status === "in_progress")
  const isFinished = run && (run.status === "completed" || !!run.conclusion)

  return (
    <div className="min-h-screen bg-background py-4 sm:py-8 px-4">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <Smartphone className="w-6 h-6" />
        <h1 className="text-2xl sm:text-3xl font-bold">Приложение</h1>
      </div>

      {(isMissingEnvError || isBadCredentialsError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Требуется настройка GitHub Actions</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {isBadCredentialsError 
                ? "Токен GitHub недействителен или отсутствует. Проверьте переменные окружения."
                : "Отсутствуют необходимые переменные окружения для интеграции с GitHub Actions."}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm">См. <code className="bg-muted px-1 py-0.5 rounded">GITHUB_ACTIONS_SETUP.md</code> для инструкций по настройке</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* GitHub Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Загрузка проекта на GitHub
          </CardTitle>
          <CardDescription>
            Автоматическая синхронизация текущей версии проекта с GitHub репозиторием
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Settings Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Статус настроек:</span>
            {githubToken && owner && repo ? (
              <Badge variant="default" className="gap-1">
                <Check className="w-3 h-3" />
                Настроено
              </Badge>
            ) : (
              <Badge variant="secondary">Требуется настройка</Badge>
            )}
          </div>

          {/* Unified Repository Parameters (from .env or overridden) */}
          <div className="rounded-md border p-3 bg-muted/30">
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className="flex items-center gap-2 text-sm hover:underline"
            >
              <Settings className="w-4 h-4" /> Параметры репозитория
            </button>
            {showSettings && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">GitHub Token (repo scope)</label>
                  <input
                    value={githubToken}
                    onChange={(e) => {
                      setGithubToken(e.target.value)
                      if (typeof window !== "undefined") localStorage.setItem("gh_upload_token", e.target.value)
                    }}
                    placeholder="ghp_..."
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Owner</label>
                  <input
                    value={owner}
                    onChange={(e) => {
                      setOwner(e.target.value)
                      if (typeof window !== "undefined") localStorage.setItem("gh_owner", e.target.value)
                    }}
                    placeholder="Molmurut46"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Repo</label>
                  <input
                    value={repo}
                    onChange={(e) => {
                      setRepo(e.target.value)
                      if (typeof window !== "undefined") localStorage.setItem("gh_repo", e.target.value)
                    }}
                    placeholder="mybenzin15102025"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Ветка (branch)</label>
                  <input
                    value={refName}
                    onChange={(e) => {
                      setRefName(e.target.value)
                      if (typeof window !== "undefined") localStorage.setItem("gh_ref", e.target.value)
                    }}
                    placeholder="main"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm text-muted-foreground">Workflow ID (имя .yml или ID) — для запуска Actions</label>
                  <input
                    value={workflowId}
                    onChange={(e) => {
                      setWorkflowId(e.target.value)
                      if (typeof window !== "undefined") localStorage.setItem("gh_workflowId", e.target.value)
                    }}
                    placeholder="android.yml"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <Label>Режим загрузки</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={autoUploadMode === "auto" ? "default" : "outline"}
                onClick={() => setAutoUploadMode("auto")}
                className="w-full"
              >
                <Zap className="w-4 h-4 mr-2" />
                Автоматическая
              </Button>
              <Button
                variant={autoUploadMode === "manual" ? "default" : "outline"}
                onClick={() => setAutoUploadMode("manual")}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Ручная (ZIP)
              </Button>
            </div>
          </div>

          {/* Auto Mode Description */}
          {autoUploadMode === "auto" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Автоматический режим:</strong> Проект будет загружен напрямую из текущей файловой системы. 
                Не требуется скачивание ZIP файла.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Примечание: Может не работать на некоторых хостингах (Vercel serverless). В этом случае используйте ручную загрузку.
              </p>
            </div>
          )}

          {/* Manual Mode - File Selection */}
          {autoUploadMode === "manual" && (
            <>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Ручной режим:</strong> Скачайте проект как ZIP из конструктора Orchids, 
                  затем выберите файл для загрузки.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={manualFolderMode}
                    onChange={(e) => {
                      setManualFolderMode(e.target.checked)
                      // reset selections when switching
                      setSelectedZipFile(null)
                      setSelectedFolderFiles([])
                      if (e.target.checked) setUploadAsZip(false)
                    }}
                    className="h-4 w-4"
                  />
                  Загрузить распакованные файлы (папка)
                </label>

                {!manualFolderMode ? (
                  <div className="space-y-2">
                    <Label htmlFor="project-zip">ZIP файл проекта</Label>
                    <Input
                      id="project-zip"
                      type="file"
                      accept=".zip"
                      onChange={handleFileChange}
                    />
                    {selectedZipFile && (
                      <p className="text-xs text-muted-foreground">
                        Выбран: {selectedZipFile.name} ({(selectedZipFile.size / 1024 / 1024).toFixed(2)} МБ)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="project-folder">Папка проекта</Label>
                    {/* @ts-ignore: webkitdirectory is supported in Chromium-based browsers */}
                    <input
                      id="project-folder"
                      type="file"
                      multiple
                      // @ts-ignore
                      webkitdirectory=""
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        setSelectedFolderFiles(files)
                        toast.success(`Выбрано файлов: ${files.length}`)
                      }}
                    />
                    {selectedFolderFiles.length > 0 && (
                      <p className="text-xs text-muted-foreground">Выбрано файлов: {selectedFolderFiles.length}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Zip options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={uploadAsZip}
                onChange={(e) => setUploadAsZip(e.target.checked)}
                className="h-4 w-4"
                disabled={autoUploadMode === "manual" && manualFolderMode}
              />
              Заливать одним архивом (.zip)
            </label>
            {uploadAsZip && (
              <div className="space-y-1">
                <Label htmlFor="zip-name">Имя ZIP файла</Label>
                <Input
                  id="zip-name"
                  value={zipName}
                  onChange={(e) => setZipName(e.target.value)}
                  placeholder={makeDefaultZipName()}
                  disabled={autoUploadMode === "manual" && manualFolderMode}
                />
                <p className="text-xs text-muted-foreground">При загрузке архив будет добавлен одним файлом в корень репозитория. Отключите переключатель, чтобы распаковать файлы в репозитории.</p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUploadToGithub}
            disabled={
              isUploadingToGithub || 
              !githubToken || 
              !owner || 
              !repo ||
              (autoUploadMode === "manual" && !manualFolderMode && !selectedZipFile) ||
              (autoUploadMode === "manual" && manualFolderMode && selectedFolderFiles.length === 0)
            }
            className="w-full gap-2"
            size="lg"
          >
            {isUploadingToGithub ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Загрузка на GitHub...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {autoUploadMode === "auto" 
                  ? (uploadAsZip ? "Загрузить текущую версию (ZIP)" : "Загрузить текущую версию (распаковано)") 
                  : manualFolderMode 
                    ? "Загрузить папку (распаковано)"
                    : (uploadAsZip ? "Загрузить ZIP на GitHub" : "Распаковать ZIP в репозиторий")}
              </>
            )}
          </Button>

          {/* NEW: Comparison Section */}
          <div className="pt-2 border-t">
            <div className="mb-3 text-sm text-muted-foreground">
              <strong>Проверка изменений:</strong> сравнивает локальные файлы с GitHub и показывает список изменённых файлов
            </div>
            
            <Button
              onClick={handleCompare}
              disabled={isComparing || !githubToken || !owner || !repo}
              variant="outline"
              className="w-full gap-2 mb-3"
              size="lg"
            >
              {isComparing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сравнение...
                </>
              ) : (
                <>
                  <FileSearch className="w-4 h-4" />
                  Проверить изменения
                </>
              )}
            </Button>

            {/* Comparison Results */}
            {showComparison && comparisonSummary && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Результаты сравнения</h4>
                  <button
                    onClick={() => setShowComparison(false)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Скрыть
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                    <div className="flex items-center gap-1 text-green-800 dark:text-green-100">
                      <FilePlus className="w-4 h-4" />
                      <span className="font-semibold">{comparisonSummary.newCount}</span>
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-200">Новые</div>
                  </div>
                  
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded">
                    <div className="flex items-center gap-1 text-blue-800 dark:text-blue-100">
                      <FileEdit className="w-4 h-4" />
                      <span className="font-semibold">{comparisonSummary.changedCount}</span>
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-200">Изменённые</div>
                  </div>
                  
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    <div className="flex items-center gap-1 text-gray-800 dark:text-gray-100">
                      <Check className="w-4 h-4" />
                      <span className="font-semibold">{comparisonSummary.unchangedCount}</span>
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-200">Без изменений</div>
                  </div>
                  
                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded">
                    <div className="flex items-center gap-1 text-red-800 dark:text-red-100">
                      <FileX className="w-4 h-4" />
                      <span className="font-semibold">{comparisonSummary.deletedCount}</span>
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-200">Удалённые</div>
                  </div>
                </div>

                {comparison && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {comparison.new.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-green-800 dark:text-green-200 hover:underline">
                          Новые файлы ({comparison.new.length})
                        </summary>
                        <ul className="mt-1 ml-4 text-xs space-y-0.5 text-muted-foreground">
                          {comparison.new.map((path, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <FilePlus className="w-3 h-3 text-green-600" />
                              {path}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    
                    {comparison.changed.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-blue-800 dark:text-blue-200 hover:underline">
                          Изменённые файлы ({comparison.changed.length})
                        </summary>
                        <ul className="mt-1 ml-4 text-xs space-y-0.5 text-muted-foreground">
                          {comparison.changed.map((path, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <FileEdit className="w-3 h-3 text-blue-600" />
                              {path}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    
                    {comparison.deleted.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-red-800 dark:text-red-200 hover:underline">
                          Удалённые файлы ({comparison.deleted.length})
                        </summary>
                        <ul className="mt-1 ml-4 text-xs space-y-0.5 text-muted-foreground">
                          {comparison.deleted.map((path, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <FileX className="w-3 h-3 text-red-600" />
                              {path}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sync Button - обходит ограничения Vercel */}
          <div className="pt-2 border-t">
            <div className="mb-2 text-sm text-muted-foreground">
              <strong>Синхронизация (рекомендуется для Vercel):</strong> скачивает проект, распаковывает в браузере и загружает файлы постепенно на GitHub
            </div>
            
            <div className="mb-3 space-y-2">
              <Label htmlFor="batch-delay" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Задержка между файлами (мс)
              </Label>
              <Input
                id="batch-delay"
                type="number"
                min="0"
                max="5000"
                step="50"
                value={batchDelay}
                onChange={(e) => setBatchDelay(Number(e.target.value))}
                disabled={isSyncing}
              />
              <p className="text-xs text-muted-foreground">
                Рекомендуется 100-500 мс для избежания rate limits. 0 = максимальная скорость.
              </p>
            </div>

            {/* NEW: Delete files option */}
            <div className="mb-3 p-3 bg-muted/50 rounded-lg space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteRemovedFiles}
                  onChange={(e) => setDeleteRemovedFiles(e.target.checked)}
                  className="h-4 w-4"
                  disabled={isSyncing}
                />
                <span className="font-medium">Удалять отсутствующие файлы из репозитория</span>
              </label>
              <p className="text-xs text-muted-foreground ml-6">
                Если включено, файлы которые есть в GitHub, но отсутствуют локально, будут удалены из репозитория
              </p>
              {deleteRemovedFiles && comparisonSummary && comparisonSummary.deletedCount > 0 && (
                <div className="ml-6 mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-semibold">
                      Будет удалено {comparisonSummary.deletedCount} файлов
                    </span>
                  </div>
                </div>
              )}
            </div>

            {isSyncing && syncProgress.total > 0 && (
              <div className="mb-3 space-y-2 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    Загружено: {syncProgress.current} / {syncProgress.total}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-background">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  />
                </div>
                {syncProgress.currentFile && (
                  <p className="text-xs text-muted-foreground truncate">
                    {syncProgress.currentFile}
                  </p>
                )}
              </div>
            )}
            
            <Button
              onClick={handleSync}
              disabled={isSyncing || !githubToken || !owner || !repo}
              variant="default"
              className="w-full gap-2"
              size="lg"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Синхронизация...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-4 h-4" />
                  Синхронизировать с GitHub
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Управление сборкой Android</CardTitle>
          <CardDescription>
            Здесь запуск сборки, обновление статуса и ссылка на CI. Скачивание артефактов возможно через страницу CI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button onClick={triggerBuild} disabled={triggerLoading || !!isBuilding} className="gap-2 w-full">
              <Play className="w-4 h-4" /> {triggerLoading ? "Запуск…" : isBuilding ? "Сборка идёт…" : "Запустить сборку"}
            </Button>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={fetchStatus} variant="outline" disabled={statusLoading} className="gap-2 w-full sm:flex-1">
                <RefreshCcw className="w-4 h-4 animate-[spin_1.2s_linear_infinite]" style={{ animationPlayState: statusLoading ? "running" : "paused" }} />
                {statusLoading ? "Обновление…" : "Обновить статус"}
              </Button>
              {isBuilding ? (
                <Button variant="secondary" onClick={stopAutoRefresh} className="w-full sm:flex-1" disabled={!autoRefresh}>
                  Остановить обновление
                </Button>
              ) : (
                <Button variant="secondary" onClick={startAutoRefresh} className="w-full sm:flex-1" disabled={autoRefresh}>
                  Автообновление
                </Button>
              )}
            </div>
            {artifacts?.length && isFinished ? (
              <Button onClick={() => handleDownload(artifacts[0].id, `${artifacts[0].name}.apk`)} variant="outline" className="gap-2 w-full" disabled={downloadId === artifacts[0].id}>
                <Download className="w-4 h-4" /> {downloadId === artifacts[0].id ? "Загрузка…" : "Скачать APK/AAB"}
              </Button>
            ) : (
              <Button variant="outline" className="gap-2 w-full" disabled>
                <Download className="w-4 h-4" /> Скачать APK/AAB
              </Button>
            )}
          </div>

          {/* Показ ошибки сборки явно и заметно */}
          {isFinished && run?.conclusion && run.conclusion !== "success" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Сборка завершилась с ошибкой</AlertTitle>
              <AlertDescription>
                Статус: {run.status}. Результат: {run.conclusion}. {" "}
                {run?.html_url && (
                  <a
                    href={run.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    Открыть логи CI
                  </a>
                )}
                {errorSnippet ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer select-none text-sm underline underline-offset-2">Показать последние строки логов</summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-destructive/10 p-2 text-xs leading-relaxed whitespace-pre-wrap">
{errorSnippet}
                    </pre>
                  </details>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          {/* If backend suggested a YAML fix snippet (e.g., missing workflow_dispatch), show it clearly */}
          {!isFinished && errorSnippet && errorMsg?.includes("workflow_dispatch") && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Требуется включить ручной запуск workflow</AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-sm">Добавьте блок ниже в файл вашего workflow (.github/workflows/…yml), затем повторите запуск:</p>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs leading-relaxed whitespace-pre">
{errorSnippet}
                </pre>
              </AlertDescription>
            </Alert>
          )}

          {isBuilding && (
            <div className="rounded-md border p-3 bg-muted/50">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Сборка выполняется…</span>
                <span className="text-muted-foreground">{autoRefresh ? "Автообновление каждые 5с" : "Автообновление выключено"}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/3 bg-primary animate-pulse" />
              </div>
              {/* keyframes через Tailwind v4: используем встроенную arbitary animate */}
            </div>
          )}

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
            <p className="text-sm text-destructive whitespace-pre-wrap break-words">{errorMsg}</p>
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
                    <button
                      onClick={() => handleDownload(a.id, `${a.name}.apk`)}
                      disabled={downloadId === a.id}
                      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
                    >
                      <Download className="w-4 h-4" /> {downloadId === a.id ? "Загрузка…" : "Скачать"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Примечание: сервер пытается распаковать артефакт и отдать APK/AAB напрямую. Если в архиве нет таких файлов, будет загружен исходный ZIP.
          </p>
        </CardContent>
      </Card>

      {/* Download full project ZIP */}
      <div className="mt-4">
        <Button
          onClick={handleDownloadProject}
          variant="outline"
          className="w-full gap-2"
          disabled={downloadingProject}
          size="lg"
        >
          {downloadingProject ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Формирование ZIP…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Скачать ZIP проекта
            </>
          )}
        </Button>
      </div>
    </div>
  )
}