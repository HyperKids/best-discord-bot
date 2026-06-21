// modules/sanity.js
// Thin wrapper around @sanity/client for publishing a Discord message as an
// `article` document on the Brown Esports website (brownesports.org, Sanity
// project w12prbqd / dataset production). The data shape, tag set and
// markdown -> Portable Text conversion mirror studio-brown-esports/import-news.mjs
// so bot-published posts look identical to the bulk-imported announcements.

const axios = require("axios");

const PROJECT_ID = "w12prbqd";
const DATASET = "production";
const API_VERSION = "2026-06-01";
const STUDIO_URL = "https://brownesports.sanity.studio";
const SITE_URL = "https://brownesports.org";

// The five categories used on the site. Must match the `tag` docs created by
// import-news.mjs. We createIfNotExists these so a publish never dangles on a
// missing reference, but never clobber an existing tag's color/sort.
const TAGS = {
  Events: { _id: "tag-events", text: "Events", color: "#4493f8", sort: 2 },
  Results: { _id: "tag-results", text: "Results", color: "#3fb950", sort: 3 },
  Recruiting: { _id: "tag-recruiting", text: "Recruiting", color: "#d29922", sort: 4 },
  Announcements: { _id: "tag-announcements", text: "Announcements", color: "#e7392f", sort: 5 },
  Community: { _id: "tag-community", text: "Community", color: "#a371f7", sort: 6 },
};

