const ROOT = "/src/assets/images";

const CACHE: Record<string, any> = import.meta.glob(
  "/src/assets/images/**/*.{png,jpg,webp,svg}",
  {
    import: "default",
    eager: true,
  }
);

export function normalize(src: string, root = ROOT) {
  if (!src.startsWith("/")) {
    src = `/${src}`;
  }
  if (!src.startsWith(root)) {
    src = `${root}${src}`;
  }
  return src;
}

export function resolve(src: string, returnSrc: boolean = false) {
  src = normalize(src);
  const img = CACHE[src];
  if (!img) {
    throw `Not found image:  ${src}`;
  }
  return returnSrc ? img.src : img;
}
