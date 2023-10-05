declare global {
	interface DataConfig {
		sensors: (keyof Sensors)[];
	}
}
export {};
