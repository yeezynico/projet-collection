const PROXIED_HOSTS = [
  "product-images.s3.cardmarket.com",
  "static.cardmarket.com",
  "www.cardmarket.com",
  "cardmarket.com",
];

export function getImageSrc(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (PROXIED_HOSTS.includes(parsed.hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }

  return url;
}
