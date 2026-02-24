
export const getRectPath = (x: number, y: number, w: number, h: number, rx: number = 0, ry: number = 0): string => {
    // Basic rect path with optional rounded corners
    // If rx/ry are 0, it's a simple M L L L Z
    if (rx === 0 && ry === 0) {
        return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    }

    // Creating a rounded rect path
    // Clamp rx/ry to not exceed half dimensions
    const crx = Math.min(rx, w / 2);
    const cry = Math.min(ry, h / 2);

    return `
        M ${x + crx} ${y}
        L ${x + w - crx} ${y}
        Q ${x + w} ${y} ${x + w} ${y + cry}
        L ${x + w} ${y + h - cry}
        Q ${x + w} ${y + h} ${x + w - crx} ${y + h}
        L ${x + crx} ${y + h}
        Q ${x} ${y + h} ${x} ${y + h - cry}
        L ${x} ${y + cry}
        Q ${x} ${y} ${x + crx} ${y}
        Z
    `.replace(/\s+/g, ' ').trim();
};

export const getEllipsePath = (x: number, y: number, w: number, h: number): string => {
    // Ellipse using cubic bezier curves (Kappa approximation)
    const kappa = 0.5522848;
    const ox = (w / 2) * kappa; // control point offset horizontal
    const oy = (h / 2) * kappa; // control point offset vertical
    const xe = x + w;           // x-end
    const ye = y + h;           // y-end
    const xm = x + w / 2;       // x-middle
    const ym = y + h / 2;       // y-middle

    return `
        M ${x} ${ym}
        C ${x} ${ym - oy} ${xm - ox} ${y} ${xm} ${y}
        C ${xm + ox} ${y} ${xe} ${ym - oy} ${xe} ${ym}
        C ${xe} ${ym + oy} ${xm + ox} ${ye} ${xm} ${ye}
        C ${xm - ox} ${ye} ${x} ${ym + oy} ${x} ${ym}
        Z
    `.replace(/\s+/g, ' ').trim();
};

export const getTrianglePath = (x: number, y: number, w: number, h: number): string => {
    // Isosceles triangle pointing up
    const xm = x + w / 2;
    return `M ${xm} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
};

export const getStarPath = (x: number, y: number, w: number, h: number): string => {
    // 5-point star
    // Define relative points on a 0-1 scale then map to bounds
    const cx = x + w / 2;
    const cy = y + h / 2;
    const outerRadius = Math.min(w, h) / 2;
    const innerRadius = outerRadius * 0.382;
    const points = 5;

    let d = '';
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / 5) * i - Math.PI / 2; // Start from top
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius; // y grows down

        // However, standard star shape usually expects "up" to be -y. 
        // Our bounds are x,y (top-left) to x+w, y+h (bottom-right).
        // The above calc assumes centered at cx, cy.

        if (i === 0) d += `M ${px} ${py}`;
        else d += ` L ${px} ${py}`;
    }
    d += ' Z';
    return d;
};

export const getPolygonPath = (x: number, y: number, w: number, h: number, sides: number = 5): string => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;

    let d = '';
    for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;

        if (i === 0) d += `M ${px} ${py}`;
        else d += ` L ${px} ${py}`;
    }
    d += ' Z';
    return d;
};
