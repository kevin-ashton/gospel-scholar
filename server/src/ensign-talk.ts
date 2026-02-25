import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import * as path from "path";
import TurndownService from "turndown";

interface PageResult {
  markdown: string;
  author: string;
  title: string;
  date: string;
}

export async function fetchEnsignTalkAsMarkdown(url: string): Promise<PageResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Initialize turndown for HTML to Markdown conversion
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
  });

  // Strip links - keep text content only
  turndown.addRule("stripLinks", {
    filter: "a",
    replacement: (content) => content,
  });

  // Strip bold and italic - keep text content only
  turndown.addRule("stripBoldItalic", {
    filter: ["strong", "b", "em", "i"],
    replacement: (content) => content,
  });

  // Build the markdown content
  const parts: string[] = [];

  // Extract title
  const title = $("h1.page-title").first().text().trim() ||
                $("h1").first().text().trim();
  if (title) {
    parts.push(`# ${title}`);
  }

  // Extract author from speaker section
  const authorName = $(".page-speaker span.fw-semibold").first().text().trim();
  if (authorName) {
    parts.push(authorName);
  }

  // Extract date from <time> element
  const timeText = $("time").first().text().trim();
  if (timeText) {
    parts.push(timeText);
  }

  // Extract main body content
  const bodyBlock = $(".page-transcripts .rich-text-body").first();
  if (bodyBlock.length) {
    // Remove any script or style tags
    bodyBlock.find("script, style").remove();

    const bodyHtml = bodyBlock.html();
    if (bodyHtml) {
      const bodyMarkdown = turndown.turndown(bodyHtml);
      parts.push(bodyMarkdown);
    }
  }

  const markdown = parts.join("\n\n");

  // Parse date for filename (e.g., "October 28, 2025 11:15 AM" -> "2025-10")
  let yearMonth = "unknown";
  if (timeText) {
    const date = new Date(timeText);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      yearMonth = `${year}-${month}`;
    }
  }

  return {
    markdown,
    author: stripAuthorPrefix(authorName) || "Unknown",
    title: title || "Untitled",
    date: yearMonth,
  };
}

function sanitizeForFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*'"`„«»\u2018\u2019\u201C\u201D]/g, "").trim();
}

function stripAuthorPrefix(name: string): string {
  // Remove prefixes like "By President", "By Elder", "Elder", "President", etc.
  return name.replace(/^(By\s+)?\w+\s+/i, "").trim();
}

function formatAuthorForDirectory(name: string): string {
  // Remove periods
  const noPeriods = name.replace(/\./g, "");
  const parts = noPeriods.split(/\s+/);
  if (parts.length <= 1) {
    return noPeriods;
  }
  const lastName = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(" ");
  return `${lastName} ${rest}`;
}

async function processUrl(url: string): Promise<void> {
  const { markdown, author, title, date } = await fetchEnsignTalkAsMarkdown(url);

  const authorDir = sanitizeForFilename(formatAuthorForDirectory(author));
  const safeTitle = sanitizeForFilename(title);
  const filename = `${date} ${safeTitle}.md`;
  const outputDir = path.resolve(__dirname, "../../content", authorDir, "ensign");
  const outputPath = path.join(outputDir, filename);

  // Check if file already exists
  try {
    await fs.access(outputPath);
    console.log(`Already done: ${outputPath}`);
    return;
  } catch {
    // File doesn't exist, continue
  }

  const contentWithSource = `${markdown}\n\n---\n\nSource: ${url}\n`;

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, contentWithSource, "utf-8");
  console.log(`Written to ${outputPath}`);
}

// Main execution
async function main() {
  const urls = process.argv.slice(2);

  if (urls.length === 0) {
    console.error("Usage: pnpm ensign-talk <url> [url2] [url3] ...");
    process.exit(1);
  }

  for (const url of urls) {
    try {
      await processUrl(url);
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }
}

main();
