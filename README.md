# General Conference Talk Downloader

Downloads General Conference talks from churchofjesuschrist.org and converts them to Markdown files.

## Setup

```bash
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
```

Each file includes:
- Title
- Author name and role
- Full talk content
- Notes/references
- Source URL

If a talk has already been downloaded, the script will skip it and display "Already done".
