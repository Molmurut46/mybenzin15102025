import { NextRequest } from "next/server"
import path from "path"
import fs from "fs/promises"
import JSZip from "jszip"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Список исключений (папки и файлы, которые не должны попадать в ZIP)
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "drizzle/meta",
  ".vercel",
  "coverage",
  "dist",
  "build",
])

const EXCLUDE_FILES = new Set([
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.test.local",
  ".env.production.local",
  "package-lock.json",
  "bun.lock",
  "yarn.lock",
  "pnpm-lock.yaml",
])

const EXCLUDE_FILE_PREFIXES = [
  ".DS_Store",
]

// Утилита проверки, что путь должен быть исключён
function shouldExclude(relPath: string) {
  // Проверяем точное имя файла
  const fileName = path.basename(relPath)
  if (EXCLUDE_FILES.has(fileName)) return true
  
  // Исключаем скрытые директории верхнего уровня явно перечисленные в EXCLUDE_DIRS
  const segments = relPath.split(path.sep)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (EXCLUDE_DIRS.has(segments.slice(0, i + 1).join(path.sep))) return true
    if (EXCLUDE_DIRS.has(seg)) return true
    if (seg.startsWith(".")) {
      // Игнорировать .git, .next уже покрыто, но избегаем иных скрытых системных папок внутри
      if (seg === ".git" || seg === ".next") return true
    }
  }
  return false
}

async function collectFiles(root: string, base: string, zip: JSZip) {
  const entries = await fs.readdir(base, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(base, entry.name)
    const rel = path.relative(root, abs)

    if (shouldExclude(rel)) continue

    if (entry.isDirectory()) {
      await collectFiles(root, abs, zip)
    } else if (entry.isFile()) {
      // Исключим служебные файлы
      if (EXCLUDE_FILE_PREFIXES.some((p) => entry.name.startsWith(p))) continue
      // Читаем как бинарь, добавляем в zip
      const data = await fs.readFile(abs)
      zip.file(rel.replace(/\\/g, "/"), data)
    }
  }
}

export async function GET(_req: NextRequest) {
  try {
    const projectRoot = process.cwd()

    const zip = new JSZip()
    await collectFiles(projectRoot, projectRoot, zip)

    // Генерируем архив как Node.js Buffer
    const nodeBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } })

    // Имя файла с датой
    const now = new Date()
    const stamp = now.toISOString().replace(/[:.]/g, "-")
    const filename = `project-export-${stamp}.zip`

    return new Response(nodeBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Content-Length": String(nodeBuffer.length),
        "Cache-Control": "no-store",
      },
    })
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "Failed to create ZIP", message: e?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}