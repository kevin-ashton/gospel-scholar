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
          lds_ur: string;
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


