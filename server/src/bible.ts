import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import * as path from "path";

interface Verse {
  number: number;
  text: string;
}

interface Chapter {
  chapter: number;
  verses: Verse[];
}

interface Book {
  name: string;
  abbreviation: string;
  chapters: Chapter[];
}

interface Bible {
  version: string;
  versionId: number;
  books: Book[];
}

// All Bible books with their abbreviations and chapter counts
const BIBLE_BOOKS = [
  { name: "Genesis", abbr: "GEN", chapters: 50 },
  { name: "Exodus", abbr: "EXO", chapters: 40 },
  { name: "Leviticus", abbr: "LEV", chapters: 27 },
  { name: "Numbers", abbr: "NUM", chapters: 36 },
  { name: "Deuteronomy", abbr: "DEU", chapters: 34 },
  { name: "Joshua", abbr: "JOS", chapters: 24 },
  { name: "Judges", abbr: "JDG", chapters: 21 },
  { name: "Ruth", abbr: "RUT", chapters: 4 },
  { name: "1 Samuel", abbr: "1SA", chapters: 31 },
  { name: "2 Samuel", abbr: "2SA", chapters: 24 },
  { name: "1 Kings", abbr: "1KI", chapters: 22 },
  { name: "2 Kings", abbr: "2KI", chapters: 25 },
  { name: "1 Chronicles", abbr: "1CH", chapters: 29 },
  { name: "2 Chronicles", abbr: "2CH", chapters: 36 },
  { name: "Ezra", abbr: "EZR", chapters: 10 },
  { name: "Nehemiah", abbr: "NEH", chapters: 13 },
  { name: "Esther", abbr: "EST", chapters: 10 },
  { name: "Job", abbr: "JOB", chapters: 42 },
  { name: "Psalms", abbr: "PSA", chapters: 150 },
  { name: "Proverbs", abbr: "PRO", chapters: 31 },
  { name: "Ecclesiastes", abbr: "ECC", chapters: 12 },
  { name: "Song of Solomon", abbr: "SNG", chapters: 8 },
  { name: "Isaiah", abbr: "ISA", chapters: 66 },
  { name: "Jeremiah", abbr: "JER", chapters: 52 },
  { name: "Lamentations", abbr: "LAM", chapters: 5 },
  { name: "Ezekiel", abbr: "EZK", chapters: 48 },
  { name: "Daniel", abbr: "DAN", chapters: 12 },
  { name: "Hosea", abbr: "HOS", chapters: 14 },
  { name: "Joel", abbr: "JOL", chapters: 3 },
  { name: "Amos", abbr: "AMO", chapters: 9 },
  { name: "Obadiah", abbr: "OBA", chapters: 1 },
  { name: "Jonah", abbr: "JON", chapters: 4 },
  { name: "Micah", abbr: "MIC", chapters: 7 },
  { name: "Nahum", abbr: "NAM", chapters: 3 },
  { name: "Habakkuk", abbr: "HAB", chapters: 3 },
  { name: "Zephaniah", abbr: "ZEP", chapters: 3 },
  { name: "Haggai", abbr: "HAG", chapters: 2 },
  { name: "Zechariah", abbr: "ZEC", chapters: 14 },
  { name: "Malachi", abbr: "MAL", chapters: 4 },
  { name: "Matthew", abbr: "MAT", chapters: 28 },
  { name: "Mark", abbr: "MRK", chapters: 16 },
  { name: "Luke", abbr: "LUK", chapters: 24 },
  { name: "John", abbr: "JHN", chapters: 21 },
  { name: "Acts", abbr: "ACT", chapters: 28 },
  { name: "Romans", abbr: "ROM", chapters: 16 },
  { name: "1 Corinthians", abbr: "1CO", chapters: 16 },
  { name: "2 Corinthians", abbr: "2CO", chapters: 13 },
  { name: "Galatians", abbr: "GAL", chapters: 6 },
  { name: "Ephesians", abbr: "EPH", chapters: 6 },
  { name: "Philippians", abbr: "PHP", chapters: 4 },
  { name: "Colossians", abbr: "COL", chapters: 4 },
  { name: "1 Thessalonians", abbr: "1TH", chapters: 5 },
  { name: "2 Thessalonians", abbr: "2TH", chapters: 3 },
  { name: "1 Timothy", abbr: "1TI", chapters: 6 },
  { name: "2 Timothy", abbr: "2TI", chapters: 4 },
  { name: "Titus", abbr: "TIT", chapters: 3 },
  { name: "Philemon", abbr: "PHM", chapters: 1 },
  { name: "Hebrews", abbr: "HEB", chapters: 13 },
  { name: "James", abbr: "JAS", chapters: 5 },
  { name: "1 Peter", abbr: "1PE", chapters: 5 },
  { name: "2 Peter", abbr: "2PE", chapters: 3 },
  { name: "1 John", abbr: "1JN", chapters: 5 },
  { name: "2 John", abbr: "2JN", chapters: 1 },
  { name: "3 John", abbr: "3JN", chapters: 1 },
  { name: "Jude", abbr: "JUD", chapters: 1 },
  { name: "Revelation", abbr: "REV", chapters: 22 },
];

