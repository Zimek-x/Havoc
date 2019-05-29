import Command from '../../structures/bases/Command';
import HavocMessage from '../../extensions/Message';
import HavocClient from '../../client/Havoc';

export default class Reload extends Command {
	public constructor() {
		super(__filename, {
			opts: 0b1011,
			description: 'Disables a command.',
			target: 'command',
			prompt: {
				initialMsg: ['enter the command name or an alias of the command.'],
				validateFn: (msg: HavocMessage, str: string): boolean => msg.client.commands.has(str),
				invalidResponseMsg: 'Command doesn\'t exist'
			}
		});
	}

	public async run(this: HavocClient, { msg, targetObj: { target } }: { msg: HavocMessage; targetObj: { target: Command } }) {
		const command = target;
		this.commands.disabled.add(command.name);
		msg.response = await msg.sendEmbed({
			setDescription: `**${msg.author.tag}** the command \`${command.name}\` been disabled.`
		});
	}
}