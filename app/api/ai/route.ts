import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

• Give only the most important feedback — 2 or 3 specific, actionable suggestions, not a long checklist.
• Ground every suggestion in something the student actually wrote — never bring up a topic they didn't mention.
• Favor suggestions that produce concrete evidence: a photo, a screenshot, a chart, or specific numbers.
• Sound like a helpful mentor speaking directly to the student, not a rubric or a form.
• Encourage evidence, iteration, testing, teamwork, and reflection when appropriate.
`;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to use this feature." },
        { status: 401 }
      );
    }

    const { action, text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
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

Give the student 2 or 3 short, specific, action-oriented suggestions based only on what they actually wrote.

Each suggestion should:

- Reference something specific the student already mentioned (quote or paraphrase it briefly).
- Suggest one concrete next step that would make the entry stronger - not just "explain more."
- Favor suggestions that produce evidence: a photo, a screenshot, a chart, a measurement, a specific number, a name.
- Sound like a helpful mentor talking directly to the student, not a checklist or rubric.

Aim for this tone and level of specificity:
- "You mentioned testing the drivetrain - could you add a chart or the actual numbers from that test?"
- "You said the CAD model was updated - a quick screenshot of the new design would be great to include here."
- "You built the intake mechanism - a photo of the finished part would help show the progress."

Do NOT ask generic questions like "can you explain more?" or "what did you learn?"

Do NOT bring up anything the student didn't already mention. If they didn't mention CAD, testing, or programming, don't suggest it.

Do NOT invent details.

Return HTML like this:

<ul>
<li>Suggestion...</li>
<li>Suggestion...</li>
<li>Suggestion...</li>
</ul>

Meeting Note:

${text}
`;
    } else {
      return NextResponse.json({ error: "Unknown AI action." }, { status: 400 });
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
