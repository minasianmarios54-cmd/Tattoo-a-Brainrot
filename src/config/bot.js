import { logger } from '../utils/logger.js';

export const botConfig = {
  // =========================
  // BOT PRESENCE (what users see under the bot name)
  // =========================
  // `status` options:
  // - "online"    = green dot
  // - "idle"      = yellow moon
  // - "dnd"       = red do-not-disturb
  // - "invisible" = appears offline
  presence: {
    // Current online state shown on Discord.
    status: "online",

    // Activity lines shown under the bot name.
    // `type` number mapping from Discord:
    // 0 = Playing
    // 1 = Streaming
    // 2 = Listening
    // 3 = Watching
    // 4 = Custom
    // 5 = Competing
    activities: [
      {
        // Text users will see (example: "Playing /help | Titan Bot").
        name: "Tattoo A Brainrot",
        // Activity type number (0 = Playing).
        type: 0,
      },
    ],
  },

  // =========================
  // COMMAND BEHAVIOR
  // =========================
  commands: {
    // Bot owner user IDs (comma-separated in OWNER_IDS env var).
    // Owners can access owner/admin-level bot commands.
    owners: process.env.OWNER_IDS?.split(",") || [],

    // Default wait time between command uses (in seconds).
    defaultCooldown: 3,

    // If true, old commands are removed before re-registering.
    deleteCommands: false,

    // Optional server ID used for testing slash commands quickly.
    testGuildId: process.env.TEST_GUILD_ID,

    // Command prefix for text-based commands (e.g., "!" for "!ping").
    // Supports both slash commands and prefix commands.
    prefix: process.env.PREFIX || "!",
  },

  // =========================
  // APPLICATIONS SYSTEM
  // =========================
  applications: {
    // Default questions shown when someone fills out an application.
    defaultQuestions: [
      { question: "What is your name?", required: true },
      { question: "How old are you?", required: true },
      { question: "Why do you want to join?", required: true },
    ],

    // Embed colors by application status.
    statusColors: {
      pending: "#FFA500",
      approved: "#00FF00",
      denied: "#FF0000",
    },

    // How long users must wait before submitting another application (hours).
    applicationCooldown: 24,

    // Auto-delete denied applications after this many days.
    deleteDeniedAfter: 7,

    // Auto-delete approved applications after this many days.
    deleteApprovedAfter: 30,

    // Role IDs allowed to manage applications.
    managerRoles: [], // Will be populated from environment or database
  },

  // =========================
  // EMBED COLORS & BRANDING
  // =========================
  // IMPORTANT: This is the SINGLE SOURCE OF TRUTH for all bot colors
  embeds: {
    colors: {
      // Main brand colors.
      primary: "#336699",
      secondary: "#2F3136",

      // Standard status colors for success/error/warning/info messages.
      success: "#57F287",
      error: "#ED4245",
      warning: "#FEE75C",
      info: "#3498DB",

      // Neutral utility colors.
      light: "#FFFFFF",
      dark: "#202225",
      gray: "#99AAB5",

      // Discord-style palette shortcuts.
      blurple: "#5865F2",
      green: "#57F287",
      yellow: "#FEE75C",
      fuchsia: "#EB459E",
      red: "#ED4245",
      black: "#000000",

      // Feature-specific colors.
      giveaway: {
        active: "#57F287",
        ended: "#ED4245",
      },
      ticket: {
        open: "#57F287",
        claimed: "#FAA61A",
        closed: "#ED4245",
        pending: "#99AAB5",
      },
      economy: "#F1C40F",
      birthday: "#E91E63",
      moderation: "#9B59B6",

      // Ticket priority color mapping.
      priority: {
        none: "#95A5A6",
        low: "#3498db",
        medium: "#2ecc71",
        high: "#f1c40f",
        urgent: "#e74c3c",
      },
    },
    footer: {
      // Default footer text used in bot embeds.
      text: "Titan Bot",
      // Footer icon URL (null = no icon).
      icon: null,
    },
    // Default thumbnail URL for embeds (null = no thumbnail).
    thumbnail: null,
    author: {
      // Optional default embed author block.
      name: null,
      icon: null,
      url: null,
    },
  },

  // =========================
  // ECONOMY SETTINGS
  // =========================
  economy: {
    currency: {
      // Currency display name.
      name: "coins",
      // Plural display name.
      namePlural: "coins",
      // Currency symbol shown in balances.
      symbol: "$",
    },

    // Starting balance for new users.
    startingBalance: 0,

    // Maximum bank amount before upgrades (if upgrades are used).
    baseBankCapacity: 100000,

    // Daily reward amount.
    dailyAmount: 100,

    // Work command random payout range.
    workMin: 10,
    workMax: 100,

    // Beg command random payout range.
    begMin: 5,
    begMax: 50,

    // Chance to succeed when robbing (0.4 = 40%).
    robSuccessRate: 0.4,

    // Jail time after failed rob (milliseconds).
    // 3600000 = 1 hour.
    robFailJailTime: 3600000,
  },

  // =========================
  // SHOP SETTINGS
  // =========================
  // Add shop defaults here when needed.
  shop: {

  },

  // =========================
  // TICKET SYSTEM
  // =========================
 require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  AttachmentBuilder,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  TICKET_CATEGORY_ID,
  TICKET_LOG_CHANNEL_ID,
  STAFF_ROLE_ID,
} = process.env;

