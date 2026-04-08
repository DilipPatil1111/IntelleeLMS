import { requireTeacherPortal } from "@/lib/api-auth";
import { NextResponse } from "next/server";

interface ParsedQuestion {
  type: "MCQ" | "SHORT" | "PARAGRAPH";
  questionText: string;
  marks: number;
  correctAnswer: string;
  options: { optionText: string; isCorrect: boolean }[];
  maxLength: number | null;
}

export async function POST(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const content = await file.text();

    let questions: ParsedQuestion[] = [];

    if (fileName.endsWith(".csv")) {
      questions = parseCSV(content);
    } else if (fileName.endsWith(".pdf")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      questions = await parsePDF(buffer);
    } else if (fileName.endsWith(".doc") || fileName.endsWith(".docx")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      questions = await parseWord(buffer);
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use .csv, .pdf, .doc, or .docx" }, { status: 400 });
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: "No questions could be parsed from the file. Please check the format." }, { status: 400 });
    }

    return NextResponse.json({ questions, count: questions.length });
  } catch (err) {
    console.error("File import error:", err);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}

function parseCSV(content: string): ParsedQuestion[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = parseCSVLine(headerLine);

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const normalized = h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized.includes("type") || normalized === "questiontype") colMap.type = i;
    else if (normalized.includes("question") && !normalized.includes("type")) colMap.question = i;
    else if (normalized === "marks" || normalized === "mark" || normalized === "points") colMap.marks = i;
    else if (normalized === "correctoption" || normalized === "correctchoice") colMap.correctOption = i;
    else if (normalized.includes("correct") && normalized.includes("answer")) colMap.correctAnswer = i;
    else if (normalized === "optiona" || normalized === "option1") colMap.optionA = i;
    else if (normalized === "optionb" || normalized === "option2") colMap.optionB = i;
    else if (normalized === "optionc" || normalized === "option3") colMap.optionC = i;
    else if (normalized === "optiond" || normalized === "option4") colMap.optionD = i;
    else if (normalized === "answer" && colMap.correctAnswer === undefined) colMap.correctAnswer = i;
  });

  if (colMap.question === undefined) return [];

  const questions: ParsedQuestion[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || !cols[colMap.question]?.trim()) continue;

    const typeRaw = (cols[colMap.type ?? -1] || "MCQ").trim().toUpperCase();
    const type: "MCQ" | "SHORT" | "PARAGRAPH" =
      typeRaw === "SHORT" ? "SHORT" : typeRaw === "PARAGRAPH" ? "PARAGRAPH" : "MCQ";

    const questionText = cols[colMap.question].trim();
    const marks = parseFloat(cols[colMap.marks ?? -1]) || (type === "MCQ" ? 2 : type === "SHORT" ? 3 : 7);
    const correctAnswerCell =
      colMap.correctAnswer !== undefined ? (cols[colMap.correctAnswer] || "").trim() : "";
    const correctAnswer = correctAnswerCell;

    const options: { optionText: string; isCorrect: boolean }[] = [];
    if (type === "MCQ") {
      /** Prefer dedicated "Correct option" column; else "Correct Answer" (A–D), as in standard MCQ CSV templates. */
      const correctOptCell =
        colMap.correctOption !== undefined ? (cols[colMap.correctOption] || "").trim() : correctAnswerCell;
      const letterMatch = correctOptCell.toUpperCase().match(/[ABCD]/);
      const correctOpt = letterMatch ? letterMatch[0] : "A";
      const optTexts = [
        cols[colMap.optionA ?? -1],
        cols[colMap.optionB ?? -1],
        cols[colMap.optionC ?? -1],
        cols[colMap.optionD ?? -1],
      ];
      const labels = ["A", "B", "C", "D"];
      optTexts.forEach((text, idx) => {
        if (text?.trim()) {
          options.push({ optionText: text.trim(), isCorrect: correctOpt === labels[idx] });
        }
      });
      if (options.length > 0 && !options.some((o) => o.isCorrect)) {
        options[0].isCorrect = true;
      }
    }

    questions.push({
      type,
      questionText,
      marks,
      correctAnswer,
      options,
      maxLength: type === "SHORT" ? 500 : type === "PARAGRAPH" ? 2000 : null,
    });
  }

  return questions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function parsePDF(buffer: Buffer): Promise<ParsedQuestion[]> {
  try {
    const text = buffer.toString("utf-8");
    return parseTextToQuestions(text);
  } catch {
    return [];
  }
}

async function parseWord(buffer: Buffer): Promise<ParsedQuestion[]> {
  try {
    const text = buffer.toString("utf-8");
    return parseTextToQuestions(text);
  } catch {
    return [];
  }
}

function parseTextToQuestions(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const blocks = text.split(/(?=\d+[\.\)]\s)/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 10) continue;

    const qMatch = trimmed.match(/^\d+[.)]\s*([\s\S]*)/);
    if (!qMatch) continue;

    let questionText = qMatch[1].trim();
    const optionPattern = /^[a-dA-D][\.\)]\s*(.*)/gm;
    const foundOptions: string[] = [];
    let match;

    while ((match = optionPattern.exec(trimmed)) !== null) {
      foundOptions.push(match[1].trim());
    }

    if (foundOptions.length >= 2) {
      questionText = questionText.split(/\n[a-dA-D][\.\)]/)[0].trim();
      questions.push({
        type: "MCQ",
        questionText,
        marks: 2,
        correctAnswer: "",
        options: foundOptions.slice(0, 4).map((opt, idx) => ({
          optionText: opt,
          isCorrect: idx === 0,
        })),
        maxLength: null,
      });
    } else {
      questions.push({
        type: "SHORT",
        questionText,
        marks: 3,
        correctAnswer: "",
        options: [],
        maxLength: 500,
      });
    }
  }

  return questions;
}
