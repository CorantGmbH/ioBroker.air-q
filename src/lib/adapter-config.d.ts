// This file extends the AdapterConfig type from "@types/iobroker"

export type DataRoute = 'data' | 'average';

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			shortId: string;
			password: string;
			retrievalRate: number;
			retrievalType: DataRoute;
			clipNegativeValues: boolean;
			connectViaIP:boolean;
			deviceIP: string;
			respectNightMode: boolean;
		}
	}
}
export {};
