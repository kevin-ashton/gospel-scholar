interface Verse {
  id: number;
  text: string;
  path: string;
  num: number;
}

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
              intro: string; // Rarely used. Just for those chapters that Nephi put something in
              summary: string;
              verses: { uid: number }[];
            };
          };
        };
      };
    };
  };
  verses: {
    [verse_id: number]: Verse;
  };
}

const scriptures: Scriptures = require("../scriptures.json");

import * as fs from "fs";
import * as path from "path";

function buildScriptureSet() {
  const outputDir = path.resolve(__dirname, "..", "..", "scripture-set");

  for (const [cannonNum, cannon] of Object.entries(scriptures.structure)) {
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
      fs.mkdirSync(bookDir, { recursive: true });

      for (const [chapterNum, chapter] of Object.entries(book.chapters)) {
        const slug = book.lds_url.replace(/-/g, "");
        const fileName = `${slug}${chapterNum}.md`;
        let md = `# ${book.title} ${chapterNum}\n`;

        if (chapterNum === "1" && book.summary) {
          md += `\n${book.summary}\n`;
        }
        if (chapter.intro) {
          md += `\n${chapter.intro}\n`;
        }
        if (chapter.summary) {
          md += `\n${chapter.summary}\n`;
        }

        for (const verseRef of chapter.verses) {
          const verse = scriptures.verses[verseRef.uid];
          if (verse) {
            const vNum = String(verse.num).padStart(2, "0");
            md += `\n# ${vNum}\n${verse.text}\n`;
          }
        }

        fs.writeFileSync(path.join(bookDir, fileName), md);
      }
    }
  }

  console.log("Scripture set written to", outputDir);
}

buildScriptureSet();
