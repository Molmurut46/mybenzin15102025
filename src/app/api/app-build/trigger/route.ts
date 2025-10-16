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

    // Optional: pass inputs from client body
    let inputs: Record<string, string> | undefined = undefined;
    try {
      const body = await request.json().catch(() => null);
      if (body && typeof body === "object" && body.inputs && typeof body.inputs === "object") {
        inputs = body.inputs;
      }
    } catch {}

    const ghRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref, inputs }),
      }
    );

    if (!ghRes.ok) {
      const text = await ghRes.text();
      return NextResponse.json(
        { error: "Failed to trigger workflow", details: text },
        { status: ghRes.status }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("/api/app-build/trigger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}