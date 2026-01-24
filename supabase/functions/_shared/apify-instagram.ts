type UnknownRecord = Record<string, unknown>;

export interface InstagramMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export interface NormalizedInstagramPost {
  ownerUsername: string | null;
  ownerId: string | null;
  postUrl: string;
  shortcode: string | null;
  caption: string | null;
  mediaUrls: string[];
  thumbnailUrl: string | null;
  metrics: InstagramMetrics;
  postedAt: string | null;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as UnknownRecord;
}

function coerceString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/,/g, "");
    const match = normalized.match(/^([\d.]+)\s*([kmb])?$/i);
    if (match) {
      const base = Number(match[1]);
      if (!Number.isFinite(base)) return null;
      const suffix = match[2]?.toLowerCase();
      const multiplier =
        suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
      return Math.round(base * multiplier);
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNonEmpty(...values: Array<unknown>): string | null {
  for (const value of values) {
    const candidate = coerceString(value);
    if (candidate) return candidate;
  }
  return null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms =
      value > 1_000_000_000_000
        ? value
        : value > 1_000_000_000
        ? value * 1000
        : value;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function extractCaption(item: UnknownRecord): string | null {
  const caption = item.caption;
  if (typeof caption === "string") return caption.trim() || null;
  const captionRecord = asRecord(caption);
  if (captionRecord) {
    const text = firstNonEmpty(captionRecord.text, captionRecord.title);
    if (text) return text;
  }
  const edgeCaption = asRecord(item.edge_media_to_caption);
  const edges = edgeCaption?.edges;
  if (Array.isArray(edges) && edges.length > 0) {
    const firstEdge = asRecord(edges[0]);
    const node = firstEdge ? asRecord(firstEdge.node) : null;
    const nodeText = node ? coerceString(node.text) : null;
    if (nodeText) return nodeText;
  }
  return firstNonEmpty(
    item.text,
    item.description,
    item.altText,
    item.accessibilityCaption
  );
}

function pushUnique(list: string[], value: unknown) {
  const url = coerceString(value);
  if (!url) return;
  if (!list.includes(url)) {
    list.push(url);
  }
}

function extractMediaUrls(item: UnknownRecord): string[] {
  const urls: string[] = [];
  pushUnique(urls, item.displayUrl);
  pushUnique(urls, item.display_url);
  pushUnique(urls, item.imageUrl);
  pushUnique(urls, item.image_url);
  pushUnique(urls, item.mediaUrl);
  pushUnique(urls, item.media_url);
  pushUnique(urls, item.videoUrl);
  pushUnique(urls, item.video_url);
  pushUnique(urls, item.thumbnailUrl);
  pushUnique(urls, item.thumbnail_url);
  pushUnique(urls, item.url);

  const carouselCandidates = [
    item.carouselMedia,
    item.carousel_media,
    item.media,
    item.images,
  ];

  for (const candidate of carouselCandidates) {
    if (!Array.isArray(candidate)) continue;
    for (const entry of candidate) {
      const entryRecord = asRecord(entry);
      if (!entryRecord) continue;
      pushUnique(urls, entryRecord.url);
      pushUnique(urls, entryRecord.displayUrl);
      pushUnique(urls, entryRecord.display_url);
      pushUnique(urls, entryRecord.imageUrl);
      pushUnique(urls, entryRecord.videoUrl);
      pushUnique(urls, entryRecord.thumbnailUrl);
    }
  }

  return urls;
}

export function extractInstagramShortcodeFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : null;
  } catch {
    return null;
  }
}

export function extractInstagramOwnerUsername(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) return null;
  const owner = asRecord(record.owner);
  const user = asRecord(record.user);
  const ownerInfo = asRecord(record.ownerInfo);

  return firstNonEmpty(
    record.ownerUsername,
    owner?.username,
    record.authorUsername,
    record.username,
    user?.username,
    ownerInfo?.username,
    record.owner_username
  );
}

