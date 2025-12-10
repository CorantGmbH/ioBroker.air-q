// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			shortId: string;
			password: string;
			retrievalRate: number;
			retrievalType: string;
			rawData: boolean;
			connectViaIP:boolean;
			deviceIP: string;
			respectNightMode: boolean;
		}
	}
}
export {};
