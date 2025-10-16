import { NextRequest, NextResponse } from "next/server"
import { Octokit } from "@octokit/rest"
import JSZip from "jszip"
import fs from "fs"
import path from "path"

export const maxDuration = 60
export const runtime = "nodejs"

interface FileStructure {
  path: string
  content: string
  encoding?: "utf-8" | "base64"
}

// Единая функция для определения бинарных файлов
function isBinaryFile(filename: string): boolean {
  return /\.(png|jpg|jpeg|gif|ico|pdf|zip|woff|woff2|ttf|eot|mp4|mp3|svg|webp|avif|wasm)$/i.test(filename)
}

// Рекурсивное чтение файлов проекта
async function readProjectFiles(dir: string, baseDir: string = dir): Promise<FileStructure[]> {
  const files: FileStructure[] = []
  
  const excludeDirs = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".vercel",
    ".turbo",
    "__MACOSX"
  ]
  
  const excludeFiles = [
    ".DS_Store",
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".npmrc",
    ".yarnrc",
    ".yarnrc.yml",
    "bun.lock",
    "package-lock.json"
  ]

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(baseDir, fullPath)

      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) continue
        const subFiles = await readProjectFiles(fullPath, baseDir)
        files.push(...subFiles)
      } else {
        if (excludeFiles.includes(entry.name)) continue
        // Игнорировать файлы с потенциальными секретами
        if (
          entry.name.startsWith(".env") ||
          entry.name.endsWith(".key") ||
          entry.name.endsWith(".pem") ||
          entry.name.startsWith("secrets.") ||
          entry.name === ".secrets"
        ) {
          continue
        }
        
        if (isBinaryFile(entry.name)) {
          const content = await fs.promises.readFile(fullPath, "base64")
          files.push({
            path: relativePath.replace(/\\/g, "/"),
            content,
            encoding: "base64",
          })
        } else {
          const content = await fs.promises.readFile(fullPath, "utf-8")
          files.push({
            path: relativePath.replace(/\\/g, "/"),
            content,
            encoding: "utf-8",
          })
        }
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error)
  }

  return files
}

// Helper to get current file tree from GitHub
async function getCurrentTree(octokit: Octokit, owner: string, repo: string, branch: string) {
  try {
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    })
    const commitSha = refData.object.sha

    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: commitSha,
    })

    return {
      baseTreeSha: commitData.tree.sha,
      parentSha: commitSha,
    }
  } catch (error: any) {
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

// Новый helper: получить SHA всех файлов из GitHub
async function getGithubFileShas(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<Map<string, string>> {
  const fileMap = new Map<string, string>()
  
  try {
    const treeData = await getCurrentTree(octokit, owner, repo, branch)
    if (!treeData) return fileMap
    
    // Получаем полное дерево рекурсивно
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: treeData.baseTreeSha,
      recursive: "true",
    })
    
    // Заполняем карту: путь -> SHA
    for (const item of tree.tree) {
      if (item.type === "blob" && item.path && item.sha) {
        fileMap.set(item.path, item.sha)
      }
    }
  } catch (error) {
    console.error("Error fetching GitHub file tree:", error)
  }
  
  return fileMap
}

// Новый helper: вычислить SHA файла (как это делает Git)
function calculateGitBlobSha(content: string, encoding: "utf-8" | "base64"): string {
  const crypto = require("crypto")
  let buffer: Buffer
  
  if (encoding === "base64") {
    buffer = Buffer.from(content, "base64")
  } else {
    buffer = Buffer.from(content, "utf-8")
  }
  
  // Git формат: "blob <size>\0<content>"
  const header = `blob ${buffer.length}\0`
  const store = Buffer.concat([Buffer.from(header), buffer])
  
  return crypto.createHash("sha1").update(store).digest("hex")
}

