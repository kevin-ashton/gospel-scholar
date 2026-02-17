# Requirements

- [x] Markdown (pretty to display, but easy to edit w/ a text editor)
- [x] Can browse with a file system, not a database (text)
- [x] Version control
- [ ] Video local?
- [ ] Hosted on the web or maybe an app (access it quickly on phone)

## To Do

- [ ] add in Postgres support, which will serve as the search index.
  - [ ] columns
    - [ ] author
    - [ ] pretty_text
    - [ ] search_index
- [ ] Video support possible, possible git LFS for videos.
- [ ] Add in a web app that works on mobile
- [ ] The mobile app, if it's running locally, should allow us to open up to the file location to edit something.
- [ ] The mobile app should be deployable to the web with a URL hard-coded password.
- [ ] Add support for books and quotes such as CS Lewis.
- [ ] Add the scriptures in with their search.
- [ ] Search Featues
  - [ ] Index **bold**, but include entire paragraph
  - [ ] Scriptures
  - [ ] Able to filter
    - [ ] "a=oaks s=byu quote 1"
    - [ ] "t=video a=nelso quote 2"
    - [ ] "> i will go and do nephi 3:7" (button on mobile for >)
    - [ ] Scripture "navigate" pattern 1n37

# Talk Downloader

Downloads General Conference talks and BYU speeches and converts them to Markdown files.

## Setup

```bash
cd server
pnpm install
pnpm build
```

## Usage

### Download Individual Talks

Use `gc-talk` to download one or more talks by URL:

```bash
pnpm gc-talk <url> [url2] [url3] ...
```

Example:
```bash
pnpm gc-talk "https://www.churchofjesuschrist.org/study/general-conference/2023/04/58nelson?lang=eng"
```

### Download All Talks by a Speaker

Use `gc-speaker` to download all talks from a speaker's page:

```bash
pnpm gc-speaker <speaker-url> [speaker-url2] ...
```

Example:
```bash
pnpm gc-speaker "https://www.churchofjesuschrist.org/study/general-conference/speakers/patrick-kearon?lang=eng"
```

### Download BYU Speeches

Use `byu-talk` to download one or more BYU speeches by URL:

```bash
pnpm byu-talk <url> [url2] [url3] ...
```

Example:
```bash
pnpm byu-talk "https://speeches.byu.edu/talks/lawrence-e-corbridge/stand-for-ever/"
```

### Download Bible from Bible.com

Downloads the entire Bible from bible.com as raw HTML files. This is a two-step process:

**Step 1: Download raw HTML**

```bash
pnpm bible-download [versionId] [versionCode]
```

Examples:
```bash
pnpm bible-download              # NIRV (default, versionId=110)
pnpm bible-download 111 NIV      # NIV
pnpm bible-download 59 ESV       # ESV
```

Raw HTML files are saved to `raw_downloads/bible/{version}/`:
```
raw_downloads/bible/nirv/
  GEN.1.html
  GEN.2.html
  ...
  REV.22.html
```

Features:
- Downloads all 66 books (1,189 chapters)
- Skips already-downloaded files (resume-friendly)
- 500ms delay between requests to be respectful to the server

**Step 2: Process into JSON** (coming soon)

Will parse the raw HTML and output structured JSON to `content/scriptures/bible/{version}/bible.json`.

## Output

Files are saved to the `content/` directory, organized by author:

```
content/
  Nelson, Russell M/
    gc/
      2023-04 The Answer Is Always Jesus Christ.md
  Kearon, Patrick/
    gc/
      2024-10 Welcome to the Church of Joy.md
      2025-04 Receive His Gift.md
  Corbridge, Lawrence E/
    byu/
      2019-01 Stand Forever.md
```

Each file includes:
- Title
- Author name and role
- Full talk content
- Notes/references
- Source URL

If a talk has already been downloaded, the script will skip it and display "Already done".


