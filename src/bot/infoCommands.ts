import {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { COLOR } from "../config.js";
import {
  readPricingConfig,
  saveRolePlanPrices,
  savePrivateBotPricing,
  type RolePlanPrices,
} from "../storage/pricingConfig.js";

// ─── Static embeds ────────────────────────────────────────────────────────────

export function rulesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📜 Server Rules")
    .setColor(COLOR.red)
    .setDescription(
      "Please read and follow all rules. Failure to comply may result in a **mute, kick, or ban**.",
    )
    .addFields(
      { name: "1. Be Respectful", value: "Treat everyone with respect. No harassment, hate speech, or discrimination of any kind." },
      { name: "2. No Spam", value: "Do not spam messages, emojis, or commands. Keep conversations relevant to the channel." },
      { name: "3. No Advertising", value: "Do not advertise other servers, products, or services without staff approval." },
      { name: "4. Follow Discord TOS", value: "All members must follow [Discord's Terms of Service](https://discord.com/terms) and Community Guidelines." },
      { name: "5. Obey Staff", value: "Listen to and respect all staff decisions. If you disagree, open a ticket — do not argue publicly." },
      { name: "6. No Leaking", value: "Do not share private information, tokens, or internal tools outside of this server." },
      { name: "7. Use Channels Correctly", value: "Use each channel for its intended purpose. Read channel descriptions before posting." },
    )
    .setFooter({ text: "By being in this server you agree to follow these rules." })
    .setTimestamp();
}

export function tosEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📋 Terms of Service")
    .setColor(COLOR.blurple)
    .setDescription("By purchasing or using any Memberk service you agree to the following terms.")
    .addFields(
      { name: "🔒 No Chargebacks", value: "All sales are final. Chargebacks or payment disputes will result in a permanent ban and potential legal action." },
      { name: "🚫 No Refunds", value: "We do not offer refunds once a service has been delivered or activated." },
      { name: "⚠️ Account Responsibility", value: "You are responsible for keeping your Discord account secure. We are not liable for account losses." },
      { name: "🤝 Service Delivery", value: "Services are delivered as described. If something goes wrong, contact staff within 24 hours of purchase." },
      { name: "📵 Prohibited Use", value: "You may not resell, redistribute, or share Memberk tools without explicit written permission." },
      { name: "📝 Changes", value: "We reserve the right to update these terms at any time. Continued use of our services implies acceptance." },
    )
    .setFooter({ text: "Last updated • Memberk" })
    .setTimestamp();
}

export function infoEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("ℹ️ About Memberk")
    .setColor(COLOR.blurple)
    .setDescription(
      "**Memberk** is a premium Discord member farming & management service.\n\n" +
      "We help server owners grow their communities fast using our automated OAuth token system — " +
      "real accounts, real joins, no bots.",
    )
    .addFields(
      { name: "🚀 What We Offer", value: "• Mass member joining (`/djoin`)\n• Role-based access tiers\n• Private bot setups\n• OAuth token management\n• Gecko announcement system" },
      { name: "🔐 How It Works", value: "Members authorize via Discord OAuth, storing a real token. Owners can then mass-join those members into any server instantly." },
      { name: "🌐 Bots", value: "**Bot 1** — Main command bot\n**Bot 2** — Verification embed\n**Bot 3** — Joiner (silent, joins servers)" },
      { name: "📞 Support", value: "Open a ticket or DM staff for any issues, purchases, or questions." },
    )
    .setFooter({ text: "Memberk — Premium Member Farming" })
    .setTimestamp();
}

export function howtoEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📖 How to Use Memberk")
    .setColor(COLOR.green)
    .setDescription("Follow these steps to get your server members fast.")
    .addFields(
      { name: "Step 1 — Verify", value: "Click the **Verify** button in the verification channel to authorize your Discord account." },
      { name: "Step 2 — Authorize", value: "Click **Authorize** on the Discord OAuth page. You'll be redirected back to Discord automatically." },
      { name: "Step 3 — Invite Bot 3", value: "Make sure **Bot 3** (the joiner bot) is in the server you want members added to. Use `/add` to get the invite link." },
      { name: "Step 4 — Run /djoin", value: "Run `/djoin server_id:YOUR_SERVER_ID`. The bot will add all authenticated members to your server.\n\nTo find your server ID: right-click your server → **Copy Server ID**." },
      { name: "Step 5 — Check Results", value: "The bot will update the message live as it joins members, showing how many were added, skipped, or failed." },
      { name: "💡 Tips", value: "• Tokens are automatically recycled after each join — no need to re-auth\n• Higher role tiers = more members per `/djoin`\n• Use `/status` to check current stock count" },
    )
    .setFooter({ text: "Need help? Contact staff." })
    .setTimestamp();
}

