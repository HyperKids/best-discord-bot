// modules/publish.js
// "Publish to Website" message context-menu command for the Brown Esports bot.
//
// Flow:
//   1. Right-click a message -> Apps -> Brown Esports -> "Publish to Website"
//   2. Permission gate: President role OR the owner user id.
//   3. A modal collects Title / Subtitle / Body / Publish date (prefilled from
//      the message). Discord modals can't hold dropdowns, so...
//   4. ...an ephemeral follow-up message carries an author <select> (required,
//      from existing Sanity profiles + "Create new"), a category <select>, and
//      Publish / Cancel buttons.
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

function normalizeDate(raw, fallbackTs) {
  if (raw) {
    const d = new Date(raw.length <= 10 ? raw + "T12:00:00Z" : raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (fallbackTs) return new Date(fallbackTs).toISOString();
  return new Date().toISOString();
}

// Build the ephemeral review message (content + components). Caller adds the
// ephemeral flag on the initial reply; update() calls reuse it as-is.
function buildReviewMessage(token) {
  const s = pending.get(token);
  const lines = [
    "**Review before publishing to brownesports.org:**",
    `• **Title:** ${s.title}`,
    s.subtitle ? `• **Subtitle:** ${s.subtitle}` : null,
    `• **Publish date:** ${s.publishDate}`,
    `• **Author:** ${s.authorLabel || "_none selected — required_"}`,
    `• **Category:** ${s.tag}`,
    `• **Image:** ${s.imageUrl ? "attached from message ✅" : "none"}`,
    `• **Body:** ${s.body.length} chars`,
  ].filter(Boolean);

  // Author select — matched/selected author first, then alphabetical, capped at
  // 24 (Discord allows 25 options; we reserve one for "Create new").
  const profiles = (s.profiles || []).slice().sort((a, b) => {
    if (a._id === s.authorId) return -1;
    if (b._id === s.authorId) return 1;
    return sanity.profileName(a).localeCompare(sanity.profileName(b));
  });
  const authorOptions = profiles.slice(0, 24).map((p) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(sanity.profileName(p).slice(0, 100))
      .setValue(p._id)
      .setDefault(p._id === s.authorId)
  );
  authorOptions.push(
    new StringSelectMenuOptionBuilder()
      .setLabel("➕ Create new author…")
      .setValue("__create__")
  );
  const authorSelect = new StringSelectMenuBuilder()
    .setCustomId(`publish_author:${token}`)
    .setPlaceholder("Select author (required)")
    .addOptions(authorOptions);

  const tagSelect = new StringSelectMenuBuilder()
    .setCustomId(`publish_tag:${token}`)
    .setPlaceholder("Select category")
    .addOptions(
      Object.keys(sanity.TAGS).map((name) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(name)
          .setValue(name)
          .setDefault(name === s.tag)
      )
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`publish_go:${token}`)
      .setLabel("Publish")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`publish_cancel:${token}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: lines.join("\n"),
    components: [
      new ActionRowBuilder().addComponents(authorSelect),
      new ActionRowBuilder().addComponents(tagSelect),
      buttons,
    ],
  };
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

  // Stash the target so the modal submit can recover author/date even if the
  // message is later edited/deleted.
  pending.set(token, {
    target: {
      channelId: interaction.channelId,
      messageId: msg.id,
      authorDiscordId: msg.author.id,
      authorName: msg.author.username,
      messageTs: msg.createdTimestamp,
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
        .setPlaceholder("2026-06-21T15:00:00Z")
        .setValue(new Date(msg.createdTimestamp).toISOString())
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
  const publishDate = normalizeDate(rawDate, target.messageTs);

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

  let profiles = [];
  try {
    profiles = await sanity.fetchProfiles();
  } catch (e) {
    console.error("[publish] fetchProfiles failed:", e.message);
  }
  const matched = profiles.find(
    (p) => p.discordId && authorDiscordId && p.discordId === authorDiscordId
  );

  pending.set(token, {
    target,
    title,
    subtitle,
    body,
    publishDate,
    authorDiscordId,
    imageUrl,
    imageName,
    profiles,
    authorId: matched ? matched._id : null,
    authorLabel: matched ? sanity.profileName(matched) : null,
    tag: "Announcements",
  });
  scheduleCleanup(token);

  await interaction.reply({
    ...buildReviewMessage(token),
    flags: MessageFlags.Ephemeral,
  });
}

// ---- step 3a: author select ----
async function onAuthorSelect(interaction) {
  const token = interaction.customId.split(":")[1];
  const s = pending.get(token);
  if (!s)
    return interaction.update({
      content: "⌛ This publish session expired. Re-run the command.",
      components: [],
    });

  const value = interaction.values[0];
  if (value === "__create__") {
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

  s.authorId = value;
  const p = (s.profiles || []).find((x) => x._id === value);
  s.authorLabel = p ? sanity.profileName(p) : value;
  return interaction.update(buildReviewMessage(token));
}

// ---- step 3b: "create new author" modal submitted ----
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
  s.profiles = [
    ...(s.profiles || []),
    { _id: created._id, firstName, lastName, discordId: s.authorDiscordId },
  ];
  return interaction.update(buildReviewMessage(token));
}

// ---- step 3c: category select ----
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

// ---- step 4: Publish ----
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
      content: "⚠️ Please choose an author first — it's required.",
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
        `✅ Published **${s.title}** as ${s.authorLabel}.\n` +
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
      if (interaction.customId.startsWith("publish_newauthor:")) return await onNewAuthorModal(interaction);
      return;
    }
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("publish_author:")) return await onAuthorSelect(interaction);
      if (interaction.customId.startsWith("publish_tag:")) return await onTagSelect(interaction);
      return;
    }
    if (interaction.isButton && interaction.isButton()) {
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
