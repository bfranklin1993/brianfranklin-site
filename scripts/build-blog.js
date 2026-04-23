#!/usr/bin/env node
// Generates my-thoughts/ from posts/*.md
// Each post = markdown file with frontmatter: title, date, summary

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_DIR = path.join(ROOT, 'my-thoughts');

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

function main() {
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
}

main();