// Новый helper: сравнить локальные файлы с GitHub и вернуть изменённые
async function compareFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  localFiles: FileStructure[]
): Promise<{
  changed: FileStructure[]
  new: FileStructure[]
  unchanged: FileStructure[]
  deleted: string[]
}> {
  const githubFiles = await getGithubFileShas(octokit, owner, repo, branch)
  
  const changed: FileStructure[] = []
  const newFiles: FileStructure[] = []
  const unchanged: FileStructure[] = []
  const localPaths = new Set<string>()
  
  for (const file of localFiles) {
    localPaths.add(file.path)
    const localSha = calculateGitBlobSha(file.content, file.encoding || "utf-8")
    const githubSha = githubFiles.get(file.path)
    
    if (!githubSha) {
      newFiles.push(file)
    } else if (localSha !== githubSha) {
      changed.push(file)
    } else {
      unchanged.push(file)
    }
  }
  
  // Найти удалённые файлы (есть на GitHub, нет локально)
  const deleted: string[] = []
  for (const [path] of githubFiles) {
    if (!localPaths.has(path)) {
      deleted.push(path)
    }
  }
  
  return { changed, new: newFiles, unchanged, deleted }
}

// Helper to create or update files in GitHub using Git Data API
async function uploadFilesToGithub(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  files: FileStructure[],
  commitMessage: string,
  replaceAll: boolean = false
) {
  const treeData = await getCurrentTree(octokit, owner, repo, branch)

  // Create blobs for all files (in batches to avoid rate limits)
  const batchSize = 50
  const blobs: Array<{
    path: string
    mode: "100644"
    type: "blob"
    sha: string
  }> = []

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const batchBlobs = await Promise.all(
      batch.map(async (file) => {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content: file.content,
          encoding: file.encoding || "utf-8",
        })
        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        }
      })
    )
    blobs.push(...batchBlobs)
  }

  // Create new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    tree: blobs,
    base_tree: replaceAll ? undefined : treeData?.baseTreeSha,
  })

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: treeData ? [treeData.parentSha] : [],
  })

  // Update reference
  if (treeData) {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    })
  } else {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: newCommit.sha,
    })
  }

  return {
    commitSha: newCommit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
  }
}

// Новый helper: коммит одного ZIP файла в корень репозитория
async function commitZipAsSingleFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  zipBase64: string,
  zipName: string,
  commitMessage: string
) {
  const treeData = await getCurrentTree(octokit, owner, repo, branch)

  const { data: blob } = await octokit.git.createBlob({
    owner,
    repo,
    content: zipBase64,
    encoding: "base64",
  })

  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: treeData?.baseTreeSha,
    tree: [
      {
        path: zipName,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      },
    ],
  })

  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: treeData ? [treeData.parentSha] : [],
  })

  if (treeData) {
    await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha })
  } else {
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: newCommit.sha })
  }

  return {
    commitSha: newCommit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
  }
}

