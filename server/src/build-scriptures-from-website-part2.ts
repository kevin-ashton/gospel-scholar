import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

// ── Types (same shape as scriptures.json) ───────────────────────────

interface Verse {
  id: number;
  text: string;
  path: string; // "cannonNum:bookNum:chapterNum"
  num: number;
}

interface ChapterData {
  intro: string | null;
  summary: string | null;
  verses: { uid: number }[];
}

interface BookData {
  bookNum: number;
  lds_url: string;
  numChapter: number;
  summary: string | null;
  title: string;
  title_short: string;
  totalChapters: number;
  chapters: { [chapter_num: string]: ChapterData };
}

interface CannonData {
  title: string;
  title_short: string;
  books: { [book_num: string]: BookData };
}

interface Scriptures {
  structure: { [cannon_num: string]: CannonData };
  verses: { [verse_id: string]: Verse };
}

// ── Static metadata ─────────────────────────────────────────────────

const CANNON_META: Record<
  string,
  { slug: string; title: string; title_short: string }
> = {
  "01-ot": { slug: "ot", title: "Old Testament", title_short: "OT" },
  "02-nt": { slug: "nt", title: "New Testament", title_short: "NT" },
  "03-bom": { slug: "bofm", title: "Book of Mormon", title_short: "BoM" },
  "04-dc": {
    slug: "dc-testament",
    title: "Doctrine and Covenants",
    title_short: "D&C",
  },
  "05-pgp": {
    slug: "pgp",
    title: "Pearl of Great Price",
    title_short: "PGP",
  },
};

const TITLE_SHORT: Record<string, string> = {
  gen: "Gen.",
  ex: "Ex.",
  lev: "Lev.",
  num: "Num.",
  deut: "Deut.",
  josh: "Josh.",
  judg: "Judg.",
  ruth: "Ruth",
  "1-sam": "1 Sam.",
  "2-sam": "2 Sam.",
  "1-kgs": "1 Kgs.",
  "2-kgs": "2 Kgs.",
  "1-chr": "1 Chr.",
  "2-chr": "2 Chr.",
  ezra: "Ezra",
  neh: "Neh.",
  esth: "Esth.",
  job: "Job",
  ps: "Ps.",
  prov: "Prov.",
  eccl: "Eccl.",
  song: "Song.",
  isa: "Isa.",
  jer: "Jer.",
  lam: "Lam.",
  ezek: "Ezek.",
  dan: "Dan.",
  hosea: "Hosea",
  joel: "Joel",
  amos: "Amos",
  obad: "Obad.",
  jonah: "Jonah",
  micah: "Micah",
  nahum: "Nahum",
  hab: "Hab.",
  zeph: "Zeph.",
  hag: "Hag.",
  zech: "Zech.",
  mal: "Mal.",
  matt: "Matt.",
  mark: "Mark",
  luke: "Luke",
  john: "John",
  acts: "Acts",
  rom: "Rom.",
  "1-cor": "1 Cor.",
  "2-cor": "2 Cor.",
  gal: "Gal.",
  eph: "Eph.",
  philip: "Philip.",
  col: "Col.",
  "1-thes": "1 Thes.",
  "2-thes": "2 Thes.",
  "1-tim": "1 Tim.",
  "2-tim": "2 Tim.",
  titus: "Titus",
  philem: "Philem.",
  heb: "Heb.",
  james: "James",
  "1-pet": "1 Pet.",
  "2-pet": "2 Pet.",
  "1-jn": "1 Jn.",
  "2-jn": "2 Jn.",
  "3-jn": "3 Jn.",
  jude: "Jude",
  rev: "Rev.",
  "1-ne": "1 Ne.",
  "2-ne": "2 Ne.",
  jacob: "Jacob",
  enos: "Enos",
  jarom: "Jarom",
  omni: "Omni",
  "w-of-m": "W of M",
  mosiah: "Mosiah",
  alma: "Alma",
  hel: "Hel.",
  "3-ne": "3 Ne.",
  "4-ne": "4 Ne.",
  morm: "Morm.",
  ether: "Ether",
  moro: "Moro.",
  dc: "D&C",
  moses: "Moses",
  abr: "Abr.",
  "js-m": "JS-M",
  "js-h": "JS-H",
  "a-of-f": "A of F",
};

