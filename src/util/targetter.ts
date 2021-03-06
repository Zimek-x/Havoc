import {
  MessageMentions,
  GuildMember,
  User,
  Role,
  GuildEmoji,
  GuildChannel,
} from 'discord.js';
import HavocMessage from '../structures/extensions/HavocMessage';
import Regex from './regex';
import HavocTextChannel from '../structures/extensions/HavocTextChannel';
import { Emoji, find } from 'node-emoji';
import Time from './time';
import { NOOP } from './CONSTANTS';

export enum Target {
  USER = 'user',
  MEMBER = 'member',
  CHANNEL = 'channel',
  ROLE = 'role',
  EMOJI = 'emoji',
  TEXT = 'text',
  NUMBER = 'number',
  TIME = 'time',
  FUNCTION = 'fn',
  OPTION = 'option',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TargetFn = (message: HavocMessage) => any;
export type TargetArr = string[];
export type TargetType = Target | TargetFn | TargetArr;
export type NotFound = null | undefined;
export type NotOther = Exclude<TargetType, TargetFn | TargetArr>;
export type ExcludedOther = Exclude<Target, 'fn' | 'option'>;
type MaybePromise<T> = T | Promise<T>;

export const isOther = (type: TargetType) =>
  typeof type === 'function' || Array.isArray(type);
export const resolveTargetKey = (type: TargetType) => {
  if (typeof type === 'function') return Target.FUNCTION;
  if (Array.isArray(type)) return Target.OPTION;
  return type;
};

export interface Targets {
  user: User;
  member: GuildMember;
  channel: GuildChannel | HavocTextChannel;
  role: Role;
  emoji: GuildEmoji | Emoji;
  number: number;
  text: string;
  time: number;
  option: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: any;
}

export const Targetter: {
  [target in Target]: {
    mentionOrIDSearch?(
      query: string | undefined,
      message: HavocMessage
    ): MaybePromise<Targets[target] | NotFound>;
    nameSearch?(
      query: string | undefined,
      message: HavocMessage
    ): MaybePromise<Targets[target] | NotFound>;
    get(
      message: HavocMessage,
      arg?: string,
      other?: TargetFn | TargetArr
    ): MaybePromise<Targets[target] | NotFound>;
  };
} = {
  [Target.USER]: {
    mentionOrIDSearch(query, message) {
      if (!query) return null;
      const [target] =
        query.match(
          `(${MessageMentions.USERS_PATTERN})|(${Regex.id.source})`
        ) ?? [];
      if (!target) return null;
      return message.client.users.fetch(target.match(/\d+/)![0]).catch(NOOP);
    },
    nameSearch(query, { guild }) {
      if (!guild || !query) return null;
      const findFn = (member: GuildMember) =>
        member.user.tag === query || member.user.username === query;
      return (
        guild.members.cache.find(findFn)?.user ||
        guild.members
          .fetch()
          .then(
            (members) =>
              members.find(
                (member) =>
                  findFn(member) || member.displayName.toLowerCase() === query
              )?.user
          )
          .catch(NOOP) ||
        null
      );
    },
    async get(message, query) {
      return message.shiftArg(
        (await this.mentionOrIDSearch!(message.arg || query, message)) ||
          (await this.nameSearch!(message.arg || query, message))
      );
    },
  },

  [Target.MEMBER]: {
    async get(message, query) {
      const user = message.shiftArg(
        (await Targetter.user!.mentionOrIDSearch!(
          message.arg || query,
          message
        )) || (await Targetter.user!.nameSearch!(message.arg || query, message))
      );
      return user ? message.guild!.members.fetch(user).catch(NOOP) : user;
    },
  },

  [Target.ROLE]: {
    mentionOrIDSearch(query, message) {
      if (!query) return null;
      const [target] =
        query.match(
          `(${MessageMentions.ROLES_PATTERN})|(${Regex.id.source})`
        ) ?? [];
      if (!target) return null;
      return message.guild?.roles.cache.get(target.match(/\d+/)![0]);
    },
    nameSearch(query, message) {
      if (!message.guild || !query) return null;
      return query
        .split(/ +/)
        .reduce(
          (
            foundRole: Role | null,
            _,
            i: number,
            arr: string[]
          ): Role | null => {
            if (foundRole) return foundRole;
            const possibleRoleName = arr.slice(0, i + 1).join(' ');
            const possibleRole = message.guild!.roles.cache.find(
              (role) =>
                role.name === possibleRoleName ||
                role.name.toLowerCase() === possibleRoleName.toLowerCase()
            );
            if (possibleRole) message.args.splice(0, i + 1);
            return possibleRole || foundRole;
          },
          null
        );
    },
    async get(message, query) {
      return (
        message.shiftArg(
          await this.mentionOrIDSearch!(query || message.content, message)
        ) || (await this.nameSearch!(query || message.content, message))
      );
    },
  },

  // TODO: Create a utility function for this
  [Target.CHANNEL]: {
    mentionOrIDSearch(query, message) {
      if (!query) return null;
      const [target] =
        query.match(
          `(${MessageMentions.CHANNELS_PATTERN})|(${Regex.id.source})`
        ) ?? [];
      if (!target) return null;
      return message.guild?.channels.cache.get(target.match(/\d+/)![0]);
    },
    nameSearch(query, { guild }) {
      if (!guild || !query) return null;
      return (
        guild.channels.cache.find(
          (role) =>
            role.name === query ||
            role.name.toLowerCase() === query.toLowerCase()
        ) || null
      );
    },
    async get(message, query) {
      return message.shiftArg(
        (await this.mentionOrIDSearch!(query || message.content, message)) ||
          (await this.nameSearch!(query || message.content, message))
      );
    },
  },

  [Target.TEXT]: {
    get(message) {
      return message.text;
    },
  },

  [Target.NUMBER]: {
    get(message) {
      return message.shiftArg(Number(message.arg) || null);
    },
  },

  [Target.TIME]: {
    get(message) {
      return message.shiftArg(Time.parse(message.arg!));
    },
  },

  [Target.EMOJI]: {
    get(message, query) {
      const arg = query || message.content;
      const [emojiID] =
        arg.match(`(${Regex.emoji})|(${Regex.id.source})`) ?? [];
      return message.guild?.emojis.cache.get(emojiID) || find(arg);
    },
  },

  [Target.FUNCTION]: {
    get(message, _, fn: TargetFn) {
      return fn!.call(message.client, message);
    },
  },

  [Target.OPTION]: {
    get(message, _, options: TargetArr) {
      const possibleOption = message.arg?.toLowerCase();
      if (!possibleOption) return;
      if (options.includes(possibleOption)) {
        return message.shiftArg(possibleOption);
      }
    },
  },
};

export async function resolveTarget(
  obj: { [key: string]: HavocMessage | Targets[keyof Targets] },
  target: TargetType,
  message: HavocMessage,
  query?: string
) {
  let found;
  if (Array.isArray(target)) {
    found = Targetter[Target.OPTION]!.get(message, '', target);
    obj[Target.OPTION] = found;
  } else if (typeof target === 'function') {
    found = await Targetter[Target.FUNCTION]!.get(message, '', target);
    obj[Target.FUNCTION] = found;
  } else {
    found = await Targetter[target]!.get(message, query);
    obj[target] = found;
  }
  return found;
}
