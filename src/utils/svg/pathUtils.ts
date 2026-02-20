
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
export const transformPath = (d: string, dx: number, dy: number, sx: number = 1, sy: number = 1): string => {
    return d.replace(/([a-zA-Z])\s*([^a-zA-Z]*)/g, (match, command, params) => {
        const nums = params.trim().split(/[\s,]+/).map(Number);

        // Skip if no parameters (like Z)
        if (nums.length === 0 || (nums.length === 1 && nums[0] === 0 && params.trim() === '')) {
            return match;
        }

        const newNums: number[] = [];

        // Helper to transform X
        const tx = (val: number) => +(val * sx + dx).toFixed(2);
        // Helper to transform Y
        const ty = (val: number) => +(val * sy + dy).toFixed(2);
        // Helper to scale X (for dimensions like rx)
        const scx = (val: number) => +(val * sx).toFixed(2);
        // Helper to scale Y (for dimensions like ry)
        const scy = (val: number) => +(val * sy).toFixed(2);

        // X, Y pairs logic
        for (let i = 0; i < nums.length; i++) {
            // Processing based on command type (Absolute)
            // Note: Relative commands (lower case) are NOT correctly handled by this simple logic 
            // if we just apply absolute transform. 
            // However, we assume inputs are absolute or we apply naive transform which might be wrong for relative.
            // But basic shapes usually use Absolute.
            // Fixing relative commands requires tracking current point, which is complex.
            // We will assumes Absolute commands (Upper case) for safety, or apply scale only to relative?
            // Relative translation: dx=0, dy=0. Scale is valid.
            // Let's stick to Absolute command support mainly.

            const isRelative = command === command.toLowerCase();
            // For relative commands, translation (dx, dy) should not be applied, only scaling.
            // The tx/ty helpers already include dx/dy, so for relative, we need to subtract them back out
            // or just apply scaling directly. Let's apply scaling directly for relative.

            if (command.toUpperCase() === 'M' || command.toUpperCase() === 'L' || command.toUpperCase() === 'T') {
                if (i + 1 < nums.length) {
                    if (isRelative) {
                        newNums.push(+(nums[i] * sx).toFixed(2));
                        newNums.push(+(nums[i + 1] * sy).toFixed(2));
                    } else {
                        newNums.push(tx(nums[i]));
                        newNums.push(ty(nums[i + 1]));
                    }
                    i++;
                }
            } else if (command.toUpperCase() === 'C' || command.toUpperCase() === 'S' || command.toUpperCase() === 'Q') {
                // All pairs are points
                if (i + 1 < nums.length) {
                    if (isRelative) {
                        newNums.push(+(nums[i] * sx).toFixed(2));
                        newNums.push(+(nums[i + 1] * sy).toFixed(2));
                    } else {
                        newNums.push(tx(nums[i]));
                        newNums.push(ty(nums[i + 1]));
                    }
                    i++;
                }
            } else if (command.toUpperCase() === 'H') {
                if (isRelative) {
                    newNums.push(+(nums[i] * sx).toFixed(2));
                } else {
                    newNums.push(tx(nums[i]));
                }
            } else if (command.toUpperCase() === 'V') {
                if (isRelative) {
                    newNums.push(+(nums[i] * sy).toFixed(2));
                } else {
                    newNums.push(ty(nums[i]));
                }
            } else if (command.toUpperCase() === 'A') {
                // rx ry rot large sweep x y
                if (i + 6 < nums.length) {
                    newNums.push(scx(nums[i]));     // rx
                    newNums.push(scy(nums[i + 1]));   // ry
                    newNums.push(nums[i + 2]);        // rot (unchanged)
                    newNums.push(nums[i + 3]);        // large
                    newNums.push(nums[i + 4]);        // sweep

                    if (isRelative) {
                        newNums.push(+(nums[i + 5] * sx).toFixed(2));
                        newNums.push(+(nums[i + 6] * sy).toFixed(2));
                    } else {
                        newNums.push(tx(nums[i + 5]));
                        newNums.push(ty(nums[i + 6]));
                    }
                    i += 6;
                }
            } else if (command.toUpperCase() === 'Z') {
                // No params
            } else {
                // Fallback for unknown
                newNums.push(nums[i]);
            }
        }

        return `${command} ${newNums.join(' ')}`;
    });
};
