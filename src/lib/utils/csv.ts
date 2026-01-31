import Papa from "papaparse";
import type {
  PostInsert,
  PostWithCreator,
  CSVPostRow,
  CSVImportResult,
  Platform,
  CreatorInsert,
  CreatorWithStats,
} from "../types/database";
import * as creatorsApi from "../api/creators";
import { normalizeHandle, detectPlatformFromHandle } from "./urlParser";

/**
 * Parse a CSV file and convert it to PostInsert objects
 * Validates each row and collects errors for invalid rows
 */
/**
 * Normalize column names to handle variations
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, "_") // Replace spaces, dashes, multiple underscores with single underscore
    .replace(/^creator_?name$|^name$|^creator$/, "creator_name")
    .replace(
      /^creator_?handle$|^handle$|^username$|^@?handle$/,
      "creator_handle"
    )
    .replace(/^platform$|^social_?platform$/, "platform")
    .replace(/^post_?url$|^url$|^link$|^post_?link$/, "post_url")
    .replace(/^posted_?date$|^date$|^post_?date$/, "posted_date")
    .replace(/^views?$|^view_?count$/, "views")
    .replace(/^likes?$|^like_?count$/, "likes")
    .replace(/^comments?$|^comment_?count$/, "comments")
    .replace(/^shares?$|^share_?count$/, "shares");
}

/**
 * Get value from row using normalized column name
 */
function getRowValue(row: any, normalizedName: string): string | undefined {
  // Try exact match first
  if (row[normalizedName]) return row[normalizedName];

  // Try normalized version
  for (const key in row) {
    if (normalizeColumnName(key) === normalizedName) {
      return row[key];
    }
  }

  return undefined;
}

