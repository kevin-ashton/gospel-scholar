import * as fs from "fs";
import * as path from "path";
import * as https from "https";

interface Scriptures {
  structure: {
    [cannon_num: number]: {
      title: string;
      title_short: string;
      books: {
        [book_num: number]: {
          bookNum: number;
          lds_url: string;
          numChapter: number;
          summary: string;
          title: string;
          title_short: string;
          totalChapters: number;
          chapters: {
            [chapter_num: number]: {
              intro: string;
              summary: string;
              verses: { uid: number }[];
            };
          };
        };
      };
    };
  };
}

const scriptures: Scriptures = require("../scriptures.json");

const CANNON_SLUGS: Record<string, string> = {
  "1": "ot",
  "2": "nt",
  "3": "bofm",
  "4": "dc-testament",
  "5": "pgp",
};

const DELAY_MS = 500;
const BASE_URL = "https://www.churchofjesuschrist.org/study/scriptures";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "gospel-scholar/1.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchPage(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

interface ChapterJob {
  url: string;
  filePath: string;
  label: string;
}

function buildJobList(outputDir: string): ChapterJob[] {
  const jobs: ChapterJob[] = [];

  for (const [cannonNum, cannon] of Object.entries(scriptures.structure)) {
    const cannonSlug = CANNON_SLUGS[cannonNum];
    const cannonShort = cannon.title_short
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const cannonDir = path.join(
      outputDir,
      `${cannonNum.padStart(2, "0")}-${cannonShort}`
    );

    for (const [bookNum, book] of Object.entries(cannon.books)) {
      const bookDir = path.join(
        cannonDir,
        `${bookNum.padStart(2, "0")}-${book.title}`
      );

      for (const chapterNum of Object.keys(book.chapters)) {
        const slug = book.lds_url.replace(/-/g, "");
        const fileName = `${slug}${chapterNum}.html`;
        const url = `${BASE_URL}/${cannonSlug}/${book.lds_url}/${chapterNum}?lang=eng`;

        jobs.push({
          url,
          filePath: path.join(bookDir, fileName),
          label: `${book.title} ${chapterNum}`,
        });
      }
    }
  }

  return jobs;
}

async function downloadAll() {
  const outputDir = path.resolve(
    __dirname,
    "..",
    "..",
    "raw-church-website-scriptures"
  );
  const jobs = buildJobList(outputDir);

  // Filter out already-downloaded files for resume support
  const remaining = jobs.filter((j) => !fs.existsSync(j.filePath));

  console.log(
    `Total chapters: ${jobs.length} | Already downloaded: ${jobs.length - remaining.length} | Remaining: ${remaining.length}`
  );

  let done = 0;
  let errors = 0;

  for (const job of remaining) {
    const dir = path.dirname(job.filePath);
    fs.mkdirSync(dir, { recursive: true });

    try {
      const html = await fetchPage(job.url);
      fs.writeFileSync(job.filePath, html);
      done++;
      if (done % 25 === 0 || done === remaining.length) {
        console.log(
          `[${done}/${remaining.length}] ${job.label} ✓  (errors: ${errors})`
        );
      }
    } catch (err: any) {
      errors++;
      console.error(`[ERROR] ${job.label}: ${err.message}`);
      // Retry once after a longer pause
      await sleep(DELAY_MS * 4);
      try {
        const html = await fetchPage(job.url);
        fs.writeFileSync(job.filePath, html);
        done++;
        errors--;
        console.log(`[RETRY OK] ${job.label}`);
      } catch (retryErr: any) {
        console.error(`[RETRY FAIL] ${job.label}: ${retryErr.message}`);
      }
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `\nDone. Downloaded ${done} chapters with ${errors} errors.`
  );
}

downloadAll();
