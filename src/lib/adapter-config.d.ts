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
/**
 * Represents a single air-Q device found during mDNS network discovery.
 *
 * Fields come from the mDNS TXT record that every air-Q device broadcasts
 * on the local network under service type _http._tcp.
 */
export interface DiscoveredDevice {
	/** Human-readable device name from mDNS TXT "devicename" property */
	name: string;
	/** Full unique device ID from mDNS TXT "id" property */
	id: string;
	/** First 5 characters of the ID — the "short ID" used in adapter config */
	shortId: string;
	/** IP address of the device on the local network */
	address: string;
}
