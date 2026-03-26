import type { DiscoveredDevice } from './lib/adapter-config';

/**
 * Checks whether a raw mDNS service is an air-Q device and, if so,
 * maps it to a DiscoveredDevice object.
 *
 * How air-Q devices advertise themselves via mDNS:
 * - Service type: _http._tcp
 * - TXT record properties:
 *     device: "air-q"        — identifies the device type
 *     devicename: "My AirQ"  — human-readable name set by the user
 *     id: "ABCDE12345"       — unique device ID (first 5 chars = shortId)
 *
 * This is a pure function (no side effects) so it's easy to unit-test.
 *
 * @param service - A raw service object from bonjour-service's find() callback.
 *                  We only use .txt, .name, and .referer.address from it.
 * @returns A DiscoveredDevice if the service is an air-Q, or null if not
 */
export function tryParseAirQService(service: {
	name?: string;
	txt?: Record<string, string>;
	referer?: { address?: string };
}): DiscoveredDevice | null {
	// The key check: air-Q devices set txt.device to "air-q"
	const txtDevice = service.txt?.device;
	if (typeof txtDevice !== 'string' || txtDevice.toLowerCase() !== 'air-q') {
		return null; // Not an air-Q device — ignore it
	}

	const deviceId = service.txt?.id || '';
	return {
		name: service.txt?.devicename || service.name || '',
		id: deviceId,
		shortId: deviceId.substring(0, 5),
		address: service.referer?.address || '',
	};
}
