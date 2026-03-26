/**
 * Tests for the air-Q mDNS discovery logic.
 *
 * We're testing tryParseAirQService() — the pure function that decides
 * whether a raw mDNS service is an air-Q device and extracts its info.
 *
 * Because it's a pure function (input in, output out, no side effects),
 * we don't need to mock anything. We just call it with different inputs
 * and check the outputs.
 */

import { expect } from 'chai';
import { tryParseAirQService } from './discovery';

describe('tryParseAirQService', () => {

	// ----- Happy path: valid air-Q devices -----

	it('should parse a fully populated air-Q service', () => {
		// This simulates what bonjour-service returns when it finds an air-Q.
		// The TXT record contains device="air-q", plus devicename and id.
		const service = {
			name: 'ABCDE_air-q',
			txt: {
				device: 'air-q',
				devicename: 'Living Room AirQ',
				id: 'ABCDE12345',
			},
			referer: { address: '192.168.1.42' },
		};

		const result = tryParseAirQService(service);

		expect(result).to.not.be.null;
		expect(result!.name).to.equal('Living Room AirQ');
		expect(result!.id).to.equal('ABCDE12345');
		expect(result!.shortId).to.equal('ABCDE');  // first 5 chars of id
		expect(result!.address).to.equal('192.168.1.42');
	});

	it('should be case-insensitive when matching device type', () => {
		// Some firmware versions might advertise "Air-Q" or "AIR-Q"
		const service = {
			name: 'test_air-q',
			txt: { device: 'Air-Q', devicename: 'Test', id: 'FGHIJ67890' },
			referer: { address: '10.0.0.5' },
		};

		const result = tryParseAirQService(service);
		expect(result).to.not.be.null;
		expect(result!.shortId).to.equal('FGHIJ');
	});

	it('should fall back to service.name when devicename is missing', () => {
		// Older firmware might not set the devicename TXT property
		const service = {
			name: 'XYZAB_air-q',
			txt: { device: 'air-q', id: 'XYZAB11111' },
			referer: { address: '192.168.1.99' },
		};

		const result = tryParseAirQService(service);
		expect(result).to.not.be.null;
		expect(result!.name).to.equal('XYZAB_air-q');  // falls back to mDNS service name
	});

	// ----- Edge cases: missing or partial data -----

	it('should return empty strings when id is missing', () => {
		// A device with very old firmware might not have an id property
		const service = {
			name: 'old_air-q',
			txt: { device: 'air-q' },
			referer: { address: '192.168.1.1' },
		};

		const result = tryParseAirQService(service);
		expect(result).to.not.be.null;
		expect(result!.id).to.equal('');
		expect(result!.shortId).to.equal('');  // substring(0,5) of '' is ''
	});

	it('should return empty address when referer is missing', () => {
		const service = {
			name: 'no_referer',
			txt: { device: 'air-q', id: 'AAAAA00000' },
			// no referer property at all
		};

		const result = tryParseAirQService(service);
		expect(result).to.not.be.null;
		expect(result!.address).to.equal('');
	});

	it('should return empty address when referer.address is missing', () => {
		const service = {
			name: 'empty_referer',
			txt: { device: 'air-q', id: 'BBBBB11111' },
			referer: {},  // referer exists but no address
		};

		const result = tryParseAirQService(service);
		expect(result).to.not.be.null;
		expect(result!.address).to.equal('');
	});

	// ----- Filtering: non-air-Q services should be rejected -----

	it('should return null for a non-air-Q HTTP service', () => {
		// This simulates a random HTTP device on the network (e.g. a printer)
		const service = {
			name: 'HP_Printer',
			txt: { device: 'printer', model: 'HP LaserJet' },
			referer: { address: '192.168.1.50' },
		};

		const result = tryParseAirQService(service);
		expect(result).to.be.null;
	});

	it('should return null when txt property is missing entirely', () => {
		// Some mDNS services have no TXT records at all
		const service = {
			name: 'some_service',
			referer: { address: '192.168.1.100' },
		};

		const result = tryParseAirQService(service);
		expect(result).to.be.null;
	});

	it('should return null when txt.device is not a string', () => {
		// Guard against unexpected data types
		const service = {
			name: 'weird_service',
			txt: { device: 123 as any },
			referer: { address: '192.168.1.200' },
		};

		const result = tryParseAirQService(service);
		expect(result).to.be.null;
	});

	it('should return null for an empty service object', () => {
		const result = tryParseAirQService({});
		expect(result).to.be.null;
	});

	it('should return null when device type is similar but not air-q', () => {
		// Make sure we don't accidentally match "air-quality" or "airq-clone"
		const service = {
			name: 'fake',
			txt: { device: 'air-quality-monitor' },
			referer: { address: '192.168.1.55' },
		};

		const result = tryParseAirQService(service);
		expect(result).to.be.null;
	});
});
