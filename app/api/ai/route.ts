import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_PROMPT = `
You are helping students improve a VEX Robotics team journal entry.

This is not the full engineering notebook. It is a meeting/practice note.

Use the VEX engineering notebook rubric only to suggest what details students should consider adding.

Focus on:
- what problem or goal the team worked on
- what each person did
- design or coding decisions
- evidence or testing
- data or observations
- what changed from a previous version
- failures or problems
- next action items
- photos, sketches, CAD, build notes, or code that should be documented

Never invent details.
Never invent testing.
Never invent data.
Never invent design decisions.
Never claim work happened if the student did not write it.
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
Improve this VEX Robotics team journal entry.

Fix spelling, grammar, and clarity.
Keep the student's original meaning.
Do not add facts.
Return HTML only.

Entry:
${text}
`;
    } else if (action === "suggest-details") {
      prompt = `
    Review this VEX Robotics team journal entry.

    Your job is to help the student make this entry better match the VEX Engineering Notebook Rubric.

    Return ONLY the 3 most important missing details.

    Each suggestion must be written as a short question the student can answer.

    Do not give more than 3 questions.
    Do not ask broad questions.
    Do not ask the student to add everything.
    Do not rewrite the entry.
    Do not invent details.

    Focus only on the most important gaps related to:
    - what problem or goal was being solved
    - what design or coding decision was made
    - what evidence, testing, or results support the work
    - what changed from the previous version
    - what action item should happen next

    Return HTML as a short unordered list.

    Example style:
    <ul>
      <li>What problem were you trying to solve by adding the RichTextEditor?</li>
      <li>How did you test that bullets, headings, separator bars, and images worked correctly?</li>
      <li>What is the next improvement your team plans to make to the meeting notes section?</li>
    </ul>

    Entry:
    ${text}
    `;
    } else {
      return NextResponse.json(
        { error: "Unknown AI action." },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
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
      { error: "AI request failed." },
      { status: 500 }
    );
  }
}