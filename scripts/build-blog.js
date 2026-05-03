#!/usr/bin/env node
// Generates my-thoughts/ from posts/*.md
// Each post = markdown file with frontmatter: title, date, summary

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_DIR = path.join(ROOT, 'my-thoughts');
const BOOKS_SRC = path.join(ROOT, 'books.yaml');
const BOOKS_OUT = path.join(ROOT, 'books');
const COVERS_DIR = path.join(ROOT, 'images', 'books');
const PROJECTS_SRC = path.join(ROOT, 'projects.yaml');
const PROJECTS_OUT = path.join(ROOT, 'projects');
const PROJECTS_IMG_DIR = path.join(ROOT, 'images', 'projects');

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Urbanist', sans-serif;
    background-color: #121212;
    color: #ffffff;
    line-height: 1.6;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .container {
    width: 100%;
    max-width: 900px;
    padding: 60px;
    background-color: #000000;
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
    margin: 40px 0;
  }
  a { color: darkorange; text-decoration: none; transition: opacity 0.2s ease; }
  a:hover { opacity: 0.75; }
  .home-link {
    display: inline-block;
    color: #ffffff;
    margin-top: 15px;
    font-size: 1.05rem;
  }
  .home-link:hover { color: darkorange; opacity: 1; }
  @media (max-width: 768px) {
    .container { padding: 40px; margin: 20px; }
  }
  @media (max-width: 480px) {
    .container { padding: 25px; }
  }
