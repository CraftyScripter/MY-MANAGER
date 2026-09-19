import { NextResponse } from "next/server";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a .csv file" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      const rowCount = range.e.r - range.s.r;

      const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        defval: null,
      });

      const headerRowIndex = detectHeaderRow(rawData);
      const headers = (rawData[headerRowIndex] || []).map((h) =>
        h != null ? String(h).trim() : ""
      );

      const sampleRows: (string | null)[][] = [];
      const maxSample = Math.min(5, rawData.length - headerRowIndex - 1);
      for (let i = headerRowIndex + 1; i < headerRowIndex + 1 + maxSample; i++) {
        const row = rawData[i];
        if (!row) continue;
        const mapped: (string | null)[] = [];
        for (let ci = 0; ci < headers.length; ci++) {
          const val = row[ci];
          if (val === null || val === undefined) {
            mapped.push(null);
          } else if (typeof val === "number") {
            mapped.push(String(val));
          } else {
            mapped.push(String(val).trim() || null);
          }
        }
        if (mapped.some((v) => v !== null && v !== "")) {
          sampleRows.push(mapped);
        }
      }

      return {
        name,
        rowCount,
        headers,
        sampleRows,
        headerRowIndex,
      };
    });

    return NextResponse.json({
      success: true,
      sheetCount: sheets.length,
      sheets,
    });
  } catch (error) {
    console.error("Detect sheets error:", error);
    return NextResponse.json(
      { error: "Failed to detect sheets" },
      { status: 500 }
    );
  }
}

function detectHeaderRow(rawData: (string | number | null)[][]): number {
  if (rawData.length === 0) return 0;
  const maxScan = Math.min(rawData.length, 10);
  let bestRow = 0;
  let bestScore = 0;

  for (let i = 0; i < maxScan; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;
    let nonEmpty = 0;
    let textCells = 0;
    for (const cell of row) {
      const str = String(cell ?? "").trim();
      if (str !== "") {
        nonEmpty++;
        if (/^[a-zA-Z\s\-&.]+$/.test(str)) textCells++;
      }
    }
    const score = nonEmpty * 2 + textCells;
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  return bestRow;
}
