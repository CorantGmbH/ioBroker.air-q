// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			shortId: string;
			password: string;
			enabled: {
				healthEnabled: boolean;
				performanceEnabled: boolean;
				temperatureEnabled: boolean;
				humidityEnabled: boolean;
				humidityabsEnabled: boolean;
				dewptEnabled: boolean;
				coEnabled: boolean;
				co2Enabled: boolean;
				no2Enabled: boolean;
				o3Enabled: boolean;
				so2Enabled: boolean;
				pmEnabled: boolean;
				h2sEnabled: boolean;
				vocEnabled: boolean;
				ch2oEnabled: boolean;
				ch4Enabled: boolean;
				nh3Enabled: boolean;
				cl2Enabled: boolean;
				h2Enabled: boolean;
				c3h8Enabled: boolean;
				n2oEnabled: boolean;
				pressureEnabled: boolean;
				pressureRelEnabled: boolean;
				noiseEnabled: boolean;
			};
			retrievalRate: number;
			retrievalType: string;
		}
	}
}
export {};