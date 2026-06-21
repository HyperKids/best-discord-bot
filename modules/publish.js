// modules/publish.js
// "Publish to Website" message context-menu command for the Brown Esports bot.
//
// Flow:
//   1. Right-click a message -> Apps -> Brown Esports -> "Publish to Website"
//   2. Permission gate: President role OR the owner user id.
//   3. A modal collects Title / Subtitle / Body / Publish date (prefilled from
//      the message; date is a clean YYYY-MM-DD).
//   4. An ephemeral review message shows a human-readable summary plus:
//        - the author (auto-matched from the poster's Discord id when possible)
//        - a "Search author" button (type-to-search by name -> pick from matches)
//          and a "Create new author" button — author is required
//        - a category select, and Publish / Cancel buttons
//   5. Publish uploads any image attachment + writes the `article` to Sanity.

const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const sanity = require("./sanity");

const COMMAND_NAME = "Publish to Website";
const PRESIDENT_ROLE = "445482959085240331";
const OWNER_USER = "196685652249673728";

// In-memory session state, keyed by the target message id. Single-process bot,
// so a Map is fine. Sessions self-expire after 15 minutes.
const pending = new Map();
const SESSION_TTL = 15 * 60 * 1000;
function scheduleCleanup(token) {
  setTimeout(() => pending.delete(token), SESSION_TTL).unref?.();
}

// ---- helpers ----
async function isAllowed(interaction) {
  if (interaction.user.id === OWNER_USER) return true;
  try {
    const member =
      interaction.member && interaction.member.roles && interaction.member.roles.cache
        ? interaction.member
        : await interaction.guild.members.fetch(interaction.user.id);
    return member.roles.cache.has(PRESIDENT_ROLE);
  } catch {
    return false;
  }
}

// Display a stored ISO timestamp as e.g. "June 21, 2026" (the site shows the
// date only anyway). UTC so the calendar day never shifts.
function humanDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

// Turn the user's date input back into an ISO timestamp. Prefer a clean
// YYYY-MM-DD; if it equals the message's own date we keep the message's precise
// time (preserves intra-day ordering), otherwise noon UTC. Full ISO is accepted
// too if someone pastes one.
function resolveDate(raw, originalIso) {
  const origDateOnly = originalIso ? originalIso.slice(0, 10) : null;
  const s = (raw || "").trim();
  if (s) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      if (s === origDateOnly && originalIso) return originalIso;
      const d = new Date(s + "T12:00:00Z");
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return originalIso || new Date().toISOString();
}