async function fetchChapter(
  versionId: number,
  version: string,
  bookAbbr: string,
  chapter: number
): Promise<Verse[]> {
  const url = `https://www.bible.com/bible/${versionId}/${bookAbbr}.${chapter}.${version}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const verses: Verse[] = [];

  // Find all verse spans with data-usfm attribute
  $("span.verse[data-usfm]").each((_, el) => {
    const $verse = $(el);
    const usfm = $verse.attr("data-usfm") || "";

    // Extract verse number from usfm (e.g., "GEN.1.1" -> 1)
    const parts = usfm.split(".");
    const verseNum = parseInt(parts[2], 10);

    if (isNaN(verseNum)) return;

    // Get the text content, excluding the label
    const text = $verse.find("span.content").text().trim();

    if (text) {
      verses.push({
        number: verseNum,
        text,
      });
    }
  });

  // Sort by verse number
  verses.sort((a, b) => a.number - b.number);

  return verses;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadBible(versionId: number, version: string): Promise<Bible> {
  const bible: Bible = {
    version,
    versionId,
    books: [],
  };

  const totalChapters = BIBLE_BOOKS.reduce((sum, book) => sum + book.chapters, 0);
  let completedChapters = 0;

  for (const bookInfo of BIBLE_BOOKS) {
    const book: Book = {
      name: bookInfo.name,
      abbreviation: bookInfo.abbr,
      chapters: [],
    };

    console.log(`Downloading ${bookInfo.name}...`);

    for (let ch = 1; ch <= bookInfo.chapters; ch++) {
      try {
        const verses = await fetchChapter(versionId, version, bookInfo.abbr, ch);
        book.chapters.push({
          chapter: ch,
          verses,
        });
        completedChapters++;
        const progress = ((completedChapters / totalChapters) * 100).toFixed(1);
        console.log(`  Chapter ${ch}/${bookInfo.chapters} (${progress}% total)`);

        // Rate limit to be polite to the server
        await delay(500);
      } catch (error) {
        console.error(`  Error fetching ${bookInfo.abbr} ${ch}:`, error);
        // Continue with next chapter
      }
    }

    bible.books.push(book);
  }

  return bible;
}

async function main() {
  // Parse command line arguments
  // Default: NIRV (versionId=110)
  // Usage: pnpm bible [versionId] [versionCode]
  // Example: pnpm bible 110 NIRV

  const versionId = parseInt(process.argv[2], 10) || 110;
  const version = process.argv[3] || "NIRV";

  console.log(`Downloading Bible version ${version} (ID: ${versionId})...`);
  console.log(`This will download all 66 books. Please be patient.`);
  console.log();

  const bible = await downloadBible(versionId, version);

  const outputDir = path.resolve(__dirname, "../../content/scriptures/bible", version.toLowerCase());
  const outputPath = path.join(outputDir, "bible.json");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(bible, null, 2), "utf-8");

  console.log();
  console.log(`Bible saved to ${outputPath}`);
  console.log(`Total books: ${bible.books.length}`);
  console.log(`Total chapters: ${bible.books.reduce((sum, b) => sum + b.chapters.length, 0)}`);
  console.log(`Total verses: ${bible.books.reduce((sum, b) => sum + b.chapters.reduce((s, c) => s + c.verses.length, 0), 0)}`);
}

main();
