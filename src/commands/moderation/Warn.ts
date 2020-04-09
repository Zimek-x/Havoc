import Command from '../../structures/bases/Command';
import HavocMessage from '../../structures/extensions/HavocMessage';
import { Target } from '../../util/Targetter';
import Havoc from '../../client/Havoc';
import { GuildMember } from 'discord.js';
import GuildEntity from '../../structures/entities/GuildEntity';
import WarnEntity from '../../structures/entities/WarnEntity';
import Util from '../../util/Util';
import { getMuteRole } from './Mute';
import ms = require('ms');

export default class extends Command {
  constructor() {
    super(__filename, {
      description:
        'Warns the inputted members and takes action according to the set punishments.',
      args: [
        {
          required: true,
          type: Target.MEMBER,
          prompt:
            "mention the member / enter the member's ID, tag, nickname or username who you would like to warn."
        },
        {
          type: Target.TEXT
        }
      ],
      requiredPerms: ['MANAGE_ROLES', 'KICK_MEMBERS', 'BAN_MEMBERS']
    });
  }

  async run(
    this: Havoc,
    {
      message,
      member,
      text: reason
    }: {
      message: HavocMessage;
      member: GuildMember;
      text: string;
    }
  ) {
    if (member.id === message.author.id) {
      await message.react('463993771961483264');
      return message.channel.send('<:WaitWhat:463993771961483264>');
    }
    if (member.id === this.user!.id) {
      await message.react('😢');
      return message.channel.send('😢');
    }

    const response = message.member.can('warn', member);
    if (response) {
      await message.react('⛔');
      return message.respond(response);
    }

    const punishments = await this.db.guildRepo
      .findOne({ id: message.guild!.id }, { populate: ['warnPunishments'] })
      .then(guild => {
        if (!guild || !guild.warnPunishments.count())
          return new Map([
            [3, 'mute 1800000'],
            [5, 'kick'],
            [10, 'ban']
          ]);
        return guild.warnPunishments
          .getItems()
          .reduce(
            (map: Map<number, string>, p) =>
              map.set(
                p.amount,
                `${p.punishment}${p.duration ? ` ${p.duration}` : ''}`
              ),
            new Map()
          );
      });

    const guild = await this.db.findOrInsert(GuildEntity, message.guild!.id);
    const warns = await guild.warns.init();
    const existing = warns.getItems().find(({ id }) => id === member.id);
    const amount = (existing?.history.length || 0) + 1;
    const [action, time] = (punishments.get(amount) || '').split(' ');
    const warn = {
      at: new Date(),
      warner: message.author.id,
      reason
    };

    if (
      (action === 'kick' || action === 'ban') &&
      !(await message.confirmation(
        `warn \`${
          member.user.tag
        }\`, which will ${action} them (punishment for reaching their ${Util.ordinal(
          amount
        )} warning.`
      ))
    )
      return;

    if (existing) {
      existing.history.push(warn);
    } else {
      warns.add(
        new WarnEntity({
          id: member.id,
          history: [warn]
        })
      );
    }

    await this.db.flush();

    if (!action)
      return message.respond(
        `I have warned \`${member.user.tag}\`${
          reason ? ` for the reason \`${reason}\`` : ''
        }, this is their ${Util.ordinal(amount)} warning.`
      );

    const fullReason = `Punishment for reaching ${amount} warns (last warned by ${
      message.author.tag
    }${reason ? ` due to the reason: \`${reason}\`` : ''}).`;

    switch (action) {
      case 'mute': {
        const muteRole = await getMuteRole(message.guild!);
        if (!muteRole) return;
        await this.schedules.mute.start(message.guild!.id, {
          end: new Date(Date.now() + Number(time)),
          member: member.id,
          muter: message.author.id,
          reason: fullReason
        });
        await member.roles.add(muteRole, Util.auditClean(fullReason));
        return message.respond(
          `I have warned \`${member.user.tag}\`${
            reason ? ` for the reason \`${reason}\`` : ''
          } and muted them for ${ms(Number(time), {
            long: true
          })} as punishment for reaching ${amount} warns.`
        );
      }

      case 'kick':
        await member.kick(Util.auditClean(fullReason));
        return message.respond(
          `I have warned \`${member.user.tag}\`${
            reason ? ` for the reason \`${reason}\`` : ''
          } and kicked them as punishment for reaching ${amount} warns.`
        );

      case 'ban':
        await member.ban({ reason: Util.auditClean(reason), days: 7 });
        return message.respond(
          `I have warned \`${member.user.tag}\`${
            reason ? ` for the reason \`${reason}\`` : ''
          } and banned them as punishment for reaching ${amount} warns.`
        );
    }
  }
}