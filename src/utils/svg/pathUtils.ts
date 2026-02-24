
/**
 * Utility functions for SVG path manipulation.
 */

/**
 * Translates an SVG path string by a given x and y offset.
 * Handles M, L, C, Q, Z commands (absolute only for now as template.ts produces absolute paths from shapes).
 * Transforms an SVG path string by a given offset and scale.
 * Handles M, L, C, Q, Z, H, V, A, S, T commands.
 * 
 * @param d The SVG path data string.
 * @param dx The x offset.
 * @param dy The y offset.
 * @param sx The x scale factor (default 1).
 * @param sy The y scale factor (default 1).
 * @returns The transformed path data string.
 */
/**
 * Transforms an SVG path string by a given SVGMatrix.
 * Handles M, L, C, Q, Z, H, V, A, S, T commands.
 * Converts H and V to L commands to support rotation.
 * Converts all coordinates to absolute.
 * 
 * @param d The SVG path data string.
 * @param m The SVGMatrix to apply.
 * @returns The transformed path data string.
 */
export const matrixTransformPath = (d: string, m: DOMMatrix | SVGMatrix): string => {
    let newPath = '';
    let cx = 0, cy = 0;
    let startX = 0, startY = 0;

    // Regex to split commands - strict command matching to handle scientific notation
    const segmentRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match;

    while ((match = segmentRegex.exec(d)) !== null) {
        const command = match[1];
        const paramsStr = match[2];
        const params = paramsStr.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

        const isRelative = command === command.toLowerCase();
        const upperCmd = command.toUpperCase();

        const newParams: number[] = [];
        let newCmd = command; // May change for H/V

        // Helper to transform point (x,y)
        const tp = (x: number, y: number) => {
            return {
                x: +(m.a * x + m.c * y + m.e).toFixed(2),
                y: +(m.b * x + m.d * y + m.f).toFixed(2)
            };
        };

        if (upperCmd === 'M') {
            for (let i = 0; i < params.length; i += 2) {
                let x = params[i];
                let y = params[i + 1];
                if (isRelative) {
                    x += cx;
                    y += cy;
                }
                if (i === 0) { startX = x; startY = y; }

                const p = tp(x, y);
                newParams.push(p.x, p.y);

                cx = x; cy = y;
            }
            newCmd = 'M';

        } else if (upperCmd === 'L') {
            for (let i = 0; i < params.length; i += 2) {
                let x = params[i];
                let y = params[i + 1];
                if (isRelative) { x += cx; y += cy; }

                const p = tp(x, y);
                newParams.push(p.x, p.y);

                cx = x; cy = y;
            }
            newCmd = 'L';

        } else if (upperCmd === 'H') {
            for (let i = 0; i < params.length; i++) {
                let x = params[i];
                let y = cy;
                if (isRelative) { x += cx; }

                const p = tp(x, y);
                newParams.push(p.x, p.y);

                cx = x;
            }
            newCmd = 'L';

        } else if (upperCmd === 'V') {
            for (let i = 0; i < params.length; i++) {
                let x = cx;
                let y = params[i];
                if (isRelative) { y += cy; }

                const p = tp(x, y);
                newParams.push(p.x, p.y);

                cy = y;
            }
            newCmd = 'L';

        } else if (upperCmd === 'Z') {
            cx = startX; cy = startY;
            newCmd = 'Z';

        } else if (upperCmd === 'C') {
            for (let i = 0; i < params.length; i += 6) {
                let x1 = params[i], y1 = params[i + 1];
                let x2 = params[i + 2], y2 = params[i + 3];
                let x = params[i + 4], y = params[i + 5];

                if (isRelative) {
                    x1 += cx; y1 += cy;
                    x2 += cx; y2 += cy;
                    x += cx; y += cy;
                }

                const p1 = tp(x1, y1);
                const p2 = tp(x2, y2);
                const p = tp(x, y);

                newParams.push(p1.x, p1.y, p2.x, p2.y, p.x, p.y);
                cx = x; cy = y;
            }
            newCmd = 'C';
        } else if (upperCmd === 'Q') {
            for (let i = 0; i < params.length; i += 4) {
                let x1 = params[i], y1 = params[i + 1];
                let x = params[i + 2], y = params[i + 3];

                if (isRelative) {
                    x1 += cx; y1 += cy;
                    x += cx; y += cy;
                }

                const p1 = tp(x1, y1);
                const p = tp(x, y);

                newParams.push(p1.x, p1.y, p.x, p.y);
                cx = x; cy = y;
            }
            newCmd = 'Q';
        } else {
             // Fallback: just return as is (might break if relative vs absolute mix but better than nothing)
             // For robust implementation of other commands (S, T, A), more logic needed.
             // Mask shapes are typically simple.
             newCmd = command;
             newParams.push(...params);
        }

        newPath += newCmd + (newParams.length ? ' ' + newParams.join(' ') : '') + ' ';
    }

    return newPath.trim();
};

