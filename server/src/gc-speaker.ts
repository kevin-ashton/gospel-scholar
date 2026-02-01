import * as cheerio from "cheerio";
import { fetchPageAsMarkdown } from "./gc-talk";
import * as fs from "fs/promises";
import * as path from "path";

async function getTalkUrlsForSpeaker(speakerUrl: string): Promise<string[]> {
  const response = await fetch(speakerUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${speakerUrl}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const talkUrls: string[] = [];
  const baseUrl = "https://www.churchofjesuschrist.org";

  // Find all links that match the general conference talk pattern
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href && /^\/study\/general-conference\/\d{4}\/\d{2}\//.test(href)) {
      const fullUrl = `${baseUrl}${href}`;
      if (!talkUrls.includes(fullUrl)) {
        talkUrls.push(fullUrl);
      }
    }
  });

  return talkUrls;
}

function parseUrlParts(url: string) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const year = pathParts[2] || "unknown";
  const month = pathParts[3] || "unknown";
  return { year, month };
}

function sanitizeForFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*'"`„«»\u2018\u2019\u201C\u201D]/g, "").trim();
}

function stripAuthorPrefix(name: string): string {
  return name.replace(/^By\s+\w+\s+/i, "").trim();
}

function formatAuthorForDirectory(name: string): string {
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
  const { markdown, author, title } = await fetchPageAsMarkdown(url);
  const { year, month } = parseUrlParts(url);

  const authorDir = sanitizeForFilename(formatAuthorForDirectory(stripAuthorPrefix(author)));
  const safeTitle = sanitizeForFilename(title);
  const filename = `${year}-${month} ${safeTitle}.md`;
  const outputDir = path.resolve(__dirname, "../../content", authorDir, "gc");
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

async function main() {
  const speakerUrls = process.argv.slice(2);

  if (speakerUrls.length === 0) {
    console.error("Usage: pnpm run speaker <speaker-url> [speaker-url2] ...");
    process.exit(1);
  }

  for (const speakerUrl of speakerUrls) {
    console.log(`\nFetching talks for: ${speakerUrl}`);

    try {
      const talkUrls = await getTalkUrlsForSpeaker(speakerUrl);
      console.log(`Found ${talkUrls.length} talks\n`);

      for (const talkUrl of talkUrls) {
        try {
          await processUrl(talkUrl);
        } catch (error) {
          console.error(`Error processing ${talkUrl}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error fetching speaker page ${speakerUrl}:`, error);
    }
  }
}

main();