// In-memory ticket storage.
// For a bigger bot, move this to SQLite/MongoDB.
const openTickets = new Map();
const ticketOwners = new Map();
const ticketClaims = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Send the Ink Vault ticket panel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close the current ticket."),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim the current ticket."),

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add a user to this ticket.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to add")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a user from this ticket.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to remove")
        .setRequired(true)
    ),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });

  console.log("Slash commands registered.");
}

function isStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function cleanChannelName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 20);
}

function getTicketTypeLabel(type) {
  const labels = {
    bug: "🐛 Bug Report",
    scam: "🚨 Scam Report",
    purchase: "💸 Purchase Issue",
    appeal: "⚖️ Appeal",
    tester: "🧪 Tester Help",
    general: "❓ General Support",
  };

  return labels[type] || "❓ General Support";
}

async function createTranscript(channel) {
  const messages = [];
  let lastId;

  while (true) {
    const fetched = await channel.messages.fetch({
      limit: 100,
      before: lastId,
    });

    if (fetched.size === 0) break;

    messages.push(...fetched.values());
    lastId = fetched.last().id;

    if (messages.length >= 1000) break;
  }

  messages.reverse();

  const transcript = messages
    .map((msg) => {
      const time = msg.createdAt.toISOString();
      const author = `${msg.author.tag} (${msg.author.id})`;
      const content = msg.content || "[Embed/Attachment/Sticker]";
      const attachments = msg.attachments
        .map((a) => a.url)
        .join(", ");

      return `[${time}] ${author}: ${content}${
        attachments ? `\nAttachments: ${attachments}` : ""
      }`;
    })
    .join("\n");

  const buffer = Buffer.from(transcript || "No messages found.", "utf8");

  return new AttachmentBuilder(buffer, {
    name: `transcript-${channel.name}.txt`,
  });
}

async function closeTicket(channel, closedBy, reason = "No reason provided") {
  const guild = channel.guild;
  const logChannel = guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);

  const ownerId = ticketOwners.get(channel.id);
  const claimedBy = ticketClaims.get(channel.id);

  const transcript = await createTranscript(channel);

  const logEmbed = new EmbedBuilder()
    .setTitle("🔒 Ticket Closed")
    .setColor(0xff3b3b)
    .addFields(
      {
        name: "Ticket",
        value: `${channel.name}\n\`${channel.id}\``,
        inline: true,
      },
      {
        name: "Opened By",
        value: ownerId ? `<@${ownerId}>` : "Unknown",
        inline: true,
      },
      {
        name: "Closed By",
        value: `${closedBy}`,
        inline: true,
      },
      {
        name: "Claimed By",
        value: claimedBy ? `<@${claimedBy}>` : "Not claimed",
        inline: true,
      },
      {
        name: "Reason",
        value: reason,
        inline: false,
      }
    )
    .setTimestamp();

  if (logChannel) {
    await logChannel.send({
      embeds: [logEmbed],
      files: [transcript],
    });
  }

  if (ownerId) {
    openTickets.delete(ownerId);
  }

  ticketOwners.delete(channel.id);
  ticketClaims.delete(channel.id);

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff3b3b)
        .setDescription("🔒 This ticket will be deleted in **5 seconds**."),
    ],
  });

  setTimeout(async () => {
    try {
      await channel.delete();
    } catch (error) {
      console.error("Failed to delete ticket channel:", error);
    }
  }, 5000);
}