export function paymentMethodsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("💳 Payment Methods")
    .setColor(COLOR.yellow)
    .setDescription("We accept the following payment methods. Contact staff to purchase.")
    .addFields(
      {
        name: "🎮 Robux",
        value:
          "Pay via **Roblox Robux** through a gamepass or group funds.\n" +
          "DM staff for the gamepass link.",
      },
      {
        name: "✨ Discord Nitro",
        value:
          "Gift us **Discord Nitro** or **Nitro Basic** as payment.\n" +
          "DM staff for the gifting instructions.",
      },
      {
        name: "💵 CashApp",
        value:
          "Send via **CashApp** — DM staff for the $cashtag.\n" +
          "⚠️ Friends & Family only — no payment requests.",
      },
      {
        name: "⚠️ Important",
        value:
          "• **All sales are final.** No refunds or chargebacks.\n" +
          "• Payment must be received before service is delivered.\n" +
          "• DM staff to initiate a purchase.",
      },
    )
    .setFooter({ text: "Memberk — Contact staff to pay" })
    .setTimestamp();
}

export function inviteRewardsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🎁 Invite Rewards")
    .setColor(COLOR.green)
    .setDescription(
      "Invite members to this server and earn **free role upgrades**!\n\n" +
      "Rewards are given manually by staff — DM a staff member with proof of your invite count.",
    )
    .addFields(
      { name: "🥉 Bronze", value: "**1 invite** → Bronze role (5 joins per `/djoin`)", inline: true },
      { name: "🥇 Gold", value: "**3 invites** → Gold role (10 joins per `/djoin`)", inline: true },
      { name: "💎 Premium", value: "**5 invites** → Premium role (15 joins per `/djoin`)", inline: true },
      { name: "💠 Diamond", value: "**10 invites** → Diamond role (20 joins per `/djoin`)", inline: true },
      { name: "💚 Emerald", value: "**20 invites** → Emerald role (30 joins per `/djoin`)", inline: true },
      { name: "📋 How to Claim", value: "1. Invite friends using your personal invite link\n2. DM staff with proof (screenshot of your invite count)\n3. Staff will upgrade your role within 24h" },
    )
    .setFooter({ text: "Invite counts are verified by staff." })
    .setTimestamp();
}

// ─── Role plans (modal + embed) ───────────────────────────────────────────────

export function rolePlansModal(): ModalBuilder {
  const make = (id: string, label: string, placeholder: string) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(40),
    );

  return new ModalBuilder()
    .setCustomId("info:role_plans_modal")
    .setTitle("Set Role Plan Prices")
    .addComponents(
      make("bronze",  "🥉 Bronze Price",  "e.g. $5/month"),
      make("gold",    "🥇 Gold Price",    "e.g. $10/month"),
      make("premium", "💎 Premium Price", "e.g. $15/month"),
      make("diamond", "💠 Diamond Price", "e.g. $20/month"),
      make("emerald", "💚 Emerald Price", "e.g. $30/month"),
    );
}

export function rolePlansEmbed(prices: RolePlanPrices): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🎭 Role Plans")
    .setColor(COLOR.yellow)
    .setDescription(
      "Purchase a role to increase how many members you can join per `/djoin` command.\n\n" +
      "Contact staff to purchase. Payment info: use `/payment_methods`.",
    )
    .addFields(
      { name: "🔓 No Role (Default)", value: "2 members per `/djoin` • **FREE**", inline: true },
      { name: "🥉 Bronze", value: `5 members per \`/djoin\` • **${prices.bronze}**`, inline: true },
      { name: "🥇 Gold", value: `10 members per \`/djoin\` • **${prices.gold}**`, inline: true },
      { name: "💎 Premium", value: `15 members per \`/djoin\` • **${prices.premium}**`, inline: true },
      { name: "💠 Diamond", value: `20 members per \`/djoin\` • **${prices.diamond}**`, inline: true },
      { name: "💚 Emerald", value: `30 members per \`/djoin\` • **${prices.emerald}**`, inline: true },
    )
    .setFooter({ text: "DM staff to purchase a plan • Memberk" })
    .setTimestamp();
}

// ─── Private bot (modal + embed) ─────────────────────────────────────────────

