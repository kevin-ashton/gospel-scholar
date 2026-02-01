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

export async function fetchBYUTalkAsMarkdown(url: string): Promise<PageResult> {
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

  // Try to extract from JSON-LD schema first
  let title = "";
  let authorName = "";
  let datePublished = "";

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonText = $(element).html();
      if (jsonText) {
        const data = JSON.parse(jsonText);
        // Handle @graph structure
        const articles = data["@graph"]?.filter((item: { "@type": string }) => item["@type"] === "Article") || [];
        const article = articles[0] || data;

        if (article.name) title = article.name;
        if (article.headline) title = title || article.headline;
        if (article.author?.name) authorName = article.author.name;
        if (article.datePublished) datePublished = article.datePublished;
      }
    } catch {
      // Ignore JSON parse errors
    }
  });

  // Fallback to DOM selectors if schema didn't have the data
  if (!title) {
    title = $(".sp-page-title__text").first().text().trim() ||
            $("h1").first().text().trim();
  }

  if (!authorName) {
    authorName = $(".author-name").text().trim() ||
                 $(".byline").text().trim();
  }

  if (title) {
    parts.push(`# ${title}`);
  }

  if (authorName) {
    parts.push(authorName);
  }

  // Extract date and format it
  let formattedDate = "";
  if (datePublished) {
    const date = new Date(datePublished);
    formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    parts.push(formattedDate);
  }

  // Extract main body content
  const bodyBlock = $(".single-speech__content, .post__content, .entry-content").first();
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

  // Extract year-month from date for filename
  let yearMonth = "unknown";
  if (datePublished) {
    const date = new Date(datePublished);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    yearMonth = `${year}-${month}`;
  }

  return {
    markdown,
    author: authorName || "Unknown",
    title: title || "Untitled",
    date: yearMonth,
  };
}

function sanitizeForFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*'"`„«»\u2018\u2019\u201C\u201D]/g, "").trim();
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
  const { markdown, author, title, date } = await fetchBYUTalkAsMarkdown(url);

  const authorDir = sanitizeForFilename(formatAuthorForDirectory(author));
  const safeTitle = sanitizeForFilename(title);
  const filename = `${date} ${safeTitle}.md`;
  const outputDir = path.resolve(__dirname, "../../content", authorDir, "byu");
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
    console.error("Usage: pnpm byu-talk <url> [url2] [url3] ...");
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