client.once("ready", async () => {
  console.log(`${client.user.tag} is online.`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === "ticket-panel") {
        const embed = new EmbedBuilder()
          .setTitle("🎫 The Ink Vault Support")
          .setDescription(
            [
              "Need help? Open a private ticket with staff.",
              "",
              "**Choose the category that fits your issue:**",
              "",
              "🐛 **Bug Report** — report a game/server bug",
              "🚨 **Scam Report** — report scammers or fake links",
              "💸 **Purchase Issue** — Robux/gamepass/product problems",
              "⚖️ **Appeal** — appeal a warning/ban",
              "🧪 **Tester Help** — beta tester support",
              "❓ **General Support** — anything else",
              "",
              "Do not open fake tickets. Abuse may result in a timeout or ban.",
            ].join("\n")
          )
          .setColor(0x8b5cf6)
          .setFooter({ text: "The Ink Vault • Tattoo a Brainrot" });

        const menu = new StringSelectMenuBuilder()
          .setCustomId("ticket_select")
          .setPlaceholder("Choose a ticket category")
          .addOptions([
            {
              label: "Bug Report",
              description: "Report a bug or exploit.",
              value: "bug",
              emoji: "🐛",
            },
            {
              label: "Scam Report",
              description: "Report a scammer or fake giveaway.",
              value: "scam",
              emoji: "🚨",
            },
            {
              label: "Purchase Issue",
              description: "Help with gamepasses or Robux purchases.",
              value: "purchase",
              emoji: "💸",
            },
            {
              label: "Appeal",
              description: "Appeal a punishment.",
              value: "appeal",
              emoji: "⚖️",
            },
            {
              label: "Tester Help",
              description: "Support for beta testers.",
              value: "tester",
              emoji: "🧪",
            },
            {
              label: "General Support",
              description: "Other questions.",
              value: "general",
              emoji: "❓",
            },
          ]);

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({
          content: "Ticket panel sent.",
          ephemeral: true,
        });

        await interaction.channel.send({
          embeds: [embed],
          components: [row],
        });
      }

      if (commandName === "close") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "This command can only be used inside a ticket.",
            ephemeral: true,
          });
        }

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Only staff can close tickets.",
            ephemeral: true,
          });
        }

        await interaction.reply({
          content: "Closing ticket...",
          ephemeral: true,
        });

        await closeTicket(interaction.channel, interaction.user, "Closed by command");
      }

      if (commandName === "claim") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "This command can only be used inside a ticket.",
            ephemeral: true,
          });
        }

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Only staff can claim tickets.",
            ephemeral: true,
          });
        }

        ticketClaims.set(interaction.channel.id, interaction.user.id);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x22c55e)
              .setDescription(`✅ This ticket has been claimed by ${interaction.user}.`),
          ],
        });
      }

      if (commandName === "add") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "This command can only be used inside a ticket.",
            ephemeral: true,
          });
        }

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Only staff can add users to tickets.",
            ephemeral: true,
          });
        }

        const user = interaction.options.getUser("user");

        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });

        await interaction.reply({
          content: `✅ Added ${user} to this ticket.`,
        });
      }

      if (commandName === "remove") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "This command can only be used inside a ticket.",
            ephemeral: true,
          });
        }

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Only staff can remove users from tickets.",
            ephemeral: true,
          });
        }

        const user = interaction.options.getUser("user");

        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: false,
          SendMessages: false,
          ReadMessageHistory: false,
        });

        await interaction.reply({
          content: `✅ Removed ${user} from this ticket.`,
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== "ticket_select") return;

      const type = interaction.values[0];
      const user = interaction.user;
      const guild = interaction.guild;

      if (openTickets.has(user.id)) {
        const existingChannelId = openTickets.get(user.id);

        return interaction.reply({
          content: `You already have an open ticket: <#${existingChannelId}>`,
          ephemeral: true,
        });
      }

      const ticketType = getTicketTypeLabel(type);
      const channelName = `ticket-${cleanChannelName(user.username)}`;

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageMessages,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.AttachFiles,
            ],
          },
        ],
      });

      openTickets.set(user.id, channel.id);
      ticketOwners.set(channel.id, user.id);

      const introEmbed = new EmbedBuilder()
        .setTitle(`${ticketType}`)
        .setColor(0x8b5cf6)
        .setDescription(
          [
            `Welcome ${user}. Staff will help you soon.`,
            "",
            "**Please include:**",
            "- Roblox username",
            "- What happened",
            "- Screenshots/videos if possible",
            "- Any purchase IDs or proof if relevant",
            "",
            "Do not ping staff repeatedly.",
          ].join("\n")
        )
        .setFooter({ text: "The Ink Vault Support" })
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_claim")
          .setLabel("Claim")
          .setEmoji("🙋")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Close")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${user} <@&${STAFF_ROLE_ID}>`,
        embeds: [introEmbed],
        components: [buttons],
      });

      await interaction.reply({
        content: `✅ Your ticket has been opened: ${channel}`,
        ephemeral: true,
      });
    }

    if (interaction.isButton()) {
      if (interaction.customId === "ticket_claim") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "This button can only be used inside a ticket.",
            ephemeral: true,
          });
        }

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Only staff can claim tickets.",
            ephemeral: true,
          });
        }

        if (ticketClaims.has(interaction.channel.id)) {
          return interaction.reply({
            content: `This ticket is already claimed by <@${ticketClaims.get(
              interaction.channel.id
            )}>.`,
            ephemeral: true,
          });
        }

        ticketClaims.set(interaction.channel.id, interaction.user.id);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x22c55e)
              .setDescription(`✅ Ticket claimed by ${interaction.user}.`),
          ],
        });
      }

      if (interaction.customId === "ticket_close") {
        if (!interaction.channel.name.startsWith("ticket-")) {
          return interaction.reply({
            content: "This button can only be used inside a ticket.",
            ephemeral: true,
          });
        }

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Only staff can close tickets.",
            ephemeral: true,
          });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close_confirm")
            .setLabel("Confirm Close")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("ticket_close_cancel")
            .setLabel("Cancel")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf97316)
              .setDescription("Are you sure you want to close this ticket?"),
          ],
          components: [confirmRow],
          ephemeral: true,
        });
      }

      if (interaction.customId === "ticket_close_confirm") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "Only staff can close tickets.",
            ephemeral: true,
          });
        }

        await interaction.reply({
          content: "Closing ticket...",
          ephemeral: true,
        });

        await closeTicket(interaction.channel, interaction.user, "Closed by button");
      }

      if (interaction.customId === "ticket_close_cancel") {
        await interaction.reply({
          content: "Ticket close cancelled.",
          ephemeral: true,
        });
      }
    }
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Something went wrong.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "Something went wrong.",
        ephemeral: true,
      });
    }
  }
});