// --- @sanity/client loaded lazily via dynamic import so this CommonJS module
//     works whether the installed build is CJS or ESM-only ---
let _clientPromise = null;
function getClient() {
  if (!process.env.SANITY_API_TOKEN) {
    return Promise.reject(
      new Error("SANITY_API_TOKEN is not set — cannot publish to Sanity.")
    );
  }
  if (!_clientPromise) {
    _clientPromise = import("@sanity/client").then((mod) => {
      const createClient =
        mod.createClient || (mod.default && mod.default.createClient);
      return createClient({
        projectId: PROJECT_ID,
        dataset: DATASET,
        apiVersion: API_VERSION,
        token: process.env.SANITY_API_TOKEN,
        useCdn: false,
      });
    });
  }
  return _clientPromise;
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const profileName = (p) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ") || p._id;

// ---- Portable Text conversion (copied from import-news.mjs) ----
// headings `## `, bullets `- `, italics `_x_`, and bare links. A fresh key
// counter is created per toPortableText() call so _keys are unique within a doc.
function makeKeyer() {
  let k = 0;
  return (p) => (p || "k") + k++;
}
function spans(text, markDefs, key) {
  const out = [];
  for (const part of text.split(/(_[^_]+_)/g)) {
    if (!part) continue;
    let marks = [];
    let t = part;
    if (/^_[^_]+_$/.test(part)) {
      marks = ["em"];
      t = part.slice(1, -1);
    }
    for (const seg of t.split(/(https?:\/\/[^\s]+)/g)) {
      if (!seg) continue;
      if (/^https?:\/\//.test(seg)) {
        const dk = key("link");
        markDefs.push({ _type: "link", _key: dk, href: seg });
        out.push({ _type: "span", _key: key("s"), text: seg, marks: [...marks, dk] });
      } else {
        out.push({ _type: "span", _key: key("s"), text: seg, marks });
      }
    }
  }
  if (!out.length) out.push({ _type: "span", _key: key("s"), text: "", marks: [] });
  return out;
}
function toPortableText(body) {
  const key = makeKeyer();
  const blocks = [];
  for (const para of String(body || "").split(/\n{2,}/)) {
    for (const raw of para.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      let style = "normal";
      let listItem = null;
      let text = line;
      if (text.startsWith("## ")) {
        style = "h3";
        text = text.slice(3);
      } else if (text.startsWith("- ")) {
        listItem = "bullet";
        text = text.slice(2);
      }
      const markDefs = [];
      const block = {
        _type: "block",
        _key: key("b"),
        style,
        markDefs,
        children: spans(text, markDefs, key),
      };
      if (listItem) {
        block.listItem = listItem;
        block.level = 1;
      }
      blocks.push(block);
    }
  }
  return blocks;
}

// ---- profiles (authors) ----
async function fetchProfiles() {
  const client = await getClient();
  return client.fetch(
    '*[_type=="profile"]|order(firstName asc){_id,firstName,lastName,discordId}'
  );
}

// Find the single profile linked to a Discord user id (for auto-matching the
// original poster). Returns null if none.
async function findProfileByDiscordId(discordId) {
  if (!discordId) return null;
  const client = await getClient();
  return client.fetch(
    '*[_type=="profile" && discordId==$id][0]{_id,firstName,lastName,discordId}',
    { id: discordId }
  );
}

// Type-to-search by name. Matches the first typed token as a prefix against
// firstName or lastName; capped at 25 (Discord select limit).
async function searchProfiles(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const first = q.split(/\s+/)[0].replace(/[^\p{L}\p{N}'-]/gu, "");
  if (!first) return [];
  const client = await getClient();
  return client.fetch(
    '*[_type=="profile" && (firstName match $q || lastName match $q)] | order(firstName asc) [0...25] {_id,firstName,lastName,discordId}',
    { q: first + "*" }
  );
}

// Create a new author profile, tagging it with the Discord id of the original
// poster so future publishes auto-match them.
async function createProfile({ firstName, lastName, discordId }) {
  const client = await getClient();
  const id =
    "profile-author-" +
    (slugify([firstName, lastName].filter(Boolean).join(" ")) || "unnamed") +
    "-" +
    Math.random().toString(36).slice(2, 7);
  const doc = { _id: id, _type: "profile", firstName };
  if (lastName) doc.lastName = lastName;
  if (discordId) doc.discordId = discordId;
  await client.createOrReplace(doc);
  return doc;
}

// ---- images ----
async function uploadImageFromUrl(url, filename) {
  const client = await getClient();
  const res = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(res.data);
  const asset = await client.assets.upload("image", buffer, {
    filename: filename || "discord-image",
  });
  return asset._id;
}

// ---- publish an article ----
// opts: { title, subtitle, body, publishDate (ISO), authorId, tag, imageUrl, imageName }
async function publishArticle(opts) {
  const client = await getClient();
  const dateIso = opts.publishDate || new Date().toISOString();
  const dateOnly = dateIso.slice(0, 10);
  const baseSlug = slugify(opts.title) || "post";
  const slug = `${baseSlug}-${dateOnly}`;
  const _id = `article-${slug}`;

  const key = makeKeyer();
  const doc = {
    _id,
    _type: "article",
    title: opts.title,
    slug: { _type: "slug", current: slug },
    publishDate: dateIso,
    // chronological by publish date so newer posts sort after older ones.
    sort: Math.floor(new Date(dateIso).getTime() / 1000),
  };
  if (opts.subtitle) doc.subtitle = opts.subtitle;
  if (opts.authorId) doc.authors = { _type: "reference", _ref: opts.authorId };
  if (opts.tag && TAGS[opts.tag]) {
    doc.tags = [{ _type: "reference", _key: key("t"), _ref: TAGS[opts.tag]._id }];
  }
  doc.content = toPortableText(opts.body);

  // Upload the image first (outside the transaction) so a failure here doesn't
  // abort the whole publish — we just publish without the photo.
  if (opts.imageUrl) {
    try {
      const assetId = await uploadImageFromUrl(opts.imageUrl, opts.imageName);
      doc.photo = { _type: "image", asset: { _type: "reference", _ref: assetId } };
    } catch (err) {
      console.error("[publish] image upload failed, continuing without it:", err.message);
    }
  }

  const tx = client.transaction();
  if (opts.tag && TAGS[opts.tag]) {
    const t = TAGS[opts.tag];
    tx.createIfNotExists({ _id: t._id, _type: "tag", text: t.text, color: t.color, sort: t.sort });
  }
  tx.createOrReplace(doc);
  await tx.commit();

  return {
    _id,
    slug,
    siteUrl: `${SITE_URL}/news/${dateOnly}/${slug}`,
    studioUrl: `${STUDIO_URL}/structure/article;${_id}`,
  };
}

module.exports = {
  TAGS,
  slugify,
  profileName,
  toPortableText,
  fetchProfiles,
  findProfileByDiscordId,
  searchProfiles,
  createProfile,
  uploadImageFromUrl,
  publishArticle,
  STUDIO_URL,
  SITE_URL,
};
