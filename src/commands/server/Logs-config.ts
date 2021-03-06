import Command from '../../structures/bases/Command';
import Havoc from '../../client/Havoc';
import HavocMessage from '../../structures/extensions/HavocMessage';
import { stripIndents } from 'common-tags';
import Util from '../../util';
import GuildEntity from '../../structures/entities/GuildEntity';
import { MIN_LIMITS, EMOJIS } from '../../util/CONSTANTS';

export default class extends Command {
  constructor() {
    super(__filename, {
      description: 'Configure logs for the server.',
      sub: true,
      requiredPerms: 'MANAGE_GUILD',
    });
  }

  async run(this: Havoc, { message }: { message: HavocMessage }) {
    if (!message.guild!.logs)
      return message.respond(
        `logs haven't been enabled on this server, you can do \`${message.prefix}logs enable\` to enable them`
      );

    const logEvents = [
      'channel creations',
      'channel deletions',
      'channel updates',
      'command usage',
      'emoji creations',
      'emoji deletions',
      'emoji updates',
      'server updates',
      'member bans',
      'member joins',
      'member leaves',
      'member unbans',
      'member updates',
      'message clears',
      'message edits',
      'messages deletions',
      'role creations',
      'role deletions',
      'role updates',
      'voice channel updates',
    ];

    const buildEmbed = () =>
      message.constructEmbed({
        addFields: logEvents.map((event, i) => ({
          name: `\`${i + 1}\`) ${Util.captialise(event)}`,
          value: message.guild!.logs!.disabled.includes(i)
            ? `${EMOJIS.DISABLED} Off`
            : `${EMOJIS.ENABLED} On`,
          inline: true,
        })),
      });
    const prompt = (await message.channel.send(
      stripIndents`**${message.author}** enter the number according to the action you would like to enable/disable.
                  E.g: if \`Channel creations\` is \`On\` and you would like to disable it enter \`channel creations\` or \`1\`.
                  Enter \`cancel\` to cancel this command and enter \`done\` if you have finished using this command.`,
      buildEmbed()
    )) as HavocMessage;
    await prompt.safeReact(EMOJIS.IN_PROGRESS);
    // @ts-ignore
    message.channel.prompts.add(message.author.id);

    let countdown = 60;
    const editInterval = this.setInterval(async () => {
      if (!countdown) return this.clearInterval(editInterval);
      if (!prompt.deleted)
        await prompt.edit(
          prompt.embeds[0].setFooter(
            `You have ${(countdown -= 5)} seconds left to enter an option.`
          )
        );
    }, 5000);

    const collector = message.channel.createMessageCollector(
      (msg) => msg.author.id === message.author.id,
      { time: 60000 }
    );

    collector
      .on('collect', async (message: HavocMessage) => {
        const option = message.content.toLowerCase();
        if (option === 'cancel' || option === 'done')
          return collector.stop(option);

        const selected = Number(option) - 1 || logEvents.indexOf(option);
        await message.delete();

        if (
          selected < MIN_LIMITS.LOGS_CONFIG_OPTION ||
          selected >= logEvents.length
        )
          return message
            .respond(
              `you have entered an invalid type of log type, you need to either enter the type itself or the according number
              E.g: if \`Channel creations\` is \`On\` and you would like to disable it enter \`channel creations\` or \`1\``
            )
            .then((msg) => msg.delete({ timeout: 5000 }));

        const currentlyDisabled = message.guild!.logs!.disabled;
        const selectedIndex = currentlyDisabled.indexOf(selected);
        if (selectedIndex !== -1) currentlyDisabled.splice(selectedIndex, 1);
        else currentlyDisabled.push(selected);
        await this.db.upsert(GuildEntity, message.guild!.id, {
          logs: message.guild!.logs,
        });

        await prompt.edit(
          buildEmbed().setFooter(prompt.embeds[0].footer?.text)
        );
        await message
          .respond(
            `I have ${
              selectedIndex === -1 ? 'disabled' : 'enabled'
            } logs for \`${Util.captialise(logEvents[selected])}\``
          )
          .then((msg) => msg.delete({ timeout: 3000 }));
      })

      .on('end', async (_, reason) => {
        let footer;
        let emoji;
        // @ts-ignore
        message.channel.prompts.delete(message.author.id);
        this.clearInterval(editInterval);
        await prompt.reactions.removeAll();

        switch (reason) {
          case 'time':
            await message
              .respond(`60 seconds is over.`)
              .then((msg) => msg.delete({ timeout: 3000 }));
            footer = 'timed out.';
            emoji = EMOJIS.TIMED_OUT;
            break;
          case 'cancel':
            footer = 'was cancelled.';
            emoji = EMOJIS.CANCELLED;
            break;
          default:
            footer = 'has been executed.';
            emoji = EMOJIS.TICK;
            break;
        }

        if (!prompt.deleted) {
          await prompt.edit(
            message.author.toString(),
            prompt.embeds[0].setFooter(`Command ${footer}`)
          );
          prompt.safeReact(emoji);
        }
      });
  }
}
