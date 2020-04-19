import * as dotenv from 'dotenv';
import HavoClient from './client/Havoc';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Structures } from 'discord.js';

dotenv.config();

const extensionsDir = join(__dirname, 'structures', 'extensions');
fs.readdir(extensionsDir).then(structures => {
  structures.forEach(struct =>
    Structures.extend(
      struct.match(/Havoc([a-z]+).js/i)![1],
      () => require(join(extensionsDir, struct)).default
    )
  );
  const Havoc = new HavoClient();
  Havoc.login(process.env.TOKEN);
});
