/**
 * Mathematical utilities.
 * @module math
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria, 2010 Jeff Schiller
 */

import { NS } from "./namespaces";

export interface AngleCoord45 {
    x: number;
    y: number;
    a: number;
}

export interface XYObject {
    x: number;
    y: number;
}

// Constants
const NEAR_ZERO = 1e-14;

// Throw away SVGSVGElement used for creating matrices/transforms.
let svg: SVGSVGElement;
if (typeof document !== 'undefined') {
    svg = document.createElementNS(NS.SVG, "svg") as SVGSVGElement;
}

/**
 * A (hopefully) quicker function to transform a point by a matrix
 * (this function avoids any DOM calls and just does the math).
 * @param x - Float representing the x coordinate
 * @param y - Float representing the y coordinate
 * @param m - Matrix object to transform the point with
 * @returns An x, y object representing the transformed point
 */
export const transformPoint = function (x: number, y: number, m: DOMMatrix | SVGMatrix): XYObject {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
};

/**
 * Helper function to check if the matrix performs no actual transform
 * (i.e. exists for identity purposes).
 * @param m - The matrix object to check
 * @returns Indicates whether or not the matrix is 1,0,0,1,0,0
 */
export const isIdentity = function (m: DOMMatrix | SVGMatrix): boolean {
    return (
        Math.abs(m.a - 1) < NEAR_ZERO &&
        Math.abs(m.b) < NEAR_ZERO &&
        Math.abs(m.c) < NEAR_ZERO &&
        Math.abs(m.d - 1) < NEAR_ZERO &&
        Math.abs(m.e) < NEAR_ZERO &&
        Math.abs(m.f) < NEAR_ZERO
    );
};

/**
 * This function tries to return a `SVGMatrix` that is the multiplication `m1 * m2`.
 * We also round to zero when it's near zero.
 * @param args - Matrix objects to multiply
 * @returns The matrix object resulting from the calculation
 */
export const matrixMultiply = function (...args: (DOMMatrix | SVGMatrix)[]): SVGMatrix {
    const m = args.reduceRight((prev, m1) => {
        return (m1 as SVGMatrix).multiply(prev as SVGMatrix);
    }) as SVGMatrix;

    if (Math.abs(m.a) < NEAR_ZERO) {
        m.a = 0;
    }
    if (Math.abs(m.b) < NEAR_ZERO) {
        m.b = 0;
    }
    if (Math.abs(m.c) < NEAR_ZERO) {
        m.c = 0;
    }
    if (Math.abs(m.d) < NEAR_ZERO) {
        m.d = 0;
    }
    if (Math.abs(m.e) < NEAR_ZERO) {
        m.e = 0;
    }
    if (Math.abs(m.f) < NEAR_ZERO) {
        m.f = 0;
    }

    return m;
};

export const deltaTransformPoint = function (m: SVGMatrix): {
    translateX: number;
    translateY: number;
    angle: number;
    scaleX: number;
    scaleY: number;
} {
    let row0x = m.a;
    let row0y = m.b;
    let row1x = m.c;
    let row1y = m.d;

    let scaleX = Math.sqrt(row0x * row0x + row0y * row0y);
    let scaleY = Math.sqrt(row1x * row1x + row1y * row1y);

    // If determinant is negative, one axis was flipped.
    const determinant = row0x * row1y - row0y * row1x;
    if (determinant < 0) {
        // Flip axis with minimum unit vector dot product.
        if (row0x < row1y) {
            scaleX = -scaleX;
        } else {
            scaleY = -scaleY;
        }
    }

    // Renormalize matrix to remove scale.
    if (scaleX) {
        row0x *= 1 / scaleX;
        row0y *= 1 / scaleX;
    }

    if (scaleY) {
        row1x *= 1 / scaleY;
        row1y *= 1 / scaleY;
    }

    // Compute rotation and renormalize matrix.
    let angle = Math.atan2(row0y, row0x);

    if (angle) {
        // Round very small angles to 0
        if (Math.abs(angle) < 1e-10) {
            angle = 0;
        } else {
            // Rotate(-angle) = [cos(angle), sin(angle), -sin(angle), cos(angle)]
            //                = [row0x, -row0y, row0y, row0x]
            // Thanks to the normalization above.
            const sn = -row0y;
            const cs = row0x;
            const m11 = row0x;
            const m12 = row0y;
            const m21 = row1x;
            const m22 = row1y;
            row0x = cs * m11 + sn * m21;
            row0y = cs * m12 + sn * m22;
            row1x = -sn * m11 + cs * m21;
            row1y = -sn * m12 + cs * m22;
        }
    }

    // Convert into degrees because our rotation functions expect it.
    angle = angle * (180 / Math.PI);
    // The requested parameters are then theta,
    // sx, sy, phi,
    return {
        translateX: m.e,
        translateY: m.f,
        angle: angle,
        scaleX: scaleX,
        scaleY: scaleY,
    };
};