export async function parseCSV(
  file: File,
  campaignId: string
): Promise<CSVImportResult & { posts: PostInsert[] }> {
  return new Promise((resolve) => {
    const posts: PostInsert[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const creatorCache = new Map<string, string>(); // Cache: "handle:platform" -> creator_id

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => normalizeColumnName(header), // Normalize headers
      complete: async (results) => {
        const validPlatforms: Platform[] = [
          "tiktok",
          "instagram",
          "youtube",
        ];

        // Log available columns for debugging (first row only)
        let availableColumns: string[] = [];
        if (results.data.length > 0) {
          availableColumns = Object.keys(results.data[0]);
          console.log("CSV columns detected:", availableColumns.join(", "));
        }

        // First pass: collect all unique creator handles to batch-fetch existing creators
        const creatorKeys = new Set<string>();
        const rowData: Array<{
          row: any;
          rowNumber: number;
          creatorName: string | undefined;
          creatorHandle: string;
          platform: string;
          postUrl: string;
        }> = [];

        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const rowNumber = i + 2;

          const creatorName = getRowValue(row, "creator_name")
            ?.toString()
            .trim();
          const creatorHandle = getRowValue(row, "creator_handle")
            ?.toString()
            .trim();
          const platform = getRowValue(row, "platform")?.toString().trim();
          const postUrl = getRowValue(row, "post_url")?.toString().trim();

          // Validate required fields early
          if (!creatorHandle || !platform || !postUrl) {
            if (!creatorHandle) {
              const columnHint =
                availableColumns.length > 0
                  ? ` Found columns: ${availableColumns.join(
                      ", "
                    )}. Expected: creator_handle, handle, username, or @handle`
                  : "";
              errors.push({
                row: rowNumber,
                message: `Missing creator handle${columnHint}`,
              });
            }
            if (!platform) {
              const columnHint =
                availableColumns.length > 0
                  ? ` Found columns: ${availableColumns.join(
                      ", "
                    )}. Expected: platform or social_platform`
                  : "";
              errors.push({
                row: rowNumber,
                message: `Missing platform${columnHint}`,
              });
            }
            if (!postUrl) {
              const columnHint =
                availableColumns.length > 0
                  ? ` Found columns: ${availableColumns.join(
                      ", "
                    )}. Expected: post_url, url, link, or post_link`
                  : "";
              const suggestion =
                availableColumns.includes("creator_handle") &&
                availableColumns.includes("platform") &&
                availableColumns.length === 2
                  ? " Note: If you only have creator handles, use 'Import Creators' instead of 'Import Posts CSV'."
                  : "";
              errors.push({
                row: rowNumber,
                message: `Missing post URL${columnHint}${suggestion}`,
              });
            }
            continue;
          }

          const normalizedPlatform = platform.toLowerCase() as Platform;
          if (!validPlatforms.includes(normalizedPlatform)) {
            errors.push({
              row: rowNumber,
              message: `Invalid platform "${platform}". Must be one of: ${validPlatforms.join(
                ", "
              )}`,
            });
            continue;
          }

          const cacheKey = `${creatorHandle}:${normalizedPlatform}`;
          creatorKeys.add(cacheKey);
          rowData.push({
            row,
            rowNumber,
            creatorName,
            creatorHandle,
            platform: normalizedPlatform,
            postUrl,
          });
        }

        // Batch fetch all existing creators
        const allCreatorsResult = await creatorsApi.list();
        if (allCreatorsResult.data) {
          allCreatorsResult.data.forEach((creator) => {
            const key = `${creator.handle}:${creator.platform}`;
            if (creatorKeys.has(key)) {
              creatorCache.set(key, creator.id);
            }
          });
        }

        // Process each row (validation already done in first pass)
        for (const rowInfo of rowData) {
          const {
            row,
            rowNumber,
            creatorName,
            creatorHandle,
            platform: normalizedPlatform,
            postUrl,
          } = rowInfo;

          // Get or create creator (use handle as name if name not provided)
          const cacheKey = `${creatorHandle}:${normalizedPlatform}`;
          let creatorId = creatorCache.get(cacheKey);

          if (!creatorId) {
            // Use handle as name fallback if creator_name not provided
            const finalCreatorName = creatorName || creatorHandle;
            const creatorResult = await creatorsApi.getOrCreate(
              finalCreatorName,
              creatorHandle,
              normalizedPlatform
            );

            if (creatorResult.error || !creatorResult.data) {
              errors.push({
                row: rowNumber,
                message: `Failed to create/find creator: ${
                  creatorResult.error?.message || "Unknown error"
                }`,
              });
              continue;
            }

            creatorId = creatorResult.data.id;
            creatorCache.set(cacheKey, creatorId);
          }

          // Parse optional date
          let postedDate: string | null = null;
          const postedDateValue = getRowValue(row, "posted_date")
            ?.toString()
            .trim();
          if (postedDateValue) {
            const date = new Date(postedDateValue);
            if (!isNaN(date.getTime())) {
              postedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD format
            }
          }

          // Parse optional numeric fields (default to 0)
          const viewsValue = getRowValue(row, "views")?.toString() || "0";
          const likesValue = getRowValue(row, "likes")?.toString() || "0";
          const commentsValue = getRowValue(row, "comments")?.toString() || "0";
          const sharesValue = getRowValue(row, "shares")?.toString() || "0";

          const views = parseInt(viewsValue, 10) || 0;
          const likes = parseInt(likesValue, 10) || 0;
          const comments = parseInt(commentsValue, 10) || 0;
          const shares = parseInt(sharesValue, 10) || 0;

          // Calculate engagement rate
          const engagementRate =
            views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

          // Create PostInsert object
          posts.push({
            campaign_id: campaignId,
            creator_id: creatorId,
            post_url: postUrl,
            platform: normalizedPlatform,
            posted_date: postedDate,
            views,
            likes,
            comments,
            shares,
            engagement_rate: Number(engagementRate.toFixed(2)),
            status: views > 0 ? "scraped" : "manual",
          });
        }

        resolve({
          success_count: posts.length,
          error_count: errors.length,
          errors,
          posts,
        });
      },
      error: (error) => {
        resolve({
          success_count: 0,
          error_count: 1,
          errors: [{ row: 0, message: `CSV parsing error: ${error.message}` }],
          posts: [],
        });
      },
    });
  });
}

/**
 * Convert an array of posts to CSV format
 */
export function exportToCSV(posts: PostWithCreator[]): string {
  const csvData = posts.map((post) => ({
    creator_name: post.creator?.name || "",
    creator_handle: post.creator?.handle || "",
    platform: post.platform,
    post_url: post.post_url,
    posted_date: post.posted_date || "",
    views: post.views || 0,
    likes: post.likes || 0,
    comments: post.comments || 0,
    shares: post.shares || 0,
  }));

  return Papa.unparse(csvData, {
    header: true,
    columns: [
      "creator_name",
      "creator_handle",
      "platform",
      "post_url",
      "posted_date",
      "views",
      "likes",
      "comments",
      "shares",
    ],
  });
}

