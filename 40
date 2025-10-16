import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const REQUIRED_VARS = [
  "GITHUB_TOKEN",
  // owner/repo/workflowId/ref могут прийти из тела запроса, поэтому не требуем их всегда
] as const;

function getMissingEnv(overrides?: { owner?: string; repo?: string; workflowId?: string; ref?: string }) {
  const missing: string[] = [];
  // Всегда требуется токен
  if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN === "") missing.push("GITHUB_TOKEN");
  // Остальные поля требуем только если не переданы в overrides
  if (!overrides?.owner && (!process.env.GITHUB_REPO_OWNER || process.env.GITHUB_REPO_OWNER === "")) missing.push("GITHUB_REPO_OWNER");
  if (!overrides?.repo && (!process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO_NAME === "")) missing.push("GITHUB_REPO_NAME");
  if (!overrides?.workflowId && (!process.env.GITHUB_WORKFLOW_ID || process.env.GITHUB_WORKFLOW_ID === "")) missing.push("GITHUB_WORKFLOW_ID");
  if (!overrides?.ref && (!process.env.GITHUB_WORKFLOW_REF || process.env.GITHUB_WORKFLOW_REF === "")) missing.push("GITHUB_WORKFLOW_REF");
  return missing;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Restrict to privileged email
    if (session.user.email !== "89045219234@mail.ru") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Optional: pass inputs and repo params from client body
    let inputs: Record<string, string> | undefined = undefined;
    let ownerOverride: string | undefined;
    let repoOverride: string | undefined;
    let refOverride: string | undefined;
    let workflowIdOverride: string | undefined;
    try {
      const body = await request.json().catch(() => null);
      if (body && typeof body === "object") {
        if (body.inputs && typeof body.inputs === "object") inputs = body.inputs;
        if (typeof body.owner === "string") ownerOverride = body.owner;
        if (typeof body.repo === "string") repoOverride = body.repo;
        if (typeof body.ref === "string") refOverride = body.ref;
        if (typeof body.workflowId === "string") workflowIdOverride = body.workflowId;
      }
    } catch {}

    const missing = getMissingEnv({
      owner: ownerOverride,
      repo: repoOverride,
      workflowId: workflowIdOverride,
      ref: refOverride,
    });
    if (missing.length) {
      return NextResponse.json(
        {
          error: "Missing environment variables",
          missing,
        },
        { status: 400 }
      );
    }

    const owner = (ownerOverride || process.env.GITHUB_REPO_OWNER) as string;
    const repo = (repoOverride || process.env.GITHUB_REPO_NAME) as string;
    let workflowId = (workflowIdOverride || process.env.GITHUB_WORKFLOW_ID) as string; // e.g. android.yml or numeric ID
    const ref = (refOverride || process.env.GITHUB_WORKFLOW_REF) as string; // e.g. main
    const token = process.env.GITHUB_TOKEN as string;

    const commonHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Mybenzin/1.0",
    } as const;

    // Первичная попытка триггера по переданному workflowId (имя файла или числовой id)
    const dispatch = async (wid: string | number) => {
      return fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${wid}/dispatches`,
        {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({ ref, inputs }),
        }
      );
    };

    let ghRes = await dispatch(workflowId);

    // Если 404, пробуем альтернативные варианты имени файла (добавить .yml/.yaml)
    if (ghRes.status === 404) {
      const base = `${workflowId}`.replace(/^\/+|\/+$/g, "");
      const candidates = base.endsWith(".yml") || base.endsWith(".yaml")
        ? []
        : [
            `${base}.yml`,
            `${base}.yaml`,
            `.github/workflows/${base}.yml`,
            `.github/workflows/${base}.yaml`,
          ];
      for (const cand of candidates) {
        ghRes = await dispatch(cand);
        if (ghRes.ok) {
          workflowId = cand;
          break;
        }
      }
    }

    // Если 422 из-за неожиданных inputs — повторим без inputs
    if (ghRes.status === 422) {
      try {
        const text = await ghRes.clone().text();
        if (text.includes("Unexpected inputs provided")) {
          ghRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
            {
              method: "POST",
              headers: commonHeaders,
              body: JSON.stringify({ ref }), // повтор без inputs
            }
          );
        } else if (text.includes("Workflow does not have 'workflow_dispatch' trigger")) {
          // Явно подсказываем, как добавить workflow_dispatch в YAML
          const ymlSnippet = `# Добавьте этот блок в ваш workflow YAML (на верхнем уровне)
on:
  workflow_dispatch:
    inputs:
      website_url:
        description: "URL вашего сайта (для TWA/Bubblewrap fallback, если используете)"
        required: false
        default: "https://example.com"`;

          return NextResponse.json(
            {
              error: "Failed to trigger workflow",
              details: text,
              reason: "Workflow is missing workflow_dispatch trigger",
              fix: {
                message:
                  "Добавьте блок 'workflow_dispatch' в .github/workflows/<file>.yml и повторите запуск.",
                ymlSnippet,
              },
              used: { owner, repo, workflowId, ref },
              docs: "https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch",
            },
            { status: 422 }
          );
        }
      } catch {}
    }

    // Если 404, пробуем найти точный numeric id через список workflow'ов и повторяем
    if (ghRes.status === 404) {
      const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`, {
        headers: commonHeaders,
      });

      if (listRes.ok) {
        const data = (await listRes.json()) as { workflows?: Array<{ id: number; name: string; path: string; state: string }> };
        const wantedRaw = `${workflowId}`.toLowerCase();
        const wantedBase = wantedRaw
          .replace(/^.*\//, "") // take basename
          .replace(/\.(yml|yaml)$/i, ""); // strip extension
        let match = data.workflows?.find((w) => {
          const p = (w.path || "").toLowerCase(); // e.g. ".github/workflows/android.yml"
          const n = (w.name || "").toLowerCase();
          const pBase = p.replace(/^.*\//, "").replace(/\.(yml|yaml)$/i, "");
          return (
            p.endsWith(`.github/workflows/${wantedRaw}`) ||
            p.endsWith(`/${wantedRaw}`) ||
            pBase === wantedBase ||
            n === wantedRaw ||
            n === wantedBase
          );
        });

        // Доп. эвристики: выбираем Android workflow по имени/пути, если прямого совпадения нет
        if (!match && data.workflows?.length) {
          match = data.workflows.find(w => (w.name || "").toLowerCase().includes("android"))
            || data.workflows.find(w => (w.path || "").toLowerCase().endsWith("/main.yml"))
            || data.workflows[0];
        }

        if (match?.id) {
          workflowId = String(match.id);
          ghRes = await dispatch(match.id);
        }
      }
    }

    if (!ghRes.ok) {
      const text = await ghRes.text();
      // Добавляем дружелюбные подсказки для распространённых причин 404/422
      const hints = {
        note:
          "If you see 404: ensure the token has 'workflow' (and 'repo' for private repos) scopes, the workflow file exists on the target branch, and workflowId matches the filename or numeric id.",
        used: { owner, repo, workflowId, ref },
      } as const;

      // Если 404 — вернём список доступных workflow'ов для подсказки
      let workflows: Array<{ id: number; name: string; path: string; state: string }> | undefined;
      if (ghRes.status === 404) {
        try {
          const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`, {
            headers: commonHeaders,
          });
          if (listRes.ok) {
            const data = (await listRes.json()) as { workflows?: Array<{ id: number; name: string; path: string; state: string }> };
            workflows = (data.workflows || []).map(w => ({ id: w.id, name: w.name, path: w.path, state: w.state }));
          }
        } catch {}
      }

      return NextResponse.json(
        { error: "Failed to trigger workflow", details: text, ...hints, workflows },
        { status: ghRes.status }
      );
    }

    // GitHub returns 204 No Content on success
    return NextResponse.json({ ok: true, used: { owner, repo, workflowId, ref } }, { status: 200 });
  } catch (error) {
    console.error("/api/app-build/trigger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}