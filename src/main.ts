import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import bonjour, { BrowserConfig } from 'bonjour-service';
import * as dns from 'dns';
import { decrypt } from './decryptAES256';
import type { DataRoute } from './lib/adapter-config';

interface NightModeConfig {
	Activated: boolean;        // Is night mode turned on?
	StartDay: string;          // UTC time when day starts, e.g., "05:00"
	StartNight: string;        // UTC time when night starts, e.g., "21:00"
	WifiNightOff: boolean;     // Does the device turn off WiFi at night?
}

class AirQ extends utils.Adapter {

	private _service: any;
	private _ip: string = '';
	private _sensorArray:string[] = [];
	private _id: string= '';
	private _password: string= '';
	private _deviceName: string = '';
	private _stateInterval: any;
	private _timeout: any;
	private readonly _specialSensors: string[] = ['health', 'performance'];
	private _nightModeConfig: NightModeConfig | null = null;
	private _lastNightModeCheck: number = 0;
	private readonly _nightModeRefreshInterval: number = 3600000; // 1 hour in milliseconds


	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'air-q',
		});
		axios.defaults.timeout = 4000;
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private onUnload(): void {
		this.log.info('air-Q adapter stopped...');
		this.clearInterval(this._stateInterval);
		this.clearTimeout(this._timeout);
	}

	private async onReady(): Promise<void> {
		if(this.config.password){

			this.setState('info.connection', { val: false, ack: true });

			try{
				this.password = this.config.password;
				await this.checkConnectIP();

			}catch(error){
				this.log.error(error);
			}

			// Fetch night mode configuration if feature is enabled
			if (this.config.respectNightMode) {
				this.log.info('Fetching night mode configuration from device');
				await this.fetchAndCacheNightMode();
			} else {
				this.log.info('Night mode is being ignored (respectNightMode setting disabled)');
			}

			await this.setObjectNotExistsAsync(`sensors.health`, {
				type: 'state',
				common: {
					name: 'health',
					type: 'number',
					role: 'value',
					unit:  this.getUnit('health'),
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`sensors.performance`, {
				type: 'state',
				common: {
					name: 'performance',
					type: 'number',
					role: 'value',
					unit: this.getUnit('performance'),
					read: true,
					write: false,
				},
				native: {},
			});

			this.sensorArray = await this.getSensorsInDevice();
			this.clearObsoleteSensors();
			try{
				for (const element of this.sensorArray) {
					await this.setObjectNotExistsAsync(this.replaceInvalidChars(`sensors.${element}`), {
						type: 'state',
						common: {
							name: element,
							type: 'number',
							role: this.setRole(element),
							unit: this.getUnit(element),
							read: true,
							write: false,
						},
						native: {},
					});

				}
			}catch(error){
				this.log.error('Error while iterating through the sensors: ' + error + '. Possible reasons might be false credentials or your ioBroker system is not connected to the same network as the air-Q device. Please check again.');
			}

			this.extendObject('sensors', { common: { name: this.deviceName } });

			this._stateInterval = this.setInterval(async () => {
				await this.setStates();
			}, this.retrievalRate * 1000);
		}
	}

	private setRole(element: string): string {
		switch (element) {
			case 'temperature':
				return 'value.temperature';
			case 'dewpt':
				return 'value.temperature';
			case 'humidity':
				return 'value.humidity';
			case 'pressure':
				return 'level.pressure';
			case 'co2':
				return 'value.co2';
			default:
				return 'value';
		}
	}

	private async checkConnectIP(): Promise<void> {
		try{
			if(this.config.connectViaIP){
				this.service= '';
				this.isValidIP(this.config.deviceIP);
				this.id = await this.getShortId()
				this.deviceName = this.id.concat('_air-q');
			}else{
				this.id = this.config.shortId;
				this.deviceName = this.id.concat('_air-q');
				this.service = await this.findAirQInNetwork();
				this.ip= await this.getIp();
			}
		}catch(error){
			throw error;
		}
	}

	private isValidIP(ip: string): void {
		const ip4Address = /^(\d{1,3}\.){3}\d{1,3}$/;
		const valid = ip4Address.test(ip);
		if (valid){
			this.ip = this.config.deviceIP;
		}else{
			throw new Error('IP is not valid. Please check your IP address.');
		}
	}

	private async findAirQInNetwork(): Promise<any> {
		return new Promise((resolve, reject) => {
			const instance = new bonjour();
			const config: BrowserConfig = { type: 'http' };

			const findAirQ = instance.find(config, (service) => {
				if (service.name === this.deviceName) {
					findAirQ.stop();
					this.setState('info.connection', { val: true, ack: true });
					resolve(service);
					this.log.info('air-Q connected.');
				}
			});

			this._timeout= this.setTimeout(() => {
				findAirQ.stop();
				reject(new Error('air-Q not found in network'));
			}, 50000);
		});
	}

	private async getShortId(): Promise<string> {
		try{
			const response = await axios.get(`http://${this.ip}/config`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as DataConfig;
				const serial = sensorsData.SN;
				const shortID = serial.slice(0,5);
				this.setState('info.connection', { val: true, ack: true });
				this.log.info('air-Q connected.');
				return shortID;

			}
		}
		catch(error){
			throw error;
		}
	}

	private getUnit(sensorName: string): Unit {
		const sensorUnitMap = new Map<string, string>([
			['health',        '%'],
			['performance',    '%'],
			['virus',         '%'],
			['co',             'mg/m³'],
			['co2',            'ppm'],
			['no2',            'µg/m³'],
			['so2',            'µg/m³'],
			['o3',             'µg/m³'],
			['temperature',    '°C'],
			['humidity',       '%'],
			['humidity_abs',   'g/m³'],
			['dewpt',          '°C'],
			['pm1',            'µg/m³'],
			['pm2_5',          'µg/m³'],
			['pm10',           'µg/m³'],
			['typps',          'µm'],
			['sound',          'db(A)'],
			['sound_max',      'db(A)'],
			['tvoc',           'ppb'],
			['pressure',       'hPa'],
			['h2s',            'µg/m³'],
			['ch4_mipex',      'µg/m³'],
			['c3h8_mipex',     'µg/m³'],
			['tvoc_ionsc',     'ppb'],
			['radon',          'Bq/m³'],
			['no2_insplorion', 'µg/m³'],
			['ethanol',        'µg/m³'],
			['nh3_mr100',      'µg/m³'],
			['acid_m100',      'µg/m³'],
			['h2_m1000',       'µg/m³'],
			['no_m250',        'µg/m³'],
			['cl2_m20',        'µg/m³'],
			['ch2o_m10',       'µg/m³'],
			['pm1_sps30',      'µg/m³'],
			['pm2_5_sps30',    'µg/m³'],
			['pm10_sps30',     'µg/m³'],
		]);
		return sensorUnitMap.get(sensorName) as Unit;
	}

	private async getIp(): Promise<string> {
		try{
			return new Promise<string>((resolve, reject) => {
				dns.lookup(this.service.name, 4, (err, address) => {
					if (err) {
						reject(err);
					} else {
						resolve(address);
					}
				});
			});
		}catch(error){
			this.log.error('Cannot seem to find IP address: ' + error);
			this.stop();
		}
	}

	private async getDataFromAirQ(route: DataRoute): Promise<DeviceDataResponse | undefined> {
		try {
			const response = await axios.get(`http://${this.ip}/${route}`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const deviceData = decryptedData as DeviceDataResponse;
				return deviceData;
			} else {
				throw new Error('Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.');
			}
		} catch(error){
			this.log.error('Error while getting data from air-Q: ' + error +  '. Check if the device is in the correct network and reachable.');
			this.stop();
			return undefined;
		}
	}

	private async getSensorsInDevice(): Promise<string[]> {
		try {
			const response = await axios.get(`http://${this.ip}/config`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as DataConfig;
				const sensors = this.checkParticulates(sensorsData.sensors);
				return sensors;
			} else {
				throw new Error('Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.');
			}
		} catch (error) {
			this.log.error('Error while getting sensors from device: ' + error);
			this.stop();
		}
	}

	private checkParticulates(data:string[]): string[]{
		if (data.includes('particulates')){
			const pm=['pm1','pm2_5','pm10'];
			const index = data.indexOf('particulates');
			data.splice(index, 1);
			data.splice(index, 0, ...pm);
			return data;
		}else{
			return data;
		}
	}

	private getRetrievalType(): DataRoute {
		return this.config.retrievalType;
	}

	private async setStates(): Promise<void> {
		try{
			// Check if we should skip this poll due to night mode
			if (this.isInNightMode()) {
				// We're in night mode and WiFi is off, so skip this poll
				this.log.debug('Skipping poll - device is in night mode with WiFi disabled');
				return;  // Exit early, don't try to connect
			}

			// If we're not in night mode, check if we should refresh the config
			await this.refreshNightModeIfNeeded();

			// Continue with normal polling
			const data = await this.getDataFromAirQ(this.getRetrievalType());
			if (!data) {
				this.log.error('No data returned from getDataFromAirQ()');
				return;
			}
			this.log.silly(`Received from device: ${JSON.stringify(data, null, 2)}`)
			// Assign polled values to sensors
			await this.setSensors(data);
		}catch(error){
			this.log.error('Error while setting states: ' + error);
		}
	}

	private async setSensors(data: DeviceDataResponse): Promise<void> {
		try{
			for (const element of this.sensorArray) {
				let value: number | null = null;
				if (!data[element]) {
					const statusMsg = data.Status?.[element]
						? ` Status: ${data.Status[element]}`
						: '';
					this.log.warn(`Sensor '${element}' not found in device response - skipping.${statusMsg}`);
				} else if(this.config.clipNegativeValues){
					const isNegative = this.checkNegativeValues(data, element);
					value = isNegative? 0 : data[element][0];
				}else{
					value = data[element][0];
				}
				await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: value, ack: true});
			}
			for (const element of this._specialSensors) {
				const value = data[element] / 10
				await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: value, ack: true});
			}
		}catch(error){
			this.log.error('Error while setting data from air-Q: ' + error + '. Is one of the sensors not readable or in warm-up phase?');
		}
	}

	private checkNegativeValues(data:Sensors, element:string): boolean {
		if(data[element][0]< 0 && element !== 'temperature'){
			return true;
		}else{
			return false;
		}
	}

	/**
	 * Creates a Date object for today at the specified UTC time
	 * The Date object will automatically represent the time in local timezone
	 *
	 * @param utcTimeStr - Time in UTC format "HH:MM"
	 * @returns Date object in local timezone
	 */
	private createUTCTimeToday(utcTimeStr: string): Date {
		const [hours, minutes] = utcTimeStr.split(':').map(num => parseInt(num, 10));

		// Create a date with today's date at the specified UTC time
		const date = new Date();
		date.setUTCHours(hours, minutes, 0, 0);

		return date;
	}

	/**
	 * Checks if the current time falls within the night mode period
	 * Returns true if we should skip polling (because WiFi is off)
	 */
	private isInNightMode(): boolean {
		// First, check if the user wants us to respect night mode at all
		if (!this.config.respectNightMode) {
			return false;  // User disabled this feature, so never skip
		}

		// Check if we have night mode config loaded
		if (!this._nightModeConfig) {
			return false;  // No config yet, so don't skip
		}

		// Extract the settings from the config
		const { Activated, StartNight, StartDay, WifiNightOff } = this._nightModeConfig;

		// Check if night mode is actually active and WiFi turns off
		if (!Activated || !WifiNightOff) {
			return false;  // Night mode not active or WiFi stays on
		}

		// Get current time
		const now = new Date();

		// Create Date objects for night start and day start (in UTC)
		const nightStart = this.createUTCTimeToday(StartNight);
		const dayStart = this.createUTCTimeToday(StartDay);

		this.log.debug(
			`WiFi is off due to night mode between ${nightStart.toLocaleTimeString()} and ${dayStart.toLocaleTimeString()} today`
		);

		// Both dates are set to today, so we compare just the times
		if (nightStart < dayStart) {
			// Night period is within the same day (e.g., 02:00 to 06:00)
			return now >= nightStart && now <= dayStart;
		} else {
			// Night period crosses midnight (e.g., 22:00 to 06:00)
			// We're in night mode if it's either before day start (< 06:00) OR after night start (>= 22:00)
			return now <= dayStart || now >= nightStart;
		}
		// Note: I use >= and <= above to avoid a rounding error when the device has not
		// come back from the night mode yet, but ioBroker already polls it
	}

	/**
	 * Fetches the night mode configuration from the device and caches it
	 */
	private async fetchAndCacheNightMode(): Promise<void> {
		try {
			// Make HTTP request to get device configuration
			const response = await axios.get(`http://${this.ip}/config`, { responseType: 'json' });

			// Get the encrypted content
			const data = response.data.content;

			// Decrypt the data using our password
			const decryptedData = decrypt(data, this.password) as any;

			// Check if the decrypted data contains NightMode information
			if (decryptedData && decryptedData.NightMode) {
				// Store the night mode configuration
				this._nightModeConfig = decryptedData.NightMode as NightModeConfig;

				// Remember when we fetched this
				this._lastNightModeCheck = Date.now();

				// Log what we found
				this.log.info(
					`Night mode config cached: Activated=${this._nightModeConfig.Activated}, ` +
					`StartNight=${this._nightModeConfig.StartNight} UTC, ` +
					`StartDay=${this._nightModeConfig.StartDay} UTC, ` +
					`WifiNightOff=${this._nightModeConfig.WifiNightOff}`
				);
			} else {
				// Device doesn't have NightMode data (maybe older firmware?)
				this.log.debug('No NightMode configuration found in device config');
			}
		} catch (error) {
			// If we can't fetch the config, just log a warning and continue
			// (This might happen if the device is currently in night mode!)
			this.log.warn(`Could not fetch night mode config: ${error}`);
		}
	}

	/**
	 * Checks if it's time to refresh the night mode config and does so if needed
	 */
	private async refreshNightModeIfNeeded(): Promise<void> {
		// Only refresh if we're NOT currently in night mode
		// (because if we are, the device might not respond)
		if (this.isInNightMode()) {
			return;  // Skip refresh during night mode
		}

		// Check if enough time has passed since last check
		const timeSinceLastCheck = Date.now() - this._lastNightModeCheck;

		if (timeSinceLastCheck > this._nightModeRefreshInterval) {
			// It's been more than an hour, let's refresh
			this.log.debug('Refreshing night mode configuration');
			await this.fetchAndCacheNightMode();
		}
	}

	private replaceInvalidChars(name: string): string {
		return name.replace(this.FORBIDDEN_CHARS, '_');
	}

	private async clearObsoleteSensors(): Promise<void> {
		try {
			// Get all existing sensor states under 'sensors' channel
			const existingStates = await this.getStatesOfAsync('sensors');
			this.log.debug(`Existing states retrieved: ${existingStates ? existingStates.length : 0}`);

			// Log the existingStates array
			if (existingStates && existingStates.length > 0) {
				this.log.silly(`existingStates: ${JSON.stringify(existingStates, null, 2)}`);

				// Extract sensor IDs from existing states
				const existingSensorIds = existingStates.map(state =>
					state._id.replace(`${this.namespace}.sensors.`, '')
				);
				this.log.silly(`existingSensorIds: ${JSON.stringify(existingSensorIds)}`);

				// Combine sensorArray and specialSensors to create a list of valid sensors
				const validSensors = this.sensorArray.concat(this._specialSensors);
				this.log.silly(`Valid sensors (sensorArray + specialSensors): ${JSON.stringify(validSensors)}`);

				// Identify obsolete sensors (those not in sensorArray)
				const obsoleteSensors = existingSensorIds.filter(
					id => !validSensors.includes(id)
				);
				this.log.silly(`obsoleteSensors: ${JSON.stringify(obsoleteSensors)}`);

				// Log current sensorArray for comparison
				this.log.silly(`Current sensorArray: ${JSON.stringify(this.sensorArray)}`);

				// Delete only obsolete sensors
				for (const sensorId of obsoleteSensors) {
					const fullId = `sensors.${sensorId}`;
					await this.delObjectAsync(fullId);
					this.log.info(`Deleted obsolete sensor: ${fullId}`);
				}
			} else {
				this.log.debug('No existing sensor states found.');
			}
		} catch (err) {
			this.log.error('Error while clearing obsolete sensors: ' + err);
		}
	}

	set service(value: any) {
		this._service = value;
	}

	get service(): any {
		return this._service;
	}

	set ip(value: string) {
		this._ip = value;
	}

	get ip(): string {
		return this._ip;
	}

	set sensorArray(value: string[]) {
		this._sensorArray = value;
	}

	get sensorArray(): string[] {
		return this._sensorArray;
	}

	set id(value: string) {
		this._id = value;
	}

	get id(): string {
		return this._id;
	}

	set password(value: string) {
		this._password = value;
	}

	get password(): string {
		return this._password;
	}

	set deviceName(value: string) {
		this._deviceName = value;
	}

	get deviceName(): string {
		return this._deviceName;
	}

	get retrievalRate(): number {

		if(this.config.retrievalRate > 3600){
			return 3600;
		}else if(this.config.retrievalRate < 2){
			return 2;
		}else{
			return this.config.retrievalRate;
		}
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AirQ(options);
} else {
	(() => new AirQ())();
}
