import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const REQUIRED_VARS = [
  "GITHUB_TOKEN",
  "GITHUB_REPO_OWNER",
  "GITHUB_REPO_NAME",
  "GITHUB_WORKFLOW_ID",
  "GITHUB_WORKFLOW_REF",
];

function getMissingEnv() {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k] || process.env[k] === "");
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

    const missing = getMissingEnv();
    if (missing.length) {
      return NextResponse.json(
        {
          error: "Missing environment variables",
          missing,
        },
        { status: 400 }
      );
    }

    const owner = process.env.GITHUB_REPO_OWNER as string;
    const repo = process.env.GITHUB_REPO_NAME as string;
    const workflowId = process.env.GITHUB_WORKFLOW_ID as string; // e.g. android.yml or numeric ID
    const ref = process.env.GITHUB_WORKFLOW_REF as string; // e.g. main
    const token = process.env.GITHUB_TOKEN as string;

    // Fetch the latest workflow runs for this workflow
    const runsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?branch=${encodeURIComponent(
        ref
      )}&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      }
    );

    if (!runsRes.ok) {
      const text = await runsRes.text();
      return NextResponse.json(
        { error: "Failed to fetch workflow runs", details: text },
        { status: runsRes.status }
      );
    }

    const runsData = await runsRes.json();
    const latest = runsData?.workflow_runs?.[0];

    if (!latest) {
      return NextResponse.json(
        { run: null, artifacts: [] },
        { status: 200 }
      );
    }

    // Fetch artifacts for the latest run
    const artifactsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${latest.id}/artifacts`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
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

    return NextResponse.json({ run, artifacts }, { status: 200 });
  } catch (error) {
    console.error("/api/app-build/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}