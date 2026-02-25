export const generateSvgTemplatePrompt = (prompt: string, type: 'full' | 'side' | 'top', currentSvgData?: string, availableFonts: string[] = []) => {
    let width, height;
    switch (type) {
        case 'side': width = 356; height = 837; break;
        case 'top': width = 1864; height = 90; break;
        case 'full': default: width = 1920; height = 1080; break;
    }

    const fontConstraint = availableFonts.length > 0 
        ? `\n   - CRITICAL FONT ASSIGNMENT: You MUST assign a 'font-family' attribute to ALL <text> elements. You are STRICTLY RESTRICTED to choosing from the following list of available fonts: [${availableFonts.join(', ')}]. DO NOT use any other fonts.`
        : '';

    return `You are an expert SVG designer and Next.js developer.
The user wants to generate a complete custom SVG template based on a prompt.

USER INSTRUCTION:
${prompt}

CURRENT PROJECT CONTEXT (Optional Inspiration):
${currentSvgData || 'None provided'}

Task: Generate a full ${width}x${height} SVG composition and its corresponding mapping JSON for an editor.
The SVG must be a valid, well-formed string with viewBox="0 0 ${width} ${height}".
The JSON must contain an object tracing the editable elements in the SVG, using the following structure:
{
  "item": {
    "svg_1": { "id": "svg_1", "nodeName": "path", "shapes_id": "svg_1", "editor_move": "true", "editor_scale": "true", "editor_rotate": "true" },
    "svg_2": { "id": "svg_2", "nodeName": "text", "editor_move": "true", "editor_scale": "false", "editor_rotate": "true", "attr_rock": "false" }
  },
  "font-list": {
    "SelectedFontName": ["svg_2"]
  }
}
The keys in "item" (e.g., svg_1) MUST match the id="" attributes of the elements inside the SVG.
If there are text elements, you MUST populate the "font-list" object mapping the chosen font family name to an array of SVG IDs that use it.

OUTPUT FORMAT:
You MUST return exactly TWO markdown blocks and nothing else.
1. The first block must be the SVG code. Start with \`\`\`svg and end with \`\`\`.
2. The second block must be the JSON mapping. Start with \`\`\`json and end with \`\`\`.

Rules:
1. ONLY output the two markdown blocks.
2. DO NOT output any conversational text, explanations, or comments.
3. Ensure the SVG is visually stunning and fits the user's prompt.
4. TEXT CONSTRAINTS - STRICT: 
   - DO NOT add any extra padding, margins, or whitespace around text elements. 
   - The maximum allowed text length (\`max-length\`) is EXACTLY 15 characters. 
   - If a sentence or phrase is longer than 15 characters, you MUST either summarize/shorten it to fit within 15 characters OR split it into multiple separate \`<text>\` elements (e.g., Line 1, Line 2) arranged vertically. Never generate a single \`<text>\` node over 15 characters.${fontConstraint}
5. CRITICAL: DO NOT INCLUDE ANY ANIMATIONS. Do not output <animate>, <animateTransform>, <animateMotion>, or any CSS @keyframes. The output SVG MUST be completely static.`;
};