/**
 * See if the given transformlist includes any non-identity transform.
 * @param tlist - The transformlist to check
 * @returns Whether or not a non-identity transform was found
 */
export const hasNonIdentityTransform = function (tlist: SVGTransformList | null): boolean {
    if (!tlist) {
        return false;
    }
    let num = tlist.numberOfItems;
    while (num--) {
        const xform = tlist.getItem(num);
        if (!isIdentity(xform.matrix)) {
            return true;
        }
    }
    return false;
};

export interface TransformedBox {
    tl: XYObject;
    tr: XYObject;
    bl: XYObject;
    br: XYObject;
    aabox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

/**
 * Transforms a rectangle based on the given matrix.
 * @param l - Float with the box's left coordinate
 * @param t - Float with the box's top coordinate
 * @param w - Float with the box width
 * @param h - Float with the box height
 * @param m - Matrix object to transform the box by
 * @returns
 */
export const transformBox = function (l: number, t: number, w: number, h: number, m: DOMMatrix | SVGMatrix): TransformedBox {
    const tl = transformPoint(l, t, m);
    const tr = transformPoint(l + w, t, m);
    const bl = transformPoint(l, t + h, m);
    const br = transformPoint(l + w, t + h, m);

    const minx = Math.min(tl.x, tr.x, bl.x, br.x);
    const maxx = Math.max(tl.x, tr.x, bl.x, br.x);
    const miny = Math.min(tl.y, tr.y, bl.y, br.y);
    const maxy = Math.max(tl.y, tr.y, bl.y, br.y);

    return {
        tl,
        tr,
        bl,
        br,
        aabox: {
            x: minx,
            y: miny,
            width: maxx - minx,
            height: maxy - miny,
        },
    };
};

/**
 * This returns a single matrix Transform for a given Transform List
 * (this is the equivalent of `SVGTransformList.consolidate()` but unlike
 * that method, this one does not modify the actual `SVGTransformList`).
 * This function is very liberal with its `min`, `max` arguments.
 * @param tlist - The transformlist object
 * @param min - Optional integer indicating start transform position
 * @param max - Optional integer indicating end transform position;
 *   defaults to one less than the tlist's `numberOfItems`
 * @returns A single matrix transform object
 */
export const transformListToTransform = function (tlist: SVGTransformList | null, min?: number, max?: number): SVGTransform {
    if (!tlist) {
        // Or should tlist = null have been prevented before this?
        return svg.createSVGTransformFromMatrix(svg.createSVGMatrix());
    }
    min = min || 0;
    max = max || tlist.numberOfItems - 1;
    // min = Number.parseInt(min);
    // max = Number.parseInt(max);
    if (min > max) {
        const temp = max;
        max = min;
        min = temp;
    }
    let m = svg.createSVGMatrix();
    for (let i = min; i <= max; ++i) {
        // if our indices are out of range, just use a harmless identity matrix
        const mtom =
            i >= 0 && i < tlist.numberOfItems
                ? tlist.getItem(i).matrix
                : svg.createSVGMatrix();
        m = matrixMultiply(m, mtom);
    }
    return svg.createSVGTransformFromMatrix(m);
};

/**
 * Get the matrix object for a given element.
 * @param elem - The DOM element to check
 * @returns The matrix object associated with the element's transformlist
 */
export const getMatrix = (elem: SVGGraphicsElement): SVGMatrix => {
    const tlist = elem.transform.baseVal;
    return transformListToTransform(tlist).matrix;
};

/**
 * Returns a 45 degree angle coordinate associated with the two given
 * coordinates.
 * @param x1 - First coordinate's x value
 * @param y1 - First coordinate's y value
 * @param x2 - Second coordinate's x value
 * @param y2 - Second coordinate's y value
 * @returns
 */
export const snapToAngle = (x1: number, y1: number, x2: number, y2: number): AngleCoord45 => {
    const snap = Math.PI / 4; // 45 degrees
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const snapangle = Math.round(angle / snap) * snap;

    return {
        x: x1 + dist * Math.cos(snapangle),
        y: y1 + dist * Math.sin(snapangle),
        a: snapangle,
    };
};

/**
 * Check if two rectangles (BBoxes objects) intersect each other.
 * @param r1 - The first BBox-like object
 * @param r2 - The second BBox-like object
 * @returns True if rectangles intersect
 */
export const rectsIntersect = (r1: SVGRect, r2: SVGRect): boolean => {
    return (
        r2.x < r1.x + r1.width &&
        r2.x + r2.width > r1.x &&
        r2.y < r1.y + r1.height &&
        r2.y + r2.height > r1.y
    );
};
