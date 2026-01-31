import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import * as path from "path";
import TurndownService from "turndown";

interface PageResult {
  markdown: string;
  author: string;
  title: string;
}

export async function fetchPageAsMarkdown(url: string): Promise<PageResult> {
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
  const title = $("h1").first().text().trim();
  if (title) {
    parts.push(`# ${title}`);
  }

  // Extract author info
  const authorName = $(".author-name").text().trim();
  const authorRole = $(".author-role").text().trim();
  if (authorName) {
    parts.push(authorName);
  }
  if (authorRole) {
    parts.push(authorRole);
  }

  // Extract main body content
  const bodyBlock = $(".body-block");
  if (bodyBlock.length) {
    // Remove any script or style tags
    bodyBlock.find("script, style").remove();

    const bodyHtml = bodyBlock.html();
    if (bodyHtml) {
      const bodyMarkdown = turndown.turndown(bodyHtml);
      parts.push(bodyMarkdown);
    }
  }

  // Extract footnotes if present
  const notes = $("footer.notes");
  if (notes.length) {
    notes.find("script, style").remove();
    const notesHtml = notes.html();
    if (notesHtml) {
      parts.push("---");
      parts.push("## Notes");
      const notesMarkdown = turndown.turndown(notesHtml);
      parts.push(notesMarkdown);
    }
  }

  // Unescape brackets
  const markdown = parts.join("\n\n").replace(/\\([[\]])/g, "$1");

  return {
    markdown,
    author: stripAuthorPrefix(authorName) || "Unknown",
    title: title || "Untitled",
  };
}

interface UrlParts {
  year: string;
  month: string;
  day: string;
}

function parseUrlParts(url: string): UrlParts {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  // URL format: /study/general-conference/2023/04/58nelson
  const year = pathParts[2] || "unknown";
  const month = pathParts[3] || "unknown";
  const slug = pathParts[4] || "0";
  // Extract numeric part from slug (e.g., "58" from "58nelson")
  const day = slug.match(/^\d+/)?.[0] || "0";
  return { year, month, day };
}

function sanitizeForFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").trim();
}

function stripAuthorPrefix(name: string): string {
  // Remove prefixes like "By President", "By Elder", "By Sister", etc.
  return name.replace(/^By\s+\w+\s+/i, "").trim();
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
  return `${lastName}, ${rest}`;
}

async function processUrl(url: string): Promise<void> {
  const { markdown, author, title } = await fetchPageAsMarkdown(url);
  const { year, month } = parseUrlParts(url);

  const authorDir = sanitizeForFilename(formatAuthorForDirectory(author));
  const safeTitle = sanitizeForFilename(title);
  const filename = `${year}-${month} ${safeTitle}.md`;
  const outputDir = path.resolve("content", authorDir);
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
    console.error("Usage: pnpm start <url> [url2] [url3] ...");
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