// Build the ephemeral review message (content + components).
function buildReviewMessage(token) {
  const s = pending.get(token);
  const lines = [];
  if (s.searchNote) lines.push(s.searchNote, "");
  lines.push(
    "**Review before publishing to brownesports.org:**",
    `• **Title:** ${s.title}`,
    ...(s.subtitle ? [`• **Subtitle:** ${s.subtitle}`] : []),
    `• **Publish date:** ${humanDate(s.publishDate)}`,
    `• **Author:** ${
      s.authorLabel
        ? `**${s.authorLabel}**`
        : "⚠️ _not set — use 🔍 Search or ➕ Create below (required)_"
    }`,
    `• **Category:** ${s.tag}`,
    `• **Image:** ${s.imageUrl ? "attached from message ✅" : "none"}`,
    `• **Body:** ${s.body.length} chars`
  );

  const rows = [];

  // Search-results select — only present right after a name search returns >1.
  if (s.searchResults && s.searchResults.length) {
    const opts = s.searchResults.slice(0, 25).map((p) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(sanity.profileName(p).slice(0, 100))
        .setDescription(p.discordId ? "has a Discord ID" : "no Discord ID")
        .setValue(p._id)
        .setDefault(p._id === s.authorId)
    );
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`publish_pickauthor:${token}`)
          .setPlaceholder(`Pick the author (${s.searchResults.length} match${s.searchResults.length === 1 ? "" : "es"})`)
          .addOptions(opts)
      )
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`publish_tag:${token}`)
        .setPlaceholder("Select category")
        .addOptions(
          Object.keys(sanity.TAGS).map((name) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(name)
              .setValue(name)
              .setDefault(name === s.tag)
          )
        )
    )
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`publish_searchauthor:${token}`)
        .setLabel("🔍 Search author")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`publish_newauthorbtn:${token}`)
        .setLabel("➕ Create new author")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`publish_go:${token}`)
        .setLabel("Publish")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`publish_cancel:${token}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return { content: lines.join("\n"), components: rows };
}

// ---- command registration (call on ready) ----
async function register(client, guildId) {
  const data = new ContextMenuCommandBuilder()
    .setName(COMMAND_NAME)
    .setType(ApplicationCommandType.Message);
  const guild = await client.guilds.fetch(guildId);
  await guild.commands.create(data);
  console.log(`[publish] registered "${COMMAND_NAME}" context menu in guild ${guildId}`);
}

// ---- step 1: context menu clicked -> show modal ----
async function onContextMenu(interaction) {
  if (!(await isAllowed(interaction))) {
    return interaction.reply({
      content:
        "🔒 You don't have permission to publish to the website. (Requires the President role.)",
      flags: MessageFlags.Ephemeral,
    });
  }
  const msg = interaction.targetMessage;
  const token = msg.id;
  const content = msg.content || "";
  const firstLine = content.split("\n").find((l) => l.trim()) || "";
  const originalIso = new Date(msg.createdTimestamp).toISOString();

  pending.set(token, {
    target: {
      channelId: interaction.channelId,
      messageId: msg.id,
      authorDiscordId: msg.author.id,
      authorName: msg.author.username,
      originalIso,
    },
  });
  scheduleCleanup(token);

  const modal = new ModalBuilder()
    .setCustomId(`publish_modal:${token}:${interaction.channelId}`)
    .setTitle("Publish to Website");
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("title")
        .setLabel("Title")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true)
        .setValue(firstLine.slice(0, 100))
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("subtitle")
        .setLabel("Subtitle (optional)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(150)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("body")
        .setLabel("Body")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(4000)
        .setRequired(true)
        .setValue(content.slice(0, 4000))
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("publishDate")
        .setLabel("Publish date")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("YYYY-MM-DD")
        .setValue(originalIso.slice(0, 10))
    )
  );
  await interaction.showModal(modal);
}

// ---- step 2: modal submitted -> resolve author/image, show review message ----
async function onModalSubmit(interaction) {
  const parts = interaction.customId.split(":");
  const token = parts[1];
  const channelIdFromId = parts[2];
  const prev = pending.get(token) || {};
  const target = prev.target || {};

  const title = interaction.fields.getTextInputValue("title").trim();
  const subtitle = (interaction.fields.getTextInputValue("subtitle") || "").trim();
  const body = interaction.fields.getTextInputValue("body");
  const rawDate = (interaction.fields.getTextInputValue("publishDate") || "").trim();
  const publishDate = resolveDate(rawDate, target.originalIso);

  // Re-fetch the message for its image attachment + author (best-effort).
  let imageUrl = null;
  let imageName = null;
  let authorDiscordId = target.authorDiscordId || null;
  try {
    const ch = await interaction.client.channels.fetch(channelIdFromId || target.channelId);
    const msg = await ch.messages.fetch(token);
    authorDiscordId = msg.author.id;
    const img = msg.attachments.find(
      (a) =>
        (a.contentType || "").startsWith("image/") ||
        /\.(png|jpe?g|gif|webp)$/i.test(a.name || "")
    );
    if (img) {
      imageUrl = img.url;
      imageName = img.name || "image";
    }
  } catch (e) {
    console.error("[publish] could not re-fetch target message:", e.message);
  }

  // Auto-match the original poster to a profile by Discord id (targeted query,
  // not the full 92-profile list).
  let matched = null;
  try {
    matched = await sanity.findProfileByDiscordId(authorDiscordId);
  } catch (e) {
    console.error("[publish] findProfileByDiscordId failed:", e.message);
  }

  pending.set(token, {
    target,
    title,
    subtitle,
    body,
    publishDate,
    authorDiscordId,
    imageUrl,
    imageName,
    authorId: matched ? matched._id : null,
    authorLabel: matched ? sanity.profileName(matched) : null,
    tag: "Announcements",
    searchResults: null,
    searchNote: matched
      ? `✅ Auto-matched author by Discord ID: **${sanity.profileName(matched)}**. Change it below if needed.`
      : null,
  });
  scheduleCleanup(token);

  await interaction.reply({
    ...buildReviewMessage(token),
    flags: MessageFlags.Ephemeral,
  });
}

// ---- author: "Search author" button -> name modal ----
async function onSearchAuthorButton(interaction) {
  const token = interaction.customId.split(":")[1];
  if (!pending.get(token))
    return interaction.update({
      content: "⌛ This publish session expired. Re-run the command.",
      components: [],
    });
  const modal = new ModalBuilder()
    .setCustomId(`publish_searchmodal:${token}`)
    .setTitle("Find author");
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("q")
        .setLabel("Author name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("Type a first or last name, e.g. Isaac")
    )
  );
  return interaction.showModal(modal);
}

// ---- author: name modal submitted -> search + render matches ----
async function onSearchModalSubmit(interaction) {
  const token = interaction.customId.split(":")[1];
  const s = pending.get(token);
  if (!s)
    return interaction.reply({
      content: "⌛ This publish session expired. Re-run the command.",
      flags: MessageFlags.Ephemeral,
    });
  const q = interaction.fields.getTextInputValue("q").trim();

  let results = [];
  try {
    results = await sanity.searchProfiles(q);
  } catch (e) {
    console.error("[publish] searchProfiles failed:", e.message);
  }

  if (!results.length) {
    s.searchResults = null;
    s.searchNote = `🔎 No profiles match “${q}”. Try a different spelling, or ➕ Create new author.`;
  } else if (results.length === 1) {
    s.authorId = results[0]._id;
    s.authorLabel = sanity.profileName(results[0]);
    s.searchResults = null;
    s.searchNote = `✅ Author set to **${s.authorLabel}** (only match for “${q}”).`;
  } else {
    s.searchResults = results;
    s.searchNote = `🔎 ${results.length} matches for “${q}” — pick one below.`;
  }
  // Modal shown from a message component (the search button) -> update() is valid.
  return interaction.update(buildReviewMessage(token));
}

// ---- author: pick from the search-results select ----
async function onPickAuthorSelect(interaction) {
  const token = interaction.customId.split(":")[1];
  const s = pending.get(token);
  if (!s)
    return interaction.update({
      content: "⌛ This publish session expired. Re-run the command.",
      components: [],
    });
  const id = interaction.values[0];
  const p = (s.searchResults || []).find((x) => x._id === id);
  s.authorId = id;
  s.authorLabel = p ? sanity.profileName(p) : id;
  s.searchResults = null;
  s.searchNote = `✅ Author set to **${s.authorLabel}**.`;
  return interaction.update(buildReviewMessage(token));
}

// ---- author: "Create new author" button -> name modal ----
async function onNewAuthorButton(interaction) {
  const token = interaction.customId.split(":")[1];
  if (!pending.get(token))
    return interaction.update({
      content: "⌛ This publish session expired. Re-run the command.",
      components: [],
    });
  const modal = new ModalBuilder()
    .setCustomId(`publish_newauthor:${token}`)
    .setTitle("New author");
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("firstName")
        .setLabel("First name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("lastName")
        .setLabel("Last name (optional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );
  return interaction.showModal(modal);
}

// ---- author: "Create new author" modal submitted -> create profile ----
async function onNewAuthorModal(interaction) {
  const token = interaction.customId.split(":")[1];
  const s = pending.get(token);
  if (!s)
    return interaction.reply({
      content: "⌛ This publish session expired. Re-run the command.",
      flags: MessageFlags.Ephemeral,
    });

  const firstName = interaction.fields.getTextInputValue("firstName").trim();
  const lastName = (interaction.fields.getTextInputValue("lastName") || "").trim();
  const created = await sanity.createProfile({
    firstName,
    lastName,
    discordId: s.authorDiscordId || undefined,
  });
  s.authorId = created._id;
  s.authorLabel = [firstName, lastName].filter(Boolean).join(" ");
  s.searchResults = null;
  s.searchNote = `✅ Created and selected **${s.authorLabel}**.`;
  return interaction.update(buildReviewMessage(token));
}

// ---- category select ----
async function onTagSelect(interaction) {
  const token = interaction.customId.split(":")[1];
  const s = pending.get(token);
  if (!s)
    return interaction.update({
      content: "⌛ This publish session expired. Re-run the command.",
      components: [],
    });
  s.tag = interaction.values[0];
  return interaction.update(buildReviewMessage(token));
}

// ---- Publish ----
async function onPublish(interaction) {
  const token = interaction.customId.split(":")[1];
  const s = pending.get(token);
  if (!s)
    return interaction.update({
      content: "⌛ This publish session expired. Re-run the command.",
      components: [],
    });
  if (!s.authorId) {
    return interaction.reply({
      content:
        "⚠️ Please set an author first — use 🔍 Search author or ➕ Create new author. It's required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.update({
    content: "⏳ Publishing to brownesports.org…",
    components: [],
  });
  try {
    const result = await sanity.publishArticle({
      title: s.title,
      subtitle: s.subtitle,
      body: s.body,
      publishDate: s.publishDate,
      authorId: s.authorId,
      tag: s.tag,
      imageUrl: s.imageUrl,
      imageName: s.imageName,
    });
    pending.delete(token);
    await interaction.editReply({
      content:
        `✅ Published **${s.title}** as ${s.authorLabel} (${humanDate(s.publishDate)}).\n` +
        `🔗 ${result.siteUrl}\n` +
        `✏️ Edit in Studio: ${result.studioUrl}\n\n` +
        `_The site fetches from Sanity's CDN, so it may take a minute to appear._`,
      components: [],
    });
  } catch (err) {
    console.error("[publish] publishArticle failed:", err);
    await interaction.editReply({
      content:
        "❌ Publish failed: " +
        err.message +
        "\nNothing was saved — you can run the command again.",
      components: [],
    });
  }
}

