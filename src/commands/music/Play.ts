import Command from '../../structures/bases/Command';
import HavocMessage from '../../structures/extensions/HavocMessage';
import { Target } from '../../util/targetter';
import * as ytdl from 'ytdl-core';
import { MAX_LIMITS, PROMPT_INVALD, PROMPT_ENTER } from '../../util/CONSTANTS';

export default class extends Command {
  constructor() {
    super(__filename, {
      description: 'Plays the inputted song url.',
      args: {
        name: 'url',
        type: Target.TEXT,
        required: true,
        promptOpts: {
          initial: PROMPT_ENTER('the song you would like to play'),
          invalid: PROMPT_INVALD("the song's name or a URL"),
        },
      },
    });
  }

  async run({ message, text: url }: { message: HavocMessage; text: string }) {
    if (!message.member!.voice.channel)
      return message.respond(
        `you need to be in a voice channel to use this command.`
      );

    await message.channel.send(
      `
			${message.author}\nɴᴏᴡ ᴘʟᴀʏɪɴɢ: \`${url.substring(0, 32)}${
        url.length > MAX_LIMITS.PLAY_URL ? '...' : ''
        /* eslint-disable no-irregular-whitespace */
      }\`
			:white_circle:───────────────────────────────────────────
			◄◄⠀▐▐ ⠀►►⠀⠀　　⠀ 0:00 / 1:37　　⠀ ───○ :loud_sound:⠀　　　ᴴᴰ :gear: ❐ ⊏⊐
		`,
      { disableMentions: 'everyone' }
    );
    const connection = await message.member!.voice.channel.join();
    connection
      .play(
        ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
          filter: 'audioonly',
        })
      )
      .on('finish', () => message.guild!.voice?.channel?.leave());
  }
}