// ── Helpers ─────────────────────────────────────────────────────────

/** Natural-sort compare for numeric directory prefixes like "01-…", "02-…" */
function dirSort(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b);
}

/** Extract chapter number from filename like "gen1.html" → 1 */
function chapterNumFromFile(fileName: string): number {
  const m = fileName.match(/(\d+)\.html$/);
  if (!m) throw new Error(`Cannot parse chapter number from ${fileName}`);
  return parseInt(m[1], 10);
}

/**
 * Extract clean verse text from a cheerio verse element.
 * Strips footnote markers, media icons, verse numbers, para-marks, page-breaks.
 */
function extractVerseText($: cheerio.CheerioAPI, el: any): string {
  const $el = $(el).clone();

  // Remove elements we don't want in the text
  $el.find("span.verse-number").remove();
  $el.find("span.para-mark").remove();
  $el.find("span.page-break").remove();
  $el.find("sup.marker").remove();
  // Remove the entire media-icon pointer spans (contain SVGs)
  $el.find('[class*="iconPointer"]').remove();

  // Get text – cheerio .text() collapses inner elements to their text content
  let text = $el.text();

  // Normalise whitespace (collapse runs, trim)
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/** Extract plain text from an element, collapsing whitespace */
function extractText(
  $: cheerio.CheerioAPI,
  selector: string
): string | null {
  const el = $(selector).first();
  if (!el.length) return null;
  let text = el.text().replace(/\s+/g, " ").trim();
  return text || null;
}

// ── Main ────────────────────────────────────────────────────────────

function buildScriptures(): void {
  const rootDir = path.resolve(
    __dirname,
    "..",
    "..",
    "raw-church-website-scriptures"
  );

  const scriptures: Scriptures = { structure: {}, verses: {} };
  let nextUid = 1;

  // List canon directories (sorted)
  const cannonDirs = fs
    .readdirSync(rootDir)
    .filter((d) => fs.statSync(path.join(rootDir, d)).isDirectory())
    .sort(dirSort);

  for (const cannonDir of cannonDirs) {
    const cannonMeta = CANNON_META[cannonDir];
    if (!cannonMeta) {
      console.warn(`Unknown cannon directory: ${cannonDir}, skipping`);
      continue;
    }
    const cannonNum = cannonDir.split("-")[0].replace(/^0+/, ""); // "01" → "1"

    const cannonData: CannonData = {
      title: cannonMeta.title,
      title_short: cannonMeta.title_short,
      books: {},
    };

    const cannonPath = path.join(rootDir, cannonDir);
    const bookDirs = fs
      .readdirSync(cannonPath)
      .filter((d) => fs.statSync(path.join(cannonPath, d)).isDirectory())
      .sort(dirSort);

    for (const bookDir of bookDirs) {
      const bookNum = bookDir.split("-")[0].replace(/^0+/, ""); // "01" → "1"
      const bookTitle = bookDir.replace(/^\d+-/, ""); // "01-Genesis" → "Genesis"

      const bookPath = path.join(cannonPath, bookDir);
      const htmlFiles = fs
        .readdirSync(bookPath)
        .filter((f) => f.endsWith(".html"))
        .sort((a, b) => chapterNumFromFile(a) - chapterNumFromFile(b));

      if (htmlFiles.length === 0) {
        console.warn(`No HTML files in ${bookPath}, skipping`);
        continue;
      }

      // We'll determine lds_url from the first chapter's data-uri
      let ldsUrl = "";

      const bookData: BookData = {
        bookNum: parseInt(bookNum, 10),
        lds_url: "", // filled after first chapter
        numChapter: htmlFiles.length,
        summary: null,
        title: bookTitle,
        title_short: "", // filled after lds_url known
        totalChapters: htmlFiles.length,
        chapters: {},
      };

      for (const htmlFile of htmlFiles) {
        const chapterNum = chapterNumFromFile(htmlFile);
        const filePath = path.join(bookPath, htmlFile);

        // Read and parse one file at a time to limit memory
        const html = fs.readFileSync(filePath, "utf-8");
        const $ = cheerio.load(html);

        // Extract lds_url from <article data-uri="/scriptures/ot/gen/1">
        if (!ldsUrl) {
          const dataUri = $("article[data-uri]").attr("data-uri") || "";
          // "/scriptures/ot/gen/1" → split → ["", "scriptures", "ot", "gen", "1"]
          const parts = dataUri.split("/").filter(Boolean);
          if (parts.length >= 3) {
            ldsUrl = parts[2]; // e.g. "gen", "1-ne", "dc"
          }
          bookData.lds_url = ldsUrl;
          bookData.title_short = TITLE_SHORT[ldsUrl] || bookTitle;
        }

        // Extract intro (BOM uses p.intro, D&C uses p.study-intro)
        const introText =
          extractText($, "p.intro") || extractText($, "p.study-intro");

        // Extract summary
        const summaryText = extractText($, "p.study-summary");

        // Determine where the intro goes:
        // - BOM book intros (p.intro in chapter 1) → book.summary
        // - D&C section intros (p.study-intro) → chapter.intro
        let chapterIntro: string | null = null;
        if (introText) {
          const hasBookIntro = $("p.intro").length > 0;
          if (hasBookIntro && chapterNum === 1) {
            // BOM-style book intro → store as book summary
            bookData.summary = introText;
          } else {
            // D&C-style section intro → store as chapter intro
            chapterIntro = introText;
          }
        }

        // Extract verses
        const chapterVerses: { uid: number }[] = [];
        const versePath = `${cannonNum}:${bookNum}:${chapterNum}`;

        $("p.verse").each((_i, el) => {
          const text = extractVerseText($, el);
          // Extract verse number from the verse-number span (before we removed it)
          const verseNumStr = $(el).find("span.verse-number").text().trim();
          const verseNum = parseInt(verseNumStr, 10) || _i + 1;

          const uid = nextUid++;
          chapterVerses.push({ uid });
          scriptures.verses[String(uid)] = {
            id: uid,
            text,
            path: versePath,
            num: verseNum,
          };
        });

        bookData.chapters[String(chapterNum)] = {
          intro: chapterIntro,
          summary: summaryText,
          verses: chapterVerses,
        };

        // Let the HTML string be garbage-collected
      }

      cannonData.books[bookNum] = bookData;

      console.log(
        `  ${bookTitle}: ${htmlFiles.length} chapters, ${Object.keys(bookData.chapters).length} parsed`
      );
    }

    scriptures.structure[cannonNum] = cannonData;
    console.log(
      `Canon ${cannonNum} (${cannonMeta.title}): ${bookDirs.length} books`
    );
  }

  // Write output
  const outPath = path.resolve(__dirname, "..", "..", "server", "scriptures2.json");
  console.log(`\nWriting ${outPath} ...`);
  console.log(
    `Total verses: ${Object.keys(scriptures.verses).length}`
  );

  // Write using a stream to avoid holding the entire JSON string in memory
  const fd = fs.openSync(outPath, "w");
  fs.writeSync(fd, '{"structure":');
  fs.writeSync(fd, JSON.stringify(scriptures.structure));
  fs.writeSync(fd, ',"verses":');

  // Write verses in chunks to limit memory
  const verseKeys = Object.keys(scriptures.verses);
  fs.writeSync(fd, "{");
  for (let i = 0; i < verseKeys.length; i++) {
    if (i > 0) fs.writeSync(fd, ",");
    const k = verseKeys[i];
    fs.writeSync(fd, JSON.stringify(k) + ":" + JSON.stringify(scriptures.verses[k]));
  }
  fs.writeSync(fd, "}");
  fs.writeSync(fd, "}");
  fs.closeSync(fd);

  console.log("Done.");
}

buildScriptures();
