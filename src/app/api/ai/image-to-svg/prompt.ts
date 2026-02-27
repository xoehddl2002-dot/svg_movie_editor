export const generateImageToSvgPrompt = (prompt: string, type: 'full' | 'side' | 'top' = 'full', availableFonts: string[] = []) => {
    let width, height;
    switch (type) {
        case 'side': width = 356; height = 837; break;
        case 'top': width = 1864; height = 90; break;
        case 'full': default: width = 1920; height = 1080; break;
    }
    const fontConstraint = availableFonts.length > 0 
        ? `\n   - CRITICAL FONT ASSIGNMENT: You MUST assign a 'font-family' attribute to ALL <text> elements. You are STRICTLY RESTRICTED to choosing from the following list of available fonts: [${availableFonts.join(', ')}]. DO NOT use any other fonts.`
        : '';

    return `You are an expert SVG designer, UI/UX analyst, and Next.js developer.
The user has provided an IMAGE and an optional text prompt. Your task is to analyze the image and convert it into an editable SVG video template.

USER INSTRUCTION:
${prompt || 'Analyze the attached image and create a matching SVG template.'}

Goal: Generate a full ${width}x${height} SVG composition and its corresponding mapping JSON for our editor based on the provided image's layout and style. 
Do NOT just trace the image into a single complex path. You must abstract the image into a reusable TEMPLATE.

TEMPLATE RULES:
1. Photos/Images in the original: If the original image has a photo or illustration, represent it as a masked section using the EXACT following nested structure.
   - You MUST generate this exact structure:
     <g id="svg_wrapper_1">
       <defs>
         <rect id="shape_1" x="something" y="something" width="something" height="something" />
       </defs>
       <clipPath id="clip_1">
         <use href="#shape_1"/>
       </clipPath>
       <g clip-path="url(#clip_1)" id="svg_clip_1">
         <image id="svg_img_1" href="___BASE64_IMAGE___" x="image_x" y="image_y" width="image_w" height="image_h" preserveAspectRatio="none" />
       </g>
     </g>
   - For the boundary shape (\`rect\`), use simple shapes like \`<rect>\` or \`<circle>\` (DO NOT use \`<path>\`).
   - Fill in \`image_x\`, \`image_y\`, \`image_w\`, \`image_h\` so the image covers the required area.
   - The JSON should list ONLY the OUTERMOST \`<g>\` tag (the one with \`id="svg_wrapper_1"\`) in the "item" object.
   - For this item, set \`"nodeName": "g"\` and \`"image_id": "svg_wrapper_1"\`.
   - You MUST add an "image-list" object in the JSON mapping the outer \`<g>\`'s id to the URL: "___BASE64_IMAGE___".
2. Text in the original: Convert text into editable \`<text>\` elements. Try to match the font size, color, and position.
3. Shapes/Backgrounds: Convert buttons, borders, backgrounds, and simple icons into \`<rect>\`, \`<circle>\`, \`<path>\`, etc.

The SVG must be a valid, well-formed string with viewBox="0 0 ${width} ${height}".
The JSON must contain an object tracing the editable elements in the SVG, using the following structure:
{
  "item": {
    "svg_1": { "id": "svg_1", "nodeName": "path", "shapes_id": "svg_1", "editor_move": "true", "editor_scale": "true", "editor_rotate": "true" },
    "svg_2": { "id": "svg_2", "nodeName": "text", "editor_move": "true", "editor_scale": "false", "editor_rotate": "true", "attr_rock": "false" },
    "svg_3": { "id": "svg_3", "nodeName": "g", "image_id": "svg_3", "editor_move": "true", "editor_scale": "true", "editor_rotate": "true" }
  },
  "font-list": {
    "SelectedFontName": ["svg_2"]
  },
  "image-list": {
    "/assets/no-img.svg": ["svg_3"]
  }
}

JSON MAPPING DEPTH RULES:
1. ONLY immediate children (depth 1) of the root \`<svg>\` element should be included in the "item" list. DO NOT include elements that are nested deeper.
2. If elements are grouped together using a \`<g>\` tag, the \`<g>\` tag MUST have an id, and ONLY this \`<g>\` tag itself should be added as a single "item" in the JSON. The individual child elements inside the \`<g>\` MUST NOT have ids and MUST NOT be included in the "item" JSON.
3. Every immediate child (depth 1) of the \`<svg>\`, including the background \`<rect>\`, MUST have a unique id and MUST be included in the "item" JSON.

The keys in "item" (e.g., svg_1) MUST match the id="" attributes of the elements inside the SVG.
If there are text elements, you MUST populate the "font-list" object.

OUTPUT FORMAT:
You MUST return exactly TWO markdown blocks and nothing else.
1. The first block must be the SVG code. Start with \`\`\`svg and end with \`\`\`.
2. The second block must be the JSON mapping. Start with \`\`\`json and end with \`\`\`.

Rules:
1. ONLY output the two markdown blocks.
2. DO NOT output any conversational text, explanations, or comments.
3. Ensure the SVG layout represents the provided image, but as a clean, editable template.
4. TEXT CONSTRAINTS - STRICT: 
   - DO NOT add any extra padding, margins, or whitespace around text elements. 
   - The maximum allowed text length (\`max-length\`) is EXACTLY 15 characters. 
   - If a sentence or phrase is longer than 15 characters, you MUST either summarize/shorten it to fit within 15 characters OR split it into multiple separate \`<text>\` elements (e.g., Line 1, Line 2) arranged vertically. Never generate a single \`<text>\` node over 15 characters.${fontConstraint}
5. CRITICAL: DO NOT INCLUDE ANY ANIMATIONS. Do not output <animate>, <animateTransform>, <animateMotion>, or any CSS @keyframes. The output SVG MUST be completely static.`;
};