async function onCancel(interaction) {
  const token = interaction.customId.split(":")[1];
  pending.delete(token);
  return interaction.update({
    content: "🚫 Cancelled — nothing was published.",
    components: [],
  });
}

// ---- router (wire to client 'interactionCreate') ----
async function handleInteraction(interaction) {
  try {
    if (
      interaction.isMessageContextMenuCommand &&
      interaction.isMessageContextMenuCommand() &&
      interaction.commandName === COMMAND_NAME
    ) {
      return await onContextMenu(interaction);
    }
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("publish_modal:")) return await onModalSubmit(interaction);
      if (interaction.customId.startsWith("publish_searchmodal:")) return await onSearchModalSubmit(interaction);
      if (interaction.customId.startsWith("publish_newauthor:")) return await onNewAuthorModal(interaction);
      return;
    }
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("publish_tag:")) return await onTagSelect(interaction);
      if (interaction.customId.startsWith("publish_pickauthor:")) return await onPickAuthorSelect(interaction);
      return;
    }
    if (interaction.isButton && interaction.isButton()) {
      if (interaction.customId.startsWith("publish_searchauthor:")) return await onSearchAuthorButton(interaction);
      if (interaction.customId.startsWith("publish_newauthorbtn:")) return await onNewAuthorButton(interaction);
      if (interaction.customId.startsWith("publish_go:")) return await onPublish(interaction);
      if (interaction.customId.startsWith("publish_cancel:")) return await onCancel(interaction);
      return;
    }
  } catch (err) {
    console.error("[publish] interaction error:", err);
    try {
      const note = "⚠️ Something went wrong: " + err.message;
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: note, flags: MessageFlags.Ephemeral });
      } else if (interaction.isRepliable && interaction.isRepliable()) {
        await interaction.reply({ content: note, flags: MessageFlags.Ephemeral });
      }
    } catch {
      /* ignore */
    }
  }
}

module.exports = { register, handleInteraction, COMMAND_NAME };
