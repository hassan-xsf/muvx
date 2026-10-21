import mammoth from "mammoth"
import * as XLSX from "xlsx"

/**
 * Extracts plain text from diverse document formats (Word .docx, Excel .xlsx,
 * CSV, plain text, JSON, etc.) so that LLM providers (Anthropic Bedrock, OpenRouter,
 * OpenAI, Google) can read their contents without rejecting binary Office MIME types.
 */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mediaType?: string
): Promise<string> {
  const lowerName = (filename || "").toLowerCase()
  const lowerType = (mediaType || "").toLowerCase()

  // 1. Microsoft Word (.docx)
  if (
    lowerName.endsWith(".docx") ||
    lowerType.includes("wordprocessingml") ||
    lowerType.includes("officedocument.word")
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value.trim()
      return `--- [ATTACHED WORD DOCUMENT: ${filename}] ---\n${
        text || "(No readable text found in document)"
      }\n--- [END OF ${filename}] ---`
    } catch (err: any) {
      console.warn(`[DOCX-PARSER] Mammoth failed on ${filename}:`, err?.message)
      // Fallback: search for readable text inside xml
      try {
        const raw = buffer.toString("utf-8")
        const textMatches = raw.match(/<w:t[^>]*>(.*?)<\/w:t>/g)
        if (textMatches && textMatches.length > 0) {
          const stripped = textMatches
            .map((m) => m.replace(/<[^>]+>/g, ""))
            .join(" ")
            .trim()
          return `--- [ATTACHED WORD DOCUMENT: ${filename}] ---\n${stripped}\n--- [END OF ${filename}] ---`
        }
      } catch {}
      return `--- [ATTACHED WORD DOCUMENT: ${filename}] ---\n(Unable to extract text from Word document: ${err?.message || "unsupported format"})\n--- [END OF ${filename}] ---`
    }
  }

  // 2. Microsoft Word legacy (.doc)
  if (lowerName.endsWith(".doc") || lowerType === "application/msword") {
    try {
      // Extract ASCII/printable strings from legacy binary doc
      const raw = buffer.toString("latin1")
      const printable = raw.replace(/[^\x20-\x7E\r\n\t]/g, " ").replace(/\s{2,}/g, " ").trim()
      if (printable.length > 50) {
        return `--- [ATTACHED WORD DOCUMENT: ${filename}] ---\n${printable}\n--- [END OF ${filename}] ---`
      }
    } catch {}
    return `--- [ATTACHED WORD DOCUMENT: ${filename}] ---\n(Legacy .doc format. Please upload as .docx or .pdf for best analysis)\n--- [END OF ${filename}] ---`
  }

  // 3. Microsoft Excel (.xlsx, .xls)
  if (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerType.includes("spreadsheetml") ||
    lowerType.includes("ms-excel")
  ) {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" })
      const sheetTexts: string[] = []

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) {
          sheetTexts.push(`[Sheet: ${sheetName}]\n${csv.trim()}`)
        }
      }

      const combined = sheetTexts.join("\n\n")
      return `--- [ATTACHED SPREADSHEET: ${filename}] ---\n${
        combined || "(Spreadsheet is empty)"
      }\n--- [END OF ${filename}] ---`
    } catch (err: any) {
      console.warn(`[XLSX-PARSER] XLSX parsing failed on ${filename}:`, err?.message)
      return `--- [ATTACHED SPREADSHEET: ${filename}] ---\n(Unable to parse spreadsheet: ${err?.message || "unsupported format"})\n--- [END OF ${filename}] ---`
    }
  }

  // 4. CSV, TSV, Plain Text, JSON, Markdown, Logs, Code
  if (
    lowerType.startsWith("text/") ||
    lowerType.includes("json") ||
    lowerType.includes("csv") ||
    /\.(csv|tsv|txt|json|md|log|env|xml|sql|yaml|yml|html)$/i.test(lowerName)
  ) {
    try {
      const text = buffer.toString("utf-8")
      return `--- [ATTACHED FILE: ${filename}] ---\n${text.trim()}\n--- [END OF ${filename}] ---`
    } catch (err: any) {
      return `--- [ATTACHED FILE: ${filename}] ---\n(Could not decode text file: ${err?.message})\n--- [END OF ${filename}] ---`
    }
  }

  // 5. Fallback for any unknown file format
  try {
    const text = buffer.toString("utf-8")
    // Check if mostly printable characters
    let printableCount = 0
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      const code = text.charCodeAt(i)
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
        printableCount++
      }
    }
    const sampleLen = Math.min(text.length, 1000)
    if (sampleLen > 0 && printableCount / sampleLen > 0.85) {
      return `--- [ATTACHED FILE: ${filename}] ---\n${text.trim()}\n--- [END OF ${filename}] ---`
    }
  } catch {}

  return `--- [ATTACHED FILE: ${filename} (${mediaType || "application/octet-stream"})] ---\n(Binary file attachment with ${buffer.length} bytes)\n--- [END OF ${filename}] ---`
}
