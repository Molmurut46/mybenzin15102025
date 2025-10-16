import { NextResponse } from "next/server";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs"; // sharp requires Node.js runtime

export async function GET(
  _req: Request,
  { params }: { params: { size: string } }
) {
  try {
    const n = Number(params.size);
    const size = Number.isFinite(n) ? Math.max(16, Math.min(1024, Math.floor(n))) : 512;

    const svgPath = path.join(process.cwd(), "public", "icons", "fuel-nozzle.svg");
    const svg = await fs.readFile(svgPath);

    const pngBuffer = await sharp(svg)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Icon generation failed" }, { status: 500 });
  }
}