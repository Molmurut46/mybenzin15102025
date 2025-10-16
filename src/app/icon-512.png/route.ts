import { NextResponse } from "next/server";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const svgPath = path.join(process.cwd(), "public", "icons", "fuel-nozzle.svg");
    const svg = await fs.readFile(svgPath);

    const pngBuffer = await sharp(svg)
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
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