export function privateBotModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("info:private_bot_modal")
    .setTitle("Private Bot Listing")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("price")
          .setLabel("Setup Price")
          .setPlaceholder("e.g. $50 one-time")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(60),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("monthly")
          .setLabel("Monthly Hosting Fee (leave blank if none)")
          .setPlaceholder("e.g. $10/month • or leave blank")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(60),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("features")
          .setLabel("Features / What's Included")
          .setPlaceholder("Custom commands, 24/7 uptime, private stock, etc.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("contact")
          .setLabel("How to Purchase / Contact")
          .setPlaceholder("DM @username • or open a ticket")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
    );
}

export function privateBotEmbed(
  price: string,
  monthly: string,
  features: string,
  contact: string,
): EmbedBuilder {
  const priceField = monthly
    ? `${price} setup + ${monthly} hosting`
    : price;

  return new EmbedBuilder()
    .setTitle("🤖 Private Bot")
    .setColor(COLOR.blurple)
    .setDescription(
      "Get your own **private Memberk bot** — fully set up and hosted for you.\n\n" +
      "All the power of Memberk running exclusively for your server.",
    )
    .addFields(
      { name: "💰 Pricing", value: priceField },
      { name: "✅ What's Included", value: features },
      { name: "📞 How to Purchase", value: contact },
    )
    .setFooter({ text: "Memberk — Private Bot Service" })
    .setTimestamp();
}

// ─── Command handler ──────────────────────────────────────────────────────────

export async function handleInfoCommand(
  i: ChatInputCommandInteraction,
): Promise<void> {
  const cmd = i.commandName;

  if (cmd === "rules")           { await i.reply({ embeds: [rulesEmbed()] }); return; }
  if (cmd === "tos")             { await i.reply({ embeds: [tosEmbed()] }); return; }
  if (cmd === "info")            { await i.reply({ embeds: [infoEmbed()] }); return; }
  if (cmd === "howto")           { await i.reply({ embeds: [howtoEmbed()] }); return; }
  if (cmd === "payment_methods") { await i.reply({ embeds: [paymentMethodsEmbed()] }); return; }
  if (cmd === "invite_rewards")  { await i.reply({ embeds: [inviteRewardsEmbed()] }); return; }

  if (cmd === "role_plans") {
    const saved = readPricingConfig().rolePlans;
    if (saved) {
      // If prices already set, post the embed directly; owner can also re-run to update
      await i.showModal(rolePlansModal());
    } else {
      await i.showModal(rolePlansModal());
    }
    return;
  }

  if (cmd === "private_bot") {
    await i.showModal(privateBotModal());
    return;
  }
}

// ─── Free Bronze Role embed ───────────────────────────────────────────────────

export function freeBronzeRoleEmbed(inviteLink: string, roleId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🥉 Free Bronze Role")
    .setColor(0xcd7f32)
    .setDescription(
      `Want a **free Bronze role**? Just add our link to your Discord status and the bot will automatically give you <@&${roleId}>!`,
    )
    .addFields(
      {
        name: "📋 Step 1 — Copy this text",
        value: `\`\`\`${inviteLink}\`\`\``,
      },
      {
        name: "📱 Step 2 — Add it to your Discord status",
        value:
          "1. Click your **profile picture** (bottom-left)\n" +
          "2. Click **Set a custom status**\n" +
          "3. Paste the text and save",
      },
      {
        name: "✅ Step 3 — Get your role",
        value: `The bot will detect your status and give you <@&${roleId}> automatically within a few minutes.`,
      },
      {
        name: "⚠️ Keep it in your status",
        value: "If you remove the text from your status, the role will be removed too.",
      },
    )
    .setFooter({ text: "Memberk — Free Bronze Role" })
    .setTimestamp();
}

// ─── Modal submit handlers ────────────────────────────────────────────────────

export async function handleInfoModal(i: ModalSubmitInteraction): Promise<void> {
  if (i.customId === "info:role_plans_modal") {
    const prices: RolePlanPrices = {
      bronze:  i.fields.getTextInputValue("bronze"),
      gold:    i.fields.getTextInputValue("gold"),
      premium: i.fields.getTextInputValue("premium"),
      diamond: i.fields.getTextInputValue("diamond"),
      emerald: i.fields.getTextInputValue("emerald"),
    };
    saveRolePlanPrices(prices);
    await i.reply({ embeds: [rolePlansEmbed(prices)] });
    return;
  }

  if (i.customId === "info:private_bot_modal") {
    const price    = i.fields.getTextInputValue("price");
    const monthly  = i.fields.getTextInputValue("monthly");
    const features = i.fields.getTextInputValue("features");
    const contact  = i.fields.getTextInputValue("contact");
    savePrivateBotPricing({ price, monthly, features, contact });
    await i.reply({ embeds: [privateBotEmbed(price, monthly, features, contact)] });
    return;
  }
}