// Helper to delete files from GitHub
async function deleteFilesFromGithub(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  filePaths: string[],
  commitMessage: string
) {
  if (filePaths.length === 0) return null

  const treeData = await getCurrentTree(octokit, owner, repo, branch)
  if (!treeData) return null

  // Get current tree recursively
  const { data: currentTree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeData.baseTreeSha,
    recursive: "true",
  })

  // Create new tree without deleted files
  const newTreeItems = currentTree.tree
    .filter((item) => item.type === "blob" && item.path && !filePaths.includes(item.path))
    .map((item) => ({
      path: item.path!,
      mode: item.mode as "100644" | "100755" | "040000" | "160000" | "120000",
      type: item.type as "blob" | "tree" | "commit",
      sha: item.sha!,
    }))

  // Create new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    tree: newTreeItems,
  })

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: [treeData.parentSha],
  })

  // Update reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  })

  return {
    commitSha: newCommit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    deletedCount: filePaths.length,
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const githubToken = formData.get("githubToken") as string
    const owner = formData.get("owner") as string
    const repo = formData.get("repo") as string
    const branch = (formData.get("branch") as string) || "main"
    const zipFile = formData.get("projectZip") as File | null
    const autoMode = formData.get("autoMode") === "true"
    const uploadAsZip = formData.get("uploadAsZip") === "true"
    const zipNameInput = (formData.get("zipName") as string) || ""
    const manualFolder = formData.get("manualFolder") === "true"
    const replaceAll = formData.get("replaceAll") === "true"
    const singleFile = formData.get("singleFile") === "true"
    const finalizeSync = formData.get("finalizeSync") === "true"
    const compareOnly = formData.get("compareOnly") === "true"
    const deleteFiles = formData.get("deleteFiles") === "true"
    const filesToDelete = formData.get("filesToDelete") as string | null

    if (!githubToken || !owner || !repo) {
      return NextResponse.json(
        { error: "Отсутствуют обязательные поля: githubToken, owner, repo" },
        { status: 400 }
      )
    }

    // Initialize Octokit
    const octokit = new Octokit({
      auth: githubToken,
    })

    // Verify credentials
    try {
      await octokit.users.getAuthenticated()
    } catch (error: any) {
      return NextResponse.json(
        { error: "Недействительный GitHub токен" },
        { status: 401 }
      )
    }

    // Verify repository access
    try {
      await octokit.repos.get({ owner, repo })
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: `Репозиторий ${owner}/${repo} не найден или нет доступа` },
          { status: 404 }
        )
      }
      throw error
    }

    // --- НОВЫЙ РЕЖИМ: удаление файлов ---
    if (deleteFiles && filesToDelete) {
      try {
        const paths = JSON.parse(filesToDelete) as string[]
        const result = await deleteFilesFromGithub(
          octokit,
          owner,
          repo,
          branch,
          paths,
          `🗑️ Remove ${paths.length} files from Orchids sync (${new Date().toISOString()}) [skip ci]`
        )
        
        if (result) {
          return NextResponse.json({
            success: true,
            deletedCount: result.deletedCount,
            commitSha: result.commitSha,
            commitUrl: result.commitUrl,
            message: `Удалено ${result.deletedCount} файлов из репозитория`,
          })
        } else {
          return NextResponse.json(
            { error: "Не удалось удалить файлы" },
            { status: 500 }
          )
        }
      } catch (error: any) {
        console.error("Delete files error:", error)
        return NextResponse.json(
          { error: "Ошибка удаления файлов", details: error?.message },
          { status: 500 }
        )
      }
    }

    // --- НОВЫЙ РЕЖИМ: финализация синхронизации (пустой коммит для триггера) ---
    if (finalizeSync) {
      try {
        const treeData = await getCurrentTree(octokit, owner, repo, branch)
        if (!treeData) {
          return NextResponse.json({ success: true, message: "Синхронизация завершена" })
        }

        const { data: newCommit } = await octokit.git.createCommit({
          owner,
          repo,
          message: `🔄 Sync completed from Orchids (${new Date().toISOString()}) [skip ci]`,
          tree: treeData.baseTreeSha,
          parents: [treeData.parentSha],
        })

        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommit.sha,
        })

        return NextResponse.json({
          success: true,
          commitSha: newCommit.sha,
          commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
          message: "Синхронизация завершена",
        })
      } catch (error: any) {
        console.error("Finalize sync error:", error)
        return NextResponse.json({ success: true, message: "Синхронизация завершена (без финального коммита)" })
      }
    }

    // --- НОВЫЙ РЕЖИМ: только сравнение (не загружаем) ---
    if (compareOnly) {
      let files: FileStructure[] = []
      
      if (autoMode) {
        try {
          const projectRoot = process.cwd()
          files = await readProjectFiles(projectRoot)
        } catch (error: any) {
          return NextResponse.json(
            { error: "Ошибка чтения файлов проекта", details: error?.message },
            { status: 500 }
          )
        }
      } else if (zipFile) {
        const arrayBuffer = await zipFile.arrayBuffer()
        const zip = await JSZip.loadAsync(arrayBuffer)
        const filePromises: Promise<void>[] = []

        zip.forEach((relativePath, file) => {
          if (file.dir) return
          if (
            relativePath.includes("node_modules/") ||
            relativePath.includes(".git/") ||
            relativePath.includes(".next/") ||
            relativePath.startsWith("__MACOSX/") ||
            relativePath === ".DS_Store"
          ) {
            return
          }

          const promise = (async () => {
            if (isBinaryFile(relativePath)) {
              const content = await file.async("base64")
              files.push({ path: relativePath, content, encoding: "base64" })
            } else {
              const content = await file.async("string")
              files.push({ path: relativePath, content, encoding: "utf-8" })
            }
          })()

          filePromises.push(promise)
        })

        await Promise.all(filePromises)
      }
      
      if (files.length === 0) {
        return NextResponse.json(
          { error: "Нет файлов для сравнения" },
          { status: 400 }
        )
      }
      
      const comparison = await compareFiles(octokit, owner, repo, branch, files)
      
      return NextResponse.json({
        success: true,
        comparison: {
          changed: comparison.changed.map(f => f.path),
          new: comparison.new.map(f => f.path),
          unchanged: comparison.unchanged.map(f => f.path),
          deleted: comparison.deleted,
        },
        summary: {
          changedCount: comparison.changed.length,
          newCount: comparison.new.length,
          unchangedCount: comparison.unchanged.length,
          deletedCount: comparison.deleted.length,
          totalLocal: files.length,
        },
      })
    }

    // --- НОВЫЙ РЕЖИМ: загрузка одного файла ---
    if (singleFile) {
      const file = formData.get("file") as File | null
      const filePath = formData.get("path") as string

      if (!file || !filePath) {
        return NextResponse.json(
          { error: "Отсутствует файл или путь для режима singleFile" },
          { status: 400 }
        )
      }

      const isBinary = isBinaryFile(filePath) || (file.type && !file.type.startsWith("text/"))
      let content: string
      let encoding: "utf-8" | "base64"

      if (isBinary) {
        const ab = await file.arrayBuffer()
        content = Buffer.from(ab).toString("base64")
        encoding = "base64"
      } else {
        content = await file.text()
        encoding = "utf-8"
      }

      try {
        const treeData = await getCurrentTree(octokit, owner, repo, branch)

        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content,
          encoding,
        })

        const { data: newTree } = await octokit.git.createTree({
          owner,
          repo,
          base_tree: treeData?.baseTreeSha,
          tree: [
            {
              path: filePath,
              mode: "100644",
              type: "blob",
              sha: blob.sha,
            },
          ],
        })

        // Создаём коммит для каждого файла
        const { data: newCommit } = await octokit.git.createCommit({
          owner,
          repo,
          message: `Update ${filePath} [skip ci]`,
          tree: newTree.sha,
          parents: treeData ? [treeData.parentSha] : [],
        })

        // Обновляем ссылку
        if (treeData) {
          await octokit.git.updateRef({
            owner,
            repo,
            ref: `heads/${branch}`,
            sha: newCommit.sha,
          })
        } else {
          await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branch}`,
            sha: newCommit.sha,
          })
        }
        
        return NextResponse.json({
          success: true,
          file: filePath,
          commitSha: newCommit.sha,
          message: `Файл ${filePath} загружен`,
        })
      } catch (error: any) {
        console.error(`Error uploading single file ${filePath}:`, error)
        return NextResponse.json(
          { error: `Ошибка загрузки файла ${filePath}`, details: error?.message },
          { status: 500 }
        )
      }
    }

    // --- ПРИОРИТЕТ: ручная загрузка распакованных файлов (папка) ---
    if (manualFolder) {
      const folderFiles = formData.getAll("folderFiles") as File[]
      const paths = formData.getAll("paths[]") as string[]

      if (!folderFiles.length || folderFiles.length !== paths.length) {
        return NextResponse.json(
          { error: "Неверные данные папки: список файлов или путей пуст/несогласован" },
          { status: 400 }
        )
      }

      const files: FileStructure[] = []
      for (let i = 0; i < folderFiles.length; i++) {
        const file = folderFiles[i]
        const rel = (paths[i] || file.name).replace(/\\/g, "/")
        const isBinary = isBinaryFile(rel) || (file.type && !file.type.startsWith("text/"))
        if (isBinary) {
          const ab = await file.arrayBuffer()
          files.push({ path: rel, content: Buffer.from(ab).toString("base64"), encoding: "base64" })
        } else {
          const text = await file.text()
          files.push({ path: rel, content: text, encoding: "utf-8" })
        }
      }

      const result = await uploadFilesToGithub(
        octokit,
        owner,
        repo,
        branch,
        files,
        `Replace project from folder upload (${new Date().toISOString()})`,
        !!replaceAll
      )

      return NextResponse.json({
        success: true,
        filesUploaded: files.length,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        message: `Успешно загружено ${files.length} файлов (папка) на GitHub${replaceAll ? " с полной заменой" : ""}`,
        mode: "manual-folder",
      })
    }

    // Если требуется заливать как один ZIP файл
    if (uploadAsZip) {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, "0")
      const dd = String(today.getDate()).padStart(2, "0")
      const defaultZip = `${repo || "project"}_${yyyy}-${mm}-${dd}.zip`
      const zipName = zipNameInput?.trim() ? zipNameInput.trim() : defaultZip

      let zipBase64: string | null = null

      if (autoMode) {
        let files: FileStructure[] = []
        try {
          const projectRoot = process.cwd()
          files = await readProjectFiles(projectRoot)
          if (files.length === 0) {
            return NextResponse.json(
              { error: "Не удалось прочитать файлы проекта" },
              { status: 500 }
            )
          }
        } catch (error: any) {
          return NextResponse.json(
            { 
              error: "Ошибка чтения файлов проекта",
              details: error?.message,
              hint: "Автоматическая загрузка может не работать на некоторых хостингах. Используйте ручную загрузку ZIP файла."
            },
            { status: 500 }
          )
        }

        const zip = new JSZip()
        for (const f of files) {
          if (f.encoding === "base64") {
            zip.file(f.path, f.content, { base64: true })
          } else {
            zip.file(f.path, f.content)
          }
        }
        const zipBuffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
        zipBase64 = Buffer.from(zipBuffer).toString("base64")
      } else {
        if (!zipFile) {
          return NextResponse.json(
            { error: "Отсутствует ZIP файл проекта" },
            { status: 400 }
          )
        }
        const ab = await zipFile.arrayBuffer()
        zipBase64 = Buffer.from(ab).toString("base64")
      }

      const result = await commitZipAsSingleFile(
        octokit,
        owner,
        repo,
        branch,
        zipBase64!,
        zipName,
        `chore: upload project archive ${zipName} (${new Date().toISOString()}) [skip ci]`
      )

      return NextResponse.json({
        success: true,
        filesUploaded: 1,
        archive: zipName,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        message: `Архив ${zipName} загружен в ${owner}/${repo}`,
        mode: autoMode ? "auto" : "manual",
        asZip: true,
      })
    }

    // --- Обычный режим: коммит всех файлов по отдельности ---
    let files: FileStructure[] = []

    // AUTO MODE: Read files from current project directory
    if (autoMode) {
      try {
        const projectRoot = process.cwd()
        files = await readProjectFiles(projectRoot)
        
        if (files.length === 0) {
          return NextResponse.json(
            { error: "Не удалось прочитать файлы проекта" },
            { status: 500 }
          )
        }
      } catch (error: any) {
        return NextResponse.json(
          { 
            error: "Ошибка чтения файлов проекта", 
            details: error?.message,
            hint: "Автоматическая загрузка может не работать на некоторых хостингах. Используйте ручную загрузку ZIP файла."
          },
          { status: 500 }
        )
      }
    } 
    // MANUAL MODE: Extract from ZIP file
    else {
      if (!zipFile) {
        return NextResponse.json(
          { error: "Отсутствует ZIP файл проекта" },
          { status: 400 }
        )
      }

      const arrayBuffer = await zipFile.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)

      const filePromises: Promise<void>[] = []

      zip.forEach((relativePath, file) => {
        if (file.dir) return
        
        if (
          relativePath.includes("node_modules/") ||
          relativePath.includes(".git/") ||
          relativePath.includes(".next/") ||
          relativePath.startsWith("__MACOSX/") ||
          relativePath === ".DS_Store"
        ) {
          return
        }

        const promise = (async () => {
          if (isBinaryFile(relativePath)) {
            const content = await file.async("base64")
            files.push({
              path: relativePath,
              content,
              encoding: "base64",
            })
          } else {
            const content = await file.async("string")
            files.push({
              path: relativePath,
              content,
              encoding: "utf-8",
            })
          }
        })()

        filePromises.push(promise)
      })

      await Promise.all(filePromises)

      if (files.length === 0) {
        return NextResponse.json(
          { error: "ZIP файл не содержит файлов проекта" },
          { status: 400 }
        )
      }
    }

    // Upload to GitHub
    const result = await uploadFilesToGithub(
      octokit,
      owner,
      repo,
      branch,
      files,
      `Update project from Orchids constructor (${new Date().toISOString()}) [skip ci]`,
      replaceAll
    )

    return NextResponse.json({
      success: true,
      filesUploaded: files.length,
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
      message: `Успешно загружено ${files.length} файлов на GitHub${replaceAll ? " с полной заменой" : ""}`,
      mode: autoMode ? "auto" : "manual"
    })
  } catch (error: any) {
    console.error("Upload to GitHub error:", error)
    return NextResponse.json(
      {
        error: "Ошибка загрузки на GitHub",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}