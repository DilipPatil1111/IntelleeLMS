import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subjectId, type, count = 5, topic = "", questionTypes = [] } = body;

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const topicContext = topic ? ` specifically about "${topic}"` : "";
  const qTypeInstructions = questionTypes.length > 0
    ? `Generate a mix of these question types: ${questionTypes.join(", ")}.`
    : type === "QUIZ" || type === "TEST"
      ? "Generate Multiple Choice Questions (MCQ)."
      : "Generate a mix of SHORT answer and PARAGRAPH questions.";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      questions: generateFallbackQuestions(subject.name, topic, questionTypes, count),
    });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });

    const prompt = `You are an expert educator creating assessment questions for the subject "${subject.name}"${topicContext}.

${qTypeInstructions}

Generate exactly ${count} questions. For each question, return a JSON object with:
- "type": one of "MCQ", "SHORT", or "PARAGRAPH"
- "questionText": a clear, well-formed question
- "marks": appropriate marks (MCQ: 1-2, SHORT: 2-5, PARAGRAPH: 5-10)
- "correctAnswer": the correct answer as text
- "maxLength": null for MCQ, 500 for SHORT, 2000 for PARAGRAPH
- "options": for MCQ only, an array of exactly 4 objects with "optionText" (string) and "isCorrect" (boolean, exactly one true). For non-MCQ, use an empty array [].

Return ONLY a valid JSON array, no markdown, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful educator. Return only a valid JSON array. No markdown fences." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const content = completion.choices[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const validated = questions.map((q: Record<string, unknown>) => ({
      type: q.type || "MCQ",
      questionText: q.questionText || "",
      marks: q.marks || 2,
      correctAnswer: q.correctAnswer || "",
      maxLength: q.maxLength || null,
      options: Array.isArray(q.options) ? q.options.map((o: Record<string, unknown>) => ({
        optionText: o.optionText || "",
        isCorrect: !!o.isCorrect,
      })) : [],
    }));

    return NextResponse.json({ questions: validated });
  } catch (err) {
    console.error("AI generation error:", err);
    return NextResponse.json({
      questions: generateFallbackQuestions(subject.name, topic, questionTypes, count),
    });
  }
}

function generateFallbackQuestions(subjectName: string, topic: string, questionTypes: string[], count: number) {
  const topicLabel = topic || subjectName;
  const questions = [];
  for (let i = 1; i <= count; i++) {
    const useType = questionTypes.length > 0
      ? questionTypes[i % questionTypes.length]
      : i % 3 === 0 ? "PARAGRAPH" : i % 2 === 0 ? "SHORT" : "MCQ";

    if (useType === "MCQ") {
      questions.push({
        type: "MCQ",
        questionText: `What is a fundamental concept of ${topicLabel}? (Question ${i})`,
        marks: 2,
        correctAnswer: "",
        options: [
          { optionText: `Correct answer about ${topicLabel}`, isCorrect: true },
          { optionText: `Incorrect option B for ${topicLabel}`, isCorrect: false },
          { optionText: `Incorrect option C for ${topicLabel}`, isCorrect: false },
          { optionText: `Incorrect option D for ${topicLabel}`, isCorrect: false },
        ],
        maxLength: null,
      });
    } else if (useType === "SHORT") {
      questions.push({
        type: "SHORT",
        questionText: `Briefly explain a key principle of ${topicLabel}. (Question ${i})`,
        marks: 3,
        correctAnswer: `A clear explanation of the key principle of ${topicLabel}.`,
        options: [],
        maxLength: 500,
      });
    } else {
      questions.push({
        type: "PARAGRAPH",
        questionText: `Describe in detail how ${topicLabel} works and its significance. (Question ${i})`,
        marks: 7,
        correctAnswer: `A detailed explanation covering the mechanism and significance of ${topicLabel}.`,
        options: [],
        maxLength: 2000,
      });
    }
  }
  return questions;
}
