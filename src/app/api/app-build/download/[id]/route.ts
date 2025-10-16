import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import JSZip from "jszip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REQUIRED_VARS = [
  "GITHUB_TOKEN",
  // owner/repo могут прийти из query, поэтому требуем их только при отсутствии оверрайдов
] as const

function getMissingEnv(overrides?: { owner?: string; repo?: string }) {
  const missing: string[] = []
  if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN === "") missing.push("GITHUB_TOKEN")
  if (!overrides?.owner && (!process.env.GITHUB_REPO_OWNER || process.env.GITHUB_REPO_OWNER === "")) missing.push("GITHUB_REPO_OWNER")
  if (!overrides?.repo && (!process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO_NAME === "")) missing.push("GITHUB_REPO_NAME")
  return missing
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  // Auth: only privileged user can download
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  if (session.user.email !== "89045219234@mail.ru") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const ownerOverride = searchParams.get("owner") || undefined
  const repoOverride = searchParams.get("repo") || undefined

  const missing = getMissingEnv({ owner: ownerOverride || undefined, repo: repoOverride || undefined })
  if (missing.length) {
    return new Response(JSON.stringify({ error: "Missing environment variables", missing }), { status: 400 })
  }

  const owner = (ownerOverride || process.env.GITHUB_REPO_OWNER) as string
  const repo = (repoOverride || process.env.GITHUB_REPO_NAME) as string
  const token = process.env.GITHUB_TOKEN as string
  const artifactId = params.id

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Mybenzin/1.0",
  }

  try {
    // 1) Get artifact details to derive a friendly filename
    const infoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}`,
      { headers: ghHeaders as any, cache: "no-store" }
    )

    if (!infoRes.ok) {
      const text = await infoRes.text()
      return new Response(
        JSON.stringify({ error: "Failed to fetch artifact info", details: text }),
        { status: infoRes.status }
      )
    }

    const info = await infoRes.json()
    const artifactName: string = info?.name || `artifact-${artifactId}`

    // 2) Download the artifact archive (GitHub always returns a ZIP)
    const downloadRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
      { headers: ghHeaders as any, cache: "no-store", redirect: "follow" }
    )

    if (!downloadRes.ok || !downloadRes.body) {
      const text = await downloadRes.text().catch(() => "")
      return new Response(
        JSON.stringify({ error: "Failed to download artifact", details: text }),
        { status: downloadRes.status || 500 }
      )
    }

    // Попытка распаковать и отдать первый .apk или .aab из архива
    const arrayBuf = await downloadRes.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuf)
    const fileNames = Object.keys(zip.files)
    // Сначала ищем .apk, затем .aab
    const apkName = fileNames.find((n) => n.toLowerCase().endsWith(".apk"))
    const aabName = fileNames.find((n) => n.toLowerCase().endsWith(".aab"))
    const picked = apkName || aabName

    if (picked) {
      const file = zip.file(picked)
      if (!file) {
        // Теоретически не должно случиться, но на всякий случай
        // Fallback к исходному ZIP
        return new Response(Buffer.from(arrayBuf), {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${artifactName}.zip"`,
            "Cache-Control": "no-store",
          },
        })
      }
      const nodeBuffer = await file.async("nodebuffer")
      const isApk = picked.toLowerCase().endsWith(".apk")
      const contentType = isApk
        ? "application/vnd.android.package-archive"
        : "application/octet-stream"
      const outName = isApk ? `${artifactName}.apk` : `${artifactName}.aab`

      return new Response(nodeBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${outName}"`,
          "Content-Length": String(nodeBuffer.length),
          "Cache-Control": "no-store",
        },
      })
    }

    // Если .apk/.aab не найдены — отдаём ZIP как есть
    return new Response(Buffer.from(arrayBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${artifactName}.zip"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Internal server error", message: e?.message }), { status: 500 })
  }
}