client.login(DISCORD_TOKEN);

    // Default priority for new tickets.
    defaultPriority: "none",

    // Category ID where closed tickets are archived.
    archiveCategory: null,

    // Channel ID where ticket logs are sent.
    logChannel: null,
  },

  // =========================
  // GIVEAWAY SETTINGS
  // =========================
  giveaways: {
    // Default giveaway duration in milliseconds.
    // 86400000 = 24 hours.
    defaultDuration: 86400000,

    // Allowed winner count range.
    minimumWinners: 1,
    maximumWinners: 10,

    // Allowed giveaway duration range in milliseconds.
    // 300000 = 5 minutes.
    minimumDuration: 300000,
    // 2592000000 = 30 days.
    maximumDuration: 2592000000,

    // Role IDs allowed to host giveaways.
    allowedRoles: [],

    // Role IDs that bypass giveaway restrictions.
    bypassRoles: [],
  },

  // =========================
  // BIRTHDAY SETTINGS
  // =========================
  birthday: {
    // Role ID given to users on their birthday.
    defaultRole: null,

    // Channel ID where birthday announcements are posted.
    announcementChannel: null,

    // Timezone used to calculate birthday dates.
    timezone: "UTC",
  },

  // =========================
  // VERIFICATION SETTINGS
  // =========================
  verification: {
    // Message shown when posting the verification panel.
    defaultMessage: "Click the button below to verify yourself and gain access to the server!",

    // Text on the verification button.
    defaultButtonText: "Verify",

    // Automatic verification behavior.
    autoVerify: {
      // How automatic verification decides who is auto-approved:
      // - "none"        = everyone is auto-verified immediately
      // - "account_age" = account must be older than set days
      // - "server_size" = auto-verify everyone only in smaller servers
      defaultCriteria: "none",

      // Days used when `defaultCriteria` is `account_age`.
      defaultAccountAgeDays: 7,

      // Member count threshold used when `defaultCriteria` is `server_size`.
      // Example: 1000 means auto-verify if server has fewer than 1000 members.
      serverSizeThreshold: 1000,

      // Allowed safety limits for account-age requirements.
      // 1 = minimum day, 365 = maximum days.
      minAccountAge: 1,
      maxAccountAge: 365,

      // If true, user receives a DM after verification.
      sendDMNotification: true,

      // Human-readable descriptions for each criteria mode.
      criteria: {
        account_age: "Account must be older than specified days",
        server_size: "All users if server has less than 1000 members",
        none: "All users immediately"
      }
    },

    // Minimum time between verification attempts (milliseconds).
    // 5000 = 5 seconds.
    verificationCooldown: 5000,

    // Maximum failed attempts allowed inside the time window below.
    maxVerificationAttempts: 3,

    // Time window for counting attempts (milliseconds).
    // 60000 = 1 minute.
    attemptWindow: 60000,

    // In-memory safety limits (helps avoid unbounded memory growth).
    maxCooldownEntries: 10000,
    maxAttemptEntries: 10000,
    // Cleanup frequency for cooldown/attempt maps (milliseconds).
    // 300000 = 5 minutes.
    cooldownCleanupInterval: 300000,
    // Maximum metadata payload size for audit entries (bytes).
    maxAuditMetadataBytes: 4096,
    // Maximum number of audit entries kept in memory.
    maxInMemoryAuditEntries: 1000,
    // If true, log every verification action.
    logAllVerifications: true,
    // If true, preserve verification audit history.
    keepAuditTrail: true,
  },

  // =========================
  // WELCOME / GOODBYE MESSAGES
  // =========================
  welcome: {
    // Welcome template posted when a user joins.
    // Placeholders: {user}, {server}, {memberCount}
    defaultWelcomeMessage:
      "Welcome {user} to {server}! We now have {memberCount} members!",
    // Goodbye template posted when a user leaves.
    // Placeholders: {user}, {memberCount}
    defaultGoodbyeMessage:
      "{user} has left the server. We now have {memberCount} members.",
    // Channel ID for welcome messages.
    defaultWelcomeChannel: null,
    // Channel ID for goodbye messages.
    defaultGoodbyeChannel: null,
  },

  // =========================
  // COUNTER CHANNELS
  // =========================
  counters: {
    defaults: {
      // Default naming/description templates for counter entries.
      name: "{name} Counter",
      description: "Server {name} counter",
      // Channel type used for counters (typically "voice").
      type: "voice",
      // Channel name format. `{count}` is replaced automatically.
      channelName: "{name}-{count}",
    },
    permissions: {
      // Default denied permissions for the counter channel.
      deny: ["VIEW_CHANNEL"],
      // Default allowed permissions for the counter channel.
      allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"],
    },
    messages: {
      // Default response messages for counter actions.
      created: "✅ Created counter **{name}**",
      deleted: "🗑️ Deleted counter **{name}**",
      updated: "🔄 Updated counter **{name}**",
    },
    types: {
      // Built-in counter types and how each count is calculated.
      members: {
        name: "👥 Members",
        description: "Total members in the server",
        getCount: (guild) => guild.memberCount.toString(),
      },
      bots: {
        name: "🤖 Bots",
        description: "Total bot accounts in the server",
        getCount: (guild) =>
          guild.members.cache.filter((m) => m.user.bot).size.toString(),
      },
      members_only: {
        name: "👤 Humans",
        description: "Total human members (non-bots)",
        getCount: (guild) =>
          guild.members.cache.filter((m) => !m.user.bot).size.toString(),
      },
    },
  },

  // =========================
  // GENERIC BOT MESSAGES
  // =========================
  messages: {
    noPermission: "You do not have permission to use this command.",
    cooldownActive: "Please wait {time} before using this command again.",
    errorOccurred: "An error occurred while executing this command.",
    missingPermissions:
      "I am missing required permissions to perform this action.",
    commandDisabled: "This command has been disabled.",
    maintenanceMode: "The bot is currently in maintenance mode.",
  },

  // =========================
  // FEATURE TOGGLES
  // =========================
  // Set any feature to `false` to disable it globally.
  features: {
    // Core systems.
    economy: true,
    leveling: true,
    moderation: true,
    logging: true,
    welcome: true,

    // Community engagement systems.
    tickets: true,
    giveaways: true,
    birthday: true,
    counter: true,

    // Security and self-service systems.
    verification: true,
    reactionRoles: true,
    joinToCreate: true,

    // Utility/quality-of-life modules.
    voice: true,
    search: true,
    tools: true,
    utility: true,
    community: true,
    fun: true,
  },
};

