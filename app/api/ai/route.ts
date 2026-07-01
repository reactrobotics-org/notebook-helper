import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_PROMPT = `
You are an expert VEX Robotics engineering notebook mentor.

Your purpose is to coach students to write complete, accurate, and authentic meeting notes that support a high-quality engineering notebook.

This is NOT the engineering notebook itself.
It is a record of a team's meeting or practice.

Never invent:
- facts
- testing
- measurements
- programming
- design decisions
- observations
- results

If information is missing, ask questions instead of making assumptions.

Your goal is to help students think like engineers.

When reviewing entries:

• Ask only the most important questions.
• Never overwhelm the student.
• Prefer 2–3 excellent questions over a long checklist.
• Only ask questions directly related to the work described.
• Ignore rubric categories that clearly do not apply.
• Encourage evidence, iteration, testing, teamwork, and reflection when appropriate.
`;

export async function POST(req: Request) {
  try {
    const { action, text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required." },
        { status: 400 }
      );
    }

    let prompt = "";

    if (action === "improve-writing") {
      prompt = `
Improve the following VEX Robotics meeting note.

Requirements:
- Correct grammar and spelling.
- Improve readability.
- Preserve the student's original meaning.
- Do not add facts.
- Do not remove important engineering details.
- Keep the writing concise and professional.
- Return HTML only.

Meeting Note:
${text}
`;
    } else if (action === "suggest-details") {
      prompt = `
Review this VEX Robotics meeting note.

First determine what kind of work this meeting describes.

Possible categories include:
- Mechanical Design
- Programming
- CAD
- Electrical
- Documentation
- Strategy
- Testing
- General Practice

Then:

Return ONLY the 2 or 3 most important questions that would help improve this meeting note.

Each question should:

- Be specific to THIS meeting.
- Help the student better document what actually happened.
- Focus on the biggest gaps.
- Be short.
- Be easy to answer.

Do NOT ask generic questions.

Do NOT ask about CAD if no CAD work was done.

Do NOT ask about programming if no programming was done.

Do NOT ask about testing if testing clearly wasn't part of the meeting.

Do NOT invent details.

Return HTML like this:

<ul>
<li>Question...</li>
<li>Question...</li>
<li>Question...</li>
</ul>

Meeting Note:

${text}
`;
    } else {
      return NextResponse.json(
        { error: "Unknown AI action." },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "system",
          content: BASE_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return NextResponse.json({
      result: response.output_text,
    });
  } catch (error) {
    console.error("AI route error:", error);

    return NextResponse.json(
      {
        error: "AI request failed.",
      },
      { status: 500 }
    );
  }
}