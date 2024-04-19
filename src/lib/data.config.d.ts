declare global {
	interface DataConfig {
		sensors: (keyof Sensors)[];
		SN: string;
		SensorInfo: {
			[key in keyof Sensors]: {
				Unit: Unit;
			};
		};
	}
}
export {};
