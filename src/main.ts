import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import bonjour, { BrowserConfig } from 'bonjour-service';
import * as dns from 'dns';
import { decrypt } from './decryptAES256';

class AirQ extends utils.Adapter {

	private _service: any;
	private _ip: string = '';
	private _sensorArray:string[] = [];
	private _id: string= '';
	private _password: string= '';
	private _deviceName: string = '';
	private _stateInterval: any;
	private _timeout: any;


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
		this.log.info('air-q adapter stopped...');
		this.clearInterval(this._stateInterval);
		this.clearTimeout(this._timeout);
	}

	private async onReady(): Promise<void> {
		if(this.config.password){

			this.clearSensors();
			this.setState('info.connection', { val: false, ack: true });

			try{
				this.password = this.config.password;
				await this.checkConnectIP();

			}catch(error){
				this.log.error(error);
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
					this.log.info('Air-q connected.');
				}
			});

			this._timeout= this.setTimeout(() => {
				findAirQ.stop();
				reject(new Error('Air-q not found in network'));
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
				this.log.info('Air-q connected.');
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
			['iaq_spec',       'ppb'],
			['resp_irr_spec',  'ppb'],
			['nh3_mr100',      'µg/m³'],
			['acid_m100',      'µg/m³'],
			['h2_m1000',       'µg/m³'],
			['no_m250',        'µg/m³'],
			['cl2_m20',        'µg/m³'],
			['ch2o_m10',       'µg/m³'],
			['ch2o_winsen',    'µg/m³'],
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

	private async getDataFromAirQ(): Promise<any> {
		try {
			const response = await axios.get(`http://${this.ip}/data`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as Sensors;
				return sensorsData;
			} else {
				throw new Error('Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.');
			}
		} catch(error){
			this.log.error('Error while getting data from air-q: ' + error +  '. Check if the device is in the correct network and reachable.');
			this.stop();
		}
	}

	private async getAverageDataFromAirQ(): Promise<any> {
		try {
			const response = await axios.get(`http://${this.ip}/average`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as Sensors;
				return sensorsData;
			} else {
				throw new Error('Decrypted data is undefined or not an object. Make sure your credentials are correct and have no typos.');
			}
		} catch (error) {
			this.log.error('Error while getting average data from air-q: ' + error +  '. Check if the device is in the correct network and reachable.');
			this.stop();
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

	private getRetrievalType(): string {
		return this.config.retrievalType;
	}

	private async setStates(): Promise<void> {
		try{
			this.getRetrievalType() === 'data'
				? await this.setSensorData()
				: await this.setSensorAverageData();
		}catch(error){
			this.log.error('Error while setting states: ' + error);
		}
	}

	private async setSensorData(): Promise<void> {
		try{
			const data = await this.getDataFromAirQ();
			for (const element of this.sensorArray) {
				if(this.config.rawData){
					const isNegative = this.checkNegativeValues(data, element);
					const cappedValue= isNegative? 0 : data[element][0];
					await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: cappedValue, ack: true});
				}else{
					await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: data[element][0], ack: true });
				}
			}
			this.setStateAsync('sensors.health', { val: data.health / 10, ack: true });
			this.setStateAsync('sensors.performance', { val: data.performance / 10, ack: true });
		}catch(error){
			this.log.error('Error while setting data from air-q: ' + error + '. Is one of the sensors not readable or in warm-up phase?');
		}
	}

	private async setSensorAverageData(): Promise<void> {
		try{
			const data = await this.getAverageDataFromAirQ();
			for (const element of this.sensorArray){
				if(this.config.rawData){
					const isNegative = this.checkNegativeValues(data, element);
					const cappedValue= isNegative? 0 : data[element][0];
					await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: cappedValue, ack: true});
				}else{
					await this.setStateAsync(this.replaceInvalidChars(`sensors.${element}`), { val: data[element][0], ack: true });
				}
			}
			this.setStateAsync('sensors.health', { val: data.health / 10, ack: true });
			this.setStateAsync('sensors.performance', { val: data.performance / 10, ack: true });
		}catch(error){
			this.log.error('Error while setting average data from air-q: ' + error + '. Is one of the sensors not readable or in warm-up phase?');
		}
	}

	private checkNegativeValues(data:Sensors, element:string): boolean {
		if(data[element][0]< 0 && element !== 'temperature'){
			return true;
		}else{
			return false;
		}
	}

	private replaceInvalidChars(name: string): string {
		return name.replace(this.FORBIDDEN_CHARS, '_');
	}

	private clearSensors(): void {
		this.getStatesOf('sensors', async (err, states) => {
			if (states) {
				for (const state of states) {
					this.delObject(state._id);
				}
			}else{
				this.log.error('Error while clearing sensors: ' + err);
			}
		});
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
