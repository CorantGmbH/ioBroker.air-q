declare global {
	interface DataConfig {
		sensors: (keyof Sensors)[];
		SN: string;
	}
}
export {};
