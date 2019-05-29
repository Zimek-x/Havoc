import { Collection } from 'discord.js';

export default abstract class Store<K, V> extends Collection<K, V> {
	public disabled: Set<K> = new Set();

	public constructor() {
		super();
		this._load();
	}

	protected abstract _load(): Promise<void>;
}