export function validateConfig(config) {
  const errors = [];

  if (process.env.NODE_ENV !== 'production') {
    logger.debug('Environment variables check:');
    logger.debug('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
    logger.debug('TOKEN exists:', !!process.env.TOKEN);
    logger.debug('CLIENT_ID exists:', !!process.env.CLIENT_ID);
    logger.debug('GUILD_ID exists:', !!process.env.GUILD_ID);
    logger.debug('POSTGRES_HOST exists:', !!process.env.POSTGRES_HOST);
    logger.debug('NODE_ENV:', process.env.NODE_ENV);
  }

  if (!process.env.DISCORD_TOKEN && !process.env.TOKEN) {
    errors.push("Bot token is required (DISCORD_TOKEN or TOKEN environment variable)");
  }

  if (!process.env.CLIENT_ID) {
    errors.push("Client ID is required (CLIENT_ID environment variable)");
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.POSTGRES_HOST) {
      errors.push("PostgreSQL host is required in production (POSTGRES_HOST environment variable)");
    }
    if (!process.env.POSTGRES_USER) {
      errors.push("PostgreSQL user is required in production (POSTGRES_USER environment variable)");
    }
    if (!process.env.POSTGRES_PASSWORD) {
      errors.push("PostgreSQL password is required in production (POSTGRES_PASSWORD environment variable)");
    }
  }

  return errors;
}

const configErrors = validateConfig(botConfig);
if (configErrors.length > 0) {
  logger.error("Bot configuration errors:", configErrors.join("\n"));
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

export const BotConfig = botConfig;

export function getColor(path, fallback = "#99AAB5") {
  
  if (typeof path === "number") return path;
  if (typeof path === "string" && path.startsWith("#")) {
    
    return parseInt(path.replace("#", ""), 16);
  }
  const result = path
    .split(".")
    .reduce(
      (obj, key) => (obj && obj[key] !== undefined ? obj[key] : fallback),
      botConfig.embeds.colors,
    );
  
  if (typeof result === "string" && result.startsWith("#")) {
    return parseInt(result.replace("#", ""), 16);
  }
  return result;
}

export function getRandomColor() {
  const colors = Object.values(botConfig.embeds.colors).flatMap((color) =>
    typeof color === "string" ? color : Object.values(color),
  );
  return colors[Math.floor(Math.random() * colors.length)];
}

export default botConfig;
