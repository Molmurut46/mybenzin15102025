import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Return GitHub settings from environment variables
    const settings = {
      token: process.env.GITHUB_TOKEN || "",
      owner: process.env.GITHUB_REPO_OWNER || "",
      repo: process.env.GITHUB_REPO_NAME || "",
      branch: process.env.GITHUB_WORKFLOW_REF || "main",
      workflowId: process.env.GITHUB_WORKFLOW_ID || "",
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to load settings", details: error?.message },
      { status: 500 }
    )
  }
}