export function extractInstagramOwnerId(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) return null;
  const owner = asRecord(record.owner);
  const user = asRecord(record.user);

  return firstNonEmpty(
    record.ownerId,
    record.owner_id,
    owner?.id,
    owner?.pk,
    owner?.userId,
    user?.id,
    user?.pk,
    record.authorId
  );
}

export function extractApifyItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  const items = record.items ?? record.data ?? record.datasetItems;
  if (Array.isArray(items)) return items;
  return [];
}

export function pickFirstInstagramItem(items: unknown[]): unknown | null {
  if (!items.length) return null;
  for (const item of items) {
    if (extractInstagramOwnerUsername(item)) {
      return item;
    }
  }
  return items[0] ?? null;
}

export function normalizeInstagramScrapeItem(
  item: unknown,
  fallbackUrl: string
): NormalizedInstagramPost {
  const record = asRecord(item) ?? {};
  const rawViewFields = {
    videoViewCount: record.videoViewCount,
    video_view_count: record.video_view_count,
    videoPlayCount: record.videoPlayCount,
    video_play_count: record.video_play_count,
    reelPlayCount: record.reelPlayCount,
    reel_play_count: record.reel_play_count,
    playCount: record.playCount,
    plays: record.plays,
    viewCount: record.viewCount,
    views: record.views,
    view_count: record.view_count,
  };
  const postUrl = firstNonEmpty(
    record.postUrl,
    record.post_url,
    record.url,
    record.permalink
  ) || fallbackUrl;

  const viewCandidates = [
    record.videoViewCount,
    record.video_view_count,
    record.videoPlayCount,
    record.video_play_count,
    record.reelPlayCount,
    record.reel_play_count,
    record.playCount,
    record.plays,
    record.viewCount,
    record.views,
    record.view_count,
  ]
    .map((value) => parseNumericValue(value))
    .filter((value): value is number => Number.isFinite(value) && (value ?? 0) > 0);

  const metrics: InstagramMetrics = {
    views: viewCandidates.length > 0 ? Math.max(...viewCandidates) : 0,
    likes:
      parseNumericValue(
        record.likesCount ?? record.like_count ?? record.likes ?? 0
      ) || 0,
    comments:
      parseNumericValue(
        record.commentsCount ?? record.comment_count ?? record.comments ?? 0
      ) || 0,
    shares: 0,
    engagement_rate: 0,
  };

  const ownerUsername = extractInstagramOwnerUsername(record);
  const ownerId = extractInstagramOwnerId(record);
  const shortcode =
    firstNonEmpty(
      record.shortCode,
      record.shortcode,
      record.code,
      record.short_code
    ) || extractInstagramShortcodeFromUrl(postUrl);

  const mediaUrls = extractMediaUrls(record);
  const thumbnailUrl =
    firstNonEmpty(record.thumbnailUrl, record.thumbnail_url) ||
    mediaUrls[0] ||
    null;

  const postedAt = normalizeTimestamp(
    record.takenAt ??
      record.taken_at ??
      record.takenAtTimestamp ??
      record.timestamp ??
      record.createdAt ??
      record.created_at ??
      record.postedAt
  );

  return {
    ownerUsername,
    ownerId,
    postUrl,
    shortcode,
    caption: extractCaption(record),
    mediaUrls,
    thumbnailUrl,
    metrics,
    postedAt,
  };
}

export function getInstagramViewDebug(item: unknown): Record<string, unknown> {
  const record = asRecord(item) ?? {};
  return {
    videoViewCount: record.videoViewCount,
    video_view_count: record.video_view_count,
    videoPlayCount: record.videoPlayCount,
    video_play_count: record.video_play_count,
    reelPlayCount: record.reelPlayCount,
    reel_play_count: record.reel_play_count,
    playCount: record.playCount,
    plays: record.plays,
    viewCount: record.viewCount,
    views: record.views,
    view_count: record.view_count,
  };
}
