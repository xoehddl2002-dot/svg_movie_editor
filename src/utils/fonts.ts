/**
 * 글꼴 동적 로딩
 *
 * 파라미터는 FontFace의 생성자 파라미터들을 하나의 Object 속성으로 지정한 것
 * 참고: @url https://developer.mozilla.org/en-US/docs/Web/API/FontFace/FontFace
 */

export interface FontMapItem {
    family: string;
    url?: string;
    file?: File | Blob;
    [key: string]: any; // descriptors like style, weight, etc.
}

export const loadFont = async (fontMapList: FontMapItem | FontMapItem[]): Promise<FontFace[]> => {
    // FontFace 객체 생성
    const list = await Promise.allSettled(
        ([] as FontMapItem[])
            .concat(fontMapList)
            .filter((it) => !checkFontLoaded(it.family))
            .map(async ({ family, file, url, ...data }) => {
                const isFile = file instanceof File || file instanceof Blob;
                let source: string | BufferSource;

                if (isFile && file) {
                    source = new Uint8Array(await file.arrayBuffer());
                } else {
                    source = `url(${url})`;
                }

                const safeFamily = family.replace(/['"]/g, '');
                return new FontFace(safeFamily, source, data);
            })
    );

    // 로딩후 FontFaceSet에 추가
    const loadedFonts = await Promise.all(
        list.map(async (result) => {
            if (result.status === 'rejected') return null;

            const fontFace = result.value;
            try {
                const font = await fontFace.load();
                document.fonts.add(font);
                return font;
            } catch (err) {
                console.error(`Failed to load font ${fontFace.family}:`, err);
                return null;
            }
        })
    );

    return loadedFonts.filter((font): font is FontFace => font !== null);
};

export const checkFontLoaded = (fontFamily: string): boolean => {
    const safeFamily = fontFamily.replace(/['"]/g, '');
    return (
        document.fonts.check(`16px "${safeFamily}"`) &&
        Array.from(document.fonts).some((font) => 
            font.family === safeFamily || 
            font.family === `"${safeFamily}"` || 
            font.family === `'${safeFamily}'`
        )
    );
};
