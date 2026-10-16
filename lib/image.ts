/** 대표 사진 data URL 상한. 사진은 행사 항목에 들어가 이 기기 사본·전송 대기열에도 그대로 복사되므로
 *  localStorage(약 5MB)를 생각해 작게 잡는다. 600px 사진은 보통 40~80KB 라 대부분 첫 품질에서 통과한다 */
export const COVER_LIMIT = 120 * 1024;

/** 대표 사진을 카드 크기에 맞게 줄여 data URL로. 600px · JPEG 75% 면 보통 40~80KB 다. */
export async function fileToCover(file: File, max = 600): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 넣을 수 있어요.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("사진을 읽지 못했어요."));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    // 복잡한 사진이면 품질을 한 단계씩 낮춰 상한 아래로
    for (const q of [0.75, 0.6, 0.45, 0.3]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (out.length <= COVER_LIMIT) return out;
    }
    throw new Error("사진이 너무 커서 넣을 수 없어요. 다른 사진을 골라 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