/**
 * Parse a CSV file containing creator handles
 * Format: handle,platform (platform is optional)
 * Creates creators with minimal data (name = handle initially)
 */
export interface CreatorHandleCSVResult {
  success_count: number;
  error_count: number;
  errors: Array<{ row: number; message: string }>;
  creators: CreatorInsert[];
}

export async function parseCreatorHandlesCSV(
  file: File
): Promise<CreatorHandleCSVResult> {
  return new Promise((resolve) => {
    const creators: CreatorInsert[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const validPlatforms: Platform[] = [
      "tiktok",
      "instagram",
      "youtube",
    ];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => normalizeColumnName(header),
      complete: async (results) => {
        // Log available columns for debugging
        let availableColumns: string[] = [];
        if (results.data.length > 0) {
          availableColumns = Object.keys(results.data[0]);
          console.log(
            "Creator CSV columns detected:",
            availableColumns.join(", ")
          );
        }

        // Process each row
        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const rowNumber = i + 2; // +2 because: 1-indexed + 1 for header row

          // Get handle (required)
          const handleValue =
            getRowValue(row, "creator_handle")?.toString().trim() ||
            getRowValue(row, "handle")?.toString().trim();

          if (!handleValue) {
            const columnHint =
              availableColumns.length > 0
                ? ` Found columns: ${availableColumns.join(
                    ", "
                  )}. Expected: handle or creator_handle`
                : "";
            errors.push({
              row: rowNumber,
              message: `Missing handle${columnHint}`,
            });
            continue;
          }

          // Normalize handle (remove @, lowercase)
          const normalizedHandle = normalizeHandle(handleValue);

          // Get platform (optional - try to detect if not provided)
          let platformValue = getRowValue(row, "platform")?.toString().trim();
          let platform: Platform | null = null;

          if (platformValue) {
            const normalizedPlatform = platformValue.toLowerCase() as Platform;
            if (validPlatforms.includes(normalizedPlatform)) {
              platform = normalizedPlatform;
            } else {
              errors.push({
                row: rowNumber,
                message: `Invalid platform "${platformValue}". Must be one of: ${validPlatforms.join(
                  ", "
                )}`,
              });
              continue;
            }
          } else {
            // Try to detect platform from handle
            const detectedPlatform = detectPlatformFromHandle(handleValue);
            if (detectedPlatform) {
              platform = detectedPlatform;
            } else {
              // Can't detect platform - require it
              errors.push({
                row: rowNumber,
                message: `Platform is required. Please specify one of: ${validPlatforms.join(
                  ", "
                )}`,
              });
              continue;
            }
          }

          // Use handle as name initially (can be updated later)
          const creatorName = normalizedHandle;

          // Create CreatorInsert object (user_id will be added by createMany)
          creators.push({
            user_id: "", // Will be set by createMany API
            name: creatorName,
            handle: normalizedHandle,
            platform: platform,
            follower_count: 0,
            avg_engagement: 0,
          });
        }

        resolve({
          success_count: creators.length,
          error_count: errors.length,
          errors,
          creators,
        });
      },
      error: (error) => {
        resolve({
          success_count: 0,
          error_count: 1,
          errors: [{ row: 0, message: `CSV parsing error: ${error.message}` }],
          creators: [],
        });
      },
    });
  });
}

/**
 * Export creators to CSV format
 * Note: Contact fields (email/phone) will only be included if they exist in the creator data.
 * The API layer filters contacts based on networkFilter, so My Network creators will have contacts,
 * while All Creators will have null contacts.
 */
export function exportCreatorsToCSV(creators: CreatorWithStats[]): string {
  const csvData = creators.map((creator) => ({
    name: creator.name,
    handle: creator.handle,
    platform: creator.platform,
    email: creator.email || '', // Will be empty string for All Creators (API filters to null)
    phone: creator.phone || '', // Will be empty string for All Creators (API filters to null)
    follower_count: creator.follower_count,
    avg_engagement: creator.avg_engagement,
    campaigns: creator.campaigns,
    total_posts: creator.totalPosts,
    created_at: creator.created_at,
  }));
  return Papa.unparse(csvData, { header: true });
}

/**
 * Trigger a CSV file download in the browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the Object URL
  URL.revokeObjectURL(url);
}
