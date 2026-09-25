export type ReadingImageFormat = "png" | "jpg";

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image asset could not be read."));
    reader.onerror = () => reject(new Error("Image asset could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function makeSvgSelfContained(source: string): Promise<string> {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (document.querySelector("parsererror") || document.documentElement.localName !== "svg") throw new Error("Reading image is invalid.");
  const images = Array.from(document.querySelectorAll("image"));
  await Promise.all(images.map(async (image) => {
    const href = image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (!href) throw new Error("A reading card image is missing.");
    if (href.startsWith("data:")) return;
    const assetUrl = new URL(href, window.location.origin);
    if (assetUrl.origin !== window.location.origin) throw new Error("Reading card images must come from NaTarot.");
    const response = await fetch(assetUrl.toString(), { credentials: "same-origin", cache: "force-cache" });
    if (!response.ok) throw new Error("A reading card image could not be loaded.");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("A reading card image has an invalid format.");
    const embedded = await dataUrl(blob);
    image.setAttribute("href", embedded);
    image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", embedded);
  }));
  return new XMLSerializer().serializeToString(document.documentElement);
}

export async function rasterizeReadingImage(source: string, format: ReadingImageFormat): Promise<Blob> {
  const selfContained = await makeSvgSelfContained(source);
  const svgBlob = new Blob([selfContained], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    const width = Number(image.naturalWidth) || 1200;
    const height = Number(image.naturalHeight) || 800;
    if (width > 2400 || height > 2400 || width < 1 || height < 1) throw new Error("Reading image dimensions are invalid.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image export is not available in this browser.");
    context.fillStyle = "#061522";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.92));
    if (!blob) throw new Error("The image file could not be created.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