`;

const INDEX_STYLES = `
  .blog-header { margin-bottom: 50px; text-align: center; }
  .blog-title {
    font-size: 2.5rem; font-weight: 700;
    color: darkorange; margin-bottom: 20px;
  }
  .blog-description { font-size: 1.15rem; max-width: 600px; margin: 0 auto; color: #ccc; }
  .posts-list { list-style: none; }
  .post-item {
    margin-bottom: 40px; border-bottom: 1px solid #333; padding-bottom: 40px;
  }
  .post-item:last-child { border-bottom: none; }
  .post-date { font-size: 0.9rem; color: #999; margin-bottom: 10px; }
  .post-title { font-size: 1.8rem; font-weight: 600; margin-bottom: 15px; }
  .post-title a { color: #fff; }
  .post-title a:hover { color: darkorange; opacity: 1; }
  .post-excerpt { font-size: 1.1rem; margin-bottom: 20px; color: #ddd; }
  .read-more {
    display: inline-block; background-color: rgba(255,255,255,0.1);
    padding: 8px 16px; border-radius: 4px; color: #fff;
  }
  .read-more:hover { background-color: darkorange; opacity: 1; }
  .empty { color: #999; font-style: italic; text-align: center; }
  @media (max-width: 768px) { .blog-title { font-size: 2rem; } .post-title { font-size: 1.5rem; } }
`;

const POST_STYLES = `
  .post-date { font-size: 0.95rem; color: #999; margin-bottom: 12px; }
  .post-title {
    font-size: 2.25rem; font-weight: 700;
    color: darkorange; margin-bottom: 30px; letter-spacing: -0.02em;
  }
  .post-body { font-size: 1.15rem; color: #eaeaea; }
  .post-body h2 { font-size: 1.6rem; margin: 2rem 0 1rem; color: #fff; }
  .post-body h3 { font-size: 1.3rem; margin: 1.5rem 0 0.75rem; color: #fff; }
  .post-body p { margin-bottom: 1.25rem; }
  .post-body ul, .post-body ol { margin: 0 0 1.25rem 1.5rem; }
  .post-body li { margin-bottom: 0.4rem; }
  .post-body blockquote {
    border-left: 3px solid darkorange; padding-left: 1rem;
    color: #bbb; font-style: italic; margin: 1.5rem 0;
  }
  .post-body code {
    background: #222; padding: 2px 6px; border-radius: 3px;
    font-family: 'Courier New', monospace; font-size: 0.95em;
  }
  .post-body pre {
    background: #1a1a1a; padding: 16px; border-radius: 6px;
    overflow-x: auto; margin: 1.5rem 0;
  }
  .post-body pre code { background: transparent; padding: 0; }
  .post-body a { color: darkorange; }
  .post-body img { max-width: 100%; border-radius: 6px; margin: 1.5rem 0; }
  .post-footer {
    margin-top: 60px; padding-top: 30px; border-top: 1px solid #333;
  }
  @media (max-width: 768px) { .post-title { font-size: 1.75rem; } }
`;

const HEAD = (title, extraStyles) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="icon" type="image/png" href="/images/profile-photo.png">
  <link rel="apple-touch-icon" href="/images/profile-photo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>${BASE_STYLES}${extraStyles}</style>
</head>`;

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function getPostSlug(filename, data) {
  // Filename pattern: YYYY-MM-DD-slug.md  OR  YYYY-MM-DD.md
  const base = filename.replace(/\.md$/, '');
  const m = base.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  if (m) return m[1];
  if (data.title) return slugify(data.title);
  return base;
}

function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
    return [];
  }
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  const posts = files.map(f => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
    const { data, content } = matter(raw);
    if (!data.title || !data.date) {
      throw new Error(`Post ${f} is missing required frontmatter (title, date).`);
    }
    const slug = getPostSlug(f, data);
    return {
      file: f,
      slug,
      title: data.title,
      date: data.date,
      summary: data.summary || '',
      html: marked.parse(content),
    };
  });
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

function renderIndex(posts) {
  const list = posts.length === 0
    ? `<p class="empty">No posts yet. Check back soon.</p>`
    : `<ul class="posts-list">${posts.map(p => `
          <li class="post-item">
            <div class="post-date">${formatDate(p.date)}</div>
            <h2 class="post-title"><a href="${escapeHtml(p.slug)}/">${escapeHtml(p.title)}</a></h2>
            ${p.summary ? `<p class="post-excerpt">${escapeHtml(p.summary)}</p>` : ''}
            <a href="${escapeHtml(p.slug)}/" class="read-more">Read more</a>
          </li>`).join('')}
      </ul>`;

  return `${HEAD('My Thoughts | Brian Franklin', INDEX_STYLES)}
<body>
  <div class="container">
    <div class="blog-header">
      <h1 class="blog-title">My Thoughts</h1>
      <p class="blog-description">Notes on marketing, side projects, and whatever else is rattling around.</p>
      <a href="/" class="home-link"><i class="fas fa-arrow-left"></i> Back to home</a>
    </div>
    ${list}
  </div>
</body>
</html>`;
}

function renderPost(post) {
  return `${HEAD(`${post.title} | Brian Franklin`, POST_STYLES)}
<body>
  <div class="container">
    <article>
      <div class="post-date">${formatDate(post.date)}</div>
      <h1 class="post-title">${escapeHtml(post.title)}</h1>
      <div class="post-body">${post.html}</div>
    </article>
    <div class="post-footer">
      <a href="../" class="home-link"><i class="fas fa-arrow-left"></i> All posts</a>
    </div>
  </div>
</body>
</html>`;
}

const BOOKS_STYLES = `
  .page-header { margin-bottom: 50px; text-align: center; }
  .page-title {
    font-size: 2.5rem; font-weight: 700;
    color: darkorange; margin-bottom: 15px; letter-spacing: -0.02em;
  }
  .page-description { font-size: 1.1rem; max-width: 600px; margin: 0 auto; color: #ccc; }
  .year-section { margin-bottom: 50px; }
  .year-heading {
    font-size: 1.3rem; color: #41B6E6; margin-bottom: 20px;
    letter-spacing: 0.05em; font-weight: 600;
  }
  .books-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 28px;
  }
  .book {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
  }
  .book-cover {
    width: 100%; aspect-ratio: 2 / 3;
    background: #1a1a1a;
    border-radius: 4px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    object-fit: cover;
    display: block;
    margin-bottom: 12px;
    transition: transform 0.2s ease;
  }
  .book:hover .book-cover { transform: translateY(-3px); }
  .book-title {
    font-size: 0.95rem; font-weight: 600; color: #fff;
    margin-bottom: 2px; line-height: 1.3;
  }
  .book-author {
    font-size: 0.8rem; color: #999; margin-bottom: 6px;
  }
  .book-rating {
    font-size: 0.9rem; color: darkorange; letter-spacing: 1px;
  }
  .book-rating .empty { color: #333; }
  .no-cover {
    width: 100%; aspect-ratio: 2 / 3; background: #1a1a1a;
    border-radius: 4px; display: flex; align-items: center; justify-content: center;
    color: #555; font-size: 0.85rem; padding: 10px; text-align: center;
    margin-bottom: 12px;
  }
  @media (max-width: 768px) {
    .page-title { font-size: 2rem; }
    .books-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 20px; }
  }
`;

function slugifyBook(title, author) {
  return slugify(author ? `${title}-${author}` : title);
}

function starHtml(rating) {
  const r = Math.max(0, Math.min(5, Math.round(rating || 0)));
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += i < r ? '★' : '<span class="empty">★</span>';
  }
  return html;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadTo(imgUrl, filePath) {
  const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'brianfranklin.work/1.0' } });
  if (!imgRes.ok) throw new Error(`download ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length < 1024) throw new Error(`tiny image (${buf.length}B) — likely a placeholder`);
  fs.mkdirSync(COVERS_DIR, { recursive: true });
  fs.writeFileSync(filePath, buf);
}

async function olSearch(params, filePath) {
  const searchUrl = `https://openlibrary.org/search.json?${params.toString()}`;
  const res = await fetch(searchUrl, { headers: { 'User-Agent': 'brianfranklin.work/1.0' } });
  if (!res.ok) throw new Error(`OL ${res.status}`);
  const data = await res.json();
  // Scan first 5 results for any with a cover_i
  const doc = (data?.docs || []).slice(0, 5).find(d => d.cover_i);
  if (!doc) throw new Error('no cover_i in top results');
  const imgUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
  await downloadTo(imgUrl, filePath);
}

async function tryOpenLibrary(title, author, filePath) {
  const q = new URLSearchParams({ title, limit: '5' });
  if (author) q.set('author', author);
  await olSearch(q, filePath);
}

async function tryOpenLibraryFreeText(title, author, filePath) {
  // Free-text search is fuzzier and often catches what structured misses
  const stripped = title.replace(/[:\-–—].*/, '').trim(); // drop subtitle after :-—
  const terms = [stripped, author].filter(Boolean).join(' ');
  const q = new URLSearchParams({ q: terms, limit: '5' });
  await olSearch(q, filePath);
}

async function tryGoogleBooks(title, author, filePath) {
  let query = `intitle:${encodeURIComponent(title)}`;
  if (author) query += `+inauthor:${encodeURIComponent(author)}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GB ${res.status}`);
  const data = await res.json();
  const links = data?.items?.[0]?.volumeInfo?.imageLinks;
  let imgUrl = links?.thumbnail || links?.smallThumbnail;
  if (!imgUrl) throw new Error('no imageLinks');
  imgUrl = imgUrl.replace('http://', 'https://').replace(/&edge=curl/, '').replace(/zoom=1/, 'zoom=3');
  await downloadTo(imgUrl, filePath);
}

async function fetchCover(title, author, slug) {
  const filePath = path.join(COVERS_DIR, `${slug}.jpg`);
  if (fs.existsSync(filePath)) return `/images/books/${slug}.jpg`;

  const attempts = [
    { name: 'OL-structured', fn: () => tryOpenLibrary(title, author, filePath) },
    { name: 'OL-freetext',  fn: () => tryOpenLibraryFreeText(title, author, filePath) },
    { name: 'GoogleBooks',  fn: () => tryGoogleBooks(title, author, filePath) },
  ];
  for (const attempt of attempts) {
    try {
      await attempt.fn();
      console.log(`  ✓ cover via ${attempt.name}: ${title}`);
      await sleep(300); // be polite
      return `/images/books/${slug}.jpg`;
    } catch (err) {
      console.log(`  · ${attempt.name} miss for "${title}": ${err.message}`);
    }
  }
  console.warn(`  ! no cover found for "${title}" by ${author}`);
  return null;
}

function renderBookCard(book, coverPath) {
  const coverEl = coverPath
    ? `<img class="book-cover" src="${coverPath}" alt="${escapeHtml(book.title)} cover" loading="lazy">`
    : `<div class="no-cover">${escapeHtml(book.title)}</div>`;
  const authorEl = book.author
    ? `<div class="book-author">${escapeHtml(book.author)}</div>`
    : '';
  const ratingEl = (book.rating != null)
    ? `<div class="book-rating" aria-label="${book.rating} out of 5">${starHtml(book.rating)}</div>`
    : '';
  return `
    <div class="book">
      ${coverEl}
      <div class="book-title">${escapeHtml(book.title)}</div>
      ${authorEl}
      ${ratingEl}
    </div>`;
}

function renderBooksPage(page, sections) {
  const body = sections.map(({ year, html }) => `
    <div class="year-section">
      <div class="year-heading">${escapeHtml(String(year))}</div>
      <div class="books-grid">${html}</div>
    </div>`).join('');

  return `${HEAD(`${page.title || "Books I've Read"} | Brian Franklin`, BOOKS_STYLES)}
<body>
  <div class="container">
    <div class="page-header">
      <h1 class="page-title">${escapeHtml(page.title || "Books I've Read")}</h1>
      ${page.summary ? `<p class="page-description">${escapeHtml(page.summary)}</p>` : ''}
      <a href="/" class="home-link"><i class="fas fa-arrow-left"></i> Back to home</a>
    </div>
    ${body}
  </div>
</body>
</html>`;
}

async function buildBooks() {
  if (!fs.existsSync(BOOKS_SRC)) {
    console.log('No books.yaml found — skipping.');
    return;
  }
  const raw = fs.readFileSync(BOOKS_SRC, 'utf8');
  const parsed = YAML.parse(raw) || {};
  const page = parsed.page || {};
  const books = parsed.books || [];

  // Group by year, newest year first
  const byYear = new Map();
  for (const b of books) {
    const y = b.year || 'Undated';
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(b);
  }
  const years = [...byYear.keys()].sort((a, b) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return b - a;
  });

  const sections = [];
  for (const year of years) {
    const cards = [];
    for (const book of byYear.get(year)) {
      const slug = slugifyBook(book.title, book.author);
      const cover = await fetchCover(book.title, book.author, slug);
      cards.push(renderBookCard(book, cover));
    }
    sections.push({ year, html: cards.join('') });
  }

  if (fs.existsSync(BOOKS_OUT)) fs.rmSync(BOOKS_OUT, { recursive: true, force: true });
  fs.mkdirSync(BOOKS_OUT, { recursive: true });
  fs.writeFileSync(path.join(BOOKS_OUT, 'index.html'), renderBooksPage(page, sections));
  console.log(`Built books/ (${books.length} books, ${years.length} year group(s))`);
}

const PROJECTS_STYLES = `
  .page-header { margin-bottom: 50px; text-align: center; }
  .page-title {
    font-size: 2.5rem; font-weight: 700;
    color: darkorange; margin-bottom: 15px; letter-spacing: -0.02em;
  }
  .page-description { font-size: 1.1rem; max-width: 600px; margin: 0 auto; color: #ccc; }
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 28px;
  }
  .project {
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 8px;
    padding: 26px 28px;
    display: flex; flex-direction: column;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  .project:hover { transform: translateY(-3px); border-color: #444; }
  .project-head {
    display: flex; align-items: center; gap: 14px; margin-bottom: 14px;
  }
  .project-logo {
    width: 44px; height: 44px;
    border-radius: 8px;
    background: #1a1a1a;
    object-fit: contain;
    flex-shrink: 0;
    padding: 4px;
  }
  .project-logo-placeholder {
    width: 44px; height: 44px;
    border-radius: 8px;
    background: #1a1a1a;
    display: flex; align-items: center; justify-content: center;
    color: #555; font-size: 0.85rem; font-weight: 700;
    flex-shrink: 0;
  }
  .project-name { font-size: 1.3rem; font-weight: 700; color: #fff; }
  .project-desc {
    font-size: 0.98rem; color: #ccc; margin-bottom: 18px;
    flex: 1;
  }
  .project-url {
    font-size: 0.95rem; color: darkorange;
    word-break: break-all;
  }
  .project-url:hover { color: darkorange; opacity: 0.75; }
  @media (max-width: 768px) {
    .page-title { font-size: 2rem; }
    .projects-grid { grid-template-columns: 1fr; gap: 22px; }
  }
`;

function displayUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function renderProjectCard(p) {
  const logo = p.logo
    ? `<img class="project-logo" src="${escapeHtml(p.logo)}" alt="${escapeHtml(p.name)} logo">`
    : `<div class="project-logo-placeholder">${escapeHtml(p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>`;

  const urlEl = p.url
    ? `<a class="project-url" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayUrl(p.url))}</a>`
    : '';

  return `
    <div class="project">
      <div class="project-head">
        ${logo}
        <div class="project-name">${escapeHtml(p.name)}</div>
      </div>
      ${p.description ? `<div class="project-desc">${escapeHtml(p.description)}</div>` : ''}
      ${urlEl}
    </div>`;
}

function renderProjectsPage(page, projects) {
  const grid = projects.length === 0
    ? `<p style="color:#999;text-align:center;font-style:italic;">No projects yet.</p>`
    : `<div class="projects-grid">${projects.map(renderProjectCard).join('')}</div>`;

  return `${HEAD(`${page.title || 'Projects'} | Brian Franklin`, PROJECTS_STYLES)}
<body>
  <div class="container">
    <div class="page-header">
      <h1 class="page-title">${escapeHtml(page.title || 'Projects')}</h1>
      ${page.summary ? `<p class="page-description">${escapeHtml(page.summary)}</p>` : ''}
      <a href="/" class="home-link"><i class="fas fa-arrow-left"></i> Back to home</a>
    </div>
    ${grid}
  </div>
</body>
</html>`;
}

function buildProjects() {
  if (!fs.existsSync(PROJECTS_SRC)) {
    console.log('No projects.yaml found — skipping.');
    return;
  }
  const raw = fs.readFileSync(PROJECTS_SRC, 'utf8');
  const parsed = YAML.parse(raw) || {};
  const page = parsed.page || {};
  const projects = parsed.projects || [];

  if (fs.existsSync(PROJECTS_OUT)) fs.rmSync(PROJECTS_OUT, { recursive: true, force: true });
  fs.mkdirSync(PROJECTS_OUT, { recursive: true });
  fs.mkdirSync(PROJECTS_IMG_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROJECTS_OUT, 'index.html'), renderProjectsPage(page, projects));
  console.log(`Built projects/ (${projects.length} project(s))`);
}

function cleanOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    const full = path.join(OUT_DIR, entry.name);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

async function main() {
  const posts = readPosts();
  cleanOutDir();
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(posts));
  for (const post of posts) {
    const dir = path.join(OUT_DIR, post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPost(post));
  }
  console.log(`Built ${posts.length} post(s) -> ${path.relative(ROOT, OUT_DIR)}/`);
  for (const p of posts) console.log(`  - ${p.slug} (${p.date})`);
  await buildBooks();
  buildProjects();
}

main().catch(err => { console.error(err); process.exit(1); });
