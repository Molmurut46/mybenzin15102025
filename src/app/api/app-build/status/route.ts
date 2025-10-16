import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_VARS = [
  "GITHUB_TOKEN",
  // Остальные параметры могут прийти из query, поэтому требуем их только при отсутствии оверрайдов
] as const;

function getMissingEnv(overrides?: { owner?: string; repo?: string; workflowId?: string; ref?: string }) {
  const missing: string[] = [];
  if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN === "") missing.push("GITHUB_TOKEN");
  if (!overrides?.owner && (!process.env.GITHUB_REPO_OWNER || process.env.GITHUB_REPO_OWNER === "")) missing.push("GITHUB_REPO_OWNER");
  if (!overrides?.repo && (!process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO_NAME === "")) missing.push("GITHUB_REPO_NAME");
  if (!overrides?.workflowId && (!process.env.GITHUB_WORKFLOW_ID || process.env.GITHUB_WORKFLOW_ID === "")) missing.push("GITHUB_WORKFLOW_ID");
  if (!overrides?.ref && (!process.env.GITHUB_WORKFLOW_REF || process.env.GITHUB_WORKFLOW_REF === "")) missing.push("GITHUB_WORKFLOW_REF");
  return missing;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.email !== "89045219234@mail.ru") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ownerOverride = searchParams.get("owner") || undefined;
    const repoOverride = searchParams.get("repo") || undefined;
    const refOverride = searchParams.get("ref") || undefined;
    const workflowIdOverride = searchParams.get("workflowId") || undefined;

    const missing = getMissingEnv({ owner: ownerOverride, repo: repoOverride, workflowId: workflowIdOverride, ref: refOverride });
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
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Mybenzin/1.0",
    } as const;

    // Fetch the latest workflow runs for this workflow
    const buildRunsUrl = (wid: string | number, withBranch = true) =>
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${wid}/runs${withBranch ? `?branch=${encodeURIComponent(ref)}` : ""}&per_page=1`;

    let runsRes = await fetch(buildRunsUrl(workflowId, true), {
      headers: commonHeaders,
      cache: "no-store",
    });

    // If branch is invalid or validation error, retry without branch filter
    if (!runsRes.ok && (runsRes.status === 400 || runsRes.status === 422)) {
      runsRes = await fetch(buildRunsUrl(workflowId, false), {
        headers: commonHeaders,
        cache: "no-store",
      });
    }

    // If specific workflow not found (404), try to resolve numeric id via listing workflows and retry
    if (!runsRes.ok && runsRes.status === 404) {
      const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows`, { headers: commonHeaders });
      if (listRes.ok) {
        const data = (await listRes.json()) as { workflows?: Array<{ id: number; name: string; path: string; state: string }> };
        const wantedRaw = `${workflowId}`.toLowerCase();
        const wantedBase = wantedRaw.replace(/^.*\//, "").replace(/\.(yml|yaml)$/i, "");
        const match = data.workflows?.find((w) => {
          const p = (w.path || "").toLowerCase();
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
        if (match?.id) {
          workflowId = String(match.id);
          runsRes = await fetch(buildRunsUrl(match.id, true), { headers: commonHeaders, cache: "no-store" });
          if (!runsRes.ok && (runsRes.status === 400 || runsRes.status === 422)) {
            runsRes = await fetch(buildRunsUrl(match.id, false), { headers: commonHeaders, cache: "no-store" });
          }
        }
      }
    }

    // Fallback: if specific workflow still not accessible (404) or forbidden, try fetching latest runs across repo
    if (!runsRes.ok && (runsRes.status === 404 || runsRes.status === 403)) {
      const fallbackUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(
        ref
      )}&per_page=1`;
      runsRes = await fetch(fallbackUrl, {
        headers: commonHeaders,
        cache: "no-store",
      });

      // And if still failing due to branch/validation, try without branch
      if (!runsRes.ok && (runsRes.status === 400 || runsRes.status === 422)) {
        const fallbackNoBranchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`;
        runsRes = await fetch(fallbackNoBranchUrl, {
          headers: commonHeaders,
          cache: "no-store",
        });
      }
    }

    if (!runsRes.ok) {
      const text = await runsRes.text();
      return NextResponse.json(
        { error: "Failed to fetch workflow runs", details: text },
        { status: runsRes.status }
      );
    }

    const runsData = await runsRes.json();
    const latest = (runsData?.workflow_runs || runsData?.runs || [])[0];

    if (!latest) {
      return NextResponse.json(
        { run: null, artifacts: [], used: { owner, repo, workflowId, ref } },
        { status: 200 }
      );
    }

    // Fetch artifacts for the latest run
    const artifactsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${latest.id}/artifacts`,
      {
        headers: commonHeaders,
        cache: "no-store",
      }
    );

    let artifacts: any[] = [];
    if (artifactsRes.ok) {
      const artifactsJson = await artifactsRes.json();
      artifacts = (artifactsJson?.artifacts || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        size_in_bytes: a.size_in_bytes,
        expired: a.expired,
        created_at: a.created_at,
        expires_at: a.expires_at,
        archive_download_url: a.archive_download_url,
      }));
    }

    const run = {
      id: latest.id,
      status: latest.status,
      conclusion: latest.conclusion,
      html_url: latest.html_url,
      created_at: latest.created_at,
      updated_at: latest.updated_at,
      head_branch: latest.head_branch,
      head_sha: latest.head_sha,
    };

    // When failed, collect a concise logs snippet from the failing job
    let errorSnippet: string | null = null;
    try {
      if (run.conclusion && run.conclusion !== "success") {
        const jobsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/runs/${latest.id}/jobs`,
          { headers: commonHeaders, cache: "no-store" }
        );
        if (jobsRes.ok) {
          const jobsJson = await jobsRes.json();
          const jobs: any[] = jobsJson?.jobs || [];
          const failing = jobs.find((j) => j.conclusion === "failure") || jobs[jobs.length - 1];
          if (failing?.id && failing?.logs_url) {
            const logsRes = await fetch(failing.logs_url, { headers: commonHeaders, cache: "no-store", redirect: "follow" });
            if (logsRes.ok) {
              const text = await logsRes.text();
              const lines = text.split(/\r?\n/);
              // Ищем характерные строки ошибок и возвращаем контекст вокруг них
              const patterns = [
                /No file in /i,
                /No such file or directory/i,
                /error:/i,
                /Error /,
                /FAILED/i,
                /failure/i,
                /Command .* failed/i,
              ];
              let idx = -1;
              for (const p of patterns) {
                idx = lines.findIndex((l) => p.test(l));
                if (idx !== -1) break;
              }
              if (idx !== -1) {
                const start = Math.max(0, idx - 20);
                const end = Math.min(lines.length, idx + 40);
                errorSnippet = lines.slice(start, end).join("\n");
              } else {
                // если явных ошибок не нашли — вернём хвост лога
                const tail = lines.slice(-120);
                errorSnippet = tail.join("\n");
              }
            }
          }
        }
      }
    } catch (_) {
      // ignore snippet errors
    }

    return NextResponse.json({ run, artifacts, errorSnippet, used: { owner, repo, workflowId, ref } }, { status: 200 });
  } catch (error) {
    console.error("/api/app-build/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}