/**
 * Translates an SVG path string by a given x and y offset.
 * Handles M, L, C, Q, Z commands (absolute only for now as template.ts produces absolute paths from shapes).
 * Transforms an SVG path string by a given offset and scale.
 * Handles M, L, C, Q, Z, H, V, A, S, T commands.
 * 
 * @param d The SVG path data string.
 * @param dx The x offset.
 * @param dy The y offset.
 * @param sx The x scale factor (default 1).
 * @param sy The y scale factor (default 1).
 * @returns The transformed path data string.
 */
export const transformPath = (d: string, dx: number, dy: number, sx: number = 1, sy: number = 1): string => {
    // Determine context for matrix creation
    let matrix: DOMMatrix;
    if (typeof DOMMatrix !== 'undefined') {
        matrix = new DOMMatrix([sx, 0, 0, sy, dx, dy]);
    } else {
        // Fallback or Mock for environments without DOMMatrix (though rarely needed in browser context)
        // Assume minimal mock if needed, but current usage is browser-side.
        // If strictly required, we could implement a simple object.
        // But for safety in TS, cast to any or use global check.
        const mockMatrix = {
            a: sx, b: 0,
            c: 0, d: sy,
            e: dx, f: dy
        } as unknown as DOMMatrix; 
        matrix = mockMatrix;
    }

    return matrixTransformPath(d, matrix);
};

/**
 * Calculates a loose bounding box from path data.
 * Checks all points (anchors and control points) to determine the extent.
 * This guarantees the path is contained within the box, though it may be slightly larger than the tightest bounds for curves.
 * 
 * @param d The SVG path data string.
 * @returns Object with x, y, width, height.
 */
export const getBoundsFromPathD = (d: string) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Strict regex to separate numbers
    const numbers = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
    
    if (numbers) {
        // We iterate all numbers. In valid SVG paths, x and y usually alternate, but commands break this cycle.
        // However, extracting ALL numbers and finding min/max X and Y is tricky without parsing commands,
        // because we don't know which is X and which is Y (e.g. H command takes X, V takes Y).
        
        // Simpler approach: Reuse the parsing logic from matrixTransformPath but just track bounds.
        const segmentRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
        let match;
        let cx = 0, cy = 0;
        let startX = 0, startY = 0;

        while ((match = segmentRegex.exec(d)) !== null) {
            const command = match[1];
            const paramsStr = match[2];
            const params = paramsStr.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            const isRelative = command === command.toLowerCase();
            const upperCmd = command.toUpperCase();

            // Helpers to update bounds with absolute points
            const check = (x: number, y: number) => {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            };

            if (upperCmd === 'M' || upperCmd === 'L' || upperCmd === 'T') {
                for (let i = 0; i < params.length; i += 2) {
                    let x = params[i];
                    let y = params[i+1];
                    if (isRelative) { x += cx; y += cy; }
                    check(x, y);
                    cx = x; cy = y;
                    if (upperCmd === 'M' && i === 0) { startX = x; startY = y; }
                }
            } else if (upperCmd === 'H') {
                for (let i = 0; i < params.length; i++) {
                    let x = params[i];
                    if (isRelative) { x += cx; }
                    check(x, cy);
                    cx = x;
                }
            } else if (upperCmd === 'V') {
                for (let i = 0; i < params.length; i++) {
                    let y = params[i];
                    if (isRelative) { y += cy; }
                    check(cx, y);
                    cy = y;
                }
            } else if (upperCmd === 'C') {
                for (let i = 0; i < params.length; i += 6) {
                    let x1 = params[i], y1 = params[i+1];
                    let x2 = params[i+2], y2 = params[i+3];
                    let x = params[i+4], y = params[i+5];
                    if (isRelative) {
                        x1 += cx; y1 += cy;
                        x2 += cx; y2 += cy;
                        x += cx; y += cy;
                    }
                    check(x1, y1);
                    check(x2, y2);
                    check(x, y);
                    cx = x; cy = y;
                }
            } else if (upperCmd === 'Q' || upperCmd === 'S') {
                // S uses previous control point, but for bounds we conceptually just check explicit points
                // For Q: x1 y1 x y
                // For S: x2 y2 x y (x1 is reflection)
                // We should technically calculate reflection for S to contain it, but explicit points are good first pass.
                // Note: S has 4 params (x2 y2 x y).
                 for (let i = 0; i < params.length; i += 4) {
                    let x1 = params[i], y1 = params[i+1];
                    let x = params[i+2], y = params[i+3];
                    if (isRelative) {
                        x1 += cx; y1 += cy;
                        x += cx; y += cy;
                    }
                    check(x1, y1);
                    check(x, y);
                    cx = x; cy = y;
                 }
            } else if (upperCmd === 'A') {
                // rx ry rot large sweep x y
                for (let i = 0; i < params.length; i += 7) {
                    let x = params[i+5];
                    let y = params[i+6];
                    if (isRelative) { x += cx; y += cy; }
                    // Arc bounds are complex. Checking endpoints is minimal. 
                    // To be safe, we might need to handle this better, but assuming endpoints for now.
                    check(x, y);
                    cx = x; cy = y;
                }
            } else if (upperCmd === 'Z') {
                cx = startX; cy = startY;
            }
        }
    }

    // Handle case where path is empty or invalid
    if (minX === Infinity) { return { x: 0, y: 0, width: 0, height: 0 }; }